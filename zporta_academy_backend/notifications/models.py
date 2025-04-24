from django.db import models
from django.conf import settings
from social.models import GuideRequest

class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    message = models.TextField()
    link = models.URLField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    guide_request = models.ForeignKey(
        GuideRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message}"
