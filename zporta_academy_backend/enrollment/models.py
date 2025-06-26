from django.conf import settings
import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from courses.models import Course

def generate_invite_token():
    """
    Generate a unique token for each ShareInvite.
    """
    return uuid.uuid4().hex

# Alias for backward compatibility or alternative naming
generate_token = generate_invite_token

class Enrollment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    enrollment_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=(('pending', 'Pending'), ('active', 'Active'), ('completed', 'Completed')),
        default='active'
    )
    enrollment_type = models.CharField(
        max_length=20,
        choices=(('pending', 'Pending'), ('course', 'Course'), ('quiz', 'Quiz'), ('lesson', 'Lesson')),
        default='course'
    )

    class Meta:
        ordering = ['-enrollment_date']
        unique_together = ('user', 'content_type', 'object_id')

    def __str__(self):
        return f"{self.user.username} enrolled in {self.content_object}"

class ShareInvite(models.Model):
    """
    Track each invitation event with a unique token per invite.
    """
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_shares'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_shares'
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        default=generate_invite_token,
        editable=False,
        help_text="Unique token generated per invite"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['enrollment', 'token'])]
        unique_together = ('enrollment', 'invited_user')

    def save(self, *args, **kwargs):
        # if you don’t already have a token, create one now
        if not self.token:
            self.token = uuid.uuid4().hex
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invited_by.username} invited {self.invited_user.username} to collaborate on {self.enrollment} at {self.created_at}"

# Collaboration session models to store drawings, highlights, and notes
class CollaborationSession(models.Model):
    """
    Represents a live collaboration session linked to an enrollment.
    """
    session_id = models.CharField(
        max_length=128,
        unique=True,
        help_text="Unique identifier for the real-time session"
    )
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name='collaboration_sessions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Session {self.session_id} for {self.enrollment}"

class SessionStroke(models.Model):
    """
    Stores free-draw strokes (points, color, width) for a session.
    """
    session = models.ForeignKey(
        CollaborationSession,
        on_delete=models.CASCADE,
        related_name='strokes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    # JSONField stores arrays of points and stroke properties
    stroke_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Stroke by {self.user.username} in {self.session.session_id} at {self.created_at}"

class SessionNote(models.Model):
    """
    Records text notes and highlight metadata during a session.
    """
    session = models.ForeignKey(
        CollaborationSession,
        on_delete=models.CASCADE,
        related_name='notes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    note = models.TextField()
    # Optional JSON metadata for highlights (e.g., range, style)
    highlight_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Note by {self.user.username} in {self.session.session_id} at {self.created_at}"

class CourseCompletion(models.Model):
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='course_completions'
    )
    course       = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='completions'
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'course')
        ordering        = ['-completed_at']
        indexes         = [models.Index(fields=['user', 'course'])]

    def __str__(self):
        return f"{self.user.username} completed {self.course.title} on {self.completed_at}"