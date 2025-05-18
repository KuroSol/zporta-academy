from django.db import models
from django.conf import settings
from social.models import GuideRequest

class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255, default='Zporta Academy')  # ✅ Add title field for push
    message = models.TextField()
    link = models.URLField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    is_sent = models.BooleanField(default=False)  # ✅ Track push delivery
    created_at = models.DateTimeField(auto_now_add=True)
    guide_request = models.ForeignKey(
        GuideRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )

    def __str__(self):
        return f"Notification for {self.user.username}: {self.title} - {self.message[:30]}"

class FCMToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"FCM Token for {self.user.username}"
