import os
from django.conf import settings
from django.db.models.signals import post_save, post_delete 
from django.contrib.contenttypes.models import ContentType

from django.dispatch import receiver
from django.contrib.auth.models import User
from users.models import Profile
from posts.models import Post
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz

from tags.models import Tag
from analytics.models import ActivityEvent
from users.models import UserPreference


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
@receiver(post_delete, sender=Profile)
def delete_profile_image_on_delete(sender, instance, **kwargs):
    if instance.image and os.path.isfile(instance.image.path):
        os.remove(instance.image.path)


@receiver(post_save, sender=ActivityEvent)
def update_user_preferences_from_event(sender, instance, **kwargs):
    user = instance.user
    if not user or not user.is_authenticated:
        return

    pref, _ = UserPreference.objects.get_or_create(user=user)

    if instance.event_type != 'quiz_answer_submitted':
        return

    # Use content_type + object_id to get the real object (should be a Question)
    model_class = instance.content_type.model_class()
    try:
        obj = model_class.objects.get(pk=instance.object_id)
    except model_class.DoesNotExist:
        return

    # Get the Quiz from the Question (since event is logged on a Question)
    if hasattr(obj, 'quiz') and isinstance(obj.quiz, Quiz):
        quiz = obj.quiz
        # ✅ Add subject if exists
        if quiz.subject:
            pref.interested_subjects.add(quiz.subject)
        # ✅ Add tags if present
        for tag in quiz.tags.all():
            pref.interested_tags.add(tag)

    pref.save()