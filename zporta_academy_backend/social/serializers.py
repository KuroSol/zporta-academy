# social/serializers.py
from rest_framework import serializers
from .models import GuideRequest

class GuideRequestSerializer(serializers.ModelSerializer):
    explorer_username = serializers.CharField(source='explorer.username', read_only=True)
    guide_username = serializers.CharField(source='guide.username', read_only=True)
    
    class Meta:
        model = GuideRequest
        fields = '__all__'
        read_only_fields = ['explorer', 'created_at']
