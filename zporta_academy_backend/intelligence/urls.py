# intelligence/urls.py
from django.urls import path
from .views import (
    MyAbilityView,
    LearningPathView,
    ProgressInsightsView,
    RecommendedSubjectsView
)

app_name = 'intelligence'

urlpatterns = [
    path('my-ability/', MyAbilityView.as_view(), name='my-ability'),
    path('learning-path/', LearningPathView.as_view(), name='learning-path'),
    path('progress-insights/', ProgressInsightsView.as_view(), name='progress-insights'),
    path('recommended-subjects/', RecommendedSubjectsView.as_view(), name='recommended-subjects'),
]
