from django.contrib import admin
from .models import Notification, FCMToken
from django.contrib.auth import get_user_model
from django.utils.html import format_html
from django.urls import reverse
from .utils import send_push_notification

User = get_user_model()

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'short_message', 'is_read', 'is_sent', 'created_at', 'send_push']
    list_filter = ['is_read', 'is_sent', 'created_at']
    search_fields = ['user__username', 'message', 'title']
    actions = ['send_push_notifications']  # ✅ adds admin bulk action

    def short_message(self, obj):
        return (obj.message[:50] + '...') if len(obj.message) > 50 else obj.message
    short_message.short_description = 'Message'

    def send_push(self, obj):
        if not obj.is_sent:
            url = reverse('notifications:send_notification_now', args=[obj.id])  # ✅ correct reverse name
            return format_html('<a class="button" href="{}">Send</a>', url)
        return "✅ Sent"
    send_push.short_description = 'Push'

    def send_push_notifications(self, request, queryset):
        unsent = queryset.filter(is_sent=False)
        success = 0
        for note in unsent:
            result = send_push_notification(note.user, note.title, note.message, note.link)
            if result:
                note.is_sent = True
                note.save()
                success += 1
        self.message_user(request, f"✅ Sent {success} notifications.")
    send_push_notifications.short_description = "Send push to selected users"

@admin.register(FCMToken)
class FCMTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'token', 'created_at']
    search_fields = ['user__username']
