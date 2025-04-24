import os
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from users.models import Profile
from posts.models import Post
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz

def update_profile_to_both(user):
    """
    Update the user's profile so that the role is 'both'
    and mark them as an active guide if they aren't already.
    """
    profile, _ = Profile.objects.get_or_create(user=user)
    if profile.role != 'both':
        profile.role = 'both'
        profile.active_guide = True
        profile.save()

@receiver(post_save, sender=User)
def create_user_folder(sender, instance, created, **kwargs):
    if created:
        user_folder = os.path.join(settings.MEDIA_ROOT, f'user_{instance.username}')
        os.makedirs(user_folder, exist_ok=True)
        
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    """
    Create a Profile for every new User.
    Using get_or_create ensures that if the profile already exists,
    it won't try to create a duplicate.
    """
    Profile.objects.get_or_create(user=instance)

@receiver(post_save, sender=Post)
def post_created_update_profile(sender, instance, created, **kwargs):
    """
    When a Post is created, update the creator's profile.
    """
    if created and hasattr(instance, 'created_by') and instance.created_by:
        update_profile_to_both(instance.created_by)

@receiver(post_save, sender=Course)
def course_created_update_profile(sender, instance, created, **kwargs):
    """
    When a Course is created, update the creator's profile.
    """
    if created and hasattr(instance, 'created_by') and instance.created_by:
        update_profile_to_both(instance.created_by)

@receiver(post_save, sender=Lesson)
def lesson_created_update_profile(sender, instance, created, **kwargs):
    """
    When a Lesson is created, update the creator's profile.
    """
    if created and hasattr(instance, 'created_by') and instance.created_by:
        update_profile_to_both(instance.created_by)

@receiver(post_save, sender=Quiz)
def quiz_created_update_profile(sender, instance, created, **kwargs):
    """
    When a Quiz is created, update the creator's profile.
    """
    if created and hasattr(instance, 'created_by') and instance.created_by:
        update_profile_to_both(instance.created_by)
