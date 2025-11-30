# users/management/commands/backfill_quiz_points.py
from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from analytics.models import ActivityEvent
from users.activity_models import UserActivity
from quizzes.models import Quiz

class Command(BaseCommand):
    help = "Backfill quiz points from ActivityEvent (quiz_answer_submitted)"

    def handle(self, *args, **options):
        self.stdout.write("\n=== Backfilling Quiz Points from ActivityEvent ===\n")
        
        # Get all quiz_answer_submitted events with is_correct=True
        events = ActivityEvent.objects.filter(
            event_type='quiz_answer_submitted'
        ).order_by('timestamp')
        
        total_processed = 0
        total_created = 0
        
        for event in events:
            total_processed += 1
            
            metadata = event.metadata or {}
            is_correct = metadata.get('is_correct', False)
            
            if not is_correct:
                continue  # Skip incorrect answers
            
            user = event.user
            if not user:
                continue
            
            quiz_id = metadata.get('quiz_id')
            question_id = metadata.get('question_id')
            attempt_index = metadata.get('attempt_index', 1)
            
            if not quiz_id or not question_id:
                continue
            
            # Check if already tracked (first correct attempt only)
            existing = UserActivity.objects.filter(
                user=user,
                role='student',
                activity_type='CORRECT_ANSWER',
                metadata__question_id=question_id
            ).exists()
            
            if existing:
                continue  # Skip if already tracked
            
            try:
                quiz = Quiz.objects.get(id=quiz_id)
            except Quiz.DoesNotExist:
                self.stdout.write(f"  ⚠ Quiz {quiz_id} not found, skipping...")
                continue
            
            # Create activity
            UserActivity.objects.create(
                user=user,
                role='student',
                activity_type='CORRECT_ANSWER',
                points=1,
                content_type=ContentType.objects.get_for_model(quiz),
                object_id=quiz.id,
                metadata={
                    'quiz_id': quiz.id,
                    'quiz_title': quiz.title,
                    'quiz_permalink': getattr(quiz, 'permalink', None),
                    'question_id': question_id,
                    'attempt_index': attempt_index,
                    'event_id': event.id,
                },
                created_at=event.timestamp  # Preserve original timestamp
            )
            total_created += 1
            
            if total_created % 10 == 0:
                self.stdout.write(f"  Created {total_created} activities...")
        
        self.stdout.write(self.style.SUCCESS(f"\n✓ Processed {total_processed} events"))
        self.stdout.write(self.style.SUCCESS(f"✓ Created {total_created} new activities"))
        self.stdout.write(self.style.SUCCESS("✓ Run 'sync_activity_scores' to update profile scores"))
