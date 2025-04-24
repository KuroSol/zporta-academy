# analytics/utils.py
from django.contrib.contenttypes.models import ContentType
from .models import ActivityEvent

def log_event(user, event_type, instance, metadata=None):
    """
    Logs an analytics event.
    
    :param user: The user performing the action.
    :param event_type: A string representing the event (e.g., 'quiz_opened').
    :param instance: The model instance associated with the event.
    :param metadata: Optional dictionary with additional event data.
    """
    content_type = ContentType.objects.get_for_model(instance.__class__)
    ActivityEvent.objects.create(
        user=user,
        event_type=event_type,
        content_type=content_type,
        object_id=instance.id,
        metadata=metadata or {}
    )
