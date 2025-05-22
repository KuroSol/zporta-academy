from rest_framework import viewsets, mixins

from .models import Notification
from .serializers import NotificationSerializer


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import FCMToken


from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAdminUser
from .utils import send_push_notification
from rest_framework import status
from .utils import send_push_notification 

from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import reverse
import traceback

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
    try:
        notification = Notification.objects.get(pk=pk)
        if not notification.is_sent:
            result = send_push_notification(notification.user, notification.title, notification.message, notification.link)
            if result:
                notification.is_sent = True
                notification.save()
                messages.success(request, f"✅ Sent push to {notification.user.username}")
            else:
                messages.error(request, "❌ Failed to send notification.")
        else:
            messages.warning(request, "⚠️ Notification already sent.")
    except Notification.DoesNotExist:
        messages.error(request, "❌ Notification not found.")
    except Exception as e:
        print("🔥 ERROR in send_notification_now:")
        traceback.print_exc()  # ✅ Full traceback
        messages.error(request, f"❌ Internal server error.")

    return redirect('/administration-zporta-repersentiivie/notifications/notification/')


@api_view(['POST'])
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def save_fcm_token(request):
    token = request.data.get('token')
    if not token:
        return Response({"detail": "No token provided"}, status=400)

    obj, created = FCMToken.objects.update_or_create(
        token=token,
        defaults={'user': request.user}
    )
    return Response({"detail": "FCM token saved", "created": created})

