# user_media/apps.py
from django.apps import AppConfig

class UserMediaConfig(AppConfig):
    name = 'user_media'

    def ready(self):
        import user_media.signals  # This imports your signals so they're registered
