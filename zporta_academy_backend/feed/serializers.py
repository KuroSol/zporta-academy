# feed/serializers.py
from rest_framework import serializers
from quizzes.serializers import QuizSerializer as BaseQuizSerializer
from .models import Subject, Language, Region, UserPreference

# Re-export the main QuizSerializer for feed endpoints
QuizFeedSerializer = BaseQuizSerializer

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name']

class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'name']

class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ['id', 'name']

class UserPreferenceSerializer(serializers.ModelSerializer):
    subjects  = serializers.PrimaryKeyRelatedField(many=True, queryset=Subject.objects.all())
    languages = serializers.PrimaryKeyRelatedField(many=True, queryset=Language.objects.all())
    regions   = serializers.PrimaryKeyRelatedField(many=True, queryset=Region.objects.all())

    class Meta:
        model  = UserPreference
        fields = ['subjects', 'languages', 'regions']
