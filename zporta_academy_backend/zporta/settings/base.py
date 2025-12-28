# zporta/settings/base.py
from pathlib import Path
import importlib
from decouple import config # Assuming you use python-decouple for config management
import os # Good for path joining if preferred, though Pathlib is used here

# Firebase is optional; guard import to avoid hard dependency during migrations or minimal installs
try:
    import firebase_admin
    from firebase_admin import credentials
except ImportError:  # Provide graceful fallback
    firebase_admin = None
    credentials = None

# --- Existing BASE_DIR Definition ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# --- Google TTS / Dailycast settings ---
GOOGLE_CREDENTIALS_DEFAULT = BASE_DIR / "google-credentials.json"

# Force authoritative path to avoid stale env values (e.g., Downloads/...json)
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(GOOGLE_CREDENTIALS_DEFAULT)
print(f"[OK] GOOGLE_APPLICATION_CREDENTIALS -> {GOOGLE_CREDENTIALS_DEFAULT}")

# --- ElevenLabs TTS API Key ---
ELEVENLABS_API_KEY = "sk_1fa574d07736f4b13cc861985064ff00509b4d3eacd04982"
print(f"[OK] ELEVENLABS_API_KEY configured")

# --- Firebase Admin SDK Initialization ---
# Path to your service account key file, relative to BASE_DIR from this file
SERVICE_ACCOUNT_KEY_FILENAME = "firebase_credentials.json"
SERVICE_ACCOUNT_KEY_PATH = BASE_DIR / SERVICE_ACCOUNT_KEY_FILENAME

# Initialize Firebase Admin SDK (only if not already initialized)
# Firebase is OPTIONAL for local development
if firebase_admin and not firebase_admin._apps:
    try:
        if SERVICE_ACCOUNT_KEY_PATH.exists():
            cred = credentials.Certificate(str(SERVICE_ACCOUNT_KEY_PATH))
            firebase_admin.initialize_app(cred)
            print("[OK] Firebase Admin SDK initialized successfully.")
        else:
            print(f"[WARN] Firebase Admin SDK: Service account key file not found at {SERVICE_ACCOUNT_KEY_PATH}")
            print("[WARN] Firebase features disabled (optional).")
    except Exception as e:
        print(f"[WARN] Error initializing Firebase Admin SDK: {e}")
        print("[WARN] Continuing without Firebase (optional).")
# --- End of Firebase Admin SDK Initialization ---

# --- Your Existing INSTALLED_APPS ---
def _optional(app_config_path: str):
    try:
        module_path = app_config_path.split('.apps.')[0]
        importlib.import_module(module_path)
        return [app_config_path]
    except Exception:
        print(f"⚠️  Optional app not found: {app_config_path}. Skipping.")
        return []

INSTALLED_APPS = [
    'django_cleanup.apps.CleanupConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'user_media.apps.UserMediaConfig',
    'rest_framework',
    'django_filters',
    'users.apps.UsersConfig',
    'rest_framework.authtoken',
    'django_extensions',
    'corsheaders',
    'pages',
    'posts',
    'django_ckeditor_5',
    'courses',
    'lessons',
    'quizzes.apps.QuizzesConfig',
    'tags',
    'subjects',
    'seo',
    'media_manager',
    'notes',
    'enrollment.apps.EnrollmentConfig',
    'payments',
    'analytics',
    'intelligence.apps.IntelligenceConfig',  # AI Intelligence & Ranking System
    'social',
    'notifications', # This app will likely use the Firebase Admin SDK
    'mentions',
    'learning.apps.LearningConfig',
    'channels',
    'feed',
    'explorer',
    'dailycast.apps.DailycastConfig',
    'django.contrib.sitemaps',
    'mailmagazine',
    'bulk_import.apps.BulkImportConfig',  # Bulk import courses, lessons, quizzes
    'assets.apps.AssetsConfig',  # Asset library for images, audio, etc
] + _optional('gamification.apps.GamificationConfig')

ASGI_APPLICATION = 'zporta.asgi.application'

 # For dev you can use the in-memory layer; swap in Redis for production
CHANNEL_LAYERS = {
      "default": {
          "BACKEND": "channels.layers.InMemoryChannelLayer"
      }
 }

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'seo.middleware.SEOMiddleware',
    'media_manager.middleware.UpdateDomainMiddleware',
    # Performance / observability middleware (added for slow request logging)
    'zporta.middleware.SlowRequestLoggingMiddleware',
]

ROOT_URLCONF = 'zporta.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'zporta.wsgi.application'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

USE_AWS = False # Assuming this is for S3 media storage, not relevant to Firebase Admin
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# --- Email Settings for Google Workspace ---
# For this to work, you must generate an "App Password" for your Google Account.
# Using your regular password will not work if you have 2-Step Verification enabled (which is recommended).
#
# How to generate an App Password:
# 1. Go to your Google Account: https://myaccount.google.com/
# 2. Go to the "Security" tab on the left.
# 3. Under "How you sign in to Google," click on "2-Step Verification." You must have this enabled.
# 4. At the bottom of the "2-Step Verification" page, click on "App passwords".
# 5. Give the app a name (e.g., "Django Zporta") and click "Create".
# 6. Google will generate a 16-character password. Copy this password.
# 7. Use this generated password for the EMAIL_HOST_PASSWORD in your .env file.

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', cast=int, default=587)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', cast=bool, default=True)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default=None) # Your full Google Workspace email (e.g., user@yourdomain.com)
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default=None) # The 16-character App Password you generated
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='info@zportaacademy.com') # Should be the same as EMAIL_HOST_USER for best results

# Email Branding Configuration
SITE_NAME = config('SITE_NAME', default='Zporta Academy')
SITE_URL = config('SITE_URL', default='https://zportaacademy.com')
SITE_LOGO_URL = config('SITE_LOGO_URL', default='https://zportaacademy.com/logo192.png')
EMAIL_SENDER_NAME = config('EMAIL_SENDER_NAME', default='Zporta Academy')

# Fallback: if credentials are missing in local dev, switch to console backend to avoid SMTP errors.
if (not EMAIL_HOST_USER) or (not EMAIL_HOST_PASSWORD) or EMAIL_HOST_PASSWORD == '':
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    print('[WARN] Email credentials missing; using console backend (emails will print to terminal).')
else:
    # Ensure app password format (no spaces) to reduce common mistakes; warn if spaces present.
    if ' ' in EMAIL_HOST_PASSWORD:
        print('[WARN] EMAIL_HOST_PASSWORD contains spaces. Remove spaces from your 16-character Gmail App Password.')


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'django-static/'
STATICFILES_DIRS = [BASE_DIR / "static"] # For local development static files
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3000",
    "https://zportaacademy.com",      # Allow frontend origin with HTTPS
    "https://www.zportaacademy.com",  # Allow www subdomain if used
]
CORS_ALLOW_CREDENTIALS = True
STATIC_ROOT = BASE_DIR / 'staticfiles' # For collectstatic in production

# --- Dailycast prototype settings ---
OPENAI_API_KEY = config('OPENAI_API_KEY', default=None)
GEMINI_API_KEY = config('GEMINI_API_KEY', default=None)
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default=None)
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default=None)
AWS_REGION = config('AWS_REGION', default='us-east-1')
DAILYCAST_TEST_USER_ID = config('DAILYCAST_TEST_USER_ID', cast=int, default=1)
DAILYCAST_DEFAULT_LANGUAGE = config('DAILYCAST_DEFAULT_LANGUAGE', default='en')

# --- Logging Configuration (debugging) ---
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'dailycast': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
