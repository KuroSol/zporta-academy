"""
Comprehensive fix for activity tracking and backfill all missing activities.
This will create Activity records for ALL existing data, not just new enrollments.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from enrollment.models import Enrollment, CourseCompletion
from courses.models import Course
from lessons.models import LessonCompletion
from analytics.models import ActivityEvent
from gamification.models import Activity, ActivityType, UserScore

User = get_user_model()

def backfill_all_activities():
    """Backfill all missing activities from existing data"""
    
    print("\n" + "="*60)
    print("COMPREHENSIVE ACTIVITY BACKFILL")
    print("="*60)
    
    # 1. Backfill course enrollments
    print("\n[1/4] Processing Course Enrollments...")
    course_ct = ContentType.objects.get_for_model(Course)
    enrollments = Enrollment.objects.filter(
        content_type=course_ct,
        enrollment_type='course'
    ).select_related('user')
    
    enrollment_created = 0
    for enrollment in enrollments:
        course = enrollment.content_object
        if not isinstance(course, Course):
            continue
        
        student = enrollment.user
        unique_key = f"enrollment_student_{student.id}_c_{course.id}"
        
        if Activity.objects.filter(unique_key=unique_key).exists():
            continue
        
        is_premium = getattr(enrollment, 'payment_status', None) == 'completed'
        
        Activity.objects.create(
            user=student,
            activity_type=ActivityType.COURSE_ENROLLED,
            points=Activity.get_points_for_activity(ActivityType.COURSE_ENROLLED),
            content_type=course_ct,
            object_id=course.id,
            unique_key=unique_key,
            metadata={
                'course_id': course.id,
                'course_title': course.title,
                'course_permalink': course.permalink,
                'enrollment_type': 'premium' if is_premium else 'free',
                'is_premium': is_premium,
            },
            created_at=enrollment.enrollment_date
        )
        enrollment_created += 1
        print(f"  ✓ {student.username} → {course.title}")
    
    print(f"  Created: {enrollment_created} activities")
    
    # 2. Backfill lesson completions
    print("\n[2/4] Processing Lesson Completions...")
    lesson_completions = LessonCompletion.objects.select_related('user', 'lesson').all()
    
    lesson_created = 0
    for lc in lesson_completions:
        user = lc.user
        lesson = lc.lesson
        unique_key = f"lesson_{user.id}_l_{lesson.id}"
        
        if Activity.objects.filter(unique_key=unique_key).exists():
            continue
        
        time_spent = lc.get_time_spent_seconds() if hasattr(lc, 'get_time_spent_seconds') else None
        
        Activity.objects.create(
            user=user,
            activity_type=ActivityType.LESSON_COMPLETED,
            points=Activity.get_points_for_activity(ActivityType.LESSON_COMPLETED),
            content_type=ContentType.objects.get_for_model(lesson),
            object_id=lesson.id,
            unique_key=unique_key,
            time_spent_seconds=time_spent,
            metadata={
                'lesson_id': lesson.id,
                'lesson_title': lesson.title,
                'course_title': lesson.course.title if lesson.course else None,
            },
            created_at=lc.completed_at
        )
        lesson_created += 1
        print(f"  ✓ {user.username} → {lesson.title}")
    
    print(f"  Created: {lesson_created} activities")
    
    # 3. Backfill course completions
    print("\n[3/4] Processing Course Completions...")
    course_completions = CourseCompletion.objects.select_related('user', 'course').all()
    
    course_created = 0
    for cc in course_completions:
        user = cc.user
        course = cc.course
        unique_key = f"course_{user.id}_c_{course.id}"
        
        if Activity.objects.filter(unique_key=unique_key).exists():
            continue
        
        time_spent = cc.get_time_spent_seconds() if hasattr(cc, 'get_time_spent_seconds') else None
        
        Activity.objects.create(
            user=user,
            activity_type=ActivityType.COURSE_COMPLETED,
            points=Activity.get_points_for_activity(ActivityType.COURSE_COMPLETED),
            content_type=ContentType.objects.get_for_model(course),
            object_id=course.id,
            unique_key=unique_key,
            time_spent_seconds=time_spent,
            metadata={
                'course_id': course.id,
                'course_title': course.title,
            },
            created_at=cc.completed_at
        )
        course_created += 1
        print(f"  ✓ {user.username} → {course.title}")
    
    print(f"  Created: {course_created} activities")
    
    # 4. Backfill quiz answers
    print("\n[4/4] Processing Quiz Answers...")
    quiz_events = ActivityEvent.objects.filter(
        event_type='quiz_answer_submitted',
        metadata__has_key='quiz_id'
    ).select_related('user')
    
    quiz_created = 0
    for event in quiz_events:
        user = event.user
        if not user:
            continue
        
        metadata = event.metadata or {}
        is_correct = metadata.get('is_correct', False)
        quiz_id = metadata.get('quiz_id')
        question_id = metadata.get('question_id')
        
        if not quiz_id or not question_id:
            continue
        
        if is_correct:
            unique_key = f"quiz_{user.id}_q_{question_id}"
        else:
            unique_key = f"mistake_{user.id}_q_{question_id}_t_{event.timestamp.timestamp()}"
        
        if Activity.objects.filter(unique_key=unique_key).exists():
            continue
        
        try:
            from quizzes.models import Quiz
            quiz = Quiz.objects.get(id=quiz_id)
            
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
                    'question_id': question_id,
                    'is_correct': is_correct,
                },
                created_at=event.timestamp
            )
            quiz_created += 1
        except Exception:
            continue
    
    print(f"  Created: {quiz_created} activities")
    
    # 5. Recalculate all user scores
    print("\n[5/5] Recalculating User Scores...")
    users_updated = 0
    for user in User.objects.all():
        if Activity.objects.filter(user=user).exists():
            score, _ = UserScore.objects.get_or_create(user=user)
            score.recalculate()
            users_updated += 1
    
    print(f"  Updated: {users_updated} user scores")
    
    print("\n" + "="*60)
    print("BACKFILL COMPLETE!")
    print("="*60)
    print(f"Total created:")
    print(f"  - Course Enrollments: {enrollment_created}")
    print(f"  - Lesson Completions: {lesson_created}")
    print(f"  - Course Completions: {course_created}")
    print(f"  - Quiz Answers: {quiz_created}")
    print(f"  - User Scores Updated: {users_updated}")
    print("="*60 + "\n")
    
    return enrollment_created, lesson_created, course_created, quiz_created

if __name__ == '__main__':
    backfill_all_activities()
