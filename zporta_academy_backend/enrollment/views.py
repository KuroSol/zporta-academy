# enrollment/views.py
import uuid
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from courses.models import Course
from lessons.models import LessonCompletion
from lessons.serializers import SimpleLessonCompletionSerializer
from .models import Enrollment, CollaborationSession, SessionStroke, SessionNote, ShareInvite
from .serializers import (
    EnrollmentSerializer,
    CollaborationSessionSerializer,
    SessionStrokeSerializer,
    SessionNoteSerializer,
    ShareInviteSerializer,
)
from .utils import lock_course_and_content

# This view handles the specific logic for the floating study notes widget.
class SessionNoteView(APIView):
    """
    Handles all CRUD operations for a user's study note for a specific enrollment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, enrollment_pk):
        """
        READ operation.
        Retrieves the study note for the current user and enrollment.
        """
        enrollment = get_object_or_404(Enrollment, pk=enrollment_pk, user=request.user)
        
        # This part is fine, it creates a session container if one doesn't exist
        session, _ = CollaborationSession.objects.get_or_create(
            enrollment=enrollment,
            defaults={'session_id': f'notes_{enrollment.id}_{uuid.uuid4().hex}'}
        )
        
        note = SessionNote.objects.filter(session=session, user=request.user).first()
        
        if note:
            # The serializer will correctly include 'highlight_data' if it exists
            serializer = SessionNoteSerializer(note)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Return empty data if no note exists yet
        return Response({'note': '', 'highlight_data': None}, status=status.HTTP_200_OK)

    def post(self, request, enrollment_pk):
        """
        CREATE / UPDATE operation.
        Creates or updates a study note AND/OR highlight data for the user.
        """
        enrollment = get_object_or_404(Enrollment, pk=enrollment_pk, user=request.user)

        session, _ = CollaborationSession.objects.get_or_create(
            enrollment=enrollment,
            defaults={'session_id': f'notes_{enrollment.id}_{uuid.uuid4().hex}'}
        )
        
        # Get both note and highlight data from the request
        note_content = request.data.get('note', None)
        highlight_content = request.data.get('highlight_data', None)

        # Prepare a dictionary of fields to update
        defaults = {}
        if note_content is not None:
            defaults['note'] = note_content
        if highlight_content is not None:
            defaults['highlight_data'] = highlight_content
        
        # Ensure there is actually data to save
        if not defaults:
            return Response(
                {"detail": "No 'note' or 'highlight_data' provided."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use the defaults dictionary to update or create the record
        note, created = SessionNote.objects.update_or_create(
            session=session,
            user=request.user,
            defaults=defaults
        )
        
        serializer = SessionNoteSerializer(note)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)

    def delete(self, request, enrollment_pk):
        """
        DELETE operation.
        Deletes the study note for the current user and enrollment.
        """
        enrollment = get_object_or_404(Enrollment, pk=enrollment_pk, user=request.user)
        
        try:
            session = CollaborationSession.objects.get(enrollment=enrollment)
            note = SessionNote.objects.get(session=session, user=request.user)
            note.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (CollaborationSession.DoesNotExist, SessionNote.DoesNotExist):
            # It's already gone, so succeed silently
            return Response(status=status.HTTP_204_NO_CONTENT)

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

class CourseEnrollmentList(ListAPIView):
    """
    List all enrollments for a specific course.
    Only accessible by teachers/admins.
    """
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Check if user is teacher or admin
        user = self.request.user
        is_teacher_or_admin = (
            user.is_staff or 
            (hasattr(user, 'profile') and user.profile.role == 'guide')
        )
        
        if not is_teacher_or_admin:
            return Enrollment.objects.none()
        
        # Get course_id from URL
        course_id = self.kwargs.get('course_id')
        if not course_id:
            return Enrollment.objects.none()
        
        # Get ContentType for Course
        course_ct = ContentType.objects.get_for_model(Course)
        
        # Return all enrollments for this course
        return Enrollment.objects.filter(
            content_type=course_ct,
            object_id=course_id,
            enrollment_type='course'
        ).select_related('user', 'user__profile')

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
