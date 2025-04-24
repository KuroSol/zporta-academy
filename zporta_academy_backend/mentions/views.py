from rest_framework import generics, permissions
from .models import Mention
from .serializers import MentionSerializer

class MentionListView(generics.ListAPIView):
    """
    Lists all mention notifications for the authenticated user.
    """
    serializer_class = MentionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Mention.objects.filter(user=self.request.user).order_by('-created_at')


class MentionDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve a single mention notification. Can be used to mark as read.
    """
    serializer_class = MentionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Mention.objects.filter(user=self.request.user)
