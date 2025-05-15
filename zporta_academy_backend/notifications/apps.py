from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
    def ready(self):
        # import the signal handlers so Django registers them
        import notifications.signals