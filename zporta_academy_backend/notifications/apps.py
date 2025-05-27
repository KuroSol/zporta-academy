# notifications/apps.py
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
                # Adjust this path if your firebase_credentials.json is elsewhere relative to apps.py
                cred_path = Path(__file__).resolve().parent.parent / 'zporta' / 'firebase_credentials.json'

                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    firebase_admin.initialize_app(cred)
                    app = firebase_admin.get_app() # Get the initialized app
                    print(f"DEBUG ON SERVER: Firebase Admin SDK initialized for project: {app.project_id}") # <<< DEBUG LINE
                    print("✅ Firebase Admin SDK initialized.")
                else:
                    print(f"❌ Firebase credential file NOT found at: {cred_path} (from apps.py)")
            except Exception as e:
                print(f"❌ Firebase initialization error in apps.py: {e}")