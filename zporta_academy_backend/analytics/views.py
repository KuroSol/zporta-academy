# analytics/views.py

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from django.contrib.contenttypes.models import ContentType
import logging

from .models import ActivityEvent
from .serializers import (
    ActivityEventSerializer,
    QuizRetentionInsightSerializer
)
from .utils import predict_retention_days

# Try to import Quiz and its serializer
try:
    from quizzes.models import Quiz
    from quizzes.serializers import QuizSerializer
    QUIZ_APP_AVAILABLE = True
except ImportError:
    Quiz = None
    QuizSerializer = None
    QUIZ_APP_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Quiz app not available. Quiz suggestions & retention disabled.")


class ActivityEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for ActivityEvent entries.
    """
    queryset = ActivityEvent.objects.all()
    serializer_class = ActivityEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def suggest_quizzes_based_on_activity(request):
    """
    Suggest quizzes based on user activity history.
    """
    if not QUIZ_APP_AVAILABLE:
        return Response(
            {"error": "Quiz suggestion feature not available."},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

    user = request.user
    limit = int(request.query_params.get('limit', 5))

    # ContentType for Quiz
    try:
        quiz_ct = ContentType.objects.get_for_model(Quiz)
    except ContentType.DoesNotExist:
        logger.error("ContentType for Quiz not found.")
        return Response(
            {"error": "Server configuration error for quiz suggestions."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Get last 20 unique quizzes user interacted with
    taken_ids = (
        ActivityEvent.objects
        .filter(
            user=user,
            content_type=quiz_ct,
            event_type__in=['quiz_started', 'quiz_submitted', 'quiz_answer_submitted']
        )
        .order_by('-timestamp')
        .values_list('object_id', flat=True)
        .distinct()[:20]
    )

    if not taken_ids:
        # No history → newest public
        qs = Quiz.objects.filter(is_public=True).order_by('-created_at')[:limit]
    else:
        # Find related by subject
        related_subjects = (
            Quiz.objects.filter(id__in=taken_ids)
            .filter(subject__isnull=False)
            .values_list('subject_id', flat=True)
            .distinct()
        )
        pool = Quiz.objects.exclude(id__in=taken_ids)
        if related_subjects:
            pool = pool.filter(subject_id__in=related_subjects)
        qs = pool.order_by('?')[:limit]

    serializer = QuizSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quiz_retention_insights(request):
    user = request.user
    insights = []

    if not QUIZ_APP_AVAILABLE:
        return Response([], status=status.HTTP_200_OK)

    quiz_ct = ContentType.objects.get_for_model(Quiz)

    for quiz in Quiz.objects.all():
        # 1) calculate retention using our updated utils
        retention_days = predict_retention_days(user, quiz)

        # 2) find the last attempt
        last_event = (
            ActivityEvent.objects
                .filter(
                    user=user,
                    content_type=quiz_ct,
                    object_id=quiz.id,
                    event_type__in=['quiz_answer_submitted', 'quiz_submitted']
                )
                .order_by('-timestamp')
                .first()
        )
        last_attempt_time = last_event.timestamp if last_event else None

        # 3) tally correct/wrong
        answers = ActivityEvent.objects.filter(
            user=user,
            content_type=quiz_ct,
            object_id=quiz.id,
            event_type='quiz_answer_submitted'
        )
        total = answers.count()
        correct = answers.filter(metadata__is_correct=True).count()
        wrong = total - correct

        # 4) pick the right message
        if not last_event:
            message = f"You've never taken “{quiz.title}”—give it a try!"
        elif retention_days >= 3:
            message = f"Great job! You’ll remember “{quiz.title}” for about {retention_days} days."
        elif retention_days > 0:
            message = f"You'll likely retain “{quiz.title}” for {retention_days} more day{'s' if retention_days > 1 else ''}."
        else:
            message = f"Time to review “{quiz.title}” again!"

        insights.append({
            "quiz_id": quiz.id,
            "retention_days": retention_days,
            "message": message,
            "last_attempt": last_attempt_time,
            "correct": correct,
            "wrong": wrong,
        })

    serializer = QuizRetentionInsightSerializer(insights, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)