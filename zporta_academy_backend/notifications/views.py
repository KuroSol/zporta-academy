from rest_framework import viewsets, mixins

from .models import Notification
from .serializers import NotificationSerializer


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import FCMToken


from django.contrib.auth import get_user_model
from rest_framework.decorators import permission_classes,api_view
from rest_framework.permissions import IsAdminUser
from .utils import send_push_notification
from rest_framework import status


from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required

User = get_user_model()


class NotificationViewSet(
        mixins.ListModelMixin,
        mixins.RetrieveModelMixin,
        mixins.UpdateModelMixin,
        viewsets.GenericViewSet
    ):
    permission_classes = [IsAuthenticated]
    serializer_class   = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')
        

@api_view(['POST'])
@permission_classes([IsAdminUser])  # 🔐 only admin can use
def send_notification_to_user(request):
    username = request.data.get("username", "").strip()
    title = request.data.get("title")
    message = request.data.get("message")
    link = request.data.get("link")

    if not (username and title and message):
        return Response({"error": "Missing fields"}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)

    # Create DB record
    note = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        link=link,
    )

    sent = send_push_notification(user, title, message, link)
    if sent:
        note.is_sent = True
        note.save()

    return Response({"message": "Notification sent and saved."}, status=200)

@staff_member_required
def send_notification_now(request, pk):
    note = get_object_or_404(Notification, pk=pk)
    print(f"📬 Attempting to send push to {note.user.username}")
    sent = send_push_notification(note.user, note.title, note.message, note.link)

    if sent:
        print("✅ Push sent!")
        note.is_sent = True
        note.save()
        messages.success(request, "✅ Push sent successfully.")
    else:
        print("❌ Push failed! Maybe no token?")
        messages.error(request, "❌ Push failed.")

    return redirect(request.META.get('HTTP_REFERER', '/admin/notifications/notification/'))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_fcm_token(request):
    token = request.data.get('token')
    if token:
        FCMToken.objects.update_or_create(user=request.user, defaults={'token': token})
        return Response({'message': 'Token saved'})
    return Response({'error': 'Token missing'}, status=400)
