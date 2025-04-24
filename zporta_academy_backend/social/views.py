from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.db.models import Q
from .models import GuideRequest
from .serializers import GuideRequestSerializer
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
