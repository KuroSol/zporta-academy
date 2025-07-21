# users/signals.py
import os
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType

from users.models import Profile, UserPreference
from posts.models import Post
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz
from analytics.models import ActivityEvent


def update_profile_to_both(user):
    """If a user creates content, make them a guide + explorer."""
    profile, _ = Profile.objects.get_or_create(user=user)
    if profile.role != 'both':
        profile.role = 'both'
        profile.active_guide = True
        profile.save()


@receiver(post_save, sender=User)
def create_user_artifacts(sender, instance, created, **kwargs):
    """
    On user creation:
     • Make their media folder
     • Create Profile
     • Create UserPreference
    """
    if not created:
        return

    # 1) media folder
    user_folder = os.path.join(settings.MEDIA_ROOT, f'user_{instance.username}')
    os.makedirs(user_folder, exist_ok=True)

    # 2) profile
    Profile.objects.get_or_create(user=instance)

    # 3) preference
    UserPreference.objects.get_or_create(user=instance)


@receiver(post_delete, sender=Profile)
def delete_profile_image_on_delete(sender, instance, **kwargs):
    """
    When a Profile is deleted, also nuke its image file.
    """
    if instance.profile_image and os.path.isfile(instance.profile_image.path):
        os.remove(instance.profile_image.path)


# When any content is created, bump them to “both/guide”
for Model in (Post, Course, Lesson, Quiz):
    @receiver(post_save, sender=Model)
    def creator_post_save(sender, instance, created, **kwargs):
        if created and getattr(instance, 'created_by', None):
            update_profile_to_both(instance.created_by)


@receiver(post_save, sender=ActivityEvent)
def update_user_preferences_from_event(sender, instance, **kwargs):
    """
    On each quiz‐answer event, tag the user's UserPreference
    with the quiz’s subject + tags.
    """
    user = getattr(instance, 'user', None)
    if not user or not instance.event_type == 'quiz_answer_submitted':
        return

    pref, _ = UserPreference.objects.get_or_create(user=user)

    # “instance.content_type” / object_id point at a Question → get its quiz
    model_cls = instance.content_type.model_class()
    try:
        question = model_cls.objects.get(pk=instance.object_id)
    except model_cls.DoesNotExist:
        return

    # If that Question has a .quiz, add subject + tags
    quiz = getattr(question, 'quiz', None)
    if isinstance(quiz, Quiz):
        if quiz.subject:
            pref.interested_subjects.add(quiz.subject)
        for tag in quiz.tags.all():
            pref.interested_tags.add(tag)

    pref.save()
