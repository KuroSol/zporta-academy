# analytics/views.py
import logging
from datetime import timedelta, datetime

from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg, Count, Max, Min, Prefetch, Q, Sum, Case, When, IntegerField
from django.utils import timezone
from rest_framework import generics, status, views, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from analytics.models import QuizAttempt
from analytics.utils import (log_event, predict_overall_quiz_retention_days,
                             update_memory_stat_item)
from quizzes.models import Question, Quiz
from quizzes.serializers import QuizSerializer
from subjects.models import Subject
from subjects.serializers import SubjectSerializer
from users.models import UserPreference

from .models import ActivityEvent, MemoryStat
from .serializers import (ActivityEventSerializer,
                          CorrectAnswerUserRowSerializer,
                          DetailedQuizAnalyticsSerializer,
                          MemoryStatSerializer,
                          QuizAttemptOverviewSerializer,
                          QuizRetentionInsightSerializer,
                          UserMemoryProfileItemSerializer,
                          UserMemoryProfileResponseSerializer)

logger = logging.getLogger(__name__)

# Renaming imports for clarity where needed
QuizzesQuiz = Quiz
QuizzesQuestion = Question


class QuizDetailedAnalyticsView(views.APIView):
    """
    Provides detailed public statistics for a specific quiz, including aggregated
    data for the quiz and per-question statistics.
    This is used by QuizCard to display public engagement stats.
    """
    permission_classes = [AllowAny]

    def get(self, request, quiz_id):
        try:
            quiz_id = int(quiz_id)
            quiz_instance = QuizzesQuiz.objects.get(pk=quiz_id)
        except QuizzesQuiz.DoesNotExist:
            return Response({"error": f"Quiz with ID {quiz_id} not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({"error": f"Invalid Quiz ID format: {quiz_id}."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error fetching quiz for detailed analytics (ID: {quiz_id}): {e}", exc_info=True)
            return Response({"error": "Server error fetching quiz details."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if getattr(quiz_instance, "status", "published") != "published":
            if not (request.user.is_authenticated and (
                getattr(request.user, "is_staff", False) or
                getattr(quiz_instance, "author_id", None) == request.user.id
            )):
                return Response({"error": "Quiz not public."}, status=status.HTTP_404_NOT_FOUND)

        quiz_content_type = ContentType.objects.get_for_model(QuizzesQuiz)
        question_ct = ContentType.objects.get_for_model(QuizzesQuestion)

        answer_events_for_quiz_questions = ActivityEvent.objects.filter(
            content_type=question_ct,
            metadata__quiz_id=quiz_id,
            event_type='quiz_answer_submitted'
        )

        unique_participants = answer_events_for_quiz_questions.values('user').distinct().count()

        unique_finishers = ActivityEvent.objects.filter(
            content_type=quiz_content_type, object_id=quiz_id, event_type='quiz_completed'
        ).values('user').distinct().count()

        total_answers_submitted_for_quiz = answer_events_for_quiz_questions.count()
        correct_wrong_counts = answer_events_for_quiz_questions.aggregate(
            total_correct=Sum(Case(When(metadata__is_correct=True, then=1), default=0, output_field=IntegerField())),
            total_wrong=Sum(Case(When(metadata__is_correct=False, then=1), default=0, output_field=IntegerField())),
        )
        total_correct_answers_for_quiz = correct_wrong_counts.get('total_correct', 0)
        total_wrong_answers_for_quiz = correct_wrong_counts.get('total_wrong', 0)

        overall_correctness_percentage = (total_correct_answers_for_quiz / total_answers_submitted_for_quiz * 100) if total_answers_submitted_for_quiz > 0 else 0
        overall_wrongness_percentage = (total_wrong_answers_for_quiz / total_answers_submitted_for_quiz * 100) if total_answers_submitted_for_quiz > 0 else 0

        questions_stats_list = []
        quiz_questions = QuizzesQuestion.objects.filter(quiz=quiz_instance).order_by('id')

        for q_instance in quiz_questions:
            q_id = q_instance.id
            q_events = ActivityEvent.objects.filter(
                content_type=question_ct,
                object_id=q_id,
                event_type='quiz_answer_submitted',
                metadata__quiz_id=quiz_id,
            )
            q_distinct_answered_users = q_events.values('user').distinct().count()
            q_correct = q_events.filter(metadata__is_correct=True).count()
            q_wrong = q_events.filter(metadata__is_correct=False).count()
            q_total_submissions = q_events.count()

            questions_stats_list.append({
                'question_id': q_id,
                'question_text': str(q_instance.question_text)[:100] + ('...' if len(str(q_instance.question_text)) > 100 else ''),
                'times_answered': q_total_submissions,
                'distinct_users_answered': q_distinct_answered_users,
                'times_correct': q_correct,
                'times_wrong': q_wrong,
                'percentage_correct': round((q_correct / q_total_submissions * 100) if q_total_submissions > 0 else 0, 2),
                'percentage_wrong': round((q_wrong / q_total_submissions * 100) if q_total_submissions > 0 else 0, 2),
            })

        analytics_data = {
            'quiz_id': quiz_id,
            'quiz_title': quiz_instance.title,
            'unique_participants': unique_participants,
            'unique_finishers': unique_finishers,
            'total_answers_submitted_for_quiz': total_answers_submitted_for_quiz,
            'total_correct_answers_for_quiz': total_correct_answers_for_quiz,
            'total_wrong_answers_for_quiz': total_wrong_answers_for_quiz,
            'overall_correctness_percentage': round(overall_correctness_percentage, 2),
            'overall_wrongness_percentage': round(overall_wrongness_percentage, 2),
            'questions_stats': questions_stats_list
        }
        serializer = DetailedQuizAnalyticsSerializer(analytics_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class _SmallPage(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class CorrectUsersForQuestionView(generics.ListAPIView):
    serializer_class = CorrectAnswerUserRowSerializer
    pagination_class = _SmallPage
    permission_classes = [IsAuthenticated]  # or AllowAny if you want public

    def get_queryset(self):
        quiz_id = self.kwargs["quiz_id"]
        question_id = self.kwargs["question_id"]
        correct = self.request.query_params.get("correct", "true").lower() != "false"

        question_ct = ContentType.objects.get_for_model(QuizzesQuestion)
        qs = (
            ActivityEvent.objects
            .filter(
                event_type="quiz_answer_submitted",
                content_type=question_ct,
                metadata__quiz_id=quiz_id,
                metadata__question_id=question_id,
            )
            .select_related("user")         # <-- required for username
            .order_by("-timestamp")
        )
        if correct:
            qs = qs.filter(metadata__is_correct=True)
        return qs

class ActivityEventViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivityEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = ActivityEvent.objects.select_related('user', 'content_type')

        if user.is_staff and self.request.query_params.get('all_users') == 'true':
            return queryset.all().order_by('-timestamp')

        return queryset.filter(user=user).order_by('-timestamp')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quiz_overall_retention_insights_view(request):
    user = request.user
    insights_data = []

    try:
        quiz_content_type = ContentType.objects.get_for_model(QuizzesQuiz)
    except Exception as e:
        logger.error(f"quiz_overall_retention_insights_view: Could not get ContentType for Quiz: {e}", exc_info=True)
        return Response({"error": "Server configuration error for retention insights."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    user_quiz_memory_stats_qs = MemoryStat.objects.filter(
        user=user, content_type=quiz_content_type
    ).select_related('user', 'content_type').prefetch_related('learnable_item')

    for stat in user_quiz_memory_stats_qs:
        quiz_instance = stat.learnable_item
        if not isinstance(quiz_instance, QuizzesQuiz):
            logger.warning(f"MemoryStat ID {stat.id} for user {user.id} (ContentType: Quiz) has learnable_item of type {type(quiz_instance)} instead of Quiz. Skipping.")
            continue

        retention_days = predict_overall_quiz_retention_days(user, quiz_instance)

        message = f"Review “{quiz_instance.title}”"
        if retention_days > 30:
            message = f"🧠 Excellent! Memory for “{quiz_instance.title}” is strong. Next ideal review in {retention_days} days."
        elif retention_days > 14:
            message = f"👍 Great job on “{quiz_instance.title}”! Memory is solid. Review in {retention_days} days."
        elif retention_days > 3:
            message = f"📚 Good progress with “{quiz_instance.title}”. Reinforce in {retention_days} days."
        elif retention_days > 0:
            message = f"💡 Keep “{quiz_instance.title}” fresh! Review in {retention_days} day{'s' if retention_days > 1 else ''}."
        else:
            message = f"⚠️ Act now! It's the best time to review “{quiz_instance.title}” to boost memory."

        insights_data.append({
            "quiz_id": quiz_instance.id,
            "quiz_title": quiz_instance.title,
            "retention_days": retention_days,
            "message": message,
            "last_attempt_timestamp": stat.last_reviewed_at,
            "current_quiz_retention_estimate": stat.current_retention_estimate,
        })

    serializer = QuizRetentionInsightSerializer(insights_data, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


class UserMemoryProfileView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        near_future_days = int(request.query_params.get('upcoming_days', 7))

        try:
            question_content_type = ContentType.objects.get_for_model(QuizzesQuestion)
        except Exception as e:
            logger.error(f"UserMemoryProfileView: Could not get ContentType for QuizzesQuestion: {e}", exc_info=True)
            return Response({"error": "Server configuration error."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        base_question_stats_qs = MemoryStat.objects.filter(
            user=user, content_type=question_content_type
        ).select_related('user', 'content_type').prefetch_related(
            Prefetch('learnable_item', queryset=QuizzesQuestion.objects.select_related('quiz'))
        )

        items_to_review_qs = base_question_stats_qs.filter(
            next_review_at__lte=now
        ).order_by('next_review_at')

        strong_memory_items_qs = base_question_stats_qs.filter(
            next_review_at__gt=now + timedelta(days=14),
            current_retention_estimate__gte=0.50
        ).order_by('-next_review_at', '-current_retention_estimate')[:15]

        upcoming_review_items_qs = base_question_stats_qs.filter(
            next_review_at__gt=now,
            next_review_at__lte=now + timedelta(days=near_future_days)
        ).exclude(pk__in=items_to_review_qs.values_list('pk', flat=True))
        upcoming_review_items_qs = upcoming_review_items_qs.order_by('next_review_at')

        total_items_tracked_count = base_question_stats_qs.count()
        aggregates = base_question_stats_qs.aggregate(
            avg_ret=Avg('current_retention_estimate'),
            avg_int=Avg('interval_days')
        )
        average_retention_val = aggregates['avg_ret']
        average_interval_val = aggregates['avg_int']

        items_due_count_val = items_to_review_qs.count()
        upcoming_review_count_val = upcoming_review_items_qs.count()

        summary_data = {
            "total_questions_tracked": total_items_tracked_count,
            "average_question_retention": round(average_retention_val * 100, 1) if average_retention_val is not None else 0,
            "average_question_interval_days": round(average_interval_val, 1) if average_interval_val is not None else 0,
            "items_due_count": items_due_count_val,
            "upcoming_review_count": upcoming_review_count_val,
        }

        profile_data_for_serializer = {
            "items_to_review": items_to_review_qs,
            "strong_memory_items": strong_memory_items_qs,
            "upcoming_review_items": upcoming_review_items_qs,
            "message": f"Hello {user.username}! Here's your learning status. You have {items_due_count_val} item(s) due for review.",
            "summary": summary_data
        }
        final_serializer = UserMemoryProfileResponseSerializer(profile_data_for_serializer, context={'request': request})
        return Response(final_serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_content_interaction_time_view(request):
    user = request.user
    item_type_str = request.data.get('item_type')
    item_id = request.data.get('item_id')
    duration_ms = request.data.get('duration_ms')
    context_str = request.data.get('context')

    if not all([item_type_str, item_id, duration_ms is not None, context_str]):
        return Response({"error": "Missing required data: item_type, item_id, duration_ms, context"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        item_id = int(item_id)
        duration_ms = int(duration_ms)
        if duration_ms < 0:
            return Response({"error": "duration_ms must be non-negative."}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError:
        return Response({"error": "item_id and duration_ms must be integers."}, status=status.HTTP_400_BAD_REQUEST)

    instance_to_log = None
    if item_type_str.lower() == 'quiz':
        instance_to_log = QuizzesQuiz.objects.filter(pk=item_id).first()
    elif item_type_str.lower() == 'question':
        instance_to_log = QuizzesQuestion.objects.filter(pk=item_id).first()

    metadata = {
        "item_type_str": item_type_str,
        "item_id": item_id,
        "duration_ms": duration_ms,
        "context": context_str,
        "url": request.data.get('url', request.META.get('HTTP_REFERER', 'N/A')),
    }
    log_event(
        user=user,
        event_type='content_interaction_time',
        instance=instance_to_log,
        metadata=metadata
    )
    return Response({"message": "Interaction time logged successfully."}, status=status.HTTP_201_CREATED)


class QuizAttemptOverviewView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        events = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_answer_submitted',
            metadata__has_key='quiz_id',
        )

        quiz_ids = events.values_list('metadata__quiz_id', flat=True).distinct()
        total_quizzes = quiz_ids.count()

        total_correct = events.filter(metadata__is_correct=True).count()
        total_mistakes = events.filter(metadata__is_correct=False).count()

        quiz_attempt_map = {}
        for e in events:
            quiz_id = e.metadata.get("quiz_id")
            is_correct = e.metadata.get("is_correct")
            if quiz_id is None:
                continue
            quiz_attempt_map.setdefault(quiz_id, []).append(is_correct)

        quizzes_fixed = 0
        never_fixed = 0

        for answers in quiz_attempt_map.values():
            if True in answers and False in answers and answers[0] is False:
                quizzes_fixed += 1
            elif True not in answers and False in answers:
                never_fixed += 1

        prefs, _ = UserPreference.objects.get_or_create(user=user)

        filters = {
            'subjects': SubjectSerializer(prefs.interested_subjects.all(), many=True).data,
            'languages': prefs.languages_spoken or [],
            'locations': [prefs.location] if prefs.location else [],
        }

        data = {
            'total_quizzes': total_quizzes,
            'total_correct': total_correct,
            'total_mistakes': total_mistakes,
            'quizzes_fixed': quizzes_fixed,
            'never_fixed': never_fixed,
            'filters': filters,
        }
        serializer = QuizAttemptOverviewSerializer(data)
        return Response(serializer.data)


class QuizListAPIView(generics.ListAPIView):
    """
    GET /analytics/quiz-list/?type=<taken|correct|mistake|fixed|never_fixed>
    """
    permission_classes = [IsAuthenticated]
    serializer_class = QuizSerializer

    def get_queryset(self):
        user = self.request.user
        evts = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_answer_submitted',
            metadata__has_key='quiz_id'
        ).order_by('timestamp')

        from collections import OrderedDict
        quiz_map = OrderedDict()
        for e in evts:
            qid = e.metadata.get('quiz_id')
            if qid is None:
                continue
            quiz_map.setdefault(qid, []).append(bool(e.metadata.get('is_correct', False)))

        t = self.request.query_params.get('type')
        qids = []

        if t == 'taken':
            qids = evts.values_list('metadata__quiz_id', flat=True).distinct()
        elif t == 'correct':
            qids = evts.filter(metadata__is_correct=True).values_list('metadata__quiz_id', flat=True).distinct()
        elif t == 'mistake':
            qids = evts.filter(metadata__is_correct=False).values_list('metadata__quiz_id', flat=True).distinct()
        elif t == 'fixed':
            qids = [
                qid for qid, answers in quiz_map.items()
                if answers and answers[0] is False and True in answers
            ]
        elif t == 'never_fixed':
            qids = [
                qid for qid, answers in quiz_map.items()
                if answers and True not in answers and False in answers
            ]
        else:
            return Quiz.objects.none()

        return Quiz.objects.filter(pk__in=qids, status='published')
