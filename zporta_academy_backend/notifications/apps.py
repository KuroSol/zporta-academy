import firebase_admin
from firebase_admin import credentials
from django.apps import AppConfig
from pathlib import Path

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'

    def ready(self):
        if not firebase_admin._apps:
            try:
                # ✅ Absolute path from backend base to firebase_credentials.json
                cred_path = Path(__file__).resolve().parent.parent / 'zporta' / 'firebase_credentials.json'

                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    firebase_admin.initialize_app(cred, {
                        'projectId': 'zporta-academy-web'  # ← THIS IS CRITICAL
                    })
                    print("✅ Firebase Admin SDK initialized.")
                else:
                    print(f"❌ Firebase credential file NOT found at: {cred_path}")
            except Exception as e:
                print(f"❌ Firebase initialization error: {e}")
