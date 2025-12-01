# gamification/signals.py
"""
Signal handlers to automatically track activities from source tables.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType

from .models import Activity, ActivityType, UserScore
from analytics.models import ActivityEvent
from lessons.models import LessonCompletion
from enrollment.models import CourseCompletion, Enrollment
from courses.models import Course


@receiver(post_save, sender=ActivityEvent)
def track_quiz_answer(sender, instance, created, **kwargs):
    """Track correct quiz answers AND mistakes from ActivityEvent"""
    if not created or instance.event_type != 'quiz_answer_submitted':
        return
    
    metadata = instance.metadata or {}
    is_correct = metadata.get('is_correct', False)
    
    user = instance.user
    if not user:
        return
    
    quiz_id = metadata.get('quiz_id')
    question_id = metadata.get('question_id')
    
    if not quiz_id or not question_id:
        return
    
    # Create unique key - include timestamp for mistakes (can have multiple)
    if is_correct:
        unique_key = f"quiz_{user.id}_q_{question_id}"
    else:
        # Track each mistake separately
        unique_key = f"mistake_{user.id}_q_{question_id}_t_{instance.timestamp.timestamp()}"
    
    # Check if already tracked (only for correct answers)
    if is_correct and Activity.objects.filter(unique_key=unique_key).exists():
        return
    
    try:
        from quizzes.models import Quiz
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        return
    
    # Create activity (correct answers get points, mistakes get tracked for analytics)
    Activity.objects.create(
        user=user,
        activity_type=ActivityType.CORRECT_ANSWER,
        points=Activity.get_points_for_activity(ActivityType.CORRECT_ANSWER) if is_correct else 0,
        content_type=ContentType.objects.get_for_model(quiz),
        object_id=quiz.id,
        unique_key=unique_key,
        is_mistake=not is_correct,
        metadata={
            'quiz_id': quiz_id,
            'quiz_title': quiz.title,
            'quiz_permalink': quiz.permalink,
            'question_id': question_id,
            'question_text': metadata.get('question_text', ''),
            'topic': metadata.get('topic', ''),
            'subject': metadata.get('subject', ''),
            'is_correct': is_correct,
            'event_id': instance.id,
        },
        created_at=instance.timestamp
    )
    
    # Update user score
    update_user_score(user)


@receiver(post_save, sender=LessonCompletion)
def track_lesson_completion(sender, instance, created, **kwargs):
    """Track lesson completions with time spent"""
    if not created:
        return
    
    user = instance.user
    lesson = instance.lesson
    
    unique_key = f"lesson_{user.id}_l_{lesson.id}"
    
    if Activity.objects.filter(unique_key=unique_key).exists():
        return
    
    # Calculate time spent using the model method
    time_spent_seconds = instance.get_time_spent_seconds()
    
    # Create activity for student
    Activity.objects.create(
        user=user,
        activity_type=ActivityType.LESSON_COMPLETED,
        points=Activity.get_points_for_activity(ActivityType.LESSON_COMPLETED),
        content_type=ContentType.objects.get_for_model(lesson),
        object_id=lesson.id,
        unique_key=unique_key,
        time_spent_seconds=time_spent_seconds,
        metadata={
            'lesson_id': lesson.id,
            'lesson_title': lesson.title,
            'lesson_permalink': lesson.permalink,
            'course_id': lesson.course.id if lesson.course else None,
            'course_title': lesson.course.title if lesson.course else None,
            'course_permalink': lesson.course.permalink if lesson.course else None,
            'course_username': lesson.course.created_by.username if lesson.course and lesson.course.created_by else None,
            'course_subject': lesson.course.subject.name if lesson.course and lesson.course.subject else None,
            'course_date': lesson.course.created_at.strftime('%Y-%m-%d') if lesson.course else None,
            'time_spent_minutes': round(time_spent_seconds / 60, 2) if time_spent_seconds else None,
        },
        created_at=instance.completed_at
    )
    
    update_user_score(user)
    
    # Track standalone lesson for teacher
    if lesson.course is None and lesson.created_by and lesson.created_by != user:
        teacher_unique_key = f"standalone_{lesson.created_by.id}_l_{lesson.id}_u_{user.id}"
        
        if not Activity.objects.filter(unique_key=teacher_unique_key).exists():
            Activity.objects.create(
                user=lesson.created_by,
                activity_type=ActivityType.STANDALONE_LESSON,
                points=Activity.get_points_for_activity(ActivityType.STANDALONE_LESSON),
                content_type=ContentType.objects.get_for_model(lesson),
                object_id=lesson.id,
                unique_key=teacher_unique_key,
                metadata={
                    'lesson_id': lesson.id,
                    'lesson_title': lesson.title,
                    'student_id': user.id,
                    'student_username': user.username,
                },
                created_at=instance.completed_at
            )
            update_user_score(lesson.created_by)


@receiver(post_save, sender=CourseCompletion)
def track_course_completion(sender, instance, created, **kwargs):
    """Track course completions (all lessons finished)"""
    if not created:
        return
    
    user = instance.user
    course = instance.course
    
    unique_key = f"course_{user.id}_c_{course.id}"
    
    if Activity.objects.filter(unique_key=unique_key).exists():
        return
    
    # Calculate time spent on entire course
    time_spent_seconds = instance.get_time_spent_seconds()
    
    Activity.objects.create(
        user=user,
        activity_type=ActivityType.COURSE_COMPLETED,
        points=Activity.get_points_for_activity(ActivityType.COURSE_COMPLETED),
        content_type=ContentType.objects.get_for_model(course),
        object_id=course.id,
        unique_key=unique_key,
        time_spent_seconds=time_spent_seconds,
        metadata={
            'course_id': course.id,
            'course_title': course.title,
            'course_permalink': course.permalink,
            'course_username': course.created_by.username if course.created_by else None,
            'course_subject': course.subject.name if course.subject else None,
            'course_date': course.created_at.strftime('%Y-%m-%d') if course.created_at else None,
            'time_spent_days': round(time_spent_seconds / 86400, 1) if time_spent_seconds else None,
        },
        created_at=instance.completed_at
    )
    
    update_user_score(user)


@receiver(post_save, sender=Enrollment)
def track_enrollment(sender, instance, created, **kwargs):
    """Track enrollments for teachers"""
    if not created:
        return
    
    # Only track course enrollments
    course = instance.content_object
    if not isinstance(course, Course):
        return
    
    student = instance.user
    teacher = course.created_by
    
    if not teacher or teacher == student:
        return
    
    # Determine if premium or free
    is_premium = getattr(instance, 'payment_status', None) == 'completed'
    activity_type = ActivityType.ENROLLMENT_PREMIUM if is_premium else ActivityType.ENROLLMENT_FREE
    
    unique_key = f"enrollment_{teacher.id}_c_{course.id}_u_{student.id}"
    
    if Activity.objects.filter(unique_key=unique_key).exists():
        return
    
    Activity.objects.create(
        user=teacher,
        activity_type=activity_type,
        points=Activity.get_points_for_activity(activity_type),
        content_type=ContentType.objects.get_for_model(course),
        object_id=course.id,
        unique_key=unique_key,
        metadata={
            'course_id': course.id,
            'course_title': course.title,
            'course_permalink': course.permalink,
            'course_username': course.created_by.username if course.created_by else None,
            'course_subject': course.subject.name if course.subject else None,
            'course_date': course.created_at.strftime('%Y-%m-%d') if course.created_at else None,
            'student_id': student.id,
            'student_username': student.username,
            'is_premium': is_premium,
        },
        created_at=instance.enrollment_date
    )
    
    update_user_score(teacher)

    # Also track enrollment as a student learning activity (+2 points).
    # This lets students earn points immediately upon enrolling, not only after course completion.
    student_unique_key = f"enrollment_student_{student.id}_c_{course.id}"
    if not Activity.objects.filter(unique_key=student_unique_key).exists():
        Activity.objects.create(
            user=student,
            activity_type=ActivityType.COURSE_ENROLLED,
            points=Activity.get_points_for_activity(ActivityType.COURSE_ENROLLED),
            content_type=ContentType.objects.get_for_model(course),
            object_id=course.id,
            unique_key=student_unique_key,
            metadata={
                'course_id': course.id,
                'course_title': course.title,
                'course_permalink': course.permalink,
                'course_username': course.created_by.username if course.created_by else None,
                'course_subject': course.subject.name if course.subject else None,
                'course_date': course.created_at.strftime('%Y-%m-%d') if course.created_at else None,
                'enrollment_type': 'premium' if is_premium else 'free',
                'is_premium': is_premium,
            },
            created_at=instance.enrollment_date
        )
        update_user_score(student)


@receiver(post_save, sender=ActivityEvent)
def track_quiz_first_attempt(sender, instance, created, **kwargs):
    """Track first quiz attempt by student for teacher"""
    if not created or instance.event_type != 'quiz_answer_submitted':
        return
    
    user = instance.user
    if not user:
        return
    
    metadata = instance.metadata or {}
    quiz_id = metadata.get('quiz_id')
    
    if not quiz_id:
        return
    
    try:
        from quizzes.models import Quiz
        quiz = Quiz.objects.get(id=quiz_id)
    except Quiz.DoesNotExist:
        return
    
    teacher = quiz.created_by
    if not teacher or teacher == user:
        return
    
    unique_key = f"quiz_first_{teacher.id}_q_{quiz_id}_u_{user.id}"
    
    if Activity.objects.filter(unique_key=unique_key).exists():
        return
    
    Activity.objects.create(
        user=teacher,
        activity_type=ActivityType.QUIZ_FIRST_ATTEMPT,
        points=Activity.get_points_for_activity(ActivityType.QUIZ_FIRST_ATTEMPT),
        content_type=ContentType.objects.get_for_model(quiz),
        object_id=quiz.id,
        unique_key=unique_key,
        metadata={
            'quiz_id': quiz_id,
            'quiz_title': quiz.title,
            'quiz_permalink': quiz.permalink,
            'student_id': user.id,
            'student_username': user.username,
        },
        created_at=instance.timestamp
    )
    
    update_user_score(teacher)


def update_user_score(user):
    """Update or create user score after activity"""
    score, created = UserScore.objects.get_or_create(user=user)
    score.recalculate()
