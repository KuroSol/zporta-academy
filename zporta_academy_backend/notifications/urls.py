from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationViewSet,         # From your original views.py
    # save_fcm_token,            # This will be replaced by SaveFCMTokenView
    send_notification_to_user,   # From your original views.py
    send_notification_now,       # From your original views.py
    SaveFCMTokenView,            # Class-based view from our refined views.py
    admin_send_test_notification # Example admin action view from our refined views.py
)

# Router for your NotificationViewSet
router = DefaultRouter()
router.register(r'user-notifications', NotificationViewSet, basename='user-notification') # Using 'user-notifications' as base path for clarity

app_name = 'notifications'

urlpatterns = [
    # User-facing notifications list (if NotificationViewSet provides it)
    path('', include(router.urls)), 

    # Endpoint for the frontend to save/update FCM tokens
    # Uses the class-based view for robust token handling
    path('save-fcm-token/', SaveFCMTokenView.as_view(), name='save_fcm_token'),
    
    # Your existing endpoint to send a notification to a specific user (admin-triggered)
    path('send-to-user/', send_notification_to_user, name='send_to_user'),
    
    # Your existing endpoint used by the admin panel's "Send Push" button for a Notification object
    path('send-now/<int:pk>/', send_notification_now, name='send_notification_now'),
    
    # Example URL for the admin test notification action (can be kept or removed)
    path('admin-test-push/<int:user_id>/', admin_send_test_notification, name='admin_test_push'),
]
