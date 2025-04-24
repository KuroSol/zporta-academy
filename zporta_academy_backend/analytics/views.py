# analytics/views.py
from rest_framework import viewsets, status # Add status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes # Add decorators
from rest_framework.response import Response # Add Response
from .models import ActivityEvent
from .serializers import ActivityEventSerializer
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
import logging # Add logging

# Try to import Quiz model and serializer
try:
    from quizzes.models import Quiz
    from quizzes.serializers import QuizSerializer # Use your actual QuizSerializer
    QUIZ_APP_AVAILABLE = True
except ImportError:
    QUIZ_APP_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Quiz app models/serializers not found. Quiz suggestions disabled.")


class ActivityEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityEvent.objects.all()
    serializer_class = ActivityEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def suggest_quizzes_based_on_activity(request):
    if not QUIZ_APP_AVAILABLE:
        return Response({"error": "Quiz suggestion feature not available."}, status=status.HTTP_501_NOT_IMPLEMENTED)

    user = request.user
    limit = int(request.query_params.get('limit', 5))

    try:
        quiz_content_type = ContentType.objects.get_for_model(Quiz)
    except ContentType.DoesNotExist:
        logger.error("ContentType for Quiz model not found.")
        return Response({"error": "Server configuration error for quiz suggestions."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Get IDs of quizzes the user has interacted with
    # Use distinct on object_id before slicing/limiting
    taken_quiz_ids = list(ActivityEvent.objects.filter(
        user=user,
        content_type=quiz_content_type,
        event_type__in=['quiz_submitted', 'quiz_answer_submitted', 'quiz_started']
    ).order_by('-timestamp').values_list('object_id', flat=True).distinct()[:20]) # Consider last 20 unique quizzes

    if not taken_quiz_ids:
        # Suggest popular/newest public quizzes if user has no history
        suggested_quizzes = Quiz.objects.filter(is_public=True).order_by('-created_at')[:limit] # Example: newest public
    else:
        # Find quizzes related to the ones taken (e.g., same subject), excluding taken ones
        taken_quizzes = Quiz.objects.filter(id__in=taken_quiz_ids)
        # Get subject IDs, filtering out None values if subject is optional
        related_subject_ids = list(taken_quizzes.filter(subject__isnull=False).values_list('subject_id', flat=True).distinct())

       
        suggestion_pool = Quiz.objects.exclude(id__in=taken_quiz_ids)
        # Filter by related subjects if any were found
        if not taken_quiz_ids:
            # Suggest popular/newest quizzes if user has no history
            # Remove is_public=True here too if it doesn't exist
            suggested_quizzes = Quiz.objects.order_by('-created_at')[:limit]
        else:
            # ... logic to find related subjects/courses ...

            # Find other quizzes, excluding already taken ones
            # Remove is_public=True here too if it doesn't exist
            suggestion_pool = Quiz.objects.exclude(id__in=taken_quiz_ids)

            # Filter by related subjects if any were found
            if related_subject_ids:
                suggestion_pool = suggestion_pool.filter(subject_id__in=related_subject_ids)

            suggested_quizzes = suggestion_pool.order_by('?')[:limit]
    # Use your actual QuizSerializer
    serializer = QuizSerializer(suggested_quizzes, many=True, context={'request': request})
    return Response(serializer.data)
# --- END NEW SUGGESTION VIEW ---