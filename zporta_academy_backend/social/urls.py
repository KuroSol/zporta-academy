# social/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GuideRequestViewSet, my_teachers, my_students

router = DefaultRouter()
router.register(r'guide-requests', GuideRequestViewSet, basename='guide-request')

urlpatterns = [
    path('', include(router.urls)),
    path('my-teachers/', my_teachers, name='my-teachers'),
    path('my-students/', my_students, name='my-students'),
]
