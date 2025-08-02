# analytics/apps.py
import logging
from django.apps import AppConfig

# Bind logger so it exists when ready() runs
logger = logging.getLogger(__name__)

class AnalyticsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analytics'
    verbose_name = "Zporta Site Analytics"

    def ready(self):
        try:
            import analytics.signals  # wire up your signal handlers
            logger.info("AnalyticsConfig ready — signals imported.")
        except ImportError:
            # if analytics.signals doesn't exist yet, ignore
            pass
        except Exception as e:
            logger.error(f"Error in AnalyticsConfig.ready(): {e}", exc_info=True)

