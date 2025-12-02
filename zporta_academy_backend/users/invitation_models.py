# users/invitation_models.py
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import uuid


class TeacherInvitation(models.Model):
    """
    Teachers can invite people to become teachers.
    Limited to 3 invitations per month.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Who sent the invitation
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_invitations',
        help_text="Teacher who sent the invitation"
    )
    
    # Who is being invited
    invitee_email = models.EmailField(
        help_text="Email address of person being invited"
    )
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_invitations',
        help_text="User account (if they registered)"
    )
    
    # Invitation details
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Unique token for invitation link"
    )
    personal_message = models.TextField(
        blank=True,
        null=True,
        max_length=500,
        help_text="Personal message from inviter (optional)"
    )
    
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(
        help_text="Invitation expiry date (30 days from creation)"
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inviter', 'created_at']),
            models.Index(fields=['invitee_email']),
            models.Index(fields=['token']),
            models.Index(fields=['status', 'expires_at']),
        ]
        # Prevent duplicate invitations to same email
        constraints = [
            models.UniqueConstraint(
                fields=['inviter', 'invitee_email'],
                condition=models.Q(status='pending'),
                name='unique_pending_invitation'
            )
        ]
    
    def __str__(self):
        return f"Invitation from {self.inviter.username} to {self.invitee_email} ({self.status})"
    
    def save(self, *args, **kwargs):
        # Set expiry date if not set (30 days from now)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=30)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if invitation has expired"""
        return timezone.now() > self.expires_at
    
    def accept(self, user):
        """Mark invitation as accepted and grant guide status"""
        if self.is_expired():
            self.status = 'expired'
            self.save()
            return False
        
        self.status = 'accepted'
        self.invitee = user
        self.accepted_at = timezone.now()
        self.save()
        
        # Grant guide status immediately (no admin approval needed)
        profile = user.profile
        if profile.role == 'explorer':
            profile.role = 'both'
        else:
            profile.role = 'guide'
        profile.active_guide = True
        profile.can_invite_teachers = False  # Don't allow chain invitations by default
        profile.save()
        
        return True
    
    @classmethod
    def get_monthly_invitation_count(cls, user):
        """Get number of invitations sent by user this month"""
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return cls.objects.filter(
            inviter=user,
            created_at__gte=month_start
        ).count()
    
    @classmethod
    def can_send_invitation(cls, user):
        """Check if user can send more invitations (max 3 per month)"""
        # Check if user has permission
        if not hasattr(user, 'profile') or not user.profile.can_invite_teachers:
            return False, "You don't have permission to invite teachers"
        
        # Check monthly limit
        count = cls.get_monthly_invitation_count(user)
        if count >= 3:
            return False, "You've reached your monthly limit of 3 invitations"
        
        return True, None
