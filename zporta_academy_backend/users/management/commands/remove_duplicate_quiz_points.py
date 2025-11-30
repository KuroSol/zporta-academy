# users/management/commands/remove_duplicate_quiz_points.py
from django.core.management.base import BaseCommand
from django.db import transaction
from users.activity_models import UserActivity

class Command(BaseCommand):
    help = "Remove duplicate quiz points (keep only first correct answer per question per user)"

    def handle(self, *args, **options):
        self.stdout.write("\n=== Removing Duplicate Quiz Points ===\n")
        
        # Get all CORRECT_ANSWER activities grouped by user and question
        activities = UserActivity.objects.filter(
            activity_type='CORRECT_ANSWER'
        ).order_by('user', 'metadata__question_id', 'created_at')
        
        seen = {}  # (user_id, question_id) -> first activity
        to_delete = []
        
        for activity in activities:
            metadata = activity.metadata or {}
            question_id = metadata.get('question_id')
            
            if not question_id:
                continue
            
            key = (activity.user_id, question_id)
            
            if key in seen:
                # Duplicate - mark for deletion
                to_delete.append(activity.id)
            else:
                # First occurrence - keep it
                seen[key] = activity
        
        if to_delete:
            with transaction.atomic():
                deleted_count = UserActivity.objects.filter(id__in=to_delete).delete()[0]
            self.stdout.write(self.style.SUCCESS(f"✓ Deleted {deleted_count} duplicate activities"))
        else:
            self.stdout.write(self.style.SUCCESS("✓ No duplicates found"))
        
        self.stdout.write(self.style.SUCCESS("✓ Run 'sync_activity_scores' to update profile scores"))
