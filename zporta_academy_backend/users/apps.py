from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        import users.signals  # This registers the signal handlers
        import users.activity_signals  # Register activity tracking signals
