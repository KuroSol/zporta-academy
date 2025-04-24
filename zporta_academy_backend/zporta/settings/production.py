# zporta/settings/production.py
# Based on server version, adding MEDIA_ROOT

from .base import * # Imports STATIC_URL='/django-static/' etc. from base.py now

from pathlib import Path
import os
from decouple import Config, RepositoryEnv

# Set the base directory to the root of your backend project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Set the path to your .env file (located in the backend root)
env_path = os.path.join(BASE_DIR, '.env')
config = Config(RepositoryEnv(env_path))

# Production settings
DEBUG = False

# Use your public IPv4 address for production (or a domain if you have one)
# Keeping the server's correct ALLOWED_HOSTS
ALLOWED_HOSTS = ['34.194.162.240', '127.0.0.1']

# Keeping the server's correct CSRF_TRUSTED_ORIGINS
CSRF_TRUSTED_ORIGINS = ['http://34.194.162.240','http://127.0.0.1']
FRONTEND_URL_BASE = 'http://34.194.162.240' 
# *** ADDING the Correct MEDIA_ROOT definition ***
MEDIA_ROOT = BASE_DIR / 'media'
# MEDIA_URL = '/media/' # This should already be inherited correctly from base.py

# Pull sensitive keys from your .env file
SECRET_KEY = config('SECRET_KEY')
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY')

# Database configuration using MySQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='3306'),
    }
}

# Additional security settings
# Keeping the server's correct settings for HTTP (False)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = False # Correct for HTTP
CSRF_COOKIE_SECURE = False    # Correct for HTTP
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = False  # Set to True if you install SSL/TLS certificates