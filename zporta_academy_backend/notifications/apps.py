# notifications/apps.py

from django.apps import AppConfig
from pathlib import Path
import firebase_admin
from firebase_admin import credentials

class NotificationsConfig(AppConfig):
    name = 'notifications'

    def ready(self):
        # ✅ Initialize Firebase only once
        if not firebase_admin._apps:
            cred_path = Path(__file__).resolve().parent.parent / "zporta/firebase_credentials.json"

            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)

        # ✅ Register your signals (mentions, comments, etc.)
        import notifications.signals
