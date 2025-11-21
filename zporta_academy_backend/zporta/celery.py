import os
from celery import Celery

# Default settings module (override via environment if needed)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.environ.get("DJANGO_SETTINGS_MODULE", "zporta.settings.production"))

app = Celery("zporta")

# Configure from Django settings with CELERY_ prefix mapping if later added
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscover tasks across installed apps
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):  # Simple test task
    return {"id": self.request.id, "args": self.request.args, "kwargs": self.request.kwargs}
