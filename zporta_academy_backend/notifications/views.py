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
from .utils import send_push_notification 

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

@staff_member_required  # ✅ Only admin users can use
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

    return redirect('/admin/notifications/notification/')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_fcm_token(request):
    print(f"--- save_fcm_token endpoint hit by user: {request.user.username} ---") # Log who is calling
    token = request.data.get('token')
    print(f"Received FCM token in request data: {token}")

    if token:
        try:
            fcm_token_obj, created = FCMToken.objects.update_or_create(
                user=request.user, 
                defaults={'token': token}
            )
            if created:
                print(f"✅ Successfully CREATED FCM token for user {request.user.username}")
            else:
                print(f"✅ Successfully UPDATED FCM token for user {request.user.username}")
            return Response({'message': 'Token saved successfully'})
        except Exception as e:
            print(f"❌ Error saving FCM token for user {request.user.username}: {e}")
            return Response({'error': 'Failed to save token due to server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    else:
        print("⚠️ Token missing in request data.")
        return Response({'error': 'Token missing'}, status=status.HTTP_400_BAD_REQUEST)

