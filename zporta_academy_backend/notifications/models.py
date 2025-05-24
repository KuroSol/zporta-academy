# --------------- Django Backend: notifications/models.py ---------------
from django.db import models
from django.conf import settings
from social.models import GuideRequest # Preserving user's import

# Merged Notification Model
class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_notifications' # Changed to avoid clash
    )
    title = models.CharField(max_length=255, default='Zporta Academy')
    message = models.TextField()
    link = models.URLField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    is_sent_push = models.BooleanField(default=False, help_text="Tracks if a push notification was successfully sent for this.") # Renamed from user's is_sent
    created_at = models.DateTimeField(auto_now_add=True)
    guide_request = models.ForeignKey( # Preserving user's field
        GuideRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications_for_guide_request' # Changed to avoid clash
    )

    def __str__(self): # Using user's __str__
        return f"Notification for {self.user.username}: {self.title} - {self.message[:30]}"

    class Meta: # Added from my suggestion
        ordering = ['-created_at']

# Merged FCMToken Model (based on my more detailed suggestion)
class FCMToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='fcm_devices' # Using my suggested related_name for clarity
    )
    device_id = models.CharField(max_length=255, help_text="A unique ID for the user's device/browser instance.") # Made non-nullable
    token = models.TextField(help_text="Firebase Cloud Messaging registration token.") # Removed db_index=True
    is_active = models.BooleanField(default=True, help_text="Token is active and can receive messages.")
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True, help_text="Timestamp of the last time this token was seen or used.")

    class Meta:
        unique_together = ('user', 'device_id') # Crucial for multiple devices per user
        ordering = ['user', '-last_seen']

    def __str__(self):
        return f"{self.user.username} on device {self.device_id} (Active: {self.is_active})"

# Merged FCMLog Model (based on my more detailed suggestion)
class FCMLog(models.Model):
    ACTION_CHOICES = [ # Using my more comprehensive choices
        ('register', 'Register Token'),
        ('send_attempt', 'Send Attempt'),
        ('send_success', 'Send Success'),
        ('send_failure', 'Send Failure'),
        ('prune_token', 'Prune Token'), 
        ('token_inactive', 'Mark Token Inactive'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, 
        null=True, blank=True
    )
    token = models.TextField(blank=True, help_text="The FCM token string involved.") # Changed from CharField to TextField
    device_id = models.CharField(max_length=255, blank=True, null=True, help_text="Device ID associated with the token, if available.") 
    action = models.CharField(max_length=20, choices=ACTION_CHOICES) 
    success = models.BooleanField(null=True, blank=True, help_text="Indicates success of the action, if applicable.") 
    detail = models.TextField(blank=True, help_text="E.g., error message, message ID, or 'Token created/updated'.")
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self): 
        status = ''
        if self.success is True: status = 'OK'
        elif self.success is False: status = 'FAIL'
        user_info = f"User: {self.user.username}" if self.user else "User: None"
        device_info = f"Device: {self.device_id}" if self.device_id else "Device: N/A"
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.action} {status} - Token: {self.token[:20] if self.token else 'N/A'}... - {user_info} - {device_info}"

    class Meta: 
        ordering = ['-timestamp']
