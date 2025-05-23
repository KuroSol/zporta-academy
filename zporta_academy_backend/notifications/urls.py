from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationViewSet,
    save_fcm_token,               # ✅ fixed: was SaveFCMToken
    send_notification_to_user,
    send_notification_now,
)
router = DefaultRouter()
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    
    path('save-fcm-token/', save_fcm_token),               # ✅ fixed
    path('send-to-user/', send_notification_to_user),      # /api/notifications/send-to-user/
    path('send-now/<int:pk>/', send_notification_now, name='send_notification_now'),
    path('', include(router.urls)),                         # /api/notifications/
]
