from rest_framework.permissions import BasePermission
from .models import Lesson


class FreeLessonOrAuthenticated(BasePermission):
    """
    Allows unauthenticated access to free (is_premium=False) published lessons.
    Requires authentication for premium lessons or non-published content.
    """
    def has_permission(self, request, view):
        # Public GETs are allowed; object-level checks will enforce gating
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Drafts only visible to creator/staff
        if obj.status == Lesson.DRAFT:
            return request.user.is_authenticated and (
                obj.created_by == request.user or getattr(request.user, "is_staff", False)
            )

        # Published and free: allow anyone
        if obj.status == Lesson.PUBLISHED and not obj.is_premium:
            return True

        # Premium: require auth; enrollment logic handled in view
        return request.user.is_authenticated