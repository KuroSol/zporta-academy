# intelligence/models.py
"""
AI Intelligence & Ranking System Models

This module contains models for:
- User ability profiling and ranking
- Content difficulty scoring
- User-content match scoring for personalized recommendations
- Cached recommendations for fast feed generation

All heavy ML computations are done offline via management commands.
These models store precomputed results for fast API lookups.
"""

import logging
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils import timezone

logger = logging.getLogger(__name__)


class UserAbilityProfile(models.Model):
    """
    Stores computed ability estimates for each user.
    
    Ability scores use an ELO-style rating (0-1000 scale):
    - 0-300: Beginner
    - 300-500: Intermediate
    - 500-700: Advanced
    - 700-1000: Expert
    
    Computed offline by management command: compute_user_abilities
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ability_profile',
        db_index=True
    )
    
    # Overall ability score (ELO-style, 0-1000)
    overall_ability_score = models.FloatField(
        default=400.0,
        db_index=True,
        help_text="Overall ability rating (0-1000 scale, higher = more advanced)"
    )
    
    # Subject-specific ability scores
    ability_by_subject = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dict mapping subject_id to ability score: {1: 450.0, 2: 520.0}"
    )
    
    # Tag-specific ability scores (optional, for granular tracking)
    ability_by_tag = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dict mapping tag_name to ability score: {'algebra': 480.0}"
    )
    
    # Performance metrics
    total_quizzes_attempted = models.IntegerField(
        default=0,
        help_text="Total number of quizzes attempted (for confidence weighting)"
    )
    
    total_correct_answers = models.IntegerField(
        default=0,
        help_text="Total correct answers across all quizzes"
    )
    
    recent_performance_trend = models.FloatField(
        default=0.0,
        help_text="30-day weighted performance trend (0-100%, higher = improving)"
    )
    
    # Ranking information
    global_rank = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="User's rank among all users (1 = highest ability)"
    )
    
    percentile = models.FloatField(
        null=True,
        blank=True,
        help_text="User's percentile (0-100, higher = better than more users)"
    )
    
    # Computation metadata
    last_computed_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="When this profile was last updated"
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata: model_version, feature_importance, etc."
    )
    
    class Meta:
        verbose_name = "User Ability Profile"
        verbose_name_plural = "User Ability Profiles"
        ordering = ['-overall_ability_score']
        indexes = [
            models.Index(fields=['overall_ability_score', '-last_computed_at']),
            models.Index(fields=['global_rank']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - Ability: {self.overall_ability_score:.1f} (Rank: {self.global_rank or 'N/A'})"
    
    def get_ability_level(self):
        """Return human-readable ability level."""
        score = self.overall_ability_score
        if score < 300:
            return "Beginner"
        elif score < 500:
            return "Intermediate"
        elif score < 700:
            return "Advanced"
        else:
            return "Expert"
    
    def get_subject_ability(self, subject_id):
        """Get ability score for a specific subject, fallback to overall."""
        return self.ability_by_subject.get(str(subject_id), self.overall_ability_score)


class ContentDifficultyProfile(models.Model):
    """
    Stores computed difficulty scores for quizzes and questions.
    
    Difficulty scores use same scale as ability (0-1000):
    - 0-300: Easy
    - 300-500: Medium
    - 500-700: Hard
    - 700-1000: Expert
    
    Computed offline by management command: compute_content_difficulty
    """
    # Generic FK to Quiz or Question
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        help_text="Type of content (Quiz or Question)"
    )
    object_id = models.PositiveIntegerField(
        help_text="ID of the Quiz or Question"
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Computed difficulty score (0-1000, matches ability scale)
    computed_difficulty_score = models.FloatField(
        db_index=True,
        help_text="Computed difficulty score (0-1000 scale)"
    )
    
    # Performance metrics
    avg_time_spent_seconds = models.FloatField(
        null=True,
        blank=True,
        help_text="Average time users spend on this content"
    )
    
    success_rate = models.FloatField(
        help_text="Overall correctness percentage (0-100%)"
    )
    
    attempt_count = models.IntegerField(
        default=0,
        help_text="Total number of attempts (for confidence weighting)"
    )
    
    # Segmented difficulty (how hard is it for different user groups)
    difficulty_by_user_segment = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dict: {'beginner': 650, 'intermediate': 480, 'advanced': 320}"
    )
    
    # Computation metadata
    last_computed_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="When this difficulty score was last computed"
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Feature breakdown, model version, confidence intervals"
    )
    
    class Meta:
        verbose_name = "Content Difficulty Profile"
        verbose_name_plural = "Content Difficulty Profiles"
        ordering = ['-computed_difficulty_score']
        unique_together = ('content_type', 'object_id')
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['computed_difficulty_score', '-attempt_count']),
            models.Index(fields=['last_computed_at']),
        ]
    
    def __str__(self):
        return f"{self.content_type.model} #{self.object_id} - Difficulty: {self.computed_difficulty_score:.1f}"
    
    def get_difficulty_level(self):
        """Return human-readable difficulty level."""
        score = self.computed_difficulty_score
        if score < 300:
            return "Easy"
        elif score < 500:
            return "Medium"
        elif score < 700:
            return "Hard"
        else:
            return "Expert"


class MatchScore(models.Model):
    """
    Precomputed user-content match scores for fast feed generation.
    
    Match scores range 0-100 (higher = better match).
    Combines multiple factors:
    - Zone of Proximal Development (optimal difficulty gap)
    - User preference alignment (subject/tags/language)
    - Topic similarity (if using embeddings)
    - Recency penalty (avoid recently attempted)
    
    Computed offline by management command: compute_match_scores
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='match_scores',
        db_index=True
    )
    
    # Generic FK to content (Quiz, Lesson, etc.)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE
    )
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Overall match score (0-100, higher = better match)
    match_score = models.FloatField(
        db_index=True,
        help_text="Overall match score (0-100, higher = better fit for this user)"
    )
    
    # Component scores (for transparency and debugging)
    difficulty_gap = models.FloatField(
        help_text="Signed difference: content_difficulty - user_ability (optimal: -50 to +50)"
    )
    
    zpd_score = models.FloatField(
        null=True,
        blank=True,
        help_text="Zone of Proximal Development score (0-1, higher = optimal challenge level)"
    )
    
    preference_alignment_score = models.FloatField(
        null=True,
        blank=True,
        help_text="How well content matches user preferences (0-1, subject/tags/language)"
    )
    
    topic_similarity_score = models.FloatField(
        null=True,
        blank=True,
        help_text="Cosine similarity of content embeddings (0-1, if using semantic matching)"
    )
    
    recency_penalty = models.FloatField(
        default=0.0,
        help_text="Penalty for recently attempted content (0-1, higher = more recent)"
    )
    
    # Computation metadata
    computed_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="When this match score was computed"
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Breakdown of sub-scores, 'why' explanation for UI"
    )
    
    class Meta:
        verbose_name = "Match Score"
        verbose_name_plural = "Match Scores"
        ordering = ['-match_score']
        unique_together = ('user', 'content_type', 'object_id')
        indexes = [
            # Critical index for feed queries
            models.Index(fields=['user', '-match_score', 'computed_at']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['computed_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} ↔ {self.content_type.model} #{self.object_id} - Score: {self.match_score:.1f}"
    
    def get_match_quality(self):
        """Return human-readable match quality."""
        score = self.match_score
        if score >= 80:
            return "Excellent Match 🎯"
        elif score >= 60:
            return "Good Match ✓"
        elif score >= 40:
            return "Moderate Match"
        else:
            return "Poor Match"
    
    def get_why_explanation(self):
        """Generate explanation for why this content matches the user."""
        explanations = []
        
        if self.zpd_score and self.zpd_score > 0.7:
            if -50 <= self.difficulty_gap <= 50:
                explanations.append("Perfect difficulty for your level 🎯")
            elif self.difficulty_gap > 50:
                explanations.append("Challenge yourself! 🚀")
            elif self.difficulty_gap < -30:
                explanations.append("Quick confidence booster ⚡")
        
        if self.preference_alignment_score and self.preference_alignment_score > 0.7:
            explanations.append("Matches your interests 💡")
        
        if self.topic_similarity_score and self.topic_similarity_score > 0.6:
            explanations.append("Related to what you've studied 📚")
        
        if not explanations:
            explanations.append("Recommended for you")
        
        return " • ".join(explanations)


class RecommendationCache(models.Model):
    """
    Denormalized cache for entire user feeds (optional optimization).
    
    Stores pre-serialized feed data for ultra-fast serving.
    Falls back to MatchScore queries if cache is stale.
    
    Can be populated by management command or on-demand by feed service.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recommendation_caches',
        db_index=True
    )
    
    feed_type = models.CharField(
        max_length=50,
        choices=[
            ('personalized', 'Personalized'),
            ('review', 'Review Queue'),
            ('explore', 'Explore'),
            ('challenge', 'Challenge Mode'),
        ],
        help_text="Type of feed cached"
    )
    
    # Cached data
    cached_quiz_ids = models.JSONField(
        default=list,
        help_text="Ordered list of Quiz IDs for this feed"
    )
    
    cached_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Pre-serialized 'why' explanations and scores per item"
    )
    
    # Cache management
    cached_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="When this cache was last updated"
    )
    
    expires_at = models.DateTimeField(
        db_index=True,
        help_text="When this cache should be invalidated"
    )
    
    hit_count = models.IntegerField(
        default=0,
        help_text="Number of times this cache has been used (for analytics)"
    )
    
    class Meta:
        verbose_name = "Recommendation Cache"
        verbose_name_plural = "Recommendation Caches"
        unique_together = ('user', 'feed_type')
        ordering = ['-cached_at']
        indexes = [
            models.Index(fields=['user', 'feed_type', 'expires_at']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.feed_type} (cached {self.cached_at.strftime('%Y-%m-%d %H:%M')})"
    
    def is_valid(self):
        """Check if cache is still valid (not expired)."""
        return timezone.now() < self.expires_at
    
    def increment_hit(self):
        """Increment hit counter (useful for analytics)."""
        self.hit_count += 1
        self.save(update_fields=['hit_count'])
