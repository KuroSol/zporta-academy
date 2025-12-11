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
        stats["notes_count"] = Note.objects.filter(creator=user).count()
    except Exception as e:
        logger.warning(f"Error counting notes for user {user.id}: {e}")
        stats["notes_count"] = 0
    
    # Count lessons completed
    try:
        stats["lessons_completed"] = LessonCompletion.objects.filter(
            user=user, 
            completed=True
        ).count()
    except Exception as e:
        logger.warning(f"Error counting lessons for user {user.id}: {e}")
        stats["lessons_completed"] = 0
    
    # Get enrolled courses
    try:
        from enrollment.models import Enrollment
        stats["enrolled_courses"] = list(
            Enrollment.objects.filter(
                user=user, 
                status__in=['active', 'completed']
            ).values_list('course_id', flat=True)
        )
    except Exception as e:
        logger.warning(f"Error getting enrolled courses for user {user.id}: {e}")
        stats["enrolled_courses"] = []
    
    return stats
