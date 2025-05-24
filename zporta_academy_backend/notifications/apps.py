# notifications/apps.py
from django.apps import AppConfig
from django.conf import settings # Import settings
from pathlib import Path
import firebase_admin
from firebase_admin import credentials

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField' # Recommended for newer Django versions
    name = 'notifications'

    def ready(self):
        # Initialize Firebase only once
        if not firebase_admin._apps:
            try:
                # It's best to define the path to your credentials in settings.py
                # Example: FIREBASE_ADMIN_SDK_CREDENTIALS_FILE = BASE_DIR / "path_to_your_service_account_key.json"
                if hasattr(settings, 'FIREBASE_ADMIN_SDK_CREDENTIALS_FILE'):
                    cred_path_str = getattr(settings, 'FIREBASE_ADMIN_SDK_CREDENTIALS_FILE')
                    cred_path = Path(cred_path_str)

                    if cred_path.exists():
                        cred = credentials.Certificate(str(cred_path))
                        firebase_admin.initialize_app(cred)
                        print("Firebase Admin SDK initialized via NotificationsConfig.")
                    else:
                        print(f"Firebase Admin SDK: Credential file not found at {cred_path_str} (configured in settings).")
                else:
                    # Fallback or alternative path if not in settings (less ideal for flexibility)
                    # Example: cred_path = settings.BASE_DIR / "zporta" / "firebase_credentials.json"
                    # Ensure this path is correct for your project structure if using a hardcoded path.
                    # For this example, we'll assume the settings variable is preferred.
                    print("Firebase Admin SDK: FIREBASE_ADMIN_SDK_CREDENTIALS_FILE not configured in Django settings. Initialization skipped in apps.py.")

            except Exception as e:
                print(f"Error initializing Firebase Admin SDK in NotificationsConfig: {e}")
        
        # Register your signals
        import notifications.signals
        print("Notification signals imported and registered.")
