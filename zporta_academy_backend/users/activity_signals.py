# users/activity_signals.py
"""
Signals to automatically create UserActivity records for various events.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType

from .activity_models import UserActivity
from lessons.models import LessonCompletion
from enrollment.models import CourseCompletion, Enrollment
from analytics.models import ActivityEvent
from courses.models import Course


@receiver(post_save, sender=LessonCompletion)
def track_lesson_completion(sender, instance, created, **kwargs):
    """Award +1 point when a student completes any lesson (free or premium)"""
    if not created:
        return
    
    user = instance.user
    lesson = instance.lesson
    
    # Student activity: lesson completed (+1 point)
    UserActivity.objects.create(
        user=user,
        role='student',
        activity_type='LESSON_COMPLETED',
        points=1,
        content_type=ContentType.objects.get_for_model(lesson),
        object_id=lesson.id,
        metadata={
            'lesson_id': lesson.id,
            'lesson_title': lesson.title,
            'lesson_permalink': getattr(lesson, 'permalink', None),
            'course_id': lesson.course.id if lesson.course else None,
            'course_title': lesson.course.title if lesson.course else None,
            'course_permalink': getattr(lesson.course, 'permalink', None) if lesson.course else None,
        }
    )
    
    # Teacher activity: standalone lesson (+1 point)
    if lesson.course is None and lesson.created_by and lesson.created_by != user:
        UserActivity.objects.create(
            user=lesson.created_by,
            role='teacher',
            activity_type='STANDALONE_LESSON',
            points=1,
            content_type=ContentType.objects.get_for_model(lesson),
            object_id=lesson.id,
            metadata={
                'lesson_id': lesson.id,
                'lesson_title': lesson.title,
                'lesson_permalink': getattr(lesson, 'permalink', None),
                'student_id': user.id,
                'student_username': user.username,
            }
        )


@receiver(post_save, sender=CourseCompletion)
def track_course_completion(sender, instance, created, **kwargs):
    """Award +3 points when a student completes ALL lessons in a course"""
    if not created:
        return
    
    user = instance.user
    course = instance.course
    
    # Student activity: course completed (+3 points)
    UserActivity.objects.create(
        user=user,
        role='student',
        activity_type='COURSE_COMPLETED',
        points=3,
        content_type=ContentType.objects.get_for_model(course),
        object_id=course.id,
        metadata={
            'course_id': course.id,
            'course_title': course.title,
            'course_permalink': getattr(course, 'permalink', None),
        }
    )


@receiver(post_save, sender=ActivityEvent)
def track_quiz_answer(sender, instance, created, **kwargs):
    """
    Award +1 point for each correct answer (tracks from ActivityEvent).
    """
    # Only track quiz_answer_submitted events
    if instance.event_type != 'quiz_answer_submitted':
        return
    
    # Only track on creation
    if not created:
        return
    
    # Check if answer is correct
    metadata = instance.metadata or {}
    is_correct = metadata.get('is_correct', False)
    
    if not is_correct:
        return  # No points for incorrect answers
    
    user = instance.user
    if not user:
        return
    
    # Get quiz from metadata
    quiz_id = metadata.get('quiz_id')
    if not quiz_id:
        return
    
    try:
        from quizzes.models import Quiz
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        return
    
    # Check if already tracked this question (regardless of attempt)
    question_id = metadata.get('question_id')
    attempt_index = metadata.get('attempt_index')
    
    existing = UserActivity.objects.filter(
        user=user,
        role='student',
        activity_type='CORRECT_ANSWER',
        metadata__question_id=question_id
    ).exists()
    
    if existing:
        return  # Already tracked this question
    
    # Award +1 point for this correct answer
    UserActivity.objects.create(
        user=user,
        role='student',
        activity_type='CORRECT_ANSWER',
        points=1,  # +1 per correct answer
        content_type=ContentType.objects.get_for_model(quiz),
        object_id=quiz.id,
        metadata={
            'quiz_id': quiz.id,
            'quiz_title': quiz.title,
            'quiz_permalink': getattr(quiz, 'permalink', None),
            'question_id': question_id,
            'attempt_index': attempt_index,
            'event_id': instance.id,
        }
    )


@receiver(post_save, sender=ActivityEvent)
def track_quiz_teacher_engagement(sender, instance, created, **kwargs):
    """
    Award teacher +1 point for first quiz attempt by each student.
    """
    # Only track quiz_answer_submitted events
    if instance.event_type != 'quiz_answer_submitted':
        return
    
    # Only track on creation
    if not created:
        return
    
    user = instance.user
    if not user:
        return
    
    # Get quiz from metadata
    metadata = instance.metadata or {}
    quiz_id = metadata.get('quiz_id')
    if not quiz_id:
        return
    
    try:
        from quizzes.models import Quiz
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        return
    
    # Only award if quiz has a different creator
    if not quiz.created_by or quiz.created_by == user:
        return
    
    # Check if this is the FIRST answer by this student on this quiz
    teacher_first_attempt_exists = UserActivity.objects.filter(
        user=quiz.created_by,
        role='teacher',
        activity_type='QUIZ_FIRST_ATTEMPT',
        metadata__quiz_id=quiz.id,
        metadata__student_id=user.id
    ).exists()
    
    if not teacher_first_attempt_exists:
        UserActivity.objects.create(
            user=quiz.created_by,
            role='teacher',
            activity_type='QUIZ_FIRST_ATTEMPT',
            points=1,
            content_type=ContentType.objects.get_for_model(quiz),
            object_id=quiz.id,
            metadata={
                'quiz_id': quiz.id,
                'quiz_title': quiz.title,
                'quiz_permalink': getattr(quiz, 'permalink', None),
                'student_id': user.id,
                'student_username': user.username,
                'event_id': instance.id,
            }
        )


@receiver(post_save, sender=Enrollment)
def track_enrollment(sender, instance, created, **kwargs):
    """
    Award teacher points when someone enrolls in their course.
    Free enrollment: +2 points
    Premium enrollment: +3 points
    """
    if not created:
        return
    
    # Get the course from content_object
    course = instance.content_object
    
    # Only track course enrollments (not quiz/lesson enrollments)
    if not isinstance(course, Course):
        return
    
    student = instance.user
    teacher = course.created_by
    
    if not teacher or teacher == student:
        return  # Skip if no teacher or self-enrollment
    
    # Check if already tracked this enrollment
    existing = UserActivity.objects.filter(
        user=teacher,
        role='teacher',
        metadata__enrollment_id=instance.id
    ).exists()
    
    if existing:
        return
    
    # Determine if premium or free
    is_premium = instance.payment_status == 'completed' if hasattr(instance, 'payment_status') else False
    
    activity_type = 'ENROLLMENT_PREMIUM' if is_premium else 'ENROLLMENT_FREE'
    points = 3 if is_premium else 2
    
    UserActivity.objects.create(
        user=teacher,
        role='teacher',
        activity_type=activity_type,
        points=points,
        content_type=ContentType.objects.get_for_model(course),
        object_id=course.id,
        metadata={
            'course_id': course.id,
            'course_title': course.title,
            'course_permalink': getattr(course, 'permalink', None),
            'student_id': student.id,
            'student_username': student.username,
            'enrollment_id': instance.id,
            'is_premium': is_premium,
        }
    )
