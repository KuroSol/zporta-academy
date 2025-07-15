# feed/views.py
from rest_framework import generics, permissions
from .services import (
    get_explore_quizzes,
    get_personalized_quizzes,
    get_review_queue,
)
from .models import Subject, Language, Region, UserPreference
from .serializers import (
    QuizFeedSerializer,
    SubjectSerializer,
    LanguageSerializer,
    RegionSerializer,
    UserPreferenceSerializer,
)

# Feeds
class ExploreQuizListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = QuizFeedSerializer

    def get_queryset(self):
        limit = int(self.request.query_params.get('limit', 10))
        return get_explore_quizzes(self.request.user, limit)

class PersonalizedQuizListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = QuizFeedSerializer

    def get_queryset(self):
        limit = int(self.request.query_params.get('limit', 10))
        return get_personalized_quizzes(self.request.user, limit)

class ReviewQuizListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = QuizFeedSerializer

    def get_queryset(self):
        limit = int(self.request.query_params.get('limit', 10))
        return get_review_queue(self.request.user, limit)

# Lookups & Preferences
class SubjectListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset           = Subject.objects.all()
    serializer_class   = SubjectSerializer

class LanguageListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset           = Language.objects.all()
    serializer_class   = LanguageSerializer

class RegionListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset           = Region.objects.all()
    serializer_class   = RegionSerializer

class UserPreferenceView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = UserPreferenceSerializer

    def get_object(self):
        pref, _ = UserPreference.objects.get_or_create(user=self.request.user)
        return pref
