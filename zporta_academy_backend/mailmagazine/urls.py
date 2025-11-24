from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeacherMailMagazineViewSet

router = DefaultRouter()
router.register(r'teacher-mail-magazines', TeacherMailMagazineViewSet, basename='teacher-mail-magazines')

urlpatterns = [
    path('', include(router.urls)),
]
