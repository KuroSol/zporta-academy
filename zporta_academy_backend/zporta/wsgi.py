# zporta/wsgi.py
import os

from django.core.wsgi import get_wsgi_application

#os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.local')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.production')

application = get_wsgi_application()



