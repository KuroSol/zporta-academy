from rest_framework import serializers
from .models import Notification # This refers to your original Notification model

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        # Added 'title' and 'is_sent_push' for more complete serialization if needed by clients.
        # You can remove 'is_sent_push' if it's purely an internal tracking field.
        fields = ['id', 'user', 'title', 'message', 'link', 'is_read', 'is_sent_push', 'created_at', 'guide_request']
        read_only_fields = ['user', 'created_at', 'is_sent_push'] # User is typically set by the system

    # You might want to add a serializer for FCMToken if you ever need to expose it via an API,
    # though typically it's an internal model.
