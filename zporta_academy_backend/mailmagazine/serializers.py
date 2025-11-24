from rest_framework import serializers
from .models import TeacherMailMagazine


class TeacherMailMagazineSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherMailMagazine
        fields = [
            'id',
            'title',
            'subject',
            'body',
            'frequency',
            'send_at',
            'is_active',
            'last_sent_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_sent_at', 'created_at', 'updated_at']
