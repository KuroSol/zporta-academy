from django.db import models
from django.contrib.auth.models import User
import uuid


class BulkImportJob(models.Model):
    """Track bulk import operations for monitoring and debugging"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_imports')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    total_courses = models.IntegerField(default=0)
    total_lessons = models.IntegerField(default=0)
    total_quizzes = models.IntegerField(default=0)
    total_questions = models.IntegerField(default=0)
    
    processed_courses = models.IntegerField(default=0)
    processed_lessons = models.IntegerField(default=0)
    processed_quizzes = models.IntegerField(default=0)
    processed_questions = models.IntegerField(default=0)
    
    errors = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Import {self.id} - {self.status}"

# Proxy model to expose a dedicated admin menu item for quiz uploads
class BulkImportQuizMenu(BulkImportJob):
    class Meta:
        proxy = True
        verbose_name = 'Bulk import quiz'
        verbose_name_plural = 'Bulk import quiz'
