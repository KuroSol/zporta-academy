# enrollment/views.py
import uuid
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from django_filters.rest_framework import DjangoFilterBackend
from .models import Enrollment
from .serializers import EnrollmentSerializer
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from courses.models import Course
from .utils import lock_course_and_content
from django.db.models import Q
from lessons.models       import LessonCompletion
from lessons.serializers  import SimpleLessonCompletionSerializer
from .models import ShareInvite
from .serializers import ShareInviteSerializer
from django.http import Http404
from .models import CollaborationSession, SessionStroke, SessionNote
from .serializers import (
    CollaborationSessionSerializer,
    SessionStrokeSerializer,
    SessionNoteSerializer,
)


class EnrollmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing enrollments with support for one-time share tokens.
    """
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qp = self.request.query_params
        shared_token = qp.get("shared_token")

        # 1) One-time share token grants access to that single enrollment
        if shared_token:
            try:
                invite = ShareInvite.objects.get(token=shared_token)
                return Enrollment.objects.filter(pk=invite.enrollment.pk)
            except ShareInvite.DoesNotExist:
                return Enrollment.objects.none()

        # 2) Session-accepted shares
        shared_ids = self.request.session.get("shared_enrollments", [])

        # 3) Own enrollments or those accepted in this session
        return Enrollment.objects.filter(
            Q(user=self.request.user) | Q(pk__in=shared_ids)
        )

    def retrieve(self, request, *args, **kwargs):
        shared_token = request.query_params.get("shared_token")
        
        if shared_token:
            try:
                invite = ShareInvite.objects.get(token=shared_token, enrollment__pk=kwargs["pk"])
                shared = request.session.setdefault("shared_enrollments", [])

                if invite.enrollment.id not in shared:
                    shared.append(invite.enrollment.id)
                    request.session["shared_enrollments"] = shared
                    request.session.set_expiry(0)

            except ShareInvite.DoesNotExist:
                raise Http404("Invalid or expired share token.")

        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        # When creating an enrollment, lock course content if it's a course
        if serializer.validated_data.get("enrollment_type") == "course":
            course_ct = ContentType.objects.get_for_model(Course)
            enrollment = serializer.save(
                user=self.request.user,
                content_type=course_ct
            )
            lock_course_and_content(enrollment.content_object)
        else:
            serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"], url_path='my-enrollments')
    def my_enrollments(self, request):
        user_enrolls = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(user_enrolls, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path='completions')
    def completions(self, request, pk=None):
        enrollment = self.get_object()
        user = enrollment.user
        course = enrollment.content_object
        qs = LessonCompletion.objects.filter(
            user=user,
            lesson__course=course
        )
        serializer = SimpleLessonCompletionSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path='share')
    def share(self, request, pk=None):
        """
        Generates a one-time enrollment shared_token (for backward compatibility).
        """
        enrollment = self.get_object()
        enrollment.shared_token = uuid.uuid4().hex
        enrollment.save(update_fields=['shared_token'])
        return Response({"shared_token": enrollment.shared_token})

class UserEnrollmentList(ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user)

class CollaborationSessionViewSet(viewsets.ModelViewSet):
    queryset = CollaborationSession.objects.all()
    serializer_class = CollaborationSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only sessions for enrollments this user can access:
        return CollaborationSession.objects.filter(
            enrollment__in=self.request.user.enrollments.all()
        )

class SessionStrokeViewSet(viewsets.ModelViewSet):
    queryset = SessionStroke.objects.all()
    serializer_class = SessionStrokeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Restrict to strokes in sessions this user has access to
        return SessionStroke.objects.filter(
            session__in=CollaborationSession.objects.filter(
                enrollment__in=self.request.user.enrollments.all()
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class SessionNoteViewSet(viewsets.ModelViewSet):
    queryset = SessionNote.objects.all()
    serializer_class = SessionNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SessionNote.objects.filter(
            session__in=CollaborationSession.objects.filter(
                enrollment__in=self.request.user.enrollments.all()
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ShareInviteViewSet(viewsets.ModelViewSet):
    """
    API endpoint to create and list ShareInvite records.
    """
    queryset = ShareInvite.objects.all()
    serializer_class = ShareInviteSerializer
    permission_classes = [IsAuthenticated]

    # ← enable filtering
    filter_backends = [ DjangoFilterBackend ]
    # ← allow ?enrollment=123
    filterset_fields = ['enrollment']

    def perform_create(self, serializer):
        # Generate a unique token and record who sent it
        serializer.save(invited_by=self.request.user)
