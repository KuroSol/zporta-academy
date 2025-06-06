# analytics/apps.py
from django.apps import AppConfig

class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analytics'
    verbose_name = "Zporta Site Analytics"

    def ready(self):
        try:
            import analytics.signals  # Import signals if you have any defined
            # Example for future AI model loading:
            # from .utils import load_ml_model # A function you'd create in utils.py
            # load_ml_model() 
            logger.info("AnalyticsConfig ready method called.") # Basic log
        except ImportError:
            pass
        except Exception as e:
            # Log any other exception during ready
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in AnalyticsConfig.ready(): {e}", exc_info=True)

