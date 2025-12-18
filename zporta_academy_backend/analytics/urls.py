# analytics/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ActivityEventViewSet,
    quiz_overall_retention_insights_view,
    UserMemoryProfileView,
    log_content_interaction_time_view,
    QuizDetailedAnalyticsView, # Ensure this is imported from .views
    QuizAttemptOverviewView,
    QuizListAPIView,
    QuizParticipantsView,
    CorrectUsersForQuestionView,
    QuizSessionDetailView,
    QuestionAnalyticsView,
    UserQuizHistoryView,
    # suggest_quizzes_based_on_activity, # This can remain commented if not used
)

router = DefaultRouter()
# This will make /api/analytics/events/ available if main urls.py has path('api/analytics/', include(router.urls))
# OR if this file is included under 'api/analytics/' and this router is included with path('', include(router.urls))
router.register(r'events', ActivityEventViewSet, basename='analytics-activity-event')

urlpatterns = [
    # These paths are relative to how 'analytics.urls' is included in the main urls.py.
    # If main urls.py has: path('api/analytics/', include('analytics.urls')),
    # then 'user-memory-profile/' becomes '/api/analytics/user-memory-profile/'.

    path('user-memory-profile/', UserMemoryProfileView.as_view(), name='analytics-user-memory-profile'),
    path('quiz-retention-insights/', quiz_overall_retention_insights_view, name='analytics-quiz-overall-retention-insights'),
    path('log-interaction-time/', log_content_interaction_time_view, name='analytics-log-content-interaction-time'),
    
    # This path is for the detailed quiz statistics needed by QuizCard.js
    # It will resolve to /api/analytics/quizzes/<quiz_id>/detailed-statistics/
    path('quizzes/<int:quiz_id>/detailed-statistics/', QuizDetailedAnalyticsView.as_view(), name='analytics-quiz-detailed-statistics'),
    # NEW: /api/analytics/quizzes/<quiz_id>/questions/<question_id>/answers/
    path('quizzes/<int:quiz_id>/questions/<int:question_id>/answers/', CorrectUsersForQuestionView.as_view(), name='analytics-correct-users'),


    # NEW: /api/analytics/quizzes/<quiz_id>/participants/
    path('quizzes/<int:quiz_id>/participants/', QuizParticipantsView.as_view(), name='analytics-quiz-participants'),

    # Question-level tracking endpoints
    path('sessions/<uuid:session_id>/details/', QuizSessionDetailView.as_view(), name='analytics-session-details'),
    path('questions/<int:question_id>/analytics/', QuestionAnalyticsView.as_view(), name='analytics-question-details'),
    path('users/<int:user_id>/quiz-history/', UserQuizHistoryView.as_view(), name='analytics-user-history'),

    path('quiz-attempt-overview/',QuizAttemptOverviewView.as_view(),name='quiz-attempt-overview'),
    # Include router URLs. If analytics.urls is included under 'api/analytics/',
    # this makes ActivityEventViewSet available at /api/analytics/events/
    path('', include(router.urls)), 
    path('quiz-list/', QuizListAPIView.as_view(), name='analytics-quiz-list'),
]