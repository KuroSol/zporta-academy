from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import F
from .models import QuizSessionProgress, ActivityEvent
from quizzes.models import Quiz  # ensure this import matches your quizzes app

@receiver(post_save, sender=ActivityEvent)
def update_quiz_session_progress(sender, instance, created, **kwargs):
    # Only on new answer events
    if not created or instance.event_type != 'quiz_answer_submitted':
        return

    session_id = instance.session_id
    if not session_id:
        return  # ignore if somehow missing

    user = instance.user
    metadata = instance.metadata or {}
    quiz_id = metadata.get('quiz_id')
    is_correct = metadata.get('is_correct', False)

    # Fetch the quiz to get total questions
    try:
        quiz = Quiz.objects.get(pk=quiz_id)
    except Quiz.DoesNotExist:
        return

    total_qs = quiz.questions.count()

    # Get or create a progress record for this session
    progress, created_prog = QuizSessionProgress.objects.get_or_create(
        session_id=session_id,
        defaults={
            'user': user,
            'quiz': quiz,
            'total_questions': total_qs,
            'started_at': instance.timestamp or timezone.now(),
        }
    )

    # Atomically increment counts
    updates = {'answered_count': F('answered_count') + 1}
    if is_correct:
        updates['correct_count'] = F('correct_count') + 1

    QuizSessionProgress.objects.filter(pk=progress.pk).update(**updates)

    # Refresh from DB to get actual numbers
    progress.refresh_from_db()

    # If reached completion, mark it
    if progress.answered_count >= progress.total_questions and progress.status != QuizSessionProgress.COMPLETED:
        progress.status = QuizSessionProgress.COMPLETED
        progress.completed_at = timezone.now()
        progress.save()
