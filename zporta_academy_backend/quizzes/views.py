import logging
import numpy as np
import uuid
from uuid import uuid4
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, Q
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from django.utils import timezone
# Local App Imports
from users.models import User
from notifications.models import Notification
from notifications.utils import send_push_to_user_devices
from .models import Quiz, Question, QuizReport, QuizShare
from .serializers import QuizSerializer, QuestionSerializer, QuizReportSerializer, QuizShareSerializer
from analytics.utils import update_memory_stat_item, log_event
from analytics.models import ActivityEvent
from rest_framework.decorators import api_view, permission_classes
from analytics.utils import get_or_create_quiz_session_id


logger = logging.getLogger(__name__)


class QuizStartView(APIView):
    """
    Logs a quiz_started event for a given quiz.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        # force new session on explicit start
        session_id = uuid.uuid4()
        # Only once per user + quiz
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        if not ActivityEvent.objects.filter(
            user=request.user,
            content_type=quiz_ct,
            object_id=quiz.id,
            event_type='quiz_started'
        ).exists():
            log_event(
                user=request.user,
                event_type='quiz_started',
                instance=quiz,
                metadata={ 'quiz_id': quiz.id, 'started_at': timezone.now().isoformat() },
                session_id=session_id,
            )
        return Response({'status': 'quiz_started recorded'}, status=status.HTTP_200_OK)

# --- Question-specific Views ---
class QuestionListCreateView(generics.ListCreateAPIView):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save()

class QuestionRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

# --- CORRECTED Quiz Views ---

class RecordQuizAnswerView(APIView):
    """
    Records a user's answer and handles all related analytics events,
    using the project's existing structure and fixing previous errors.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        user = request.user
        quiz_id = pk
        question_id = request.data.get("question_id")
        raw_answer = request.data.get("selected_option")
        time_spent_ms = request.data.get("time_spent_ms")

        # Validate inputs
        if question_id is None or raw_answer is None:
            return Response({"error": "question_id and selected_option are required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            time_spent_ms = int(time_spent_ms) if time_spent_ms is not None else None
        except (ValueError, TypeError):
            return Response({"error": "time_spent_ms must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        question = get_object_or_404(Question, pk=question_id, quiz_id=quiz_id)
        quiz = question.quiz

        # ——— Log quiz_started the very first time, including quiz_id ———
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        if not ActivityEvent.objects.filter(
            user=user, content_type=quiz_ct, object_id=quiz.id, event_type='quiz_started'
        ).exists():
            log_event(
                user=user,
                event_type='quiz_started',
                instance=quiz,
                metadata={
                   'quiz_id': quiz.id,
                   'started_at': timezone.now().isoformat()
                }
            )

        # Use static methods for logic, as in your original file
        is_correct, correct_val, processed_answer = self.check_answer(question, raw_answer)
        qor = self.calculate_qor(is_correct, time_spent_ms)
        
        # Use your project's existing utility for spaced repetition
        stat = update_memory_stat_item(user=user, learnable_item=question, quality_of_recall=qor, time_spent_ms=time_spent_ms)
        
        # Log the answer with all analytics data
        self.log_answer(request, quiz, question, processed_answer, correct_val, is_correct, time_spent_ms, qor, stat)
        
        # --- FIX: Defer the completion check until after the transaction commits ---
        transaction.on_commit(lambda: self.check_completion_after_commit(user.id, quiz.id))

        return Response({
            "message": "Answer recorded.",
            "is_correct": is_correct,
            "next_review_at": stat.next_review_at.isoformat() if stat and stat.next_review_at else None
        }, status=status.HTTP_200_OK)

    @staticmethod
    def check_answer(question, raw_answer):
        """
        Checks answer correctness. NOTE: This logic should be fully implemented
        to match all your question types (mcq, multi, short, sort, etc.).
        """
        is_correct = False
        correct_value = None
        processed_answer = raw_answer
        q_type = question.question_type
        
        if q_type == 'mcq':
            is_correct = (str(raw_answer) == str(question.correct_option))
            correct_value = question.correct_option
        # TODO: Add your logic for 'multi', 'short', 'sort', 'dragdrop' here
        # Example for 'short':
        elif q_type == 'short':
            is_correct = (str(raw_answer).strip().lower() == str(question.correct_answer).strip().lower())
            correct_value = question.correct_answer

        return is_correct, correct_value, processed_answer

    @staticmethod
    def calculate_qor(is_correct, time_spent_ms):
        """Calculates Quality of Recall based on correctness and time."""
        if not is_correct:
            return 1
        if time_spent_ms is None or time_spent_ms > 15000:
            return 3
        if time_spent_ms > 7000:
            return 4
        return 5

    @staticmethod
    def log_answer(request, quiz, question, ans, corr, is_corr, time_spent, qor, stat):
        """Logs the answer event, including session_id and attempt_index."""
        # 🎯 New logic: every time the user hits the *first* question, start a fresh UUID.
        # Identify the quiz’s first question (by whatever ordering you use—here assumed 'order')
        first_q = quiz.questions.order_by('id').first()
        if question.id == first_q.id:
            # New attempt → brand-new session
            session_id = uuid4()
        else:
            # Subsequent questions → re-use the most recent session_id
            last_ev = ActivityEvent.objects.filter(
                user=request.user,
                metadata__quiz_id=quiz.id,
                session_id__isnull=False
            ).order_by('-timestamp').first()
            session_id = last_ev.session_id if last_ev else uuid4()
        
        question_ct = ContentType.objects.get_for_model(Question)
        prev_attempts = ActivityEvent.objects.filter(
            user=request.user,
            event_type='quiz_answer_submitted',
            content_type=question_ct,
            object_id=question.id
        ).count()

        metadata = {
            "quiz_id": quiz.id,
            "question_id": question.id,
            "submitted_answer": ans,
            "correct_answer_expected": corr,
            "is_correct": is_corr,
            "time_spent_ms": time_spent,
            "quality_of_recall_used": qor,
            "new_interval_days": stat.interval_days if stat else None,
            "attempt_index": prev_attempts + 1,
        }

        # ——— NEW: if this is the *first* answer for this quiz by this user, log quiz_started ———
        first_count = ActivityEvent.objects.filter(
            user=request.user,
            event_type='quiz_answer_submitted',
            metadata__quiz_id=quiz.id
        ).count()

        if first_count == 0:
            log_event(
                user=request.user,
                event_type='quiz_started',
                instance=quiz,
                metadata={'quiz_id': quiz.id, 'started_at': timezone.now().isoformat()},
                session_id=session_id,
            )

        # Pass session_id along to the central log_event
        log_event(
            user=request.user,
            event_type='quiz_answer_submitted',
            instance=question,
            metadata=metadata,
            related_object=quiz,
            session_id=session_id,
        )
    @staticmethod
    def check_completion_after_commit(user_id, quiz_id):
        """
        This method runs *after* the database transaction is committed,
        ensuring it has an accurate view of all saved answers.
        """
        try:
            user = User.objects.get(id=user_id)
            quiz = Quiz.objects.get(id=quiz_id)
        except (User.DoesNotExist, Quiz.DoesNotExist):
            return # Cannot proceed if user or quiz is gone

        total_questions = quiz.questions.count()
        if total_questions == 0:
            return

        q_ct = ContentType.objects.get_for_model(Question)
        
        # Now we can do a simple, direct count because the transaction is complete.
        answered_count = ActivityEvent.objects.filter(
            user=user, content_type=q_ct, event_type='quiz_answer_submitted', metadata__quiz_id=quiz.id
        ).values('object_id').distinct().count()

        if answered_count >= total_questions:
            quiz_ct = ContentType.objects.get_for_model(Quiz)
            # only once
            if not ActivityEvent.objects.filter(
                user=user,
                content_type=quiz_ct,
                object_id=quiz.id,
                event_type='quiz_completed'
            ).exists():
                # ensure attendance_ms is always defined
                attendance_ms = None
                # find the first quiz_started timestamp
                start_ev = ActivityEvent.objects.filter(
                    user=user,
                    content_type=quiz_ct,
                    object_id=quiz.id,
                    event_type='quiz_started'
                ).order_by('timestamp').first()
                if start_ev:
                    delta = timezone.now() - start_ev.timestamp
                    attendance_ms = int(delta.total_seconds() * 1000)

                completion_session = get_or_create_quiz_session_id(user, quiz.id)
                log_event(
                    user=user,
                    event_type='quiz_completed',
                    instance=quiz,
                    metadata={
                        'quiz_id': quiz.id,
                        'auto_triggered': True,
                        'attendance_time_ms': attendance_ms
                    },
                    session_id=completion_session,
                )
                # Calculate SM-2 for the whole quiz based on the final, committed state
                qos_list = ActivityEvent.objects.filter(
                    user=user, content_type=q_ct, event_type='quiz_answer_submitted', metadata__quiz_id=quiz.id
                ).values_list('metadata__quality_of_recall_used', flat=True)
                
                valid_qos = [q for q in qos_list if q is not None]
                if valid_qos:
                    avg = int(np.round(np.mean(valid_qos)))
                    update_memory_stat_item(user=user, learnable_item=quiz, quality_of_recall=avg)


class QuizListCreateView(generics.ListCreateAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Quiz.objects.select_related('created_by', 'subject', 'course').prefetch_related(
            'tags', 'questions'
        ).annotate(
            attempt_count=Count('activity_events', filter=Q(activity_events__event_type__in=['quiz_submitted', 'quiz_completed']), distinct=True)
        ).order_by('-created_at')
        
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuizRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = Quiz.objects.all()
    lookup_field = 'pk'

    def get_object(self):
        quiz = super().get_object()
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if quiz.created_by != self.request.user and not self.request.user.is_staff:
                raise PermissionDenied("You do not have permission to modify this quiz.")
        return quiz

    def retrieve(self, request, *args, **kwargs):
        quiz = self.get_object()
        serializer = self.get_serializer(quiz)
        data = serializer.data
        question_stats = self.get_question_stats(quiz)
        
        question_map = {q['id']: q for q in data.get('questions', [])}
        for stat in question_stats:
            if stat['id'] in question_map:
                question_map[stat['id']]['stats'] = {
                    'attempt_count': stat['attempt_count'],
                    'correct_count': stat['correct_count'],
                    'wrong_count': stat['attempt_count'] - stat['correct_count']
                }
        return Response(data)

    def get_question_stats(self, quiz):
        question_ct = ContentType.objects.get_for_model(Question)
        return Question.objects.filter(quiz=quiz).annotate(
            attempt_count=Count('activity_events', filter=Q(activity_events__content_type=question_ct), distinct=True),
            correct_count=Count('activity_events', filter=Q(activity_events__content_type=question_ct, activity_events__metadata__is_correct=True), distinct=True)
        ).values('id', 'attempt_count', 'correct_count')


class QuizSubmitView(APIView):
    """
    Handles a manual, final 'submit' button click.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """
        --- FIX: This view now has only one, correct post method. ---
        It logs the 'quiz_submitted' event with summary stats.
        """
        quiz = get_object_or_404(Quiz, pk=pk)
        # force new session on explicit start
        session_id = uuid.uuid4()
        q_ct = ContentType.objects.get_for_model(Question)
        
        correct = ActivityEvent.objects.filter(
            user=request.user, event_type='quiz_answer_submitted', content_type=q_ct,
            metadata__quiz_id=quiz.id, metadata__is_correct=True
        ).count()
        
        total = ActivityEvent.objects.filter(
            user=request.user, event_type='quiz_answer_submitted', content_type=q_ct, metadata__quiz_id=quiz.id
        ).count()
        
        metadata = { 'correct_count': correct, 'total_answers': total }
        log_event(user=request.user, 
                  event_type='quiz_submitted', 
                  instance=quiz, 
                  metadata=metadata)
        return Response({"message": "Quiz submission recorded."}, status=status.HTTP_200_OK)


# --- Other Views (from your file) ---

class DynamicQuizView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, permalink):
        quiz = get_object_or_404(Quiz.objects.select_related('created_by', 'subject', 'course').prefetch_related('questions'), permalink=permalink)
        serializer = QuizSerializer(quiz, context={"request": request})
        return Response({"quiz": serializer.data})

class QuizListByCourseView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [AllowAny]
    def get_queryset(self):
        course_id = self.kwargs.get("course_id")
        return Quiz.objects.filter(course_id=course_id) if course_id else Quiz.objects.none()

class MyQuizzesView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Quiz.objects.filter(created_by=self.request.user).select_related('subject', 'course')

class ReportQuizView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        serializer = QuizReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = QuizReport.objects.create(
            quiz=quiz, reporter=request.user, **serializer.validated_data
        )
        creator = quiz.created_by
        title = f"Issue reported on \"{quiz.title}\""
        msg = f"{request.user.username} reported: {report.message[:100]}"
        link = reverse('dynamic_quiz', args=[quiz.permalink])
        Notification.objects.create(user=creator, title=title, message=msg, link=link)
        send_push_to_user_devices(user=creator, title=title, body=msg, link=link, extra_data={'type': 'quiz_report', 'report_id': report.id})
        return Response({'detail': 'Report submitted.'}, status=status.HTTP_201_CREATED)

class ShareQuizView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        serializer = QuizShareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_user = get_object_or_404(User, pk=serializer.validated_data['to_user_id'])
        if to_user == request.user:
            return Response({'error': 'Cannot share a quiz with yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        if QuizShare.objects.filter(quiz=quiz, from_user=request.user, to_user=to_user).exists():
            return Response({'error': 'You already shared this quiz with this user.'}, status=status.HTTP_400_BAD_REQUEST)
        share = QuizShare.objects.create(quiz=quiz, from_user=request.user, to_user=to_user, message=serializer.validated_data.get('message', ''))
        title = f"{request.user.username} shared a quiz with you!"
        msg = f"{request.user.username} shared \"{quiz.title}\"."
        link = reverse('dynamic_quiz', args=[quiz.permalink])
        Notification.objects.create(user=to_user, title=title, message=msg, link=link)
        send_push_to_user_devices(user=to_user, title=title, body=msg, link=link, extra_data={'type': 'quiz_share', 'share_id': share.id})
        return Response({'detail': 'Quiz shared successfully.'}, status=status.HTTP_200_OK)

class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        q = request.GET.get('q', '').strip()
        users = User.objects.filter(username__icontains=q).order_by('username')[:10] if q else []
        results = [{'id': u.id, 'username': u.username, 'email': u.email} for u in users]
        return Response({'results': results})