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
                cred_path = Path(__file__).resolve().parent.parent / 'zporta' / 'firebase_credentials.json'

                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    # MODIFICATION: Initialize without the projectId override
                    firebase_admin.initialize_app(cred)
                    # You can optionally print the project ID from the credential itself to verify
                    # app = firebase_admin.get_app()
                    # print(f"✅ Firebase Admin SDK initialized for project: {app.project_id}")
                    print("✅ Firebase Admin SDK initialized.")
                else:
                    print(f"❌ Firebase credential file NOT found at: {cred_path}")
            except Exception as e:
                print(f"❌ Firebase initialization error: {e}")