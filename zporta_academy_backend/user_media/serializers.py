# user_media/serializers.py
from rest_framework import serializers
from .models import UserMedia
from django.conf import settings

class UserMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = UserMedia
        fields = ['id', 'file_url', 'media_type', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get("request")
        if request:
            protocol = getattr(settings, "FORCE_MEDIA_PROTOCOL", "https")
            return f"{protocol}://{request.get_host()}{obj.file.url}"
        return obj.file.url
