from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnrollmentViewSet, UserEnrollmentList

router = DefaultRouter()
router.register(r'', EnrollmentViewSet, basename='enrollments')

urlpatterns = [
    # Place the custom endpoint first so it doesn't get caught by the router's detail view
    path('user/', UserEnrollmentList.as_view(), name='user-enrollments'),
    path('', include(router.urls)),
]
