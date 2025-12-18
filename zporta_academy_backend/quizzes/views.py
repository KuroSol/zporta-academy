import logging
import numpy as np
import unicodedata, re
import uuid
from uuid import uuid4
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, Q, OuterRef, Subquery, IntegerField
from django.db.models.functions import Coalesce
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from django.conf import settings
from django.utils import timezone
# Local App Imports
from users.models import User
from notifications.models import Notification
from notifications.utils import send_push_to_user_devices
from .models import Quiz, Question, QuizReport, QuizShare
from .serializers import QuizSerializer, QuestionSerializer, QuizReportSerializer, QuizShareSerializer
from .difficulty_explanation import get_difficulty_explanation
from analytics.utils import update_memory_stat_item, log_event
from analytics.models import ActivityEvent
from rest_framework.decorators import api_view, permission_classes
from analytics.utils import get_or_create_quiz_session_id
from seo.utils import canonical_url


logger = logging.getLogger(__name__)


class QuizStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        session_id = uuid.uuid4()
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
        return Response({'status': 'quiz_started recorded', 'session_id': str(session_id)}, status=status.HTTP_200_OK)

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

class RecordQuizAnswerView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        user = request.user
        quiz_id = pk
        question_id = request.data.get("question_id")
        raw_answer = request.data.get("selected_option")
        time_spent_ms = request.data.get("time_spent_ms")

        if question_id is None:
             return Response({"error": "question_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if raw_answer is None and request.data.get("selected_options") is None:
             return Response({"error": "selected_option or selected_options is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            time_spent_ms = int(time_spent_ms) if time_spent_ms is not None else None
        except (ValueError, TypeError):
            return Response({"error": "time_spent_ms must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        question = get_object_or_404(Question, pk=question_id, quiz_id=quiz_id)
        quiz = question.quiz
        if quiz.status != 'published' and request.user != quiz.created_by and not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)

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

        is_correct, correct_val, processed_answer = self.check_answer(question, request.data)
        qor = self.calculate_qor(is_correct, time_spent_ms)

        stat = update_memory_stat_item(user=user, learnable_item=question, quality_of_recall=qor, time_spent_ms=time_spent_ms)

        self.log_answer(request, quiz, question, processed_answer, correct_val, is_correct, time_spent_ms, qor, stat)

        transaction.on_commit(lambda: self.check_completion_after_commit(user.id, quiz.id))

        return Response({
            "message": "Answer recorded.",
            "is_correct": is_correct,
            "next_review_at": stat.next_review_at.isoformat() if stat and stat.next_review_at else None
        }, status=status.HTTP_200_OK)

    @staticmethod
    def check_answer(question, data):
        import unicodedata, re
        def norm(s: str):
            s = unicodedata.normalize("NFKC", str(s or "")).strip().lower()
            # collapse internal whitespace
            s = re.sub(r"\s+", " ", s)
            # strip trailing ":" often sent as "Option 2:" labels from UI
            s = s[:-1] if s.endswith(":") else s
            return s

        q_type = question.question_type
        raw      = data.get("selected_option")        # legacy: 1..4
        sel_text = data.get("selected_answer_text")   # preferred: exact option text
        sel_key  = data.get("selected_option_key")    # preferred: "option1".."option4"

        is_correct = False
        correct_value = None
        processed_answer = raw

        if q_type == 'mcq':
                try:
                    correct_idx = int(question.correct_option or 0)
                except (TypeError, ValueError):
                    correct_idx = 0
                correct_value = correct_idx
                correct_text = getattr(question, f"option{correct_idx}", None)

                # 1) Best: exact option TEXT (works regardless of shuffle)
                if sel_text:
                    is_correct = norm(sel_text) == norm(correct_text)
                    processed_answer = sel_text

                # 2) Next: exact option KEY (DB order; OK if UI didn’t shuffle)
                elif isinstance(sel_key, str) and sel_key in {"option1","option2","option3","option4"}:
                    chosen_text = getattr(question, sel_key, None)
                    is_correct = norm(chosen_text) == norm(correct_text)
                    processed_answer = sel_key
                # 3) Legacy: raw index (1..4)
                else:
                    try:
                        raw_int = int(raw)
                    except (TypeError, ValueError):
                        raw_int = None
                    is_correct = (raw_int == correct_idx)
                    processed_answer = raw_int

        elif q_type == 'short':
            is_correct = norm(raw) == norm(question.correct_answer)
            correct_value = question.correct_answer
            processed_answer = raw
        elif q_type == 'multi':
            selected = data.get("selected_options", []) or []
            correct  = question.correct_options or []
            is_correct = sorted(map(str, selected)) == sorted(map(str, correct))
            correct_value = correct
            processed_answer = selected
        elif q_type == 'sort':
            selected = data.get("selected_options", []) or []
            correct  = question.correct_options or []
            is_correct = list(map(str, selected)) == list(map(str, correct))
            correct_value = correct
            processed_answer = selected

        return is_correct, correct_value, processed_answer

    @staticmethod
    def calculate_qor(is_correct, time_spent_ms):
        if not is_correct:
            return 1
        if time_spent_ms is None or time_spent_ms > 15000:
            return 3
        if time_spent_ms > 7000:
            return 4
        return 5

    @staticmethod
    def log_answer(request, quiz, question, ans, corr, is_corr, time_spent, qor, stat):
        # request payload (fix: avoid NameError: data)
        data = request.data
        session_id = get_or_create_quiz_session_id(request.user, quiz.id)
        
        question_ct = ContentType.objects.get_for_model(Question)
        prev_attempts = ActivityEvent.objects.filter(
            user=request.user,
            event_type='quiz_answer_submitted',
            content_type=question_ct,
            object_id=question.id
        ).count()

        # Canonical fields from payload
        selected_answer_text = data.get("selected_answer_text")
        selected_option_key  = data.get("selected_option_key")
        selected_option      = data.get("selected_option")
        hints_used           = data.get("hints_used", [])  # [1] or [2] or [1,2]
        try:
            selected_option = int(selected_option) if selected_option is not None else None
        except (TypeError, ValueError):
            selected_option = None
        if not selected_option_key and selected_option in (1, 2, 3, 4):
            selected_option_key = f"option{selected_option}"

        metadata = {
            "quiz_id": quiz.id,
            "question_id": question.id,
            # store both raw and canonical for robustness
            "selected_option": selected_option,                # 1..4 (legacy)
            "selected_answer_text": selected_answer_text,      # optional text
            "selected_option_key": selected_option_key,        # "option1".. "option4"
            "submitted_answer": ans,                           # processed from check_answer()
            "correct_answer_expected": corr,
            "is_correct": is_corr,                             # use result from check_answer()
            "time_spent_ms": time_spent,
            "quality_of_recall_used": qor,
            "new_interval_days": stat.interval_days if stat else None,
            "attempt_index": prev_attempts + 1,
            "hints_used": hints_used,                          # which hints were revealed
        }

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
        try:
            user = User.objects.get(id=user_id)
            quiz = Quiz.objects.get(id=quiz_id)
        except (User.DoesNotExist, Quiz.DoesNotExist):
            return

        total_questions = quiz.questions.count()
        if total_questions == 0:
            return

        q_ct = ContentType.objects.get_for_model(Question)
        
        answered_count = ActivityEvent.objects.filter(
            user=user, content_type=q_ct, event_type='quiz_answer_submitted', metadata__quiz_id=quiz.id
        ).values('object_id').distinct().count()

        if answered_count >= total_questions:
            quiz_ct = ContentType.objects.get_for_model(Quiz)
            if not ActivityEvent.objects.filter(
                user=user,
                content_type=quiz_ct,
                object_id=quiz.id,
                event_type='quiz_completed'
            ).exists():
                attendance_ms = None
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
        q = Quiz.objects.select_related('created_by','subject','course').prefetch_related('tags','questions')
        q = q.filter(status='published').order_by('-created_at')

        question_ct = ContentType.objects.get_for_model(Question)
        # Subquery of question IDs per quiz
        quiz_qids_sq = Question.objects.filter(
            quiz=OuterRef('pk')
        ).values('id')

        # Backward-compatible ActivityEvent base:
        # either metadata.quiz_id == quiz.pk OR object_id in this quiz's question IDs
        base = ActivityEvent.objects.filter(
            content_type=question_ct,
            event_type='quiz_answer_submitted'
        ).filter(
            Q(metadata__quiz_id=OuterRef('pk')) | Q(object_id__in=Subquery(quiz_qids_sq))
        )

        total_sub = base.values('id').annotate(c=Count('id')).values('c')[:1]
        correct_sub = base.filter(metadata__is_correct=True).values('id').annotate(c=Count('id')).values('c')[:1]
        wrong_sub = base.filter(metadata__is_correct=False).values('id').annotate(c=Count('id')).values('c')[:1]
        unique_users_sub = base.values('user').annotate(c=Count('user', distinct=True)).values('c')[:1]


        # Note: attempt_count is already a field on the Quiz model, so we only annotate correct_count and wrong_count
        q = q.annotate(
            correct_count=Coalesce(Subquery(correct_sub, output_field=IntegerField()), 0),
            wrong_count=Coalesce(Subquery(wrong_sub, output_field=IntegerField()), 0),
            # optional: total answers if you want it
            # total_answers=Coalesce(Subquery(total_sub, output_field=IntegerField()), 0),
        )

        username = self.request.query_params.get('created_by')
        if username:
            q = q.filter(created_by__username=username)
        return q

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
        if quiz.status != 'published' and not (request.user.is_authenticated and (request.user == quiz.created_by or request.user.is_staff)):
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(quiz)
        data = serializer.data
        question_stats = self.get_question_stats(quiz)
        
        question_map = {q['id']: q for q in data.get('questions', [])}
        for stat in question_stats:
            if stat['question_id'] in question_map:
                question_map[stat['question_id']]['stats'] = {
                    'attempt_count': stat['total_attempts'],
                    'correct_count': stat['correct_attempts'],
                    'wrong_count': stat['total_attempts'] - stat['correct_attempts']
                }
        return Response(data)

    def get_question_stats(self, quiz):
        question_ct = ContentType.objects.get_for_model(Question)
        
        stats = ActivityEvent.objects.filter(
            content_type=question_ct,
            metadata__quiz_id=quiz.id,
            event_type='quiz_answer_submitted'
        ).values('metadata__question_id').annotate(
            total_attempts=Count('id'),
            correct_attempts=Count('id', filter=Q(metadata__is_correct=True))
        ).values('metadata__question_id', 'total_attempts', 'correct_attempts')

        # The query returns keys like 'metadata__question_id', we rename them for consistency
        return [
            {
                'question_id': s['metadata__question_id'],
                'total_attempts': s['total_attempts'],
                'correct_attempts': s['correct_attempts']
            } for s in stats
        ]


class QuizCompletionView(APIView):
    """Record when user finishes/exits a quiz with total time spent."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        total_time_ms = request.data.get('total_time_ms')
        questions_completed = request.data.get('questions_completed', 0)
        session_id = request.data.get('session_id')
        
        if not session_id:
            session_id = get_or_create_quiz_session_id(request.user, quiz.id)
        
        try:
            total_time_ms = int(total_time_ms) if total_time_ms is not None else None
        except (ValueError, TypeError):
            total_time_ms = None
        
        # Record completion event with timing data
        log_event(
            user=request.user,
            event_type='quiz_completed',
            instance=quiz,
            metadata={
                'quiz_id': quiz.id,
                'total_time_ms': total_time_ms,
                'questions_completed': questions_completed,
                'completed_at': timezone.now().isoformat(),
            },
            session_id=session_id,
        )
        
        return Response({
            "message": "Quiz completion recorded.",
            "total_time_ms": total_time_ms,
            "questions_completed": questions_completed
        }, status=status.HTTP_200_OK)


class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        if quiz.status != 'published' and request.user != quiz.created_by and not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)
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


class DynamicQuizView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, permalink):
        quiz = get_object_or_404(Quiz.objects.select_related('created_by', 'subject', 'course').prefetch_related('questions'), permalink=permalink)
        user = request.user if request.user.is_authenticated else None
        if quiz.status != 'published' and not (user and (user == quiz.created_by or user.is_staff)):
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = QuizSerializer(quiz, context={"request": request})
        data = serializer.data
        data["canonical_url"] = canonical_url(data.get("canonical_url") or f"/quizzes/{quiz.permalink}/")
        return Response({"quiz": data})

class QuizListByCourseView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [AllowAny]
    def get_queryset(self):
        course_id = self.kwargs.get("course_id")
        if not course_id:
            return Quiz.objects.none()
        return Quiz.objects.filter(course_id=course_id, status='published')

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
        link = f"{settings.QUIZ_ORIGIN}/quizzes/{quiz.permalink}/"
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
        link = f"{settings.QUIZ_ORIGIN}/quizzes/{quiz.permalink}/"
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

class QuestionDetailView(APIView):
    """
    Retrieve a single question by its SEO-friendly permalink.
    Returns question data with quiz context for individual question pages.
    """
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get(self, request, permalink):
        # Permalink format: "alex/english/2025-12-15/quiz-name/q-1-question-slug"
        question = get_object_or_404(Question, permalink=permalink)
        quiz = question.quiz
        
        # Get all questions in this quiz for navigation
        all_questions = list(quiz.questions.all().order_by('id'))
        current_index = all_questions.index(question)
        
        # Build navigation context
        prev_question = all_questions[current_index - 1] if current_index > 0 else None
        next_question = all_questions[current_index + 1] if current_index < len(all_questions) - 1 else None
        
        # Serialize question
        question_data = QuestionSerializer(question).data
        
        # Add question statistics from ActivityEvent
        question_ct = ContentType.objects.get_for_model(Question)
        stats = ActivityEvent.objects.filter(
            content_type=question_ct,
            object_id=question.id,
            event_type='quiz_answer_submitted'
        ).aggregate(
            times_answered=Count('id'),
            times_correct=Count('id', filter=Q(metadata__is_correct=True)),
            times_wrong=Count('id', filter=Q(metadata__is_correct=False))
        )
        question_data['times_answered'] = stats['times_answered'] or 0
        question_data['times_correct'] = stats['times_correct'] or 0
        question_data['times_wrong'] = stats['times_wrong'] or 0
        
        # Add quiz context and navigation
        question_data['quiz'] = {
            'id': quiz.id,
            'title': quiz.title,
            'permalink': quiz.permalink,
            'total_questions': len(all_questions),
            'current_position': current_index + 1,
        }
        
        # Add creator info to quiz
        if quiz.created_by:
            from users.serializers import PublicProfileSerializer
            question_data['quiz']['created_by'] = PublicProfileSerializer(quiz.created_by.profile).data
        
        # Add lesson/course info if quiz is part of one
        if hasattr(quiz, 'lesson') and quiz.lesson:
            question_data['quiz']['lesson_title'] = quiz.lesson.title
            question_data['quiz']['lesson_permalink'] = quiz.lesson.permalink
        if hasattr(quiz, 'course') and quiz.course:
            question_data['quiz']['course_title'] = quiz.course.title
        
        # Also include difficulty info inside quiz for frontend consistency
        try:
            question_data['quiz']['difficulty_explanation'] = get_difficulty_explanation(quiz)
        except Exception as e:
            logger.warning(f"Unable to compute difficulty_explanation for quiz {quiz.id}: {e}")
        
        # Add difficulty explanation from quiz
        if hasattr(quiz, 'difficulty_explanation') and quiz.difficulty_explanation:
            question_data['difficulty_explanation'] = quiz.difficulty_explanation

            # Add difficulty explanation using the helper function
            try:
                difficulty_data = get_difficulty_explanation(quiz)
                if difficulty_data:
                    question_data['difficulty_explanation'] = difficulty_data
            except Exception as e:
                logger.warning(f"Could not get difficulty explanation for quiz {quiz.id}: {e}")

        question_data['navigation'] = {
            'prev': {
                'permalink': prev_question.permalink,
                'number': current_index
            } if prev_question else None,
            'next': {
                'permalink': next_question.permalink,
                'number': current_index + 2
            } if next_question else None,
        }
        
        # Add top-level navigation fields for frontend compatibility
        question_data['previous_question_permalink'] = prev_question.permalink if prev_question else None
        question_data['next_question_permalink'] = next_question.permalink if next_question else None
        
        return Response(question_data)