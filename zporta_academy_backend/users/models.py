import os
from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
import uuid

def profile_image_upload_to(instance, filename):
    """
    Stores profile images inside a folder specific to the user:
    MEDIA_ROOT/user_<username>/profile_image/<username>_profile_image_zporta_academy.<ext>
    """
    ext = filename.split('.')[-1]  # Get the file extension
    new_filename = f"{instance.user.username}-profile-image-zporta-academy-{uuid.uuid4().hex}.{ext}"
    return os.path.join(f"user_{instance.user.username}", "profile_image", new_filename)

class Profile(models.Model):
    ROLE_CHOICES = [
        ('explorer', 'Explorer'),
        ('guide', 'Guide'),
        ('both', 'Both'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='explorer')
    bio = models.TextField(blank=True, null=True)
    active_guide = models.BooleanField(default=False)
    profile_image = models.ImageField(upload_to=profile_image_upload_to, blank=True, null=True)

    # ── Growth & Impact Scores ─────────────────────────────────────────────────
    growth_score = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="🌱 Growth Score: +1 per quiz, +2 per lesson, +3 per course completed"
    )
    impact_score = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="✨ Impact Score: +2 per quiz, +4 per lesson, +6 per course created; +1/+2/+3 when others complete"
    )
    # ────────────────────────────────────────────────────────────────────────────


    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"

    def delete(self, *args, **kwargs):
        # CAUTION: This deletes the associated user as well.
        self.user.delete()
        super().delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        # If replacing an existing profile image, delete the old file
        try:
            old_instance = Profile.objects.get(pk=self.pk)
            if old_instance.profile_image and old_instance.profile_image != self.profile_image:
                old_instance.profile_image.delete(save=False)
        except Profile.DoesNotExist:
            pass  # First time saving profile, no previous image exists
        super(Profile, self).save(*args, **kwargs)

# Signal to create or update Profile when User is saved
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    else:
        instance.profile.save()

# users/models.py or create a new app like 'preferences'
class UserPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # Multiselect fields (or ManyToMany)
    languages_spoken = models.JSONField(default=list)  # e.g., ['en', 'ja']
    interested_subjects = models.ManyToManyField('subjects.Subject', blank=True)
    interested_tags = models.ManyToManyField('tags.Tag', blank=True)

    # Optional
    location = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    updated_at = models.DateTimeField(auto_now=True)
