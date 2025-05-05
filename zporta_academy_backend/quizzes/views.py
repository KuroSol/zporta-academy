# quizzes/views.py

import random
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Quiz, Question
from .serializers import QuizSerializer
from analytics.utils import log_event


class QuizSubmitView(APIView):
    """
    POST: Submit answers for a given quiz, calculate score, and log event.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)
        answers = request.data.get("answers", [])
        total_questions = len(answers)
        correct_answers = 0
        question_results = []

        for answer in answers:
            qid = answer.get("question_id")
            sel = answer.get("selected_option")
            if qid is None or sel is None:
                continue
            question = get_object_or_404(Question, pk=qid, quiz_id=quiz.id)
            is_correct = (int(sel) == question.correct_option)
            if is_correct:
                correct_answers += 1
            question_results.append({
                "question_id": question.id,
                "selected_option": int(sel),
                "answered_correctly": is_correct
            })

        score = correct_answers
        metadata = {
            "score": score,
            "total_questions": total_questions,
            "correct_answers": correct_answers,
            "questions": question_results
        }
        log_event(user=request.user, event_type='quiz_submitted', instance=quiz, metadata=metadata)

        return Response({
            "quiz_id": quiz.pk,
            "score": score,
            "total_questions": total_questions,
            "correct_answers": correct_answers,
            "wrong_answers": total_questions - correct_answers,
            "question_details": question_results
        }, status=status.HTTP_200_OK)


class QuizListCreateView(generics.ListCreateAPIView):
    """
    GET : List all quizzes (public)
    POST: Create a new quiz (auth required, supports file upload)
    """
    serializer_class = QuizSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Quiz.objects.all()
        username = self.request.query_params.get('created_by')
        if username:
            qs = qs.filter(created_by__username=username)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuizRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    : Retrieve a quiz by pk
    PUT    : Update a quiz (owner only, not locked; supports file upload)
    PATCH  : Partial update (same permissions)
    DELETE : Delete a quiz (owner only, not locked)
    """
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def get_object(self):
        quiz = get_object_or_404(Quiz, pk=self.kwargs.get("pk"))
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if quiz.created_by != self.request.user:
                raise PermissionDenied("You do not have permission to modify this quiz.")
            if quiz.is_locked:
                raise PermissionDenied("This quiz is locked and cannot be modified.")
        return quiz


class DynamicQuizView(APIView):
    """
    GET: Fetch quiz by permalink (public), include SEO payload, log 'quiz_started'
    """
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        quiz = get_object_or_404(Quiz, permalink=permalink)
        serializer = QuizSerializer(quiz, context={"request": request})

        if request.user.is_authenticated:
            log_event(
                user=request.user,
                event_type='quiz_started',
                instance=quiz,
                metadata={'permalink': quiz.permalink}
            )

        return Response({
            "quiz": serializer.data,
            "seo": {
                "title":           quiz.seo_title or quiz.title,
                "description":     quiz.seo_description,
                "canonical_url":   request.build_absolute_uri(),
                "og_title":        quiz.og_title or quiz.title,
                "og_description":  quiz.og_description,
                "og_image":        quiz.og_image or "/static/default_quiz_image.png",
            }
        })


class RecordQuizAnswerView(APIView):
    """
    POST: Record a single question answer (auth required), log 'quiz_answer_submitted'
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        question_id     = request.data.get("question_id")
        selected_option = request.data.get("selected_option")

        if question_id is None or selected_option is None:
            return Response(
                {"error": "question_id and selected_option are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            selected_option = int(selected_option)
        except (ValueError, TypeError):
            return Response(
                {"error": "selected_option must be an integer"},
                status=status.HTTP_400_BAD_REQUEST
            )

        question = get_object_or_404(Question, pk=question_id, quiz_id=pk)
        is_correct = (selected_option == question.correct_option)

        log_event(
            user=request.user,
            event_type='quiz_answer_submitted',
            instance=question.quiz,
            metadata={
                "question_id": question.id,
                "selected_option": selected_option,
                "correct_option": question.correct_option,
                "is_correct": is_correct,
            }
        )

        return Response(
            {"message": "Answer recorded", "is_correct": is_correct},
            status=status.HTTP_200_OK
        )


class QuizListByCourseView(generics.ListAPIView):
    """
    GET: List quizzes attached to a specific course (public)
    """
    serializer_class = QuizSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        course_id = self.kwargs.get("course_id")
        return Quiz.objects.filter(course__id=course_id)


class MyQuizzesView(generics.ListAPIView):
    """
    GET: List quizzes created by the current user (auth required)
    """
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Quiz.objects.filter(created_by=self.request.user)
