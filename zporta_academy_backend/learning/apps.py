# learning/apps.py
from django.apps import AppConfig

class LearningConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'learning'            # must match your folder name
    def ready(self):
        import learning.signals   # only if you’re using signals
