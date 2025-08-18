# feed/views.py
from rest_framework.response import Response
from .services import generate_user_feed
from rest_framework import permissions, generics
from rest_framework import generics, permissions
from rest_framework.views import APIView
from .services import get_explore_quizzes, get_personalized_quizzes, get_review_queue
from .serializers import QuizFeedSerializer

# Feeds (return serialized dicts from services)
class ExploreQuizListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        return Response(get_explore_quizzes(request.user, limit))

class PersonalizedQuizListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        return Response(get_personalized_quizzes(request.user, limit))

class ReviewQuizListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        return Response(get_review_queue(request.user, limit))


    
class UnifiedFeedView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuizFeedSerializer

    def get(self, request):
        data = generate_user_feed(request.user)
        return Response(data)
    
class LanguageChoicesView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # single source of truth: codes that match Quiz.languages contents
        return Response([
            {"id": "en", "name": "English"},
            {"id": "ja", "name": "Japanese"},
            {"id": "es", "name": "Spanish"},
            {"id": "fr", "name": "French"},
            {"id": "de", "name": "German"},
        ])
    
class RegionChoicesView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # stub list; replace with real regions if you have a model
        return Response([
            {"id": "us", "name": "United States"},
            {"id": "jp", "name": "Japan"},
            {"id": "gb", "name": "United Kingdom"},
        ])