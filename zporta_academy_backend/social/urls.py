# social/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GuideRequestViewSet

router = DefaultRouter()
router.register(r'guide-requests', GuideRequestViewSet, basename='guide-request')

urlpatterns = [
    path('', include(router.urls)),
]
