# learning/models.py

from django.db import models
from enrollment.models import Enrollment
from subjects.models import Subject  # Change if your model is named differently

class LearningRecord(models.Model):
    enrollment = models.OneToOneField(Enrollment, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.enrollment.user.username} - {self.enrollment.content_object} started"
