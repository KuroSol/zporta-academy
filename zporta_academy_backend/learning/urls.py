from django.urls import path
from .views import LearningRecordListView, StudyDashboardView

urlpatterns = [
    path('records/',   LearningRecordListView.as_view(), name='learning-records'),
    path('dashboard/', StudyDashboardView.as_view(),   name='study-dashboard'),
]
