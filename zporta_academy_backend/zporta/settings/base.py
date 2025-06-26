# zporta/settings/base.py
from pathlib import Path
from decouple import config # Assuming you use python-decouple for config management
import firebase_admin
from firebase_admin import credentials
import os # Good for path joining if preferred, though Pathlib is used here

# --- Existing BASE_DIR Definition ---
BASE_DIR = Path(__file__).resolve().parent.parent

# --- Firebase Admin SDK Initialization ---
# Path to your service account key file, relative to BASE_DIR from this file
SERVICE_ACCOUNT_KEY_FILENAME = "firebase_credentials.json"
SERVICE_ACCOUNT_KEY_PATH = BASE_DIR / SERVICE_ACCOUNT_KEY_FILENAME

# Initialize Firebase Admin SDK (only if not already initialized)
if not firebase_admin._apps:
    try:
        if SERVICE_ACCOUNT_KEY_PATH.exists(): # Check if the file exists
            cred = credentials.Certificate(str(SERVICE_ACCOUNT_KEY_PATH)) # Path object needs to be string
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully from base.py.")
        else:
            print(f"Firebase Admin SDK: Service account key file not found at {SERVICE_ACCOUNT_KEY_PATH}")
            # Depending on your setup, you might want to raise an error here
            # or handle it if Firebase Admin SDK is optional for some environments.
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK in base.py: {e}")
# --- End of Firebase Admin SDK Initialization ---

# --- Your Existing INSTALLED_APPS ---
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
    'quizzes',
    'tags',
    'subjects',
    'seo',
    'media_manager',
    'notes',
    'enrollment.apps.EnrollmentConfig',
    'payments',
    'analytics',
    'social',
    'notifications', # This app will likely use the Firebase Admin SDK
    'mentions',
    'learning.apps.LearningConfig',
    'channels',
]

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


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='email-smtp.ap-northeast-1.amazonaws.com')
EMAIL_PORT = config('EMAIL_PORT', cast=int, default=587)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', cast=bool, default=True)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default=None) # Added default=None
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default=None) # Added default=None
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='info@zportaacademy.com')


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
    "https://zportaacademy.com",      # Allow frontend origin with HTTPS
    "https://www.zportaacademy.com",  # Allow www subdomain if used
]
CORS_ALLOW_CREDENTIALS = True
STATIC_ROOT = BASE_DIR / 'staticfiles' # For collectstatic in production
