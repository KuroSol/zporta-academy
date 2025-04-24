# analytics/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
User = get_user_model()

class ActivityEvent(models.Model):
    EVENT_CHOICES = [
        ('lesson_clicked', 'Lesson Clicked'),
        ('quiz_started', 'Quiz Started'),
        ('quiz_submitted', 'Quiz Submitted'),
        ('quiz_answer_submitted', 'Quiz Answer Submitted'), # <-- ADD THIS LINE
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_events')
    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    metadata = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} {self.event_type} at {self.timestamp}"
