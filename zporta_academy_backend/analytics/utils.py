# analytics/utils.py (Alternative - Using Answer Events)

from django.contrib.contenttypes.models import ContentType
from .models import ActivityEvent
from django.utils import timezone
import math
from datetime import timedelta
import logging

# Attempt to import Quiz model, needed for total question count
try:
    from quizzes.models import Quiz
    QUIZ_MODEL_AVAILABLE = True
except ImportError:
    Quiz = None
    QUIZ_MODEL_AVAILABLE = False

logger = logging.getLogger(__name__)

# log_event function remains the same as in analytics_utils_final
def log_event(user, event_type, instance, metadata=None):
    """
    Logs an analytics event. Checks for required metadata for 'quiz_submitted'.
    """
    if metadata is None:
        metadata = {}

    # Ensure 'quiz_submitted' events have the necessary score data
    # (This check might be less relevant now if we don't log 'quiz_submitted')
    if event_type == 'quiz_submitted':
        if 'correct_answers' not in metadata or 'total_questions' not in metadata:
             logger.warning(
                 f"Logging 'quiz_submitted' for {instance.__class__.__name__} {instance.pk} "
                 f"by User {user.id} without complete score metadata: {metadata}"
             )
             metadata.setdefault('correct_answers', 0)
             metadata.setdefault('total_questions', 1)

    try:
        content_type = ContentType.objects.get_for_model(instance.__class__)
        ActivityEvent.objects.create(
            user=user,
            event_type=event_type,
            content_type=content_type,
            object_id=instance.id,
            metadata=metadata
        )
    except Exception as e:
        logger.error(f"Failed to log event {event_type} for user {user.id}: {e}", exc_info=True)


# analytics/utils.py

def predict_retention_days(user, quiz):
    """
    Predicts retention days using spaced repetition principles based on quiz history.
    This version keeps original structure but enhances logic for better psychological accuracy.
    """
    print(f"\n--- Predicting Retention for User: {user.id}, Quiz: {quiz.id} ({quiz.title}) ---")

    if not QUIZ_MODEL_AVAILABLE:
        logger.error("Quiz model not available, cannot calculate retention.")
        return 0

    try:
        quiz_ct = ContentType.objects.get_for_model(quiz)
    except Exception as e:
        logger.error(f"Could not get ContentType for quiz {quiz.id}: {e}")
        return 0

    # 1. Get all past answer events (across all time)
    all_answer_events = ActivityEvent.objects.filter(
        user=user,
        content_type=quiz_ct,
        object_id=quiz.id,
        event_type='quiz_answer_submitted',
    ).order_by('-timestamp')

    total_attempts = 0
    correct_attempts = 0
    streak_correct = 0
    last_answer_time = None

    processed_questions = set()

    for event in all_answer_events:
        qid = event.metadata.get('question_id')
        qtype = event.metadata.get('question_type', 'unknown')
        is_correct = event.metadata.get('is_correct', False)

        if not qid or qid in processed_questions:
            continue

        processed_questions.add(qid)
        total_attempts += 1

        print(f"[DEBUG] Q{qid} ({qtype}) → {'✔' if is_correct else '✘'} at {event.timestamp}")

        if is_correct:
            correct_attempts += 1
            streak_correct += 1
        else:
            streak_correct = 0  # reset streak

        if not last_answer_time:
            last_answer_time = event.timestamp


    if total_attempts == 0:
        print("[DEBUG] No valid quiz attempts found. Returning 0 days.")
        return 0

    accuracy = correct_attempts / total_attempts
    time_since_last = timezone.now() - last_answer_time if last_answer_time else timedelta(days=0)

    print(f"[DEBUG] Attempts={total_attempts}, Correct={correct_attempts}, Accuracy={accuracy:.2f}, Streak={streak_correct}, Last Answer={time_since_last}")

    # --- Retention Tiers ---
    if accuracy == 1.0 and total_attempts >= 3 and streak_correct >= 3:
        # Mastered — recommend far in the future
        if time_since_last > timedelta(days=30):
            return 180  # Max delay
        return 90  # Still fresh mastery
    elif accuracy >= 0.8 and streak_correct >= 2:
        return 21
    elif accuracy >= 0.6:
        return 10
    elif accuracy >= 0.4:
        return 5
    else:
        return 1  # Needs review ASAP


