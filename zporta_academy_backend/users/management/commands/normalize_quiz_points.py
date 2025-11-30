# users/management/commands/normalize_quiz_points.py
from django.core.management.base import BaseCommand
from django.db import transaction
from users.activity_models import UserActivity

class Command(BaseCommand):
    help = "Normalize existing CORRECT_ANSWER activities to points=1 (quiz-level scoring)"

    def handle(self, *args, **options):
        self.stdout.write("=== Normalizing CORRECT_ANSWER activities to points=1 ===")
        with transaction.atomic():
            qs = UserActivity.objects.filter(activity_type='CORRECT_ANSWER').exclude(points=1)
            count = qs.count()
            qs.update(points=1)
        self.stdout.write(self.style.SUCCESS(f"Updated {count} activities."))
        self.stdout.write(self.style.SUCCESS("Done."))
