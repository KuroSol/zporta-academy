# intelligence/management/commands/compute_match_scores.py
"""
Management command to compute user-content match scores for personalized recommendations.

Usage:
    python manage.py compute_match_scores

This command:
1. For each active user, finds candidate quizzes
2. Computes match scores based on ZPD, preferences, and recency
3. Stores top N matches per user in MatchScore table

Should be run every 6-12 hours or after ability/difficulty updates.
"""

import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, Max
from django.utils import timezone

from intelligence.models import UserAbilityProfile, ContentDifficultyProfile, MatchScore
from intelligence.utils import (
    compute_match_score,
    compute_preference_alignment,
    compute_recency_penalty
)
from quizzes.models import Quiz
from users.models import UserPreference
from analytics.models import ActivityEvent

User = get_user_model()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Compute match scores for all users'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--top-n',
            type=int,
            default=100,
            help='Number of top matches to store per user (default: 100)'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Compute matches for specific user ID only'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Number of users to process per batch (default: 50)'
        )
    
    def handle(self, *args, **options):
        top_n = options['top_n']
        user_id = options.get('user_id')
        batch_size = options['batch_size']
        
        self.stdout.write(self.style.SUCCESS(
            f'Starting match score computation (top_n={top_n})'
        ))
        
        start_time = timezone.now()
        
        # Get users with ability profiles
        if user_id:
            users = User.objects.filter(id=user_id, ability_profile__isnull=False)
        else:
            users = User.objects.filter(ability_profile__isnull=False)
        
        total_users = users.count()
        processed = 0
        
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        
        for user in users.iterator(chunk_size=batch_size):
            try:
                match_count = self.compute_user_matches(user, top_n, quiz_ct)
                processed += 1
                
                if processed % 10 == 0:
                    self.stdout.write(f'  Processed {processed}/{total_users} users...')
            except Exception as e:
                logger.error(f"Error computing matches for user {user.id}: {e}", exc_info=True)
                continue
        
        elapsed = (timezone.now() - start_time).total_seconds()
        self.stdout.write(self.style.SUCCESS(
            f'Match score computation complete. Processed {processed} users in {elapsed:.1f} seconds'
        ))
    
    def compute_user_matches(self, user, top_n, quiz_ct):
        """Compute match scores for a single user."""
        # Get user's ability profile
        try:
            ability_profile = UserAbilityProfile.objects.get(user=user)
            user_ability = ability_profile.overall_ability_score
        except UserAbilityProfile.DoesNotExist:
            logger.warning(f"No ability profile for user {user.id}")
            return 0
        
        # Get user preferences
        try:
            user_prefs = UserPreference.objects.get(user=user)
        except UserPreference.DoesNotExist:
            user_prefs = None
        
        # Get candidate quizzes (filter by user's interested subjects if available)
        candidate_quizzes = Quiz.objects.filter(status='published')
        
        if user_prefs and user_prefs.interested_subjects.exists():
            # Prioritize quizzes in user's interested subjects
            interested_subjects = user_prefs.interested_subjects.all()
            candidate_quizzes = candidate_quizzes.filter(
                Q(subject__in=interested_subjects) |
                Q(subject__isnull=True)
            )
        
        # Limit to quizzes with difficulty scores
        candidate_quizzes = candidate_quizzes.filter(
            computed_difficulty_score__isnull=False
        ).select_related('subject').prefetch_related('tags')
        
        # Get user's recent attempt history for recency penalty
        recent_attempts = {}
        last_30_days = timezone.now() - timedelta(days=30)
        
        recent_quiz_attempts = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_answer_submitted',
            timestamp__gte=last_30_days,
            metadata__has_key='quiz_id'
        ).values('metadata__quiz_id').annotate(
            last_attempt=Max('timestamp')
        )
        
        for attempt in recent_quiz_attempts:
            quiz_id = attempt['metadata__quiz_id']
            recent_attempts[quiz_id] = attempt['last_attempt']
        
        # Compute match scores for all candidate quizzes
        match_scores = []
        
        for quiz in candidate_quizzes[:1000]:  # Limit to 1000 candidates per user for performance
            # Skip if recently attempted (within 7 days)
            last_attempt = recent_attempts.get(quiz.id)
            if last_attempt and (timezone.now() - last_attempt).days < 7:
                continue
            
            # Get quiz difficulty
            quiz_difficulty = quiz.computed_difficulty_score
            
            # Compute preference alignment
            preference_score = compute_preference_alignment(quiz, user_prefs)
            
            # Compute recency penalty
            recency_penalty = compute_recency_penalty(last_attempt) if last_attempt else 0.0
            
            # Compute overall match score
            match_score_value = compute_match_score(
                user_ability=user_ability,
                quiz_difficulty=quiz_difficulty,
                preference_score=preference_score,
                recency_penalty=recency_penalty
            )
            
            # Compute difficulty gap for ZPD
            difficulty_gap = quiz_difficulty - user_ability
            
            match_scores.append({
                'quiz': quiz,
                'match_score': match_score_value,
                'difficulty_gap': difficulty_gap,
                'preference_score': preference_score,
                'recency_penalty': recency_penalty,
            })
        
        # Sort by match score and take top N
        match_scores.sort(key=lambda x: x['match_score'], reverse=True)
        top_matches = match_scores[:top_n]
        
        # Clear old match scores for this user (for this content type)
        MatchScore.objects.filter(user=user, content_type=quiz_ct).delete()
        
        # Bulk create new match scores
        match_score_objects = []
        for match_data in top_matches:
            quiz = match_data['quiz']
            
            # Compute ZPD score
            difficulty_gap = match_data['difficulty_gap']
            if -50 <= difficulty_gap <= 50:
                zpd_score = 1.0 - abs(difficulty_gap) / 100
            else:
                zpd_score = max(0.1, 0.5 - abs(difficulty_gap - 50) / 200)
            
            # Generate explanation metadata
            why_parts = []
            if abs(difficulty_gap) <= 50:
                why_parts.append("optimal_difficulty")
            if match_data['preference_score'] > 0.6:
                why_parts.append("matches_interests")
            if difficulty_gap > 50:
                why_parts.append("challenge")
            elif difficulty_gap < -50:
                why_parts.append("confidence_builder")
            
            match_score_objects.append(MatchScore(
                user=user,
                content_type=quiz_ct,
                object_id=quiz.id,
                match_score=match_data['match_score'],
                difficulty_gap=difficulty_gap,
                zpd_score=zpd_score,
                preference_alignment_score=match_data['preference_score'],
                recency_penalty=match_data['recency_penalty'],
                metadata={
                    'why_tags': why_parts,
                    'computed_at': timezone.now().isoformat(),
                }
            ))
        
        if match_score_objects:
            MatchScore.objects.bulk_create(match_score_objects, batch_size=100)
        
        return len(match_score_objects)
