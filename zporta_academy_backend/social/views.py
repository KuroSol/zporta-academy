from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.db.models import Q
from .models import GuideRequest
from .serializers import GuideRequestSerializer, TeacherListSerializer, StudentListSerializer
from notifications.models import Notification
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers

class GuideRequestViewSet(viewsets.ModelViewSet):
    queryset = GuideRequest.objects.all()
    serializer_class = GuideRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(
            Q(explorer=self.request.user) | Q(guide=self.request.user)
        )

    def perform_create(self, serializer):
        explorer = self.request.user
        guide = serializer.validated_data['guide']
        if GuideRequest.objects.filter(explorer=explorer, guide=guide).exists():
            raise serializers.ValidationError("You have already sent a request to this guide.")
        guide_request = serializer.save(explorer=explorer)
        Notification.objects.create(
            user=guide,
            message=f"{explorer.username} has requested to attend your profile.",
            link="/guide-requests/",
            guide_request=guide_request
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        guide_request = self.get_object()
        # Only the explorer can cancel their own request.
        if guide_request.explorer != request.user:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        # Store the id before deletion.
        gr_id = guide_request.id
        # Delete the request.
        guide_request.delete()
        # Delete related notifications using the stored ID.
        Notification.objects.filter(guide_request_id=gr_id).delete()
        return Response({"detail": "Guide request cancelled."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        guide_request = self.get_object()
        if guide_request.guide != request.user:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        guide_request.status = 'accepted'
        guide_request.save()
        Notification.objects.filter(guide_request=guide_request).update(is_read=True)
        return Response({"detail": "Guide request accepted."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def deny(self, request, pk=None):
        guide_request = self.get_object()
        if guide_request.guide != request.user:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        guide_request.status = 'declined'
        guide_request.save()
        Notification.objects.filter(guide_request=guide_request).update(is_read=True)
        return Response({"detail": "Guide request declined."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_teachers(request):
    """Get list of teachers the current user is learning from (accepted guide requests)"""
    guide_requests = GuideRequest.objects.filter(
        explorer=request.user,
        status='accepted'
    ).select_related('guide', 'guide__profile')
    
    teachers = []
    for gr in guide_requests:
        teacher = gr.guide
        profile = getattr(teacher, 'profile', None)
        profile_picture_url = None
        if profile and profile.profile_image:
            profile_picture_url = request.build_absolute_uri(profile.profile_image.url)
        
        teachers.append({
            'id': teacher.id,
            'username': teacher.username,
            'display_name': profile.display_name if profile and profile.display_name else teacher.username,
            'profile_picture_url': profile_picture_url
        })
    
    serializer = TeacherListSerializer(teachers, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_students(request):
    """Get list of students learning from the current user as teacher (accepted guide requests)"""
    guide_requests = GuideRequest.objects.filter(
        guide=request.user,
        status='accepted'
    ).select_related('explorer', 'explorer__profile')
    
    students = []
    for gr in guide_requests:
        student = gr.explorer
        profile = getattr(student, 'profile', None)
        profile_picture_url = None
        if profile and profile.profile_image:
            profile_picture_url = request.build_absolute_uri(profile.profile_image.url)
        
        students.append({
            'id': student.id,
            'username': student.username,
            'display_name': profile.display_name if profile and profile.display_name else student.username,
            'profile_picture_url': profile_picture_url
        })
    
    serializer = StudentListSerializer(students, many=True)
    return Response(serializer.data)
