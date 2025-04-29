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

# --- STEP 1: Update ALLOWED_HOSTS ---
# Add your new domain (and www subdomain) that will access the server.
# Keep the IP if you might access it directly sometimes.
ALLOWED_HOSTS = [
    '54.95.178.162',   # Your server's IP address
    '127.0.0.1',        # Localhost on the server
    'eduhab.com',       # Your new domain
    'www.eduhab.com',   # The www version of your domain
    # Add 'zportaacademy.com', 'www.zportaacademy.com' later when you switch
]

# --- STEP 2: Update CSRF_TRUSTED_ORIGINS ---
# Trust requests coming from your domain via HTTPS (Cloudflare handles the HTTPS)
CSRF_TRUSTED_ORIGINS = [
    'http://54.95.178.162', # Keep IP if needed (use http if accessing directly without SSL)
    'http://127.0.0.1',      # Keep localhost
    'https://eduhab.com',    # Trust your domain with HTTPS
    'https://www.eduhab.com', # Trust www subdomain with HTTPS
    # Add 'https://zportaacademy.com', 'https://www.zportaacademy.com' later
]

# --- STEP 3: Update FRONTEND_URL_BASE (If used for generating links etc.) ---
# This should point to the primary URL users access your frontend from.
FRONTEND_URL_BASE = 'https://eduhab.com' # Use HTTPS

# *** ADDING the Correct MEDIA_ROOT definition ***
MEDIA_ROOT = BASE_DIR / 'media'
# MEDIA_URL = '/media/' # Inherited from base.py

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
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET NAMES utf8mb4",
        },
    }
}

# --- STEP 4: Update Security Settings for HTTPS via Proxy (Cloudflare) ---
# Tell Django to trust the X-Forwarded-Proto header from Cloudflare/Nginx
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Set cookies to only be sent over HTTPS
SESSION_COOKIE_SECURE = True # CHANGE TO TRUE
CSRF_COOKIE_SECURE = True    # CHANGE TO TRUE
# Other security headers (usually fine as they are)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
# SECURE_SSL_REDIRECT = False # Keep False - Nginx/Cloudflare handles redirection to HTTPS

# --- CORS Settings (Should be inherited from base.py, but ensure it's correct) ---
# Make sure CORS_ALLOWED_ORIGINS is defined correctly either here or in base.py
# If defined here, it should look like this:
# CORS_ALLOWED_ORIGINS = [
#     "https://eduhab.com",       # Allow frontend origin with HTTPS
#     "https://www.eduhab.com",  # Allow www subdomain if used
#     # "http://localhost:3000", # Only if needed for local dev against this backend
# ]
# CORS_ALLOW_CREDENTIALS = True # Should be True

# --- Static and Media files (Usually no changes needed here) ---
# STATIC_URL = '/django-static/' # Inherited
# STATIC_ROOT = BASE_DIR / 'staticfiles' # Inherited

# ... rest of your settings ...
