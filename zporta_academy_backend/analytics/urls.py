# analytics/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivityEventViewSet
from . import views 

router = DefaultRouter()
router.register(r'events', ActivityEventViewSet, basename='activity-event')

urlpatterns = [
    path('', include(router.urls)),
    # --- Add path for suggestions ---
    path('suggest/quizzes/', views.suggest_quizzes_based_on_activity, name='suggest-quizzes'),
]
