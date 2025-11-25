from django.db import models
from django.conf import settings


class TeacherMailMagazine(models.Model):
    FREQUENCY_CHOICES = [
        ('one_time', 'One Time'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mail_magazines'
    )
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default='one_time'
    )
    send_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    times_sent = models.IntegerField(default=0, help_text='Number of times this magazine has been sent')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    selected_recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='received_mail_magazines',
        blank=True,
        help_text='Select specific attendees to send this mail magazine to. Leave empty to send to all attendees.'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['teacher', 'is_active']),
            models.Index(fields=['frequency', 'is_active']),
        ]

    def __str__(self):
        return f"{self.title} by {self.teacher.username}"


class MailMagazineIssue(models.Model):
    """
    Stores each sent mail magazine issue for gated web viewing.
    Recipients can view past issues; optionally public if is_public=True.
    """
    magazine = models.ForeignKey(
        TeacherMailMagazine,
        on_delete=models.CASCADE,
        related_name='issues'
    )
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=200)
    html_content = models.TextField(help_text='Full HTML content including wrapper')
    sent_at = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=False, help_text='Make visible to non-recipients')
    recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='received_issues',
        help_text='Users who received this issue'
    )

    class Meta:
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['magazine', '-sent_at']),
        ]

    def __str__(self):
        return f"{self.subject} - {self.sent_at.strftime('%Y-%m-%d')}"
