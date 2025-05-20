# zporta/settings/local.py
from .base import *
from decouple import config, Csv
import os
from pathlib import Path
import pymysql
pymysql.install_as_MySQLdb()

# Explicitly specify the path to your .env file:
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = os.path.join(BASE_DIR, '.env')
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

from decouple import Config, RepositoryEnv
config = Config(RepositoryEnv(env_path))

# DEV: Use SQLite locally for simplicity
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'zporta_academy',
        'USER': 'root',
        'PASSWORD': 'rootpass',
        'HOST': '127.0.0.1',
        'PORT': '3307',
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': (
                "SET sql_mode='STRICT_TRANS_TABLES', "
                "NAMES utf8mb4"
            ),
        },
    }
}



DEBUG = True
ALLOWED_HOSTS = ['*']
CURRENT_DOMAIN = 'http://localhost:8000'
FRONTEND_URL_BASE = 'http://localhost:3000'
SECRET_KEY = config('SECRET_KEY', default='your-default-dev-secret-key')

STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
