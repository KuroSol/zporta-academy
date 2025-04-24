from rest_framework import serializers
from .models import Quiz

class QuizSerializer(serializers.ModelSerializer):
    is_locked = serializers.BooleanField(read_only=True)
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'id',
            'title',
            'content',
            'question',
            'option1',
            'option2',
            'option3',
            'option4',
            'correct_option',
            'hint1',
            'hint2',
            'lesson',
            'subject',
            'course',
            'quiz_type',
            'permalink',
            'created_by',
            'created_at',
            'seo_title',
            'seo_description',
            'focus_keyword',
            'canonical_url',
            'og_title',
            'og_description',
            'og_image',
            'is_locked',
        ]
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at',
            'seo_title', 'seo_description', 'canonical_url',
            'og_title', 'og_description', 'og_image'
        ]
    
    def get_created_by(self, obj):
        # If the object has a created_by attribute, use it.
        if hasattr(obj, 'created_by') and obj.created_by:
            return obj.created_by.username
        # Otherwise, if it's a snapshot, try to get created_by from the original quiz.
        elif hasattr(obj, 'original_quiz') and obj.original_quiz and hasattr(obj.original_quiz, 'created_by'):
            return obj.original_quiz.created_by.username
        else:
            return ""

    def create(self, validated_data):
        request = self.context.get("request")
        if request:
            validated_data['created_by'] = request.user
            course = validated_data.get('course')
        if course:
            validated_data['course'] = course   
        return super().create(validated_data)
