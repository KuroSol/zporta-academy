# users/signals.py
import os
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType

from users.models import Profile, UserPreference, UserLoginEvent
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.utils import timezone
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


# ────────────────────────────────────────────────────────────────
# Login / Logout tracking for session analytics
# ────────────────────────────────────────────────────────────────
@receiver(user_logged_in)
def track_user_login(sender, request, user, **kwargs):
    # Create a login event and store its id in session for later duration calc
    event = UserLoginEvent.objects.create(
        user=user,
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
        ip_address=request.META.get('REMOTE_ADDR')
    )
    request.session['login_event_id'] = event.id

@receiver(user_logged_out)
def track_user_logout(sender, request, user, **kwargs):
    event_id = request.session.pop('login_event_id', None)
    if not event_id:
        return
    try:
        ev = UserLoginEvent.objects.get(id=event_id, user=user)
    except UserLoginEvent.DoesNotExist:
        return
    ev.logout_at = timezone.now()
    if ev.logout_at and ev.login_at:
        delta = ev.logout_at - ev.login_at
        ev.session_duration_seconds = max(0, int(delta.total_seconds()))
    ev.save()
