# social/serializers.py
from rest_framework import serializers
from .models import GuideRequest
from django.contrib.auth import get_user_model

User = get_user_model()

class GuideRequestSerializer(serializers.ModelSerializer):
    explorer_username = serializers.CharField(source='explorer.username', read_only=True)
    guide_username = serializers.CharField(source='guide.username', read_only=True)
    
    class Meta:
        model = GuideRequest
        fields = '__all__'
        read_only_fields = ['explorer', 'created_at']

class TeacherListSerializer(serializers.Serializer):
    """Serializer for teachers the current user is learning from"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    profile_picture_url = serializers.CharField(allow_null=True, required=False)
    
class StudentListSerializer(serializers.Serializer):
    """Serializer for students learning from the current user as teacher"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    profile_picture_url = serializers.CharField(allow_null=True, required=False)
