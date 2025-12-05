# intelligence/management/commands/compute_content_difficulty.py
"""
Management command to compute difficulty scores for all quizzes and questions.

Usage:
    python manage.py compute_content_difficulty

This command:
1. Analyzes ActivityEvent data for quiz attempts
2. Computes difficulty scores based on success rate, time spent, attempt count
3. Updates ContentDifficultyProfile and denormalized fields on Quiz/Question models

Should be run daily or after significant new attempt data.
"""

import logging
from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.utils import timezone

from intelligence.models import ContentDifficultyProfile
from intelligence.utils import compute_difficulty_score
from quizzes.models import Quiz, Question
from analytics.models import ActivityEvent

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Compute difficulty scores for all quizzes and questions'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--min-attempts',
            type=int,
            default=3,
            help='Minimum attempts required to compute difficulty (default: 3)'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days of history to analyze (default: 90)'
        )
        parser.add_argument(
            '--content-type',
            type=str,
            choices=['quiz', 'question', 'all'],
            default='all',
            help='Which content type to process (default: all)'
        )
    
    def handle(self, *args, **options):
        min_attempts = options['min_attempts']
        days = options['days']
        content_type_choice = options['content_type']
        
        self.stdout.write(self.style.SUCCESS(
            f'Starting difficulty computation with min_attempts={min_attempts}, days={days}'
        ))
        
        start_time = timezone.now()
        
        if content_type_choice in ['quiz', 'all']:
            quiz_count = self.compute_quiz_difficulty(min_attempts, days)
            self.stdout.write(self.style.SUCCESS(f'✓ Processed {quiz_count} quizzes'))
        
        if content_type_choice in ['question', 'all']:
            question_count = self.compute_question_difficulty(min_attempts, days)
            self.stdout.write(self.style.SUCCESS(f'✓ Processed {question_count} questions'))
        
        elapsed = (timezone.now() - start_time).total_seconds()
        self.stdout.write(self.style.SUCCESS(
            f'Difficulty computation complete in {elapsed:.1f} seconds'
        ))
    
    def compute_quiz_difficulty(self, min_attempts, days):
        """Compute difficulty for all quizzes with sufficient attempt data."""
        cutoff_date = timezone.now() - timezone.timedelta(days=days)
        quiz_ct = ContentType.objects.get_for_model(Quiz)

        sql = """
            SELECT
                CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.quiz_id')) AS UNSIGNED) AS quiz_id,
                COUNT(*) AS attempt_count,
                AVG(CASE WHEN JSON_EXTRACT(metadata, '$.is_correct') = true THEN 100.0 ELSE 0 END) AS success_rate,
                AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.time_spent_ms')) AS DECIMAL(18,6))) AS avg_time_ms
            FROM analytics_activityevent
            WHERE event_type = 'quiz_answer_submitted'
              AND timestamp >= %s
              AND JSON_VALID(metadata) = 1
              AND JSON_TYPE(metadata) = 'OBJECT'
              AND JSON_EXTRACT(metadata, '$.quiz_id') IS NOT NULL
              AND JSON_EXTRACT(metadata, '$.is_correct') IS NOT NULL
              AND JSON_EXTRACT(metadata, '$.time_spent_ms') IS NOT NULL
            GROUP BY quiz_id
            HAVING attempt_count >= %s
        """

        processed = 0
        with connection.cursor() as cursor:
            cursor.execute(sql, [cutoff_date, min_attempts])
            rows = cursor.fetchall()

        for quiz_id, attempt_count, success_rate, avg_time_ms in rows:
            try:
                quiz = Quiz.objects.get(id=quiz_id)
            except Quiz.DoesNotExist:
                continue

            success_rate = float(success_rate or 50.0)
            avg_time_seconds = float(avg_time_ms or 15000) / 1000.0

            difficulty_score = compute_difficulty_score(
                success_rate, avg_time_seconds, attempt_count
            )

            ContentDifficultyProfile.objects.update_or_create(
                content_type=quiz_ct,
                object_id=quiz_id,
                defaults={
                    'computed_difficulty_score': difficulty_score,
                    'success_rate': success_rate,
                    'avg_time_spent_seconds': avg_time_seconds,
                    'attempt_count': attempt_count,
                    'metadata': {
                        'last_computed': timezone.now().isoformat(),
                        'days_analyzed': days,
                    }
                }
            )

            Quiz.objects.filter(id=quiz_id).update(
                computed_difficulty_score=difficulty_score,
                avg_completion_time_seconds=avg_time_seconds,
                overall_success_rate=success_rate,
                attempt_count=attempt_count,
            )

            processed += 1
            if processed % 100 == 0:
                self.stdout.write(f'  Processed {processed} quizzes...')

        return processed
    
    def compute_question_difficulty(self, min_attempts, days):
        """Compute difficulty for individual questions."""
        cutoff_date = timezone.now() - timezone.timedelta(days=days)
        question_ct = ContentType.objects.get_for_model(Question)

        sql = """
            SELECT
                object_id AS question_id,
                COUNT(*) AS attempt_count,
                AVG(CASE WHEN JSON_EXTRACT(metadata, '$.is_correct') = true THEN 100.0 ELSE 0 END) AS success_rate,
                AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.time_spent_ms')) AS DECIMAL(18,6))) AS avg_time_ms
            FROM analytics_activityevent
            WHERE event_type = 'quiz_answer_submitted'
              AND timestamp >= %s
              AND content_type_id = %s
              AND JSON_VALID(metadata) = 1
              AND JSON_TYPE(metadata) = 'OBJECT'
              AND JSON_EXTRACT(metadata, '$.is_correct') IS NOT NULL
              AND JSON_EXTRACT(metadata, '$.time_spent_ms') IS NOT NULL
            GROUP BY question_id
            HAVING attempt_count >= %s
        """

        processed = 0
        with connection.cursor() as cursor:
            cursor.execute(sql, [cutoff_date, question_ct.id, min_attempts])
            rows = cursor.fetchall()

        for question_id, attempt_count, success_rate, avg_time_ms in rows:
            try:
                question = Question.objects.get(id=question_id)
            except Question.DoesNotExist:
                continue

            success_rate = float(success_rate or 50.0)
            avg_time_seconds = float(avg_time_ms or 10000) / 1000.0

            difficulty_score = compute_difficulty_score(
                success_rate, avg_time_seconds, attempt_count
            )

            ContentDifficultyProfile.objects.update_or_create(
                content_type=question_ct,
                object_id=question_id,
                defaults={
                    'computed_difficulty_score': difficulty_score,
                    'success_rate': success_rate,
                    'avg_time_spent_seconds': avg_time_seconds,
                    'attempt_count': attempt_count,
                    'metadata': {
                        'last_computed': timezone.now().isoformat(),
                        'days_analyzed': days,
                    }
                }
            )

            Question.objects.filter(id=question_id).update(
                computed_difficulty_score=difficulty_score,
                avg_time_spent_ms=avg_time_ms or 0,
                success_rate=success_rate,
            )

            processed += 1
            if processed % 200 == 0:
                self.stdout.write(f'  Processed {processed} questions...')

        return processed
