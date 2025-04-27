# quizzes/serializers.py
from rest_framework import serializers
from .models import Quiz, Question

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'id', 'quiz', 'question_text', 'option1', 'option2',
            'option3', 'option4', 'correct_option', 'hint1', 'hint2'
        ]
        read_only_fields = ['id', 'quiz']

class QuizSerializer(serializers.ModelSerializer):
    is_locked = serializers.BooleanField(read_only=True)
    created_by = serializers.SerializerMethodField()
    questions = QuestionSerializer(many=True)

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'content', 'lesson', 'subject', 'course',
            'quiz_type', 'permalink', 'created_by', 'created_at',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image', 'is_locked',
            'questions'
        ]
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at',
            'seo_title', 'seo_description', 'canonical_url',
            'og_title', 'og_description', 'og_image', 'is_locked'
        ]

    def get_created_by(self, obj):
        if hasattr(obj, 'created_by') and obj.created_by:
            return obj.created_by.username
        elif hasattr(obj, 'original_quiz') and obj.original_quiz and hasattr(obj.original_quiz, 'created_by'):
            return obj.original_quiz.created_by.username
        else:
            return ""

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        request = self.context.get("request")
        if request:
            validated_data['created_by'] = request.user

        quiz = Quiz.objects.create(**validated_data)

        for question_data in questions_data:
            Question.objects.create(quiz=quiz, **question_data)

        return quiz
