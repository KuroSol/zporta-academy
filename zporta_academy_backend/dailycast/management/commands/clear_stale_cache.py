"""
Django management command to clear stale AI insight caches.

Usage:
    python manage.py clear_stale_cache                    # Clear all expired caches
    python manage.py clear_stale_cache --user 41          # Clear caches for user 41
    python manage.py clear_stale_cache --user 41 --all    # Clear ALL caches for user 41 (even fresh ones)
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from dailycast.models import CachedAIInsight
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Clear stale AI insight caches to force fresh analysis on next request'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=int,
            help='Clear caches for specific user ID'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Clear ALL caches for the user (even fresh ones)'
        )
        parser.add_argument(
            '--subject',
            type=str,
            help='Clear caches for specific subject'
        )

    def handle(self, *args, **options):
        user_id = options.get('user')
        clear_all = options.get('all', False)
        subject = options.get('subject', '')

        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User {user_id} not found'))
                return

            if clear_all:
                # Clear ALL caches for this user
                deleted, _ = CachedAIInsight.objects.filter(user=user).delete()
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Cleared {deleted} caches for user {user.username} (all)')
                )
            else:
                # Clear only expired caches for this user
                now = timezone.now()
                expired_caches = CachedAIInsight.objects.filter(
                    user=user,
                    expires_at__lt=now
                )
                count = expired_caches.count()
                expired_caches.delete()
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Cleared {count} expired caches for user {user.username}')
                )
        else:
            # Clear all expired caches globally
            now = timezone.now()
            expired_caches = CachedAIInsight.objects.filter(expires_at__lt=now)
            count = expired_caches.count()
            deleted, _ = expired_caches.delete()

            self.stdout.write(
                self.style.SUCCESS(f'✅ Cleared {deleted} expired caches globally')
            )

        self.stdout.write(self.style.SUCCESS('Next request will generate fresh analysis'))
