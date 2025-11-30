# users/management/commands/clean_obsolete_activities.py
from django.core.management.base import BaseCommand
from django.db import transaction
from users.activity_models import UserActivity

class Command(BaseCommand):
    help = "Remove obsolete activity types from old scoring system"

    def handle(self, *args, **options):
        obsolete_types = [
            'QUIZ_ATTEMPT_COMPLETED',
            'QUIZ_BONUS',
            'QUIZ_ATTEMPT_ON_THEIR_QUIZ',
            'QUIZ_PASSED_ON_THEIR_QUIZ',
            'COURSE_COMPLETED_BY_STUDENT',
        ]
        
        self.stdout.write("\n=== Cleaning Obsolete Activities ===\n")
        
        total_deleted = 0
        with transaction.atomic():
            for activity_type in obsolete_types:
                qs = UserActivity.objects.filter(activity_type=activity_type)
                count = qs.count()
                if count > 0:
                    self.stdout.write(f"Deleting {count} '{activity_type}' activities...")
                    qs.delete()
                    total_deleted += count
        
        self.stdout.write(self.style.SUCCESS(f"\n✓ Deleted {total_deleted} obsolete activities"))
        self.stdout.write(self.style.SUCCESS("✓ Run 'sync_activity_scores' to update profile scores"))
