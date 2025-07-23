from django.utils import timezone
from analytics.models import MemoryStat
from quizzes.models import Quiz

def get_review_queue(user, limit=10):
    """
    Returns a list of quizzes the user should review now, based on MemoryStat.
    Sorted by how overdue the review is (most overdue = highest priority).
    """
    now = timezone.now()

    # Get MemoryStat records for quizzes that are due
    due_stats = MemoryStat.objects.filter(
        user=user,
        next_review__lte=now
    ).select_related('quiz').order_by('next_review')[:limit]

    # Extract the quizzes in due order
    quizzes_due = [stat.quiz for stat in due_stats]

    return quizzes_due
