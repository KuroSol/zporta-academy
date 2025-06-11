from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationViewSet,
    SaveFCMTokenView,
    send_notification_to_user,
    send_notification_now,
    admin_send_test_notification,
)

router = DefaultRouter()
router.register(r'user-notifications', NotificationViewSet, basename='user-notifications')

app_name = 'notifications'

urlpatterns = [
    # <-- this exposes GET /user-notifications/ (list) and GET /user-notifications/<pk>/ (retrieve)
    path('', include(router.urls)),

    # your other endpoints:
    path('save-fcm-token/',  SaveFCMTokenView.as_view(),      name='save_fcm_token'),
    path('send-to-user/',     send_notification_to_user,       name='send_to_user'),
    path('send-now/<int:pk>/', send_notification_now,          name='send_notification_now'),
    path('admin-test-push/<int:user_id>/', admin_send_test_notification, name='admin_test_push'),
]
