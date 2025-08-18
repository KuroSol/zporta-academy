# feed/urls.py
from django.urls import path
from .views import (
    ExploreQuizListView,
    PersonalizedQuizListView,
    ReviewQuizListView,
    UnifiedFeedView,
    LanguageChoicesView,
    RegionChoicesView,
)
from users.views import UserPreferenceUpdateView  # canonical

urlpatterns = [
    path('explore/',      ExploreQuizListView.as_view(),      name='feed-explore'),
    path('personalized/', PersonalizedQuizListView.as_view(), name='feed-personalized'),
    path('review/',       ReviewQuizListView.as_view(),       name='feed-review'),
    path('preferences/languages/', LanguageChoicesView.as_view(), name='pref-languages'),
    path('preferences/regions/',   RegionChoicesView.as_view(),   name='pref-regions'),
    path('dashboard/',    UnifiedFeedView.as_view(),          name='feed-dashboard'),
]
