from rest_framework import serializers
from .models import BulkImportJob


class BulkImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkImportJob
        fields = [
            'id', 'status', 'total_courses', 'total_lessons', 'total_quizzes', 
            'total_questions', 'processed_courses', 'processed_lessons', 
            'processed_quizzes', 'processed_questions', 'errors', 'warnings', 
            'summary', 'created_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'status', 'processed_courses', 'processed_lessons', 
            'processed_quizzes', 'processed_questions', 'errors', 'warnings', 
            'summary', 'created_at', 'completed_at'
        ]
