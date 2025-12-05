# intelligence/serializers.py
from rest_framework import serializers
from .models import (
    UserAbilityProfile,
    ContentDifficultyProfile,
    MatchScore,
    RecommendationCache
)


class UserAbilityProfileSerializer(serializers.ModelSerializer):
    """Serializer for user ability profile with computed fields."""
    
    username = serializers.CharField(source='user.username', read_only=True)
    ability_level = serializers.SerializerMethodField()
    
    class Meta:
        model = UserAbilityProfile
        fields = [
            'username',
            'overall_ability_score',
            'ability_level',
            'ability_by_subject',
            'ability_by_tag',
            'total_quizzes_attempted',
            'total_correct_answers',
            'recent_performance_trend',
            'global_rank',
            'percentile',
            'last_computed_at',
        ]
        read_only_fields = fields
    
    def get_ability_level(self, obj):
        return obj.get_ability_level()


class ContentDifficultyProfileSerializer(serializers.ModelSerializer):
    """Serializer for content difficulty profile."""
    
    difficulty_level = serializers.SerializerMethodField()
    content_type_display = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = ContentDifficultyProfile
        fields = [
            'content_type_display',
            'object_id',
            'computed_difficulty_score',
            'difficulty_level',
            'success_rate',
            'avg_time_spent_seconds',
            'attempt_count',
            'difficulty_by_user_segment',
            'last_computed_at',
        ]
        read_only_fields = fields
    
    def get_difficulty_level(self, obj):
        return obj.get_difficulty_level()


class MatchScoreSerializer(serializers.ModelSerializer):
    """Serializer for match scores with explanation."""
    
    match_quality = serializers.SerializerMethodField()
    why_explanation = serializers.SerializerMethodField()
    content_type_display = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = MatchScore
        fields = [
            'content_type_display',
            'object_id',
            'match_score',
            'match_quality',
            'why_explanation',
            'difficulty_gap',
            'zpd_score',
            'preference_alignment_score',
            'computed_at',
        ]
        read_only_fields = fields
    
    def get_match_quality(self, obj):
        return obj.get_match_quality()
    
    def get_why_explanation(self, obj):
        return obj.get_why_explanation()


class LearningPathItemSerializer(serializers.Serializer):
    """Serializer for individual items in learning path."""
    
    quiz_id = serializers.IntegerField()
    title = serializers.CharField()
    subject = serializers.CharField(allow_null=True)
    difficulty_score = serializers.FloatField()
    difficulty_level = serializers.CharField()
    match_score = serializers.FloatField()
    why = serializers.CharField()
    estimated_time_minutes = serializers.IntegerField()
    permalink = serializers.CharField()


class ProgressInsightSerializer(serializers.Serializer):
    """Serializer for progress insights and analytics."""
    
    overall_trend = serializers.CharField()
    trend_direction = serializers.CharField()
    performance_change = serializers.FloatField()
    
    strengths = serializers.ListField(
        child=serializers.DictField()
    )
    
    weaknesses = serializers.ListField(
        child=serializers.DictField()
    )
    
    recommended_focus_areas = serializers.ListField(
        child=serializers.CharField()
    )
    
    recent_achievements = serializers.ListField(
        child=serializers.DictField()
    )
    
    next_milestones = serializers.ListField(
        child=serializers.DictField()
    )


class RecommendedSubjectSerializer(serializers.Serializer):
    """Serializer for recommended subjects to explore."""
    
    subject_id = serializers.IntegerField()
    subject_name = serializers.CharField()
    relevance_score = serializers.FloatField()
    reason = serializers.CharField()
    quiz_count = serializers.IntegerField()
