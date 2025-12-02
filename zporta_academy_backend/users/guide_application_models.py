# users/guide_application_models.py
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User

class GuideApplicationRequest(models.Model):
    """
    Request from a user to become a guide/teacher.
    Requires admin approval.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='guide_applications'
    )
    
    # Application details
    motivation = models.TextField(
        help_text="Why do you want to become a teacher on Zporta Academy?"
    )
    experience = models.TextField(
        blank=True,
        null=True,
        help_text="Teaching experience, credentials, certifications"
    )
    subjects_to_teach = models.CharField(
        max_length=255,
        help_text="Subjects/topics you plan to teach (comma-separated)"
    )
    
    # Invitation/referral (optional)
    referred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guide_referrals',
        help_text="Which teacher invited/recommended you? (optional)"
    )
    
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    # Admin review
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guide_applications_reviewed'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f"Guide Application: {self.user.username} ({self.status})"
    
    def approve(self, admin_user):
        """Approve application and set user as active guide"""
        from django.utils import timezone
        self.status = 'approved'
        self.reviewed_by = admin_user
        self.reviewed_at = timezone.now()
        self.save()
        
        # Update user profile
        profile = self.user.profile
        if profile.role == 'explorer':
            profile.role = 'both'  # Keep explorer status + add guide
        else:
            profile.role = 'guide'
        profile.active_guide = True
        profile.save()
    
    def reject(self, admin_user, notes=''):
        """Reject application"""
        from django.utils import timezone
        self.status = 'rejected'
        self.reviewed_by = admin_user
        self.reviewed_at = timezone.now()
        self.admin_notes = notes
        self.save()
