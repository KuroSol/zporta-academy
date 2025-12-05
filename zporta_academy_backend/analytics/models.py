# analytics/models.py
import uuid
import logging 
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
import math

logger = logging.getLogger(__name__)
User = get_user_model()

class ActivityEvent(models.Model):
    EVENT_CHOICES = [
        ('content_viewed', 'Content Viewed'), 
        ('content_interaction_time', 'Content Interaction Time'),
        ('quiz_started', 'Quiz Started'),
        ('quiz_completed', 'Quiz Completed'), 
        ('quiz_submitted', 'Quiz Submitted'), 
        ('quiz_answer_submitted', 'Quiz Answer Submitted'), 
        ('quiz_session_time', 'Quiz Session Time'), 
        ('question_focused', 'Question Focused'), 
        ('question_unfocused', 'Question Unfocused'), 
        ('question_interaction_time', 'Question Interaction Time'), 
        ('lesson_clicked', 'Lesson Clicked'), 
        ('lesson_completed', 'Lesson Completed'),
        # New event type for analytics reports
        ('analytics_report_generated', 'Analytics Report Generated'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analytics_activity_events', null=True, blank=True) # Allow null for system events
    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    session_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        default=None,
        help_text="UUID for a single continuous quiz attempt"
    )
    metadata = models.JSONField(null=True, blank=True, help_text="Stores event-specific data.")

    def clean(self):
        """
        Validate metadata to prevent corruption.
        
        Ensures metadata is either:
        - None/null (allowed)
        - A dict (JSON object) - the expected type
        
        Rejects:
        - Numeric types (int, float) that cause Django JSONField decoder errors
        - Strings, lists without proper structure
        """
        super().clean()
        
        if self.metadata is not None:
            if not isinstance(self.metadata, dict):
                raise ValidationError({
                    'metadata': f'Metadata must be a dictionary (JSON object), not {type(self.metadata).__name__}. '
                               f'Got value: {self.metadata}'
                })
    
    def save(self, *args, **kwargs):
        """Override save to always validate metadata before saving."""
        self.full_clean()  # This calls clean() and validates all fields
        super().save(*args, **kwargs)

    def __str__(self):
        username = self.user.username if self.user else 'System/Anonymous'
        content_obj_str = str(self.content_object) if self.content_object else 'N/A'
        return f"Event: {username} - {self.get_event_type_display()} for {content_obj_str} at {self.timestamp.strftime('%Y-%m-%d %H:%M')}"

    class Meta:
        verbose_name = "Activity Event (Analytics)"
        verbose_name_plural = "Activity Events (Analytics)"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'event_type']),
            models.Index(fields=['content_type', 'object_id', 'event_type']),
        ]

class MemoryStat(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memory_stats_analytics')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, help_text="The type of the learnable item.")
    object_id = models.PositiveIntegerField(help_text="The ID of the learnable item.")
    learnable_item = GenericForeignKey('content_type', 'object_id')

    interval_days = models.FloatField(default=0.0, help_text="Current review interval in days (I(n)).")
    easiness_factor = models.FloatField(default=2.5, help_text="Easiness Factor (EF), min 1.3.")
    repetitions = models.IntegerField(default=0, help_text="Number of times reviewed correctly in a row (n).")
    last_reviewed_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp of the last review/attempt for this item.")
    next_review_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text="Recommended next review timestamp based on SM-2.")
    current_retention_estimate = models.FloatField(default=1.0, help_text="Estimated current retention (0.0 to 1.0), decays over time.")
    last_quality_of_recall = models.IntegerField(null=True, blank=True, help_text="The quality of recall (0-5) from the last review.")
    last_time_spent_ms = models.PositiveIntegerField(null=True, blank=True, help_text="Time spent in milliseconds on the last review/answer of this item.")
    
    # Field to store AI-driven insights (e.g., predicted difficulty, optimal interval)
    ai_insights = models.JSONField(null=True, blank=True, help_text="Stores insights from AI models, e.g., {'predicted_difficulty': 'medium'}")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'content_type', 'object_id')
        verbose_name = "User Memory Statistic"
        verbose_name_plural = "User Memory Statistics"
        ordering = ['user', '-updated_at']
        indexes = [
            models.Index(fields=['user', 'next_review_at']),
            models.Index(fields=['user', 'content_type', 'object_id', 'last_reviewed_at']),
        ]

    def __str__(self):
        item_str = "N/A"
        try:
            if self.learnable_item: item_str = str(self.learnable_item)
            else:
                ct_model = self.content_type.model_class()
                if ct_model:
                    item = ct_model.objects.filter(pk=self.object_id).first()
                    item_str = str(item) if item else f"{self.content_type.model} ID {self.object_id} (not found)"
        except Exception as e:
            logger.warning(f"Error resolving learnable_item for MemoryStat ID {self.id}: {e}")
            item_str = f"{self.content_type.model if self.content_type else 'UnknownType'} ID: {self.object_id}"
        next_review_str = self.next_review_at.strftime('%Y-%m-%d') if self.next_review_at else "N/A"
        return f"MemoryStat for {self.user.username} on '{item_str[:50]}...' (Next: {next_review_str})"

    def update_daily_retention_decay(self, stability_factor_base_multiplier=1.5, min_stability=0.5, max_stability_contribution_from_interval=180):
        if not self.last_reviewed_at:
            if self.current_retention_estimate != 0.0:
                 self.current_retention_estimate = 0.0 
                 self.save(update_fields=['current_retention_estimate', 'updated_at'])
            return False

        time_since_review_days = (timezone.now() - self.last_reviewed_at).total_seconds() / (60 * 60 * 24)

        if time_since_review_days <= 0: 
            if self.current_retention_estimate != 1.0:
                self.current_retention_estimate = 1.0
                self.save(update_fields=[
                        'interval_days', 'easiness_factor', 'repetitions',
                        'last_reviewed_at', 'next_review_at',
                        'current_retention_estimate', 'last_quality_of_recall',
                        'last_time_spent_ms', 'ai_insights', 'updated_at'
                    ])
            return False 

        capped_interval_contribution = min(self.interval_days, max_stability_contribution_from_interval)
        ef_multiplier = self.easiness_factor / 2.5 if self.easiness_factor else 1.0
        stability_s = max(min_stability, capped_interval_contribution * ef_multiplier * stability_factor_base_multiplier)
        
        if stability_s <= 0: stability_s = min_stability
            
        new_retention_estimate = round(math.exp(-time_since_review_days / stability_s), 4)

        if self.current_retention_estimate != new_retention_estimate: 
            self.current_retention_estimate = new_retention_estimate
            self.save(update_fields=['current_retention_estimate', 'updated_at'])
            return True
        return False
    
class FeedExposure(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    quiz = models.ForeignKey('quizzes.Quiz', on_delete=models.CASCADE)
    source = models.CharField(max_length=50)  # e.g., review/personalized/explore
    shown_at = models.DateTimeField(auto_now_add=True)

class QuizAttempt(models.Model):


    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    quiz        = models.ForeignKey('quizzes.Quiz', on_delete=models.CASCADE)
    is_correct  = models.BooleanField()
    attempted_at= models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attempted_at']

class QuizSessionProgress(models.Model):
    IN_PROGRESS = 'in_progress'
    COMPLETED   = 'completed'
    STATUS_CHOICES = [
        (IN_PROGRESS, 'In Progress'),
        (COMPLETED,   'Completed'),
    ]

    user            = models.ForeignKey(
                         settings.AUTH_USER_MODEL,
                         on_delete=models.CASCADE,
                         related_name='quiz_session_progresses'
                      )
    quiz            = models.ForeignKey(
                         'quizzes.Quiz',
                         on_delete=models.CASCADE,
                         related_name='session_progresses'
                      )
    session_id      = models.UUIDField(
                         default=uuid.uuid4,
                         unique=True,
                         db_index=True,
                         help_text="UUID for this quiz attempt"
                      )
    total_questions = models.PositiveIntegerField(
                         help_text="Set once on creation from quiz.questions.count()"
                      )
    answered_count  = models.PositiveIntegerField(
                         default=0,
                         help_text="Number of questions answered so far"
                      )
    correct_count   = models.PositiveIntegerField(
                         default=0,
                         help_text="Number of correct answers so far"
                      )
    status          = models.CharField(
                         max_length=20,
                         choices=STATUS_CHOICES,
                         default=IN_PROGRESS
                      )
    started_at      = models.DateTimeField(help_text="When first answer was logged")
    completed_at    = models.DateTimeField(
                         null=True,
                         blank=True,
                         help_text="When answered_count == total_questions"
                      )

    class Meta:
        verbose_name = "Quiz Session Progress"
        verbose_name_plural = "Quiz Session Progresses"
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['session_id']),
            models.Index(fields=['user', 'quiz', 'status']),
        ]

    def __str__(self):
        return f"Session {self.session_id} ({self.status}) for {self.user.username}"