# zporta/settings/production.py
# Production configuration for Zporta Academy on Ubuntu 22.04 AWS
# Server: 18.176.206.74 (ap-northeast-1a)
# Stack: Django → Nginx → Let's Encrypt SSL → Next.js (port 3001)

from .base import *
from pathlib import Path
import os
from decouple import config

# ==============================================
# BASE DIRECTORY
# ==============================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ==============================================
# CRITICAL SECURITY SETTINGS
# ==============================================

# ❌ NEVER set DEBUG = True in production
DEBUG = False

# Required secret key (must be in .env file)
SECRET_KEY = config('SECRET_KEY')

# Allowed domains (matching Nginx server_name)
ALLOWED_HOSTS = [
    'zportaacademy.com',
    'www.zportaacademy.com',
    '18.176.206.74',  # Server IP
    '127.0.0.1',      # Localhost
]

# ==============================================
# HTTPS & SECURITY HEADERS
# ==============================================

# ⚠️ CRITICAL: SECURE_SSL_REDIRECT = False
# Your Nginx handles HTTP → HTTPS redirect (line: return 301 https://$host$request_uri)
# Setting this to True would cause redirect loops!
SECURE_SSL_REDIRECT = False

# Trust X-Forwarded-Proto header from Nginx
# Nginx sets: proxy_set_header X-Forwarded-Proto $scheme;
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Force cookies to only be sent over HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Additional security headers (Nginx also sets these)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
X_FRAME_OPTIONS = 'SAMEORIGIN'  # Match Nginx setting

# ==============================================
# CSRF & CORS CONFIGURATION
# ==============================================

# CSRF trusted origins (no duplicates)
CSRF_TRUSTED_ORIGINS = [
    'https://zportaacademy.com',
    'https://www.zportaacademy.com',
]

# CORS for Next.js frontend (port 3001)
CORS_ALLOWED_ORIGINS = [
    'https://zportaacademy.com',
    'https://www.zportaacademy.com',
]
CORS_ALLOW_CREDENTIALS = True

# ==============================================
# URL CONFIGURATION
# ==============================================

FRONTEND_URL_BASE = 'https://zportaacademy.com'
QUIZ_ORIGIN = 'https://zportaacademy.com'
CURRENT_DOMAIN = 'https://zportaacademy.com'

# ==============================================
# DATABASE CONFIGURATION (MySQL via Unix Socket)
# ==============================================

db_host = config('DB_HOST')
db_port = config('DB_PORT', default='')

# Your server uses Unix socket: /var/run/mysqld/mysqld.sock
if db_host.startswith('/'):
    # Unix socket connection (production server)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('DB_NAME'),              # zporta_db
            'USER': config('DB_USER'),              # zporta_user
            'PASSWORD': config('DB_PASSWORD'),
            'HOST': '',                             # Empty for socket
            'PORT': '',                             # Empty for socket
            'OPTIONS': {
                'unix_socket': db_host,             # /var/run/mysqld/mysqld.sock
                'charset': 'utf8mb4',
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES', NAMES utf8mb4",
            },
            'CONN_MAX_AGE': 600,  # Keep connections alive for 10 minutes
        }
    }
else:
    # TCP connection (fallback for local testing)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('DB_NAME'),
            'USER': config('DB_USER'),
            'PASSWORD': config('DB_PASSWORD'),
            'HOST': db_host,
            'PORT': db_port or '3306',
            'OPTIONS': {
                'charset': 'utf8mb4',
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES', NAMES utf8mb4",
                'connect_timeout': 10,
            },
            'CONN_MAX_AGE': 600,
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

# Use Redis for session storage (better performance)
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# ==============================================
# STATIC & MEDIA FILES
# ==============================================

# Static files served by Nginx from: /home/ubuntu/zporta-academy/zporta_academy_backend/staticfiles/
# Nginx location: /django-static/ { alias /home/ubuntu/zporta-academy/zporta_academy_backend/staticfiles/; }
# STATIC_URL = 'django-static/' (inherited from base.py)
# STATIC_ROOT = BASE_DIR / 'staticfiles' (inherited from base.py)

# Media files served by Nginx from: /home/ubuntu/zporta-academy/zporta_academy_backend/media/
# Nginx location: /media/ { alias /home/ubuntu/zporta-academy/zporta_academy_backend/media/; }
MEDIA_ROOT = BASE_DIR / 'media'
# MEDIA_URL = '/media/' (inherited from base.py)
FORCE_MEDIA_PROTOCOL = 'https'

# ==============================================
# PAYMENT CONFIGURATION (STRIPE LIVE KEYS)
# ==============================================

# ⚠️ Using LIVE Stripe keys - real payments will be processed!
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY')  # sk_live_...
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY')  # pk_live_...
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')  # whsec_...

# ==============================================
# EMAIL CONFIGURATION
# ==============================================

# Email settings inherited from base.py
# Ensure these are in your .env file:
# EMAIL_HOST_USER=your-email@zportaacademy.com
# EMAIL_HOST_PASSWORD=your-app-password
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
ADMINS = [('Admin', 'admin@zportaacademy.com')]
MANAGERS = ADMINS
SERVER_EMAIL = 'server@zportaacademy.com'

# ==============================================
# LOGGING CONFIGURATION
# ==============================================

# Create logs directory if it doesn't exist
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name} {module}: {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'django_errors.log',
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
            'handlers': ['file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# ==============================================
# PERFORMANCE OPTIMIZATIONS
# ==============================================

# Enable template caching in production
TEMPLATES[0]['OPTIONS']['loaders'] = [
    ('django.template.loaders.cached.Loader', [
        'django.template.loaders.filesystem.Loader',
        'django.template.loaders.app_directories.Loader',
    ]),
]
