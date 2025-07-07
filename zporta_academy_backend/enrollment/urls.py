# zporta_academy_backend/enrollment/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShareInviteViewSet,
    EnrollmentViewSet,
    CollaborationSessionViewSet,
    SessionStrokeViewSet,
    SessionNoteViewSet,
    UserEnrollmentList,
    SessionNoteView
)

# The router setup remains the same.
router = DefaultRouter()
router.register(r'share-invites', ShareInviteViewSet, basename='share-invites')
router.register(r'sessions', CollaborationSessionViewSet, basename='sessions')
router.register(r'strokes',   SessionStrokeViewSet,       basename='strokes')
router.register(r'notes',     SessionNoteViewSet,         basename='notes')
router.register(r'', EnrollmentViewSet, basename='enrollments')


# The urlpatterns list is updated with the corrected path.
urlpatterns = [
    # This path is for listing a user's enrollments and is correct.
    path('user/', UserEnrollmentList.as_view(), name='user-enrollments'),
    
    # --- THIS IS THE CORRECTED URL PATTERN ---
    # It now correctly matches the URL coming from your main urls.py.
    # The path should NOT start with 'enrollments/' here.
    path('<int:enrollment_pk>/notes/', SessionNoteView.as_view(), name='session-note-detail'),
    
    # The router include remains the same and must come last.
    path('', include(router.urls)),
]
