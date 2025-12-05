# intelligence/management/commands/compute_user_abilities.py
"""
Management command to compute ability scores for all users.

Usage:
    python manage.py compute_user_abilities

This command:
1. Analyzes each user's quiz attempt history
2. Computes ability scores using ELO-style rating system
3. Ranks users and computes percentiles
4. Updates UserAbilityProfile and denormalized fields on Profile model

Should be run daily or every 12 hours.
"""

import logging
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Avg
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.db import connection

from intelligence.models import UserAbilityProfile, ContentDifficultyProfile
from intelligence.utils import compute_user_ability_elo
from quizzes.models import Quiz
from analytics.models import ActivityEvent
from users.models import Profile

User = get_user_model()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Compute ability scores and rankings for all users'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--min-attempts',
            type=int,
            default=5,
            help='Minimum quiz attempts required for ranking (default: 5)'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days of history to analyze (default: 90)'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Compute for specific user ID only'
        )
    
    def handle(self, *args, **options):
        min_attempts = options['min_attempts']
        days = options['days']
        user_id = options.get('user_id')
        
        self.stdout.write(self.style.SUCCESS(
            f'Starting user ability computation with min_attempts={min_attempts}, days={days}'
        ))
        
        start_time = timezone.now()
        cutoff_date = timezone.now() - timezone.timedelta(days=days)
        
        # Get users with sufficient quiz attempts
        if user_id:
            users = User.objects.filter(id=user_id)
        else:
            users = User.objects.filter(
                analytics_activity_events__event_type='quiz_answer_submitted',
                analytics_activity_events__timestamp__gte=cutoff_date
            ).annotate(
                attempt_count=Count('analytics_activity_events')
            ).filter(attempt_count__gte=min_attempts)
        
        processed = 0
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        
        for user in users:
            try:
                self.compute_user_ability(user, cutoff_date, quiz_ct)
                processed += 1
                
                if processed % 50 == 0:
                    self.stdout.write(f'  Processed {processed} users...')
            except Exception as e:
                logger.error(f"Error computing ability for user {user.id}: {e}", exc_info=True)
                continue
        
        # Compute rankings and percentiles
        self.compute_rankings()
        
        elapsed = (timezone.now() - start_time).total_seconds()
        self.stdout.write(self.style.SUCCESS(
            f'User ability computation complete. Processed {processed} users in {elapsed:.1f} seconds'
        ))
    
    def compute_user_ability(self, user, cutoff_date, quiz_ct):
        """Compute ability score for a single user using raw SQL."""
        # Use raw SQL to get quiz attempts (bypasses JSONField decoder issues)
        sql = """
            SELECT 
                JSON_EXTRACT(metadata, '$.quiz_id') as quiz_id,
                JSON_EXTRACT(metadata, '$.is_correct') as is_correct,
                JSON_EXTRACT(metadata, '$.time_spent_ms') as time_spent_ms,
                timestamp
            FROM analytics_activityevent
            WHERE user_id = %s
              AND event_type = 'quiz_answer_submitted'
              AND timestamp >= %s
              AND JSON_TYPE(metadata) = 'OBJECT'
              AND JSON_EXTRACT(metadata, '$.quiz_id') IS NOT NULL
              AND JSON_EXTRACT(metadata, '$.is_correct') IS NOT NULL
            ORDER BY timestamp ASC
        """
        
        with connection.cursor() as cursor:
            cursor.execute(sql, [user.id, cutoff_date])
            attempts_raw = cursor.fetchall()
        
        if not attempts_raw:
            return
        
        # Prepare attempt data for ELO computation
        attempt_data = []
        quiz_difficulties = {}
        subject_attempts = {}
        
        for quiz_id_raw, is_correct_raw, time_spent_raw, timestamp in attempts_raw:
            # Convert SQL results to Python types (handle JSON null as string 'null')
            try:
                quiz_id = int(quiz_id_raw) if quiz_id_raw and str(quiz_id_raw).lower() != 'null' else None
            except (ValueError, TypeError):
                quiz_id = None
            
            try:
                is_correct = bool(is_correct_raw) if is_correct_raw and str(is_correct_raw).lower() != 'null' else False
            except (ValueError, TypeError):
                is_correct = False
            
            try:
                time_spent_ms = int(time_spent_raw) if time_spent_raw and str(time_spent_raw).lower() != 'null' else 15000
            except (ValueError, TypeError):
                time_spent_ms = 15000
            
            if not quiz_id:
                continue
            
            # Get quiz difficulty (from ContentDifficultyProfile or Quiz model)
            if quiz_id not in quiz_difficulties:
                try:
                    diff_profile = ContentDifficultyProfile.objects.get(
                        content_type=quiz_ct,
                        object_id=quiz_id
                    )
                    quiz_difficulties[quiz_id] = float(diff_profile.computed_difficulty_score)
                except ContentDifficultyProfile.DoesNotExist:
                    # Fallback to Quiz.computed_difficulty_score or default
                    try:
                        quiz = Quiz.objects.get(id=quiz_id)
                        quiz_difficulties[quiz_id] = float(quiz.computed_difficulty_score or 400.0)
                    except Quiz.DoesNotExist:
                        quiz_difficulties[quiz_id] = 400.0
            
            attempt_data.append({
                'is_correct': is_correct,
                'quiz_difficulty': quiz_difficulties[quiz_id],
                'time_spent_ms': time_spent_ms
            })
            
            # Track subject-specific attempts
            try:
                quiz = Quiz.objects.get(id=quiz_id)
                if quiz.subject_id:
                    if quiz.subject_id not in subject_attempts:
                        subject_attempts[quiz.subject_id] = []
                    
                    subject_attempts[quiz.subject_id].append({
                        'is_correct': is_correct,
                        'quiz_difficulty': quiz_difficulties.get(quiz_id, 400.0),
                        'time_spent_ms': time_spent_ms
                    })
            except Quiz.DoesNotExist:
                pass
        
        if not attempt_data:
            return
        
        # Compute overall ability using ELO
        overall_ability = compute_user_ability_elo(attempt_data)
        
        # Compute subject-specific abilities
        ability_by_subject = {}
        for subject_id, subj_attempts in subject_attempts.items():
            if len(subj_attempts) >= 3:  # Minimum attempts for subject-specific score
                ability_by_subject[str(subject_id)] = compute_user_ability_elo(subj_attempts)
        
        # Compute performance metrics
        total_attempts = len(attempt_data)
        correct_attempts = sum(1 for a in attempt_data if a['is_correct'])
        
        # Compute 30-day trend (simplified without timestamp comparison)
        if total_attempts >= 10:
            # Use last 30% of attempts as "recent"
            recent_count = max(3, int(total_attempts * 0.3))
            recent_data = attempt_data[-recent_count:]
            
            recent_correct = sum(1 for a in recent_data if a['is_correct'])
            recent_performance = (recent_correct / len(recent_data)) * 100
            overall_performance = (correct_attempts / total_attempts) * 100
            performance_trend = recent_performance - overall_performance
        else:
            performance_trend = 0.0
        
        # Update or create UserAbilityProfile
        profile, created = UserAbilityProfile.objects.update_or_create(
            user=user,
            defaults={
                'overall_ability_score': overall_ability,
                'ability_by_subject': ability_by_subject,
                'total_quizzes_attempted': total_attempts,
                'total_correct_answers': correct_attempts,
                'recent_performance_trend': performance_trend,
                'metadata': {
                    'last_computed': timezone.now().isoformat(),
                    'days_analyzed': (timezone.now() - cutoff_date).days,
                }
            }
        )
        
        # Update denormalized fields on Profile model
        try:
            user_profile = Profile.objects.get(user=user)
            user_profile.overall_ability_score = float(overall_ability)
            user_profile.last_ability_update = timezone.now()
            user_profile.save(update_fields=['overall_ability_score', 'last_ability_update'])
        except Profile.DoesNotExist:
            pass
    
    def compute_rankings(self):
        """Compute global rankings and percentiles for all users."""
        profiles = UserAbilityProfile.objects.all().order_by('-overall_ability_score')
        total_users = profiles.count()
        
        if total_users == 0:
            return
        
        for rank, profile in enumerate(profiles, start=1):
            percentile = ((total_users - rank) / total_users) * 100
            
            profile.global_rank = rank
            profile.percentile = percentile
            profile.save(update_fields=['global_rank', 'percentile'])
            
            # Update Profile model
            try:
                user_profile = Profile.objects.get(user=profile.user)
                user_profile.ability_rank = rank
                user_profile.save(update_fields=['ability_rank'])
            except Profile.DoesNotExist:
                pass
        
        self.stdout.write(self.style.SUCCESS(f'✓ Computed rankings for {total_users} users'))
