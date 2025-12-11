from django.apps import AppConfig


class AiCoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai_core'
    verbose_name = 'AI Core System'
    
    def ready(self):
        """Initialize AI system on startup"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info("✅ AI Core System loaded")
