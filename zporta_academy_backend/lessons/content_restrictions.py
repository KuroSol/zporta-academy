# lessons/content_restrictions.py
from django.db import models
from django.contrib.auth.models import User
from courses.models import Course
from .models import Lesson

class ContentRestriction(models.Model):
    """
    Model to track premium content sections within lessons that require 
    access to specific premium courses.
    """
    lesson = models.ForeignKey(
        Lesson, 
        on_delete=models.CASCADE, 
        related_name='content_restrictions'
    )
    required_course = models.ForeignKey(
        Course, 
        on_delete=models.CASCADE,
        related_name='restricted_content',
        help_text="Premium course that users must have purchased to access this content"
    )
    content_tag_id = models.CharField(
        max_length=100,
        help_text="Unique identifier for the content section within the lesson HTML"
    )
    restriction_message = models.TextField(
        default="This content is available to premium course members only.",
        help_text="Message shown to users who don't have access"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_content_restrictions'
    )

    class Meta:
        unique_together = ('lesson', 'content_tag_id')
        indexes = [
            models.Index(fields=['lesson', 'required_course']),
            models.Index(fields=['content_tag_id']),
        ]

    def __str__(self):
        return f"Restriction on {self.lesson.title} - requires {self.required_course.title}"

    def clean(self):
        """Validate that the required course is premium and not a draft"""
        from django.core.exceptions import ValidationError
        
        if self.required_course:
            if self.required_course.course_type != 'premium':
                raise ValidationError({
                    'required_course': 'Content can only be restricted to premium courses.'
                })
            if self.required_course.is_draft:
                raise ValidationError({
                    'required_course': 'Cannot restrict content to draft courses. Publish the course first.'
                })