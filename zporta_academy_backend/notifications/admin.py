from django.contrib import admin
from .models import Notification, FCMToken # Using your model names
from django.contrib.auth import get_user_model
from django.utils.html import format_html
from django.urls import reverse
from .utils import send_push_to_user_devices # Corrected function name

User = get_user_model()

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'short_message', 'is_read', 'is_sent_push', 'created_at', 'send_push_action_button'] # Changed 'is_sent' to 'is_sent_push'
    list_filter = ['is_read', 'is_sent_push', 'created_at', 'user'] # Changed 'is_sent' to 'is_sent_push'
    search_fields = ['user__username', 'message', 'title']
    actions = ['send_push_for_selected']
    readonly_fields = ['created_at']

    def short_message(self, obj):
        return (obj.message[:50] + '...') if len(obj.message) > 50 else obj.message
    short_message.short_description = 'Message (Preview)'

    def send_push_action_button(self, obj):
        # This button triggers a view that handles the push sending.
        # The view 'send_notification_now' should exist in your urls.py and views.py.
        if not obj.is_sent_push: # Changed 'is_sent' to 'is_sent_push'
            # Assuming your app_name is 'notifications' for the reverse call
            url = reverse('notifications:send_notification_now', args=[obj.id])
            return format_html('<a class="button" href="{}">Send Push</a>', url)
        return "✅ Push Sent"
    send_push_action_button.short_description = 'Push Action'
    send_push_action_button.allow_tags = True


    def send_push_for_selected(self, request, queryset):
        unsent_notifications = queryset.filter(is_sent_push=False) # Changed 'is_sent' to 'is_sent_push'
        success_count = 0
        failed_count = 0

        for notification_obj in unsent_notifications:
            num_devices_notified = send_push_to_user_devices( # Uses the corrected function name
                user=notification_obj.user,
                title=notification_obj.title,
                body=notification_obj.message,
                link=notification_obj.link,
                extra_data={"notification_db_id": str(notification_obj.id)}
            )
            if num_devices_notified > 0:
                notification_obj.is_sent_push = True # Changed 'is_sent' to 'is_sent_push'
                notification_obj.save(update_fields=['is_sent_push'])
                success_count += 1
            else:
                # Logged in utils, but we can count failures here too
                failed_count +=1
        
        if success_count > 0:
            self.message_user(request, f"✅ Successfully attempted to send {success_count} push notifications.")
        if failed_count > 0:
             self.message_user(request, f"⚠️ Failed to send or no active devices for {failed_count} notifications.", level='WARNING')
        if success_count == 0 and failed_count == 0 and queryset.exists() and not unsent_notifications.exists():
             self.message_user(request, "No unsent notifications selected or all selected were already marked as sent.", level='INFO')
        elif not queryset.exists():
            self.message_user(request, "No notifications were selected.", level='INFO')


    send_push_for_selected.short_description = "Send push for selected notifications"

@admin.register(FCMToken)
class FCMTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_id', 'is_active', 'short_token', 'created_at', 'last_seen']
    list_filter = ['is_active', 'user']
    search_fields = ['user__username', 'token', 'device_id']
    readonly_fields = ['created_at', 'last_seen', 'token'] # Token is usually long
    actions = ['mark_active', 'mark_inactive']

    def short_token(self, obj):
        return (obj.token[:20] + '...') if len(obj.token) > 20 else obj.token
    short_token.short_description = 'Token (Preview)'

    def mark_active(self, request, queryset):
        updated_count = queryset.update(is_active=True)
        self.message_user(request, f"{updated_count} FCM tokens marked as active.")
    mark_active.short_description = "Mark selected tokens as active"

    def mark_inactive(self, request, queryset):
        updated_count = queryset.update(is_active=False)
        self.message_user(request, f"{updated_count} FCM tokens marked as inactive.")
    mark_inactive.short_description = "Mark selected tokens as inactive"
