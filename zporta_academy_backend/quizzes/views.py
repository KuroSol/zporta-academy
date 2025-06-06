# quizzes/views.py
import logging
from rest_framework import generics, status, viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, Q, Prefetch
from django.contrib.contenttypes.models import ContentType
from analytics.models import ActivityEvent
import numpy as np
from .models import Quiz, Question # Import Question model
from .serializers import QuizSerializer

# Import utilities from the 'analytics' app
from analytics.utils import update_memory_stat_item, log_event
# from analytics.models import MemoryStat # Not directly needed here if utils handle ContentType

logger = logging.getLogger(__name__)

class QuizViewSet(viewsets.ModelViewSet): # Changed from ModelViewSet to ReadOnlyModelViewSet if no write ops needed directly
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticatedOrReadOnly] # Allow read for anyone, write for authenticated

    def get_queryset(self):
        """
        Annotate each Quiz so that:
          • attempt_count = number of distinct users who fired a 'quiz_submitted' event.
        """
        # Ensure related objects are fetched efficiently
        queryset = Quiz.objects.select_related('created_by', 'subject', 'course').prefetch_related(
            'questions', # Prefetch questions for potential use in serializer or views
            # Add other prefetches if your QuizSerializer or views need them
            # Prefetch('questions__fill_blank'),
            # Prefetch('questions__fill_blank__words'),
            # Prefetch('questions__fill_blank__solutions'),
        ).annotate(
            attempt_count=Count(
                'activity_events', # Assumes ActivityEvent has a GFK to Quiz
                filter=Q(activity_events__event_type='quiz_submitted'),
                distinct=True
            )
        ).order_by('-created_at') # Example ordering

        # Example filtering based on query parameters
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        
        subject_slug = self.request.query_params.get('subject_slug')
        if subject_slug:
            queryset = queryset.filter(subject__slug=subject_slug) # Assumes subject has a slug

        return queryset

    def perform_create(self, serializer):
        if not self.request.user.is_authenticated:
            raise PermissionDenied("You must be logged in to create a quiz.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        quiz = serializer.instance
        if quiz.created_by != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to edit this quiz.")
        if quiz.is_locked and not self.request.user.is_staff: # Staff can edit locked quizzes
            raise PermissionDenied("This quiz is locked and cannot be modified by non-staff users.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.created_by != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to delete this quiz.")
        if instance.is_locked and not self.request.user.is_staff:
             raise PermissionDenied("This quiz is locked and cannot be deleted by non-staff users.")
        instance.delete()

class RecordQuizAnswerView(APIView):
    """
    Records a single answer submitted by a user during a quiz.
    Handles different question types, updates memory statistics (SM-2),
    and logs detailed activity events.
    The 'pk' in the URL refers to the Quiz ID.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic  # Ensures memory stat update and event logging are atomic
    def post(self, request, pk):  # pk here is quiz_id from URL
        user = request.user
        quiz_id_from_url = pk
        question_id = request.data.get("question_id")
        selected_option_raw = request.data.get("selected_option")
        time_spent_ms = request.data.get("time_spent_ms")

        # --- 1. Validate Input ---
        if selected_option_raw is None or question_id is None:
            return Response(
                {"error": "selected_option and question_id are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            time_spent_ms = int(time_spent_ms) if time_spent_ms is not None else None
            if time_spent_ms is not None and time_spent_ms < 0:
                return Response(
                    {"error": "time_spent_ms must be non-negative."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {"error": "time_spent_ms must be an integer if provided."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Ensure the question belongs to the specified quiz from the URL
            question_instance = get_object_or_404(
                Question, pk=question_id, quiz_id=quiz_id_from_url
            )
            quiz_instance = question_instance.quiz  # This is the Quiz instance
        except Question.DoesNotExist:
            return Response(
                {"error": "Question not found or does not belong to this quiz."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(
                f"Error fetching question instance for QID {question_id}, QuizID {quiz_id_from_url}: {e}",
                exc_info=True
            )
            return Response(
                {"error": "Error fetching question details."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        is_correct = False
        correct_answer_value = None
        processed_selected_option = selected_option_raw
        q_type = question_instance.question_type

        # --- 2. Determine Correctness (from your original logic) ---
        try:
            if q_type == 'mcq':
                processed_selected_option = int(selected_option_raw)
                correct_answer_value = question_instance.correct_option
                is_correct = (
                    correct_answer_value is not None
                    and processed_selected_option == correct_answer_value
                )
            elif q_type == 'multi':
                if not isinstance(selected_option_raw, list):
                    raise TypeError("Answer must be a list.")
                processed_selected_option = sorted([int(opt) for opt in selected_option_raw])
                correct_set = set(question_instance.correct_options or [])
                correct_answer_value = sorted(list(correct_set))
                is_correct = (processed_selected_option == correct_answer_value)
            elif q_type == 'short':
                if not isinstance(selected_option_raw, (str, int, float)):
                    raise TypeError("Answer must be a string or number.")
                processed_selected_option = str(selected_option_raw).strip()
                correct_answer_value = question_instance.correct_answer
                is_correct = (
                    correct_answer_value is not None
                    and processed_selected_option.lower() == correct_answer_value.lower()
                )
            elif q_type == 'sort':
                if not isinstance(selected_option_raw, list):
                    raise TypeError("Answer must be a list of strings.")
                processed_selected_option = selected_option_raw
                correct_answer_value = question_instance.correct_options
                is_correct = (
                    isinstance(correct_answer_value, list)
                    and processed_selected_option == correct_answer_value
                )
            elif q_type == 'dragdrop':
                processed_selected_option = selected_option_raw
                correct_answer_value = question_instance.correct_options
                # TODO: Implement your actual drag-and-drop comparison logic
                # is_correct = compare_drag_drop_solutions(processed_selected_option, correct_answer_value)
                logger.warning(
                    f"Drag-and-drop grading for QID {question_instance.id} needs specific implementation."
                )
                is_correct = False  # Placeholder
            else:
                logger.error(
                    f"Unsupported question type for answer recording: {q_type} for QID {question_instance.id}"
                )
                return Response(
                    {"error": f"Unsupported question type: {q_type}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError) as e:
            logger.error(
                f"Invalid format for selected_option for QID {question_instance.id} "
                f"(type '{q_type}'): {e}",
                exc_info=True
            )
            return Response(
                {"error": f"Invalid answer format for question type '{q_type}': {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(
            f"Answer for Q:{question_instance.id} by User:{user.id}. "
            f"Data: {selected_option_raw}. Correct: {is_correct}"
        )

        # --- 3. Determine Quality of Recall (QoR) for SM-2 ---
        quality_of_recall = 0
        if is_correct:
            if time_spent_ms is None or time_spent_ms > 15000:
                quality_of_recall = 3  # Correct but slow
            elif time_spent_ms > 7000:
                quality_of_recall = 4  # Correct with some hesitation
            else:
                quality_of_recall = 5  # Correct and quick
        else:
            quality_of_recall = 1  # Default for incorrect

        # --- 4. Update Memory Statistic for the Question ---
        updated_stat = update_memory_stat_item(
            user=user,
            learnable_item=question_instance,
            quality_of_recall=quality_of_recall,
            time_spent_ms=time_spent_ms
        )
        if not updated_stat:
            logger.error(
                f"MemoryStat update failed for user {user.id}, question {question_instance.id}. "
                f"QoR: {quality_of_recall}"
            )

        # --- 5. Log 'quiz_answer_submitted' Activity Event ---
        event_metadata = {
            "quiz_id":                   quiz_instance.id,
            "quiz_title":                quiz_instance.title,
            "question_id":               question_instance.id,
            "question_text_snippet":     str(question_instance.question_text)[:100],
            "question_type":             q_type,
            "submitted_answer":          processed_selected_option,
            "correct_answer_expected":   correct_answer_value,
            "is_correct":                is_correct,
            "time_spent_ms":             time_spent_ms,
            "quality_of_recall_used":    quality_of_recall,
            "memory_stat_updated":       (updated_stat is not None),
            "new_interval_days":         (updated_stat.interval_days if updated_stat else None),
            "new_ef":                    (updated_stat.easiness_factor if updated_stat else None),
            "new_repetitions":           (updated_stat.repetitions if updated_stat else None),
            "next_review_at":            (updated_stat.next_review_at.isoformat() if updated_stat and updated_stat.next_review_at else None),
        }
        log_event(
            user=user,
            event_type='quiz_answer_submitted',
            instance=question_instance,
            metadata=event_metadata,
            related_object=quiz_instance
        )

        # ←——— INSERTION STARTS HERE ———→

        # 1) Count how many distinct questions this user has answered for this quiz so far.
        quiz_question_ct = ContentType.objects.get_for_model(Question)
        distinct_answers = (
            ActivityEvent.objects
            .filter(
                user=user,
                content_type=quiz_question_ct,
                event_type='quiz_answer_submitted',
                metadata__quiz_id=quiz_id_from_url
            )
            .values('metadata__question_id')
            .distinct()
            .count()
        )

        total_questions = quiz_instance.questions.count()
        if distinct_answers >= total_questions:
            # 2) If user has answered every question at least once, fire quiz_completed:
            log_event(
                user=request.user,
                event_type='quiz_completed',
                instance=quiz_instance,
                metadata={"auto_completed": True}
            )

            # 3) ───────── Un‐commented “Optional” SM-2 Update for the Quiz ─────────
            # Gather all of this user’s QoR values for every 'quiz_answer_submitted' on this quiz:
            qos_list = (
                ActivityEvent.objects
                .filter(
                    user=user,
                    content_type=quiz_question_ct,
                    event_type='quiz_answer_submitted',
                    metadata__quiz_id=quiz_id_from_url
                )
                .values_list('metadata__quality_of_recall_used', flat=True)
            )
            # Convert to a NumPy array of ints, then take the mean (round to nearest int)
            qos_array = np.array(list(qos_list), dtype=int)
            if qos_array.size:
                avg_qor = int(np.round(np.mean(qos_array)))
            else:
                avg_qor = 3  # default fallback if something is missing

            update_memory_stat_item(
                user=request.user,
                learnable_item=quiz_instance,
                quality_of_recall=avg_qor,
                time_spent_ms=None
            )
            logger.info(
                f"SM-2 for entire Quiz {quiz_instance.id} updated with QoR={avg_qor} for user {request.user.id}"
            )
        # ←——— INSERTION ENDS HERE ———→

        # --- 6. Prepare and Return Response ---
        response_data = {
            "message":                   "Answer recorded and processed.",
            "question_id":               question_instance.id,
            "is_correct":                is_correct,
            "quality_of_recall_calculated": quality_of_recall,
            "next_review_at":            (updated_stat.next_review_at.isoformat() if updated_stat and updated_stat.next_review_at else None),
            "current_retention_estimate": (updated_stat.current_retention_estimate if updated_stat else None),
        }
        return Response(response_data, status=status.HTTP_200_OK)


class QuizSubmitView(APIView):
    """
    Handles the submission of the entire quiz results at the end.
    This view focuses on overall quiz completion logging.
    Individual question SM-2 updates should happen via RecordQuizAnswerView.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk): # pk is quiz_id
        quiz = get_object_or_404(Quiz, pk=pk)
        # Data expected from frontend for overall submission:
        # - all_answers_summary: list of {question_id, is_correct, time_spent_ms} (already processed by RecordQuizAnswerView)
        # - quiz_session_time_ms: total time for the quiz attempt
        # - final_score: calculated on frontend or re-calculated here
        
        quiz_session_time_ms = request.data.get("quiz_session_time_ms")
        # `answers` here might be a summary if individual answers were already processed
        # or it could be the raw answers if RecordQuizAnswerView is not used for each question.
        # For this revised flow, we assume individual answers are processed by RecordQuizAnswerView.
        # So, this view mainly logs 'quiz_completed' or 'quiz_submitted' (if different).

        # Example: Frontend sends final score and number of correct answers
        final_score = request.data.get("final_score") # e.g., number correct
        total_questions_answered = request.data.get("total_questions_answered")
        correct_answers_count = request.data.get("correct_answers_count")


        if final_score is None or total_questions_answered is None or correct_answers_count is None:
             logger.warning(f"QuizSubmitView for Quiz {pk} by User {request.user.id} missing some summary data.")
             # You might still proceed to log completion or return a 400 error.

        total_questions_in_quiz = quiz.questions.count()
        score_percentage = (correct_answers_count / total_questions_in_quiz * 100) if total_questions_in_quiz > 0 and correct_answers_count is not None else None


        metadata = {
            "score_calculated": final_score, # Or re-calculate if needed
            "total_questions_in_quiz": total_questions_in_quiz,
            "total_questions_answered_in_attempt": total_questions_answered,
            "correct_answers_count_in_attempt": correct_answers_count,
            "score_percentage": score_percentage,
            "quiz_session_time_ms": quiz_session_time_ms,
            # "detailed_question_results": request.data.get("question_results_details") # If frontend sends this summary
        }

        # Log 'quiz_completed' event
        log_event(user=request.user, event_type='quiz_completed', instance=quiz, metadata=metadata)

        # Optionally, update a MemoryStat for the *entire Quiz* if you want SM-2 for whole quizzes
        if score_percentage is not None:
            quiz_qor = 0 # Determine QoR for the whole quiz based on score
            if score_percentage >= 90: quiz_qor = 5
            elif score_percentage >= 75: quiz_qor = 4
            elif score_percentage >= 50: quiz_qor = 3
            elif score_percentage >= 25: quiz_qor = 2
            else: quiz_qor = 1
            
            update_memory_stat_item(
                user=request.user,
                learnable_item=quiz, # The Quiz model instance
                quality_of_recall=quiz_qor,
                time_spent_ms=quiz_session_time_ms # Can use overall session time here
            )
            logger.info(f"Updated MemoryStat for Quiz {quiz.id} (overall) for user {request.user.id}. QoR: {quiz_qor}")


        return Response({
            "message": "Quiz submission processed successfully.",
            "quiz_id": quiz.pk,
            "final_score_recorded": final_score,
            "score_percentage": score_percentage,
        }, status=status.HTTP_200_OK)


class QuizListCreateView(generics.ListCreateAPIView):
    serializer_class = QuizSerializer
    # queryset optimization from your original code
    queryset = Quiz.objects \
        .select_related('created_by', 'subject', 'course') \
        .prefetch_related(
            'questions',
            Prefetch('questions__fill_blank'),
            Prefetch('questions__fill_blank__words'),
            Prefetch('questions__fill_blank__solutions'),
        ).order_by('-created_at') # Example default ordering

    def get_queryset(self):
        queryset = super().get_queryset()
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        
        subject_slug = self.request.query_params.get('subject_slug')
        if subject_slug:
            queryset = queryset.filter(subject__slug=subject_slug) # Ensure subject model has 'slug'
        
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
            
        # Add more filters as needed (e.g., tags, difficulty)
        return queryset

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()] # Only authenticated users can create

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuizRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuizSerializer
    queryset = Quiz.objects \
        .select_related('created_by', 'subject', 'course') \
        .prefetch_related(
            'questions',
            Prefetch('questions__fill_blank'),
            Prefetch('questions__fill_blank__words'),
            Prefetch('questions__fill_blank__solutions'),
        )
    permission_classes = [IsAuthenticatedOrReadOnly] # Allow read, restrict write
    lookup_field = 'pk' # Can also be 'permalink' if unique and indexed

    def get_object(self):
        # For 'permalink' lookup:
        # lookup_value = self.kwargs[self.lookup_field]
        # if self.lookup_field == 'permalink':
        #     obj = get_object_or_404(self.get_queryset(), permalink=lookup_value)
        # else:
        #     obj = get_object_or_404(self.get_queryset(), pk=lookup_value)
        obj = super().get_object()


        # Permission check for write operations
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if obj.created_by != self.request.user and not self.request.user.is_staff:
                raise PermissionDenied("You do not have permission to modify this quiz.")
            if obj.is_locked and not self.request.user.is_staff:
                raise PermissionDenied("This quiz is locked and cannot be modified by non-staff.")
        return obj

    def retrieve(self, request, *args, **kwargs):
        quiz = self.get_object()
        quiz_content_type = ContentType.objects.get_for_model(Quiz)
        question_content_type = ContentType.objects.get_for_model(Question)

        # Annotate the Quiz itself with attempt_count
        quiz_with_counts = (
            Quiz.objects
            .filter(pk=quiz.pk)
            .annotate(
                attempt_count=Count(
                    'activity_events', # Assumes ActivityEvent GFK points to Quiz
                    filter=Q(activity_events__event_type__in=['quiz_submitted', 'quiz_completed']), # Count both
                    distinct=True
                )
            )
            .first()
        )
        if not quiz_with_counts: # Should not happen if get_object succeeded
            quiz_with_counts = quiz # Fallback

        # Annotate each Question with its stats
        # This can be complex if questions are deeply nested in serializer.
        # Simpler to fetch separately and add to response if serializer doesn't handle it well.
        questions_queryset = Question.objects.filter(quiz=quiz).annotate(
            question_attempt_count=Count(
                'activity_events', # Assumes ActivityEvent GFK points to Question
                filter=Q(activity_events__event_type='quiz_answer_submitted', activity_events__content_type=question_content_type),
                distinct=True
            ),
            question_correct_count=Count(
                'activity_events',
                filter=Q(
                    activity_events__event_type='quiz_answer_submitted',
                    activity_events__content_type=question_content_type,
                    activity_events__metadata__is_correct=True
                ),
                distinct=True
            )
        )
        # question_wrong_count can be derived or annotated similarly

        quiz_data = QuizSerializer(quiz_with_counts, context={'request': request}).data
        
        # Add question stats to the quiz_data if serializer doesn't include them
        # This part depends heavily on your QuizSerializer structure
        if 'questions' in quiz_data:
            question_stats_map = {q.id: q for q in questions_queryset}
            for q_s_data in quiz_data['questions']:
                q_stat = question_stats_map.get(q_s_data['id'])
                if q_stat:
                    q_s_data['stats_attempt_count'] = q_stat.question_attempt_count
                    q_s_data['stats_correct_count'] = q_stat.question_correct_count
                    q_s_data['stats_wrong_count'] = q_stat.question_attempt_count - q_stat.question_correct_count


        # Log 'content_viewed' event for the quiz detail view if user is authenticated
        if request.user.is_authenticated:
            log_event(
                user=request.user,
                event_type='content_viewed',
                instance=quiz,
                metadata={'view_context': 'QuizDetailView', 'quiz_id': quiz.id}
            )

        return Response(quiz_data, status=status.HTTP_200_OK)


class DynamicQuizView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        quiz = get_object_or_404(
            Quiz.objects
                .select_related('created_by', 'subject', 'course')
                .prefetch_related(
                    'questions',
                    Prefetch('questions__fill_blank'), # Example of deep prefetch
                    Prefetch('questions__fill_blank__words'),
                    Prefetch('questions__fill_blank__solutions'),
                ),
            permalink=permalink
        )
        serializer = QuizSerializer(quiz, context={"request": request, "view_name": "dynamic-quiz-view"}) # Pass context

        if request.user.is_authenticated:
            log_event(
                user=request.user,
                event_type='quiz_started', # Or 'content_viewed' if it's just viewing before starting
                instance=quiz,
                metadata={'permalink': quiz.permalink, 'quiz_id': quiz.id, 'context': 'DynamicQuizViewLoad'}
            )

        seo_data = {
            "title": quiz.seo_title or quiz.title,
            "description": quiz.seo_description or getattr(quiz, 'short_description', '') or '',
            "canonical_url": quiz.canonical_url or request.build_absolute_uri(),
            "og_title": quiz.og_title or quiz.title,
            "og_description": quiz.og_description or getattr(quiz, 'short_description', '') or '',
            "og_image": quiz.og_image.url if quiz.og_image else request.build_absolute_uri('/static/default_quiz_image.png'), # Ensure .url for ImageField
        }

        return Response({
            "quiz": serializer.data,
            "seo": seo_data
        })


class QuizListByCourseView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        course_id = self.kwargs.get("course_id")
        if course_id is None:
            return Quiz.objects.none()
        return Quiz.objects.filter(course_id=course_id).select_related('created_by', 'subject').order_by('order_in_course', 'title') # Example ordering


class MyQuizzesView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Quiz.objects.filter(created_by=self.request.user).select_related('subject', 'course').order_by('-created_at')
