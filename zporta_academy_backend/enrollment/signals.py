from django.db.models.signals      import post_save
from django.dispatch               import receiver
from django.db.models              import F
from django.contrib.contenttypes.models import ContentType

from lessons.models    import Lesson, LessonCompletion
from courses.models    import Course
from .models           import Enrollment, CourseCompletion
from users.models      import Profile
from social.models     import GuideRequest

# ── Impact Score: Creation ─────────────────────────────────────────────────────

@receiver(post_save, sender=Lesson)
def award_is_lesson_created(sender, instance, created, **kwargs):
    if created:
        Profile.objects.filter(user=instance.created_by)\
                       .update(impact_score=F('impact_score') + 4)

@receiver(post_save, sender=Course)
def award_is_course_created(sender, instance, created, **kwargs):
    if created:
        Profile.objects.filter(user=instance.created_by)\
                       .update(impact_score=F('impact_score') + 6)

# ── Impact Score: Engagement ───────────────────────────────────────────────────

@receiver(post_save, sender=LessonCompletion)
def award_is_lesson_engagement(sender, instance, created, **kwargs):
    if not created:
        return
    creator = instance.lesson.created_by
    if instance.user != creator:
        Profile.objects.filter(user=creator)\
                       .update(impact_score=F('impact_score') + 2)

# ── Growth Score & Course Completion ──────────────────────────────────────────

@receiver(post_save, sender=LessonCompletion)
def mark_course_completed(sender, instance, created, **kwargs):
    if not created:
        return

    user   = instance.user
    course = instance.lesson.course
    if not course:
        return

    # locate the user's course enrollment
    ctype = ContentType.objects.get_for_model(Course)
    try:
        enroll = Enrollment.objects.get(
            user=user,
            content_type=ctype,
            object_id=course.id,
            enrollment_type='course'
        )
    except Enrollment.DoesNotExist:
        return

    # count lessons vs. completions
    total = course.lessons.count()
    done  = LessonCompletion.objects.filter(
                user=user,
                lesson__course=course
            ).count()

    # on full completion, record & award
    if total and done == total:
        CourseCompletion.objects.get_or_create(user=user, course=course)
        enroll.status = 'completed'
        enroll.save(update_fields=['status'])
        Profile.objects.filter(user=user)\
                       .update(growth_score=F('growth_score') + 3)
