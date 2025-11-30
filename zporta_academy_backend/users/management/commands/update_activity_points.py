# users/management/commands/update_activity_points.py
"""
Update existing activity points to match new scoring rules:
- LESSON_COMPLETED: 2 → 1 point
- ENROLLMENT_PREMIUM: 4 → 3 points
"""
from django.core.management.base import BaseCommand
from users.activity_models import UserActivity


class Command(BaseCommand):
    help = 'Update existing activity points to match new scoring rules'

    def handle(self, *args, **options):
        self.stdout.write("=== Updating Activity Points ===\n")
        
        # Update LESSON_COMPLETED: 2 → 1 point
        lesson_activities = UserActivity.objects.filter(
            activity_type='LESSON_COMPLETED',
            points=2
        )
        lesson_count = lesson_activities.count()
        lesson_activities.update(points=1)
        self.stdout.write(f"✓ Updated {lesson_count} LESSON_COMPLETED activities (2→1 point)")
        
        # Update ENROLLMENT_PREMIUM: 4 → 3 points
        premium_activities = UserActivity.objects.filter(
            activity_type='ENROLLMENT_PREMIUM',
            points=4
        )
        premium_count = premium_activities.count()
        premium_activities.update(points=3)
        self.stdout.write(f"✓ Updated {premium_count} ENROLLMENT_PREMIUM activities (4→3 points)")
        
        self.stdout.write("\n✓ Migration complete!")
        self.stdout.write("✓ Run 'sync_activity_scores' to update profile scores")
