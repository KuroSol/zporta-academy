# zporta/settings/local.py
from .base import *
from decouple import config, Csv
import os

# Explicitly specify the path to your .env file:
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = os.path.join(BASE_DIR, '.env')

from decouple import Config, RepositoryEnv
config = Config(RepositoryEnv(env_path))

DEBUG = True
ALLOWED_HOSTS = ['*']
CURRENT_DOMAIN = 'http://localhost:8000'
FRONTEND_URL_BASE = 'http://localhost:3000'
SECRET_KEY = config('SECRET_KEY', default='your-default-dev-secret-key')

STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
