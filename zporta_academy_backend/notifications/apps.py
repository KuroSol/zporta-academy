# zporta_academy_backend/notifications/apps.py

import firebase_admin
from firebase_admin import credentials
from django.apps import AppConfig
from pathlib import Path
import os

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'

    def ready(self):
        if not firebase_admin._apps:
            try:
                # ✅ Absolute path from BASE_DIR
                base_dir = Path(__file__).resolve().parent.parent  # This resolves to zporta_academy_backend/
                cred_path = base_dir / 'zporta' / 'firebase_credentials.json'

                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    firebase_admin.initialize_app(cred, {
                        'projectId': 'zporta-academy-web'
                    })
                    print("✅ Firebase Admin SDK initialized.")
                else:
                    print(f"❌ Firebase credentials file NOT found at: {cred_path}")
            except Exception as e:
                print(f"❌ Firebase initialization error: {e}")
