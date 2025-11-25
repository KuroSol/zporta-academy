from django.apps import AppConfig


class MailmagazineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mailmagazine'
    
    def ready(self):
        """Import signals when Django starts"""
        import mailmagazine.signals
