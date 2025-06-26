from django.urls import path, include

# enrollment/urls.py

from rest_framework.routers import DefaultRouter
from .views import (
    ShareInviteViewSet,
    EnrollmentViewSet,
    CollaborationSessionViewSet,
    SessionStrokeViewSet,
    SessionNoteViewSet,
)
from .views import UserEnrollmentList

router = DefaultRouter()

# 1️⃣ register share-invites first
router.register(r'share-invites', ShareInviteViewSet, basename='share-invites')

# 2️⃣ then enrollments (catch-all)
router.register(r'', EnrollmentViewSet, basename='enrollments')

# ...the rest stays the same
router.register(r'sessions', CollaborationSessionViewSet, basename='sessions')
router.register(r'strokes',   SessionStrokeViewSet,       basename='strokes')
router.register(r'notes',     SessionNoteViewSet,         basename='notes')

urlpatterns = [
    path('user/', UserEnrollmentList.as_view(), name='user-enrollments'),
    path('', include(router.urls)),
]

