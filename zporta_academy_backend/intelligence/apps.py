# intelligence/apps.py
from django.apps import AppConfig


class IntelligenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'intelligence'
    verbose_name = 'AI Intelligence & Ranking System'
    
    def ready(self):
        """
        Initialize app signals and ensure ML models are available.
        """
        pass
