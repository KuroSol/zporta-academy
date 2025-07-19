# zporta_academy_backend/explorer/views.py
# This version includes a much deeper search for quizzes, looking into questions and answers.

from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response

from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz
from users.models import User # For guides

from courses.serializers import CourseSerializer
from lessons.serializers import LessonSerializer
from quizzes.serializers import QuizSerializer
from users.serializers import UserSerializer # For guides

class ExplorerSearchView(APIView):
    """
    A unified search view for the Explorer feature.
    Handles global search across multiple models.
    """
    def get(self, request):
        query = request.GET.get('q', '').strip()

        if not query:
            return Response({
                'courses': [],
                'lessons': [],
                'quizzes': [],
                'guides': []
            })

        # --- Build complex Q objects for searching multiple fields ---

        # Course search: title or description
        course_query = Q(title__icontains=query) | Q(description__icontains=query)
        
        # Lesson search: title or content
        lesson_query = Q(title__icontains=query) | Q(content__icontains=query)
        
        # --- NEW: Deeper Quiz Search ---
        # This now searches the quiz title, its content, and also looks inside all
        # associated questions' text and their multiple-choice options.
        quiz_query = (
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            Q(questions__question_text__icontains=query) |
            Q(questions__option1__icontains=query) |
            Q(questions__option2__icontains=query) |
            Q(questions__option3__icontains=query) |
            Q(questions__option4__icontains=query) |
            Q(questions__correct_answer__icontains=query) # For short answer questions
        )
        
        # Guide (User) search: username or profile bio
        guide_query = Q(username__icontains=query) | Q(profile__bio__icontains=query)


        # --- Execute Queries ---
        courses = Course.objects.filter(course_query, is_draft=False)[:10]
        lessons = Lesson.objects.filter(lesson_query)[:10]
        
        # Use .distinct() to prevent duplicate quizzes in results
        quizzes = Quiz.objects.filter(quiz_query).distinct()[:10]
        
        guides = User.objects.filter(guide_query, profile__active_guide=True)[:10]

        # --- Serialize Data ---
        return Response({
            'courses': CourseSerializer(courses, many=True, context={'request': request}).data,
            'lessons': LessonSerializer(lessons, many=True, context={'request': request}).data,
            'quizzes': QuizSerializer(quizzes, many=True, context={'request': request}).data,
            'guides': UserSerializer(guides, many=True, context={'request': request}).data,
        })
