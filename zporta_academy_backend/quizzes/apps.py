
# quizzes/apps.py
from django.apps import AppConfig

class QuizzesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'quizzes'

    def ready(self):
        # ⬇️ ADD THIS LINE TO IMPORT YOUR SIGNALS ⬇️
        import quizzes.signals
