from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeacherMailMagazineViewSet, MailMagazineIssueDetailView

router = DefaultRouter()
router.register(r'teacher-mail-magazines', TeacherMailMagazineViewSet, basename='teacher-mail-magazines')

urlpatterns = [
    path('', include(router.urls)),
    path('issues/<int:pk>/', MailMagazineIssueDetailView.as_view(), name='issue-detail'),
]
