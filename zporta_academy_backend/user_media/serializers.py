# user_media/serializers.py
from rest_framework import serializers
from .models import UserMedia

class UserMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = UserMedia
        fields = ['id', 'file_url', 'media_type', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url
