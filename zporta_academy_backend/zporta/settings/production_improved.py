# zporta/settings/production.py
# Production configuration with security best practices

from .base import *
from pathlib import Path
import os
from decouple import Config, RepositoryEnv

# Set the base directory to the root of your backend project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Set the path to your .env file (located in the backend root)
env_path = os.path.join(BASE_DIR, '.env')
config = Config(RepositoryEnv(env_path))

# ==============================================
# CRITICAL SECURITY SETTINGS
# ==============================================

# ❌ NEVER set DEBUG = True in production
# This exposes sensitive information in error pages
DEBUG = False

# Allow production domains
ALLOWED_HOSTS = [
    '18.176.206.74',           # Server IP
    '127.0.0.1',               # Localhost
    'zportaacademy.com',       # Primary domain
    'www.zportaacademy.com',   # WWW subdomain
]

# Pull sensitive keys from .env file
SECRET_KEY = config('SECRET_KEY')
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY')

# ==============================================
# HTTPS & SECURITY HEADERS
# ==============================================

# ⚠️ IMPORTANT: Keep SECURE_SSL_REDIRECT = False
# Nginx/Cloudflare handles HTTP → HTTPS redirection
# Django redirect would cause redirect loops
SECURE_SSL_REDIRECT = False

# Trust X-Forwarded-Proto header from Nginx/Cloudflare
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Force cookies to only be sent over HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Additional security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000  # 1 year HSTS
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# X-Frame-Options to prevent clickjacking
X_FRAME_OPTIONS = 'DENY'

# ==============================================
# CSRF TRUSTED ORIGINS (No duplicates)
# ==============================================

CSRF_TRUSTED_ORIGINS = [
    'https://zportaacademy.com',
    'https://www.zportaacademy.com',
]

# ==============================================
# CORS CONFIGURATION
# ==============================================

# Override base.py CORS settings for production
CORS_ALLOWED_ORIGINS = [
    'https://zportaacademy.com',
    'https://www.zportaacademy.com',
]
CORS_ALLOW_CREDENTIALS = True

# ==============================================
# DATABASE CONFIGURATION
# ==============================================

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
            'init_command': (
                "SET NAMES utf8mb4; "
                "SET sql_mode='STRICT_TRANS_TABLES'; "
                "SET innodb_strict_mode=1;"
            ),
            # Connection pooling for better performance
            'connect_timeout': 10,
        },
        'CONN_MAX_AGE': 600,  # Keep connections alive for 10 minutes
    }
}

# ==============================================
# REDIS CACHE CONFIGURATION
# ==============================================

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'RETRY_ON_TIMEOUT': True,
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            },
        },
        'KEY_PREFIX': 'zporta',
        'TIMEOUT': 300,  # 5 minutes default
    }
}

# Use Redis for session storage (better performance than DB)
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# ==============================================
# STATIC & MEDIA FILES
# ==============================================

MEDIA_ROOT = BASE_DIR / 'media'
FORCE_MEDIA_PROTOCOL = 'https'

# Static files are handled by Nginx, not Django
# STATIC_URL and STATIC_ROOT inherited from base.py

# ==============================================
# URL CONFIGURATION
# ==============================================

FRONTEND_URL_BASE = 'https://zportaacademy.com'
QUIZ_ORIGIN = 'https://zportaacademy.com'

# ==============================================
# LOGGING CONFIGURATION
# ==============================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'django_errors.log',
            'maxBytes': 1024 * 1024 * 10,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'ERROR',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# ==============================================
# EMAIL CONFIGURATION
# ==============================================

# Inherited from base.py, but ensure it's production-ready
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
ADMINS = [('Admin', 'admin@zportaacademy.com')]
MANAGERS = ADMINS

# Send error emails to admins when DEBUG=False
SERVER_EMAIL = 'server@zportaacademy.com'

# ==============================================
# PERFORMANCE OPTIMIZATIONS
# ==============================================

# Template caching for production
TEMPLATES[0]['OPTIONS']['loaders'] = [
    ('django.template.loaders.cached.Loader', [
        'django.template.loaders.filesystem.Loader',
        'django.template.loaders.app_directories.Loader',
    ]),
]
