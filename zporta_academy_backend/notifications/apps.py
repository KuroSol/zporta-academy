# notifications/apps.py
try:
    import firebase_admin
    from firebase_admin import credentials
except ImportError:
    firebase_admin = None
    credentials = None
from django.apps import AppConfig
from pathlib import Path

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'

    def ready(self):
        if firebase_admin and not firebase_admin._apps:
            try:
                cred_path = Path(__file__).resolve().parent.parent / 'zporta' / 'firebase_credentials.json'
                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    firebase_admin.initialize_app(cred)
                    app = firebase_admin.get_app()
                    print(f"Firebase Admin SDK initialized for project: {getattr(app, 'project_id', '?')}")
                else:
                    print(f"Firebase credential file NOT found at: {cred_path} (optional).")
            except Exception as e:
                print(f"Firebase initialization error (optional): {e}")