from django.conf import settings
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from courses.models import Course

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