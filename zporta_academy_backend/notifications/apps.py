# notifications/apps.py
# import firebase_admin # No longer needed here
# from firebase_admin import credentials # No longer needed here
from django.apps import AppConfig
# from pathlib import Path # No longer needed here

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'

    def ready(self):
        # Firebase Admin SDK initialization is now handled in zporta/settings/base.py
        # You can remove the Firebase initialization code from here.
        # Example: print("NotificationsConfig ready method called.")
        pass