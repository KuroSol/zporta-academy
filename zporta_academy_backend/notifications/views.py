# --------------- Django Backend: notifications/views.py ---------------
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authentication import TokenAuthentication
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import api_view, permission_classes as drf_permission_classes # Renamed to avoid clash
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponseRedirect # For send_notification_now
from django.urls import reverse # For send_notification_now

from .models import FCMToken, FCMLog, Notification as AppNotification # Renamed to avoid conflict
from .serializers import NotificationSerializer # Make sure NotificationSerializer is defined in serializers.py
from .utils import send_push_to_user_devices 

User = get_user_model()

# --- ViewSet for user to see their notifications ---
class NotificationViewSet(
        mixins.ListModelMixin,
        mixins.RetrieveModelMixin,
        mixins.UpdateModelMixin, # For marking as read, etc.
        viewsets.GenericViewSet
    ):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class       = None
    serializer_class = NotificationSerializer

    def get_queryset(self):
        # Users should only see their own notifications; defer heavy fields if any added later
        qs = AppNotification.objects.filter(user=self.request.user).order_by('-created_at')
        return qs

    def list(self, request, *args, **kwargs):
        """Optimized list with lightweight polling support.

        Query params:
        - limit (int): max notifications to return (default 50, max 200)
        - since (ISO timestamp or epoch seconds): return only notifications newer than this
        - unread_only (bool): if true, return only unread notifications
        Returns X-Total header for client-side pagination; encourages less aggressive polling.
        """
        limit_param = request.query_params.get('limit') or 50
        try:
            limit = min(max(int(limit_param), 1), 200)
        except ValueError:
            limit = 50

        qs = self.get_queryset()

        since_val = request.query_params.get('since')
        if since_val:
            from django.utils.dateparse import parse_datetime
            from datetime import datetime
            dt = parse_datetime(since_val)
            if dt is None:
                # Try epoch seconds fallback
                try:
                    dt = datetime.utcfromtimestamp(float(since_val))
                except Exception:
                    dt = None
            if dt is not None:
                qs = qs.filter(created_at__gt=dt)

        unread_only = request.query_params.get('unread_only')
        if unread_only in ['1', 'true', 'True']:
            qs = qs.filter(is_read=False)

        total_count = qs.count()
        qs = qs[:limit]
        serializer = self.get_serializer(qs, many=True)
        resp = Response(serializer.data)
        resp['X-Total'] = str(total_count)
        resp['Cache-Control'] = 'no-store'
        return resp

    # ======================= ADD THIS NEW ACTION INSIDE THE CLASS =======================
    @action(detail=False, methods=['post'], url_path='create-collab-invite')
    def create_collab_invite(self, request):
        target_user_id = request.data.get('target_user_id')
        invite_url = request.data.get('invite_url')
        course_title = request.data.get('course_title')
        
        if not all([target_user_id, invite_url, course_title]):
            return Response(
                {"error": "Missing target_user_id, invite_url, or course_title"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            target_user = User.objects.get(pk=target_user_id)
            inviting_user = request.user
        except User.DoesNotExist:
            return Response({"error": "Target user not found"}, status=status.HTTP_404_NOT_FOUND)

        # Create the notification message
        title = f"Study Invite from {inviting_user.username}"
        message = f"Join {inviting_user.username} to study '{course_title}' together!"

        # Create the in-app notification object
        app_notification = AppNotification.objects.create(
            user=target_user,
            title=title,
            message=message,
            link=invite_url  # The link contains the collabSession ID
        )

        # Send the push notification using your existing utility
        success_count = send_push_to_user_devices(
            user=target_user,
            title=title,
            body=message,
            link=invite_url,
            extra_data={"type": "collab_invite", "url": invite_url}
        )

        if success_count > 0:
            app_notification.is_sent_push = True
            app_notification.save(update_fields=['is_sent_push'])
            return Response({"detail": "Invitation sent successfully."}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "In-app notification created, but push could not be sent (no active devices)."}, status=status.HTTP_200_OK)
    # ====================================================================================


    def perform_update(self, serializer):
        # Ensure users can only update their own notifications (e.g., mark as read)
        # Additional checks can be added here if needed.
        if serializer.instance.user == self.request.user:
            serializer.save()
        else:
            # This should ideally not happen if get_queryset is correct, but as a safeguard.
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to update this notification.")


# --- View to save FCM token ---
class SaveFCMTokenView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication] 

    def post(self, request, *args, **kwargs):
        token_str = request.data.get('token')
        device_id = request.data.get('device_id')

        if not token_str or not device_id:
            return Response(
                {"detail": "Missing 'token' or 'device_id'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            existing_token_different_user_or_device = FCMToken.objects.filter(token=token_str).exclude(user=request.user, device_id=device_id).first()
            if existing_token_different_user_or_device:
                existing_token_different_user_or_device.is_active = False
                existing_token_different_user_or_device.save()
                FCMLog.objects.create(
                    user=existing_token_different_user_or_device.user,
                    token=token_str,
                    device_id=existing_token_different_user_or_device.device_id,
                    action='token_inactive',
                    detail=f"Token reassigned to user {request.user.username}, device {device_id}. Old entry deactivated."
                )
                print(f"Warning: Token {token_str[:10]}... was reassigned from user {existing_token_different_user_or_device.user.id}/device {existing_token_different_user_or_device.device_id} to user {request.user.id}/device {device_id}")

            fcm_token_instance, created = FCMToken.objects.update_or_create(
                user=request.user,
                device_id=device_id,
                defaults={'token': token_str, 'is_active': True}
            )
            log_action = 'register'
            log_detail = 'FCM token created.' if created else 'FCM token updated.'
            
            FCMLog.objects.create(
                user=request.user,
                token=token_str, 
                device_id=device_id,
                action=log_action,
                success=True,
                detail=log_detail
            )
            return Response({"detail": log_detail, "created": created}, status=status.HTTP_200_OK)
        except Exception as e:
            FCMLog.objects.create(
                user=request.user,
                token=token_str, 
                device_id=device_id,
                action='register',
                success=False,
                detail=f"Error saving FCM token: {str(e)}"
            )
            return Response(
                {"detail": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# --- View for Admin to send a notification to a specific user ---
@api_view(['POST'])
@drf_permission_classes([IsAdminUser]) # Ensure this uses DRF's permission_classes
def send_notification_to_user(request):
    username = request.data.get("username", "").strip()
    title = request.data.get("title")
    message_body = request.data.get("message") # Renamed to avoid clash with django.contrib.messages
    link = request.data.get("link")

    if not (username and title and message_body):
        return Response({"error": "Missing fields: username, title, message are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_to_notify = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # Create the in-app notification
    app_notif = AppNotification.objects.create(
        user=user_to_notify,
        title=title,
        message=message_body,
        link=link,
    )

    # Send push notification
    success_count = send_push_to_user_devices(
        user=user_to_notify,
        title=title,
        body=message_body,
        link=link,
        extra_data={"notification_app_id": str(app_notif.id), "type": "admin_direct_send"}
    )

    if success_count > 0:
        app_notif.is_sent_push = True
        app_notif.save(update_fields=['is_sent_push'])
        return Response({"detail": f"Notification sent to {success_count} device(s) of {username} and saved in-app."}, status=status.HTTP_200_OK)
    else:
        # In-app notification is still saved, but push failed or no devices
        return Response({"detail": f"In-app notification saved for {username}, but push notification failed or no active devices found."}, status=status.HTTP_200_OK)


# --- View for Admin "Send Push" button on a Notification object ---
@staff_member_required # Django admin permission
def send_notification_now(request, pk):
    notification_obj = get_object_or_404(AppNotification, pk=pk)
    
    if notification_obj.is_sent_push:
        messages.info(request, f"Push notification for '{notification_obj.title}' was already marked as sent.")
    else:
        num_devices = send_push_to_user_devices(
            user=notification_obj.user,
            title=notification_obj.title,
            body=notification_obj.message, # Using the 'message' field from AppNotification model
            link=notification_obj.link,
            extra_data={"notification_app_id": str(notification_obj.id), "type": "admin_resend"}
        )
        if num_devices > 0:
            notification_obj.is_sent_push = True
            notification_obj.save(update_fields=['is_sent_push'])
            messages.success(request, f"Push sent to {num_devices} device(s) for notification '{notification_obj.title}'.")
        else:
            messages.warning(request, f"Push not sent for notification '{notification_obj.title}' (no active devices or other issue).")
            
    # Redirect back to the admin changelist or the referring page
    return HttpResponseRedirect(request.META.get('HTTP_REFERER', reverse('admin:notifications_notification_changelist')))


# --- Example Admin action to send a test push (can be adapted or removed) ---
@staff_member_required
def admin_send_test_notification(request, user_id):
    user_to_notify = get_object_or_404(User, pk=user_id)
    title = "Test Notification from Admin"
    body = f"Hello {user_to_notify.username}, this is a test push message!"
    link = "https://zportaacademy.com/profile" 

    app_notif = AppNotification.objects.create(
        user=user_to_notify,
        title=title,
        message=body, 
        link=link
    )

    success_count = send_push_to_user_devices(
        user=user_to_notify,
        title=title,
        body=body,
        link=link,
        extra_data={"notification_id": str(app_notif.id), "type": "test_message"}
    )

    if success_count > 0:
        app_notif.is_sent_push = True
        app_notif.save(update_fields=['is_sent_push'])
        messages.success(request, f"Test push sent to {success_count} device(s) of {user_to_notify.username}.")
    else:
        messages.error(request, f"Failed to send test push to {user_to_notify.username} or no active devices found.")

    return redirect(request.META.get('HTTP_REFERER', '/admin/'))
