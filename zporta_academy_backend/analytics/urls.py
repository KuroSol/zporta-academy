from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ActivityEventViewSet,
    suggest_quizzes_based_on_activity,
    quiz_retention_insights,
)

router = DefaultRouter()
router.register(r'events', ActivityEventViewSet, basename='activity-event')

urlpatterns = [
    # 1) Custom endpoints first:
    path('quiz-retention-insights/',  quiz_retention_insights,          name='quiz-retention-insights'),
    path('suggest/quizzes/',          suggest_quizzes_based_on_activity, name='suggest-quizzes'),

    # 2) Then include the router:
    path('', include(router.urls)),
]
