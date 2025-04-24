# learning/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in
from enrollment.models import Enrollment
from .models import LearningRecord
from subjects.models import Subject  # used to set default subject, if needed

@receiver(user_logged_in)
def sync_learning_records(sender, request, user, **kwargs):
    """
    On each user login, ensure every course enrollment has a LearningRecord.
    """
    # Fetch all course-type enrollments for this user
    course_enrollments = Enrollment.objects.filter(
        user=user,
        enrollment_type='course'
    )

    for enroll in course_enrollments:
        # Create a LearningRecord if it doesn't already exist
        LearningRecord.objects.get_or_create(
            enrollment=enroll,
            defaults={
                'subject': getattr(enroll.content_object, 'subject', None)
            }
        )

@receiver(post_save, sender=Enrollment)
def create_learning_record(sender, instance, created, **kwargs):
    """
    On each new Enrollment instance creation, create its LearningRecord.
    """
    if not created:
        return

    # Determine subject if the enrolled object has one
    content_obj = instance.content_object
    subject = getattr(content_obj, 'subject', None)

    # Create the LearningRecord or skip if it already exists
    LearningRecord.objects.get_or_create(
        enrollment=instance,
        defaults={
            'subject': subject
        }
    )
