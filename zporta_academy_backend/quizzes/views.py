from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
from .models import Quiz
from .serializers import QuizSerializer
from analytics.utils import log_event
from .models import Question 


class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz, pk=pk)

        answers = request.data.get("answers", [])
        total_questions = len(answers)
        correct_answers = 0
        question_results = []

        for answer in answers:
            question_id = answer.get("question_id")
            selected_option = answer.get("selected_option")

            if not question_id or not selected_option:
                continue  # Skip incomplete answers

            question = get_object_or_404(Question, pk=question_id, quiz_id=quiz.id)

            is_correct = (selected_option == question.correct_option)

            if is_correct:
                correct_answers += 1

            question_results.append({
                "question_id": question.id,
                "selected_option": selected_option,
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
    GET: List all quizzes (public)
    POST: Create a new quiz (requires authentication)
    """
    serializer_class = QuizSerializer

    def get_queryset(self):
        queryset = Quiz.objects.all()
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        return queryset

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]  # Allow public listing
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuizRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a quiz by its primary key.
    Only the quiz creator may update or delete.
    """
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    # Using the primary key as lookup; if you prefer permalink, change accordingly.
    def get_object(self):
        quiz = get_object_or_404(Quiz, pk=self.kwargs.get("pk"))
        
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if quiz.created_by != self.request.user:
                raise PermissionDenied("You do not have permission to modify this quiz.")
            if quiz.is_locked:
                raise PermissionDenied("This quiz is locked and cannot be modified.")
        
        return quiz


class DynamicQuizView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, permalink):
        quiz = get_object_or_404(Quiz, permalink=permalink)
        serializer = QuizSerializer(quiz, context={"request": request})

        # ✅ Correctly logging quiz_opened event:
        if request.user.is_authenticated:
            log_event(
                user=request.user,
                event_type='quiz_started',  # event_type correctly set
                instance=quiz,
                metadata={'permalink': quiz.permalink}
            )

        return Response({
            "quiz": serializer.data,
            "seo": {
                "title": quiz.seo_title or quiz.title,
                "description": quiz.seo_description,
                "canonical_url": request.build_absolute_uri(),
                "og_title": quiz.og_title or quiz.title,
                "og_description": quiz.og_description,
                "og_image": quiz.og_image or "/static/default_quiz_image.png",
            }
        })



# quizzes/views.py
class RecordQuizAnswerView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        question_id = request.data.get("question_id")
        selected_option = request.data.get("selected_option")

        if selected_option is None or question_id is None:
            return Response({"error": "selected_option and question_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            selected_option = int(selected_option)
        except ValueError:
            return Response({"error": "selected_option must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
        
        question = get_object_or_404(Question, pk=question_id, quiz_id=pk)

        is_correct = (selected_option == question.correct_option)

        log_event(
            user=request.user,
            event_type='quiz_answer_submitted',
            instance=question.quiz,
            metadata={
                'selected_option': selected_option,
                'correct_option': question.correct_option,
                'is_correct': is_correct,
                'question_id': question.id
            }
        )
        
        return Response({"message": "Answer recorded", "is_correct": is_correct}, status=status.HTTP_200_OK)
    
class QuizListByCourseView(generics.ListAPIView):
    """
    Returns a list of quizzes attached to a given course.
    """
    serializer_class = QuizSerializer
    permission_classes = [AllowAny]  # Adjust if needed

    def get_queryset(self):
        # Get the course ID from the URL parameters
        course_id = self.kwargs.get("course_id")
        return Quiz.objects.filter(course__id=course_id)
    
class MyQuizzesView(generics.ListAPIView):
    """
    Returns quizzes created by the logged-in user.
    """
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Quiz.objects.filter(created_by=self.request.user)