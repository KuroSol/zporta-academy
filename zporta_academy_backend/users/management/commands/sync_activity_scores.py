# users/management/commands/sync_activity_scores.py
"""
Sync user scores from UserActivity to Profile for display consistency.
Also backfill any missing activities.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.scoring_service import ScoringService
from users.models import Profile

User = get_user_model()


class Command(BaseCommand):
    help = 'Sync UserActivity scores to Profile.growth_score and Profile.impact_score'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n=== Syncing Activity Scores to Profile ===\n'))
        
        users = User.objects.all()
        synced = 0
        
        for user in users:
            try:
                profile, _ = Profile.objects.get_or_create(user=user)
                
                # Get scores from UserActivity (all-time)
                learning_score = ScoringService.get_learning_score(user)
                impact_score = ScoringService.get_impact_score(user)
                
                # Update profile
                profile.growth_score = learning_score
                profile.impact_score = impact_score
                profile.save(update_fields=['growth_score', 'impact_score'])
                
                synced += 1
                
                self.stdout.write(
                    f'✓ {user.username}: Learning={learning_score}, Impact={impact_score}'
                )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'✗ Error syncing {user.username}: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'\n=== Synced {synced} user profiles ===\n')
        )
