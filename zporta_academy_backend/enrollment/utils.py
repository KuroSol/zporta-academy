
from django.core.files.base import ContentFile
from django.utils import timezone
import os


# enrollment/utils.py
def lock_course_and_content(course):
    if not course.is_locked:
        course.is_locked = True
        course.save()

    lessons = course.lessons.all()
    for lesson in lessons:
        if not lesson.is_locked:
            lesson.is_locked = True
            lesson.save()

        quizzes = lesson.quizzes.all()
        for quiz in quizzes:
            if not quiz.is_locked:
                quiz.is_locked = True
                quiz.save()

    quizzes_course = course.quizzes.all()
    for quiz in quizzes_course:
        if not quiz.is_locked:
            quiz.is_locked = True
            quiz.save()
