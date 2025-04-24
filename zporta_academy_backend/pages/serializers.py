from rest_framework import serializers
from .models import Page

class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = ['id', 'title', 'permalink', 'content', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']
