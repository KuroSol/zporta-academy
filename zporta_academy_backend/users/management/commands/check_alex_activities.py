# users/management/commands/check_alex_activities.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.activity_models import UserActivity

User = get_user_model()

class Command(BaseCommand):
    help = "Check Alex's activities to debug scoring"

    def handle(self, *args, **options):
        try:
            alex = User.objects.get(username='Alex')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR("User 'Alex' not found"))
            return
        
        acts = UserActivity.objects.filter(user=alex, role='student').order_by('created_at')
        self.stdout.write(f"\n=== Alex's Student Activities (Total: {acts.count()}) ===\n")
        
        total_points = 0
        for a in acts:
            total_points += a.points
            self.stdout.write(f"{a.created_at.strftime('%Y-%m-%d %H:%M:%S')} | {a.activity_type:30} | +{a.points:2} pts")
            if a.metadata:
                self.stdout.write(f"  └─ {a.metadata}")
        
        self.stdout.write(f"\n=== Total Points: {total_points} ===")
