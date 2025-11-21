from __future__ import annotations

# Ensure Celery app is always imported when Django starts so that
# shared_task decorators register tasks.
from .celery import app as celery_app  # noqa: F401

__all__ = ["celery_app"]
