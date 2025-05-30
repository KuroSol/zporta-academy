from django.apps import AppConfig

class EnrollmentConfig(AppConfig):
    name = 'enrollment'

    def ready(self):
        # use a relative import so Django always finds your signals.py
        from . import signals