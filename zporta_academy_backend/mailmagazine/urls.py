from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TeacherMailMagazineViewSet, 
    MailMagazineIssueDetailView, 
    TeacherMailMagazineIssuesListView,
    MailMagazineTemplateViewSet,
    MailMagazineAutomationViewSet
)

router = DefaultRouter()
router.register(r'teacher-mail-magazines', TeacherMailMagazineViewSet, basename='teacher-mail-magazines')
router.register(r'templates', MailMagazineTemplateViewSet, basename='mail-templates')
router.register(r'automations', MailMagazineAutomationViewSet, basename='mail-automations')

urlpatterns = [
    path('', include(router.urls)),
    path('mailmagazine/issues/<int:pk>/', MailMagazineIssueDetailView.as_view(), name='issue-detail'),
    path('mailmagazine/issues/by-teacher/<str:username>/', TeacherMailMagazineIssuesListView.as_view(), name='teacher-issues'),
]
