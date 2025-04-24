# management/commands/create_user_folders.py
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Create media folders for existing users'

    def handle(self, *args, **kwargs):
        for user in User.objects.all():
            user_folder = os.path.join(settings.MEDIA_ROOT, f'user_{user.username}')
            if not os.path.exists(user_folder):
                os.makedirs(user_folder)
                self.stdout.write(self.style.SUCCESS(f'Created folder for {user.username}'))
            else:
                self.stdout.write(f'Folder already exists for {user.username}')
