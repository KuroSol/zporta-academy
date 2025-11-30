# users/activity_models.py
"""
Unified activity-based scoring system for Zporta Academy.
Tracks all user activities (quizzes, lessons, courses) and calculates learning/impact scores.
"""
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone


class UserActivity(models.Model):
    """
    Tracks all user activities with points for learning/impact scoring.
    """
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('teacher', 'Teacher'),
    ]
    
    ACTIVITY_TYPE_CHOICES = [
        # Student activities
        ('CORRECT_ANSWER', 'Correct Answer'),
        ('LESSON_COMPLETED', 'Lesson Completed'),
        ('COURSE_COMPLETED', 'Course Completed'),
        
        # Teacher activities
        ('ENROLLMENT_FREE', 'Free Enrollment'),
        ('ENROLLMENT_PREMIUM', 'Premium Enrollment'),
        ('QUIZ_FIRST_ATTEMPT', 'First Quiz Attempt'),
        ('STANDALONE_LESSON', 'Standalone Lesson'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_activities',
        db_index=True
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, db_index=True)
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPE_CHOICES, db_index=True)
    points = models.IntegerField(default=0)
    
    # Optional: link to related objects (quiz, lesson, course, etc.)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Metadata for additional context
    metadata = models.JSONField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'role', 'created_at']),
            models.Index(fields=['user', 'activity_type', 'created_at']),
            models.Index(fields=['created_at']),
        ]
        verbose_name = 'User Activity'
        verbose_name_plural = 'User Activities'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_activity_type_display()} (+{self.points} points)"
    
    @classmethod
    def get_base_points(cls, activity_type):
        """Get base points for each activity type"""
        POINTS_MAP = {
            # Student activities
            'CORRECT_ANSWER': 1,
            'LESSON_COMPLETED': 1,  # +1 for any lesson (free or premium)
            'COURSE_COMPLETED': 3,
            
            # Teacher activities
            'ENROLLMENT_FREE': 2,
            'ENROLLMENT_PREMIUM': 3,  # +3 for premium enrollment
            'QUIZ_FIRST_ATTEMPT': 1,
            'STANDALONE_LESSON': 1,
        }
        return POINTS_MAP.get(activity_type, 0)
