"""
🔄 CACHE MANAGER - Intelligent AI Insights & Analytics Data Caching
============================================================================

Purpose:
  - Store AI analysis results to avoid re-running expensive AI model calls
  - Cache user analytics data to reduce database queries
  - Reuse cached data for the same subject/engine combination
  - Track cache hits/misses for optimization
  - Save tokens and reduce API costs

How It Works:
  1. Check if cached result exists for this user + subject + engine
  2. If cache is fresh (not expired), return cached result
  3. If cache is stale or missing, run AI analysis
  4. Store new result in cache with timestamp
  5. Return cached result to frontend

Cache Structure:
  - CachedAIInsight: Stores AI analysis results (11 sections)
  - CachedUserAnalytics: Stores user learning analytics data
  - CacheStatistics: Tracks cache performance metrics
"""

import logging
import json
from datetime import timedelta
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()
logger = logging.getLogger(__name__)


class CachedAIInsight(models.Model):
    """
    Stores AI-generated insights (comprehensive learning analysis) to avoid re-generating.
    Reduces token usage significantly by reusing analysis results.
    
    Key Fields:
    - user: Which student
    - subject: Which subject (empty = all subjects)
    - engine: Which AI model (gemini, gpt-4o, etc)
    - ai_insights: Full JSON response from AI (11 sections)
    - tokens_saved: Estimated tokens saved by using this cache
    - hits: Number of times this cache was reused
    - created_at: When the analysis was first run
    - expires_at: When cache should be refreshed
    """
    
    SUBJECT_CHOICES = [
        ('', 'All Subjects'),
        ('English', 'English'),
        ('Math', 'Math'),
        ('Science', 'Science'),
        ('History', 'History'),
        ('Spanish', 'Spanish'),
        ('French', 'French'),
        ('Japanese', 'Japanese'),
    ]
    
    ENGINE_CHOICES = [
        ('gemini-2.0-flash-exp', '⚡ Gemini 2.0 Flash (Fast)'),
        ('gemini-2.0-pro-exp', '✨ Gemini 2.0 Pro (Best)'),
        ('gemini-1.5-pro', '🔧 Gemini 1.5 Pro'),
        ('gpt-4o-mini', '⚡ GPT-4o Mini (Fast)'),
        ('gpt-4o', '🎯 GPT-4o (Balanced)'),
        ('gpt-4-turbo', '🚀 GPT-4 Turbo (Best)'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='cached_ai_insights',
        db_index=True,
        help_text="Student whose insights are cached"
    )
    
    subject = models.CharField(
        max_length=50,
        default='',
        blank=True,
        help_text="Subject focus (empty = all subjects)"
    )
    
    engine = models.CharField(
        max_length=50,
        default='gemini-2.0-flash-exp',
        choices=ENGINE_CHOICES,
        help_text="Which AI engine was used"
    )
    
    # The actual cached AI analysis result (JSON with 11 sections)
    ai_insights = models.JSONField(
        help_text="Full AI analysis: summary, assessment, vocabulary_gaps, grammar_analysis, quiz_recommendations, difficulty_progression, external_resources, study_guide, learning_journey, specific_actions, potential_struggles"
    )
    
    # Cache performance metrics
    tokens_used = models.IntegerField(
        default=0,
        help_text="Approximate tokens used to generate this analysis"
    )
    
    tokens_saved = models.IntegerField(
        default=0,
        help_text="Tokens saved by reusing this cache instead of regenerating"
    )
    
    hits = models.IntegerField(
        default=0,
        help_text="Number of times this cached result was reused"
    )
    
    # Cache lifetime
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)  # Track when cache was last updated
    expires_at = models.DateTimeField(
        db_index=True,
        help_text="When this cache should be refreshed (24 hours after creation)"
    )
    needs_refresh = models.BooleanField(
        default=False,
        help_text="Flag to indicate cache should be refreshed on next opportunity"
    )
    
    class Meta:
        verbose_name = "Cached AI Insight"
        verbose_name_plural = "💾 Cached AI Insights"
        indexes = [
            models.Index(fields=['user', 'subject', 'engine']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['created_at', '-hits']),
        ]
        ordering = ['-created_at']
        unique_together = ['user', 'subject', 'engine']  # Only one cache per user+subject+engine
    
    def __str__(self):
        return f"Cache: {self.user.username} - {self.subject or 'All'} ({self.engine}) - {self.hits} hits"
    
    def is_fresh(self):
        """Check if cache is still valid (not expired)."""
        return timezone.now() < self.expires_at
    
    def mark_as_used(self):
        """Increment hit counter when cache is used."""
        self.hits += 1
        self.tokens_saved += self.tokens_used  # Each reuse saves tokens
        self.save(update_fields=['hits', 'tokens_saved'])
        logger.info(f"✓ Cache hit for {self.user.username} ({self.subject or 'All'}): {self.hits} hits, {self.tokens_saved} tokens saved")


class CachedUserAnalytics(models.Model):
    """
    Stores collected user analytics data (courses, lessons, quizzes, notes, etc.)
    to avoid re-querying database for the same information.
    
    Reduces database queries and improves page load speed.
    
    Key Fields:
    - user: Which student
    - analytics_data: Full collected learning data (JSON)
    - last_updated: When this analytics data was last collected
    - expires_at: When analytics should be refreshed
    """
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='cached_analytics',
        primary_key=True,
        help_text="Student whose analytics are cached"
    )
    
    # Full analytics data snapshot
    analytics_data = models.JSONField(
        help_text="Collected learning data: total_courses, lessons_completed, notes_count, quizzes_completed, quiz_accuracy, study_streak, active_days, enrolled_courses, weak_topics, strong_topics, recent_activity"
    )
    
    # Lifecycle tracking
    last_updated = models.DateTimeField(auto_now=True, db_index=True)
    expires_at = models.DateTimeField(
        db_index=True,
        help_text="When analytics cache should be refreshed (updates daily)"
    )
    
    # Usage stats
    reads = models.IntegerField(
        default=0,
        help_text="How many times this cached analytics was used"
    )
    
    class Meta:
        verbose_name = "Cached User Analytics"
        verbose_name_plural = "📊 Cached User Analytics"
        indexes = [
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Analytics Cache: {self.user.username} - {self.reads} reads - {self.is_fresh()}"
    
    def is_fresh(self):
        """Check if analytics cache is still valid."""
        return timezone.now() < self.expires_at
    
    def mark_as_read(self):
        """Increment read counter when cache is accessed."""
        self.reads += 1
        self.save(update_fields=['reads'])


class CacheStatistics(models.Model):
    """
    Tracks overall cache performance and savings.
    
    Metrics:
    - Total tokens saved across all cached insights
    - Cache hit rate (hits / total requests)
    - Average cache freshness
    - API cost savings
    """
    
    date = models.DateField(auto_now_add=True, unique=True, db_index=True)
    
    # AI Insights cache stats
    ai_insights_generated = models.IntegerField(default=0, help_text="New AI analyses generated today")
    ai_insights_cached = models.IntegerField(default=0, help_text="AI analyses served from cache today")
    ai_insights_hits = models.IntegerField(default=0, help_text="Total cache hits for AI insights")
    ai_tokens_used = models.IntegerField(default=0, help_text="Tokens used by new AI generations")
    ai_tokens_saved = models.IntegerField(default=0, help_text="Tokens saved by cache reuse")
    
    # Analytics cache stats
    analytics_generated = models.IntegerField(default=0, help_text="New analytics data collected today")
    analytics_cached = models.IntegerField(default=0, help_text="Analytics served from cache today")
    analytics_db_queries_saved = models.IntegerField(default=0, help_text="DB queries avoided by caching")
    
    class Meta:
        verbose_name = "Cache Statistics"
        verbose_name_plural = "📈 Cache Statistics"
        ordering = ['-date']
    
    def __str__(self):
        return f"Cache Stats - {self.date}"
    
    def cache_hit_rate(self):
        """Calculate AI insights cache hit rate."""
        total = self.ai_insights_generated + self.ai_insights_cached
        if total == 0:
            return 0
        return (self.ai_insights_cached / total) * 100
    
    def cost_savings(self):
        """Estimate API cost saved (rough calculation)."""
        # Approximate: 1000 tokens ≈ $0.0001 for Gemini, $0.00015 for GPT-4o
        # Using average of $0.000125 per 1000 tokens
        savings = (self.ai_tokens_saved / 1000) * 0.000125
        return f"~${savings:.4f}"


# ============================================================================
# CACHE UTILITY FUNCTIONS
# ============================================================================

def get_cached_ai_insight(user, subject='', engine='gemini-2.0-flash-exp'):
    """
    Retrieve cached AI insight using stale-while-revalidate pattern.
    
    Strategy:
    - If cache is fresh: return it immediately (serve from cache)
    - If cache is stale but exists: return it AND mark for background refresh
    - If cache doesn't exist: return None (requires fresh analysis)
    
    Returns:
        - (True, cached_data, needs_refresh) if cache exists
        - (False, None, False) if cache doesn't exist
    """
    try:
        cache = CachedAIInsight.objects.get(
            user=user,
            subject=subject,
            engine=engine
        )
        
        is_fresh = cache.is_fresh()
        
        if is_fresh:
            # Cache is fresh - use it and increment hits
            cache.mark_as_used()
            logger.info(f"✓ Cache HIT (fresh): {user.username} - {subject or 'All'} - {engine}")
            # Update statistics
            update_cache_stats(
                ai_insights_cached=1,
                ai_insights_hits=1,
                ai_tokens_saved=cache.tokens_used
            )
            return True, cache.ai_insights, False
        else:
            # Cache is stale - use it but mark for refresh
            cache.mark_as_used()
            cache.needs_refresh = True
            cache.save(update_fields=['needs_refresh', 'hits', 'tokens_saved'])
            logger.info(f"⚠️ Cache HIT (stale): {user.username} - {subject or 'All'} - {engine} - MARKED FOR REFRESH")
            # Update statistics
            update_cache_stats(
                ai_insights_cached=1,
                ai_insights_hits=1,
                ai_tokens_saved=cache.tokens_used
            )
            return True, cache.ai_insights, True  # Return cached data + refresh flag
    
    except CachedAIInsight.DoesNotExist:
        logger.info(f"✗ Cache MISS: {user.username} - {subject or 'All'} - {engine}")
        return False, None, False


def save_ai_insight_cache(user, ai_insights, subject='', engine='gemini-2.0-flash-exp', tokens_used=0):
    """
    Save AI insights to cache.
    
    Args:
        user: User object
        ai_insights: Dict with 11 sections (summary, assessment, etc.)
        subject: Subject filter (empty = all)
        engine: AI engine used
        tokens_used: Approximate tokens consumed
    """
    try:
        expires_at = timezone.now() + timedelta(hours=24)  # 24-hour cache
        
        cache, created = CachedAIInsight.objects.update_or_create(
            user=user,
            subject=subject,
            engine=engine,
            defaults={
                'ai_insights': ai_insights,
                'tokens_used': tokens_used,
                'expires_at': expires_at,
            }
        )
        
        action = "Created" if created else "Updated"
        logger.info(f"✓ {action} cache for {user.username} - {subject or 'All'} - {engine}")
        
        # Update statistics
        update_cache_stats(ai_insights_generated=1, ai_tokens_used=tokens_used)
        
        return cache
    
    except Exception as e:
        logger.exception(f"Error saving AI insight cache: {e}")
        return None


def get_cached_user_analytics(user):
    """
    Retrieve cached user analytics if available and fresh.
    
    Returns:
        - (True, analytics_data) if cache exists and is fresh
        - (False, None) if cache doesn't exist or is stale
    """
    try:
        cache = CachedUserAnalytics.objects.get(user=user)
        
        if cache.is_fresh():
            cache.mark_as_read()
            logger.info(f"✓ Analytics Cache HIT: {user.username}")
            # Update statistics
            update_cache_stats(analytics_cached=1)
            return True, cache.analytics_data
        else:
            logger.info(f"⏱️ Analytics Cache EXPIRED: {user.username}")
            return False, None
    
    except CachedUserAnalytics.DoesNotExist:
        logger.info(f"✗ Analytics Cache MISS: {user.username}")
        return False, None


def save_user_analytics_cache(user, analytics_data):
    """
    Save user analytics to cache.
    
    Args:
        user: User object
        analytics_data: Dict with collected learning data
    """
    try:
        expires_at = timezone.now() + timedelta(hours=24)  # Daily refresh
        
        cache, created = CachedUserAnalytics.objects.update_or_create(
            user=user,
            defaults={
                'analytics_data': analytics_data,
                'expires_at': expires_at,
            }
        )
        
        action = "Created" if created else "Updated"
        logger.info(f"✓ {action} analytics cache for {user.username}")
        
        # Update statistics
        update_cache_stats(analytics_generated=1)
        
        return cache
    
    except Exception as e:
        logger.exception(f"Error saving user analytics cache: {e}")
        return None


def update_cache_stats(**kwargs):
    """
    Update daily cache statistics.
    
    Usage:
        update_cache_stats(ai_insights_cached=1, ai_tokens_saved=1000)
    """
    try:
        today = timezone.now().date()
        stats, created = CacheStatistics.objects.get_or_create(date=today)
        
        # Update fields
        for field, value in kwargs.items():
            if hasattr(stats, field):
                current = getattr(stats, field)
                setattr(stats, field, current + value)
        
        stats.save()
    except Exception as e:
        logger.exception(f"Error updating cache statistics: {e}")


def get_caches_needing_refresh():
    """
    Get all cached AI insights that are marked for refresh.
    Used for background refresh process to update stale caches.
    
    Returns:
        QuerySet of CachedAIInsight objects with needs_refresh=True
    """
    return CachedAIInsight.objects.filter(needs_refresh=True).order_by('updated_at')


def clear_refresh_flag(cache_id):
    """
    Mark a cache item as refreshed (clear the needs_refresh flag).
    
    Args:
        cache_id: ID of the CachedAIInsight object
    """
    try:
        cache = CachedAIInsight.objects.get(id=cache_id)
        cache.needs_refresh = False
        cache.updated_at = timezone.now()
        cache.save(update_fields=['needs_refresh', 'updated_at'])
        logger.info(f"✓ Refresh flag cleared for cache {cache_id}")
    except CachedAIInsight.DoesNotExist:
        logger.warning(f"Cache {cache_id} not found for refresh flag clear")


def clear_expired_caches():
    """
    Delete expired cache entries to keep database clean.
    Should be run as a periodic task (daily).
    """
    now = timezone.now()
    
    # Clear expired AI insights
    ai_expired = CachedAIInsight.objects.filter(expires_at__lt=now).delete()
    logger.info(f"✓ Cleared {ai_expired[0]} expired AI insight caches")
    
    # Clear expired user analytics
    analytics_expired = CachedUserAnalytics.objects.filter(expires_at__lt=now).delete()
    logger.info(f"✓ Cleared {analytics_expired[0]} expired user analytics caches")
    
    return {
        'ai_insights_cleared': ai_expired[0],
        'analytics_cleared': analytics_expired[0]
    }
