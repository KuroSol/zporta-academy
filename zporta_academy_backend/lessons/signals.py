from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Lesson

@receiver([post_save, post_delete], sender=Lesson)
def invalidate_course_cache_on_lesson_change(sender, instance, **kwargs):
    if instance.course_id:
        cache.delete(f"course_lessons_quizzes_{instance.course_id}")
