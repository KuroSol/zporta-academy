from django.apps import AppConfig

class LessonsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'lessons'

    def ready(self):
        # Import signals to enable cache invalidation
        try:
            import lessons.signals  # noqa: F401
        except Exception:
            pass
