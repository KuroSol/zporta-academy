"""
Interactive podcast generation service.
Collects user learning data and generates personalized podcast content.
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)


def collect_user_stats(user) -> Dict:
    """Collect user statistics from the database."""
    from notes.models import Note
    from lessons.models import LessonCompletion
    from enrollment.models import Enrollment
    from django.contrib.contenttypes.models import ContentType
    from courses.models import Course
    
    stats = {
        "ability_score": None,
        "ability_level": None,
        "weak_subject": None,
        "recent_quiz": None,
        "enrolled_courses": [],
        "notes_count": 0,
        "lessons_completed": 0,
        "total_points": 0,
        "quizzes_completed": 0,
    }

    # Count notes written by user
    try:
        stats["notes_count"] = Note.objects.filter(user=user).count()
    except Exception as e:
        logger.warning(f"Error counting notes for user {user.id}: {e}")
        stats["notes_count"] = 0
    
    # Count lessons completed
    try:
        stats["lessons_completed"] = LessonCompletion.objects.filter(
            user=user
        ).count()
    except Exception as e:
        logger.warning(f"Error counting lessons for user {user.id}: {e}")
        stats["lessons_completed"] = 0
    
    # Get enrolled courses with details
    try:
        course_content_type = ContentType.objects.get_for_model(Course)
        enrollments = Enrollment.objects.filter(
            user=user,
            content_type=course_content_type,
            enrollment_type='course'
        )
        
        stats["enrolled_courses"] = [
            {
                'id': e.object_id,
                'title': e.content_object.title if e.content_object else f'Course {e.object_id}',
                'subject': getattr(e.content_object, 'subject', 'Unknown') if e.content_object else 'Unknown',
                'enrollment_date': e.enrollment_date
            }
            for e in enrollments
            if e.content_object
        ]
    except Exception as e:
        logger.warning(f"Error getting enrolled courses for user {user.id}: {e}")
        stats["enrolled_courses"] = []
    
    # Count quizzes completed
    try:
        from analytics.models import QuizAttempt
        stats["quizzes_completed"] = QuizAttempt.objects.filter(user=user).count()
    except Exception as e:
        logger.warning(f"Error counting quizzes for user {user.id}: {e}")
        stats["quizzes_completed"] = 0
    
    return stats
