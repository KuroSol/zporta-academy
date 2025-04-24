# subjects/serializers.py
from rest_framework import serializers
from .models import Subject

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'permalink', 'created_by', 'created_at']  # Adjust fields as needed
