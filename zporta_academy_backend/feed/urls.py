# feed/urls.py
from django.urls import path
from .views import (
    ExploreQuizListView,
    PersonalizedQuizListView,
    ReviewQuizListView,
    SubjectListView,
    LanguageListView,
    RegionListView,
    UserPreferenceView,
    UnifiedFeedView,
)

urlpatterns = [
    # Step 4: Feeds
    path('explore/',      ExploreQuizListView.as_view(),     name='feed-explore'),
    path('personalized/', PersonalizedQuizListView.as_view(), name='feed-personalized'),
    path('review/',       ReviewQuizListView.as_view(),      name='feed-review'),

    # Step 5: Onboarding lookups & prefs
    path('preferences/subjects/',   SubjectListView.as_view(),    name='pref-subjects'),
    path('preferences/languages/',  LanguageListView.as_view(),   name='pref-languages'),
    path('preferences/regions/',    RegionListView.as_view(),     name='pref-regions'),
    path('preferences/',            UserPreferenceView.as_view(), name='user-preference'),
    path('dashboard/', UnifiedFeedView.as_view(), name='feed-dashboard'),
]
