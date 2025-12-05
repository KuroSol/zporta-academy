# intelligence/admin.py
from django.contrib import admin
from .models import (
    UserAbilityProfile,
    ContentDifficultyProfile,
    MatchScore,
    RecommendationCache
)


@admin.register(UserAbilityProfile)
class UserAbilityProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'overall_ability_score', 'get_ability_level', 'global_rank', 'percentile', 'total_quizzes_attempted', 'last_computed_at')
    list_filter = ('last_computed_at',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('last_computed_at', 'metadata')
    ordering = ('-overall_ability_score',)
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Ability Scores', {
            'fields': ('overall_ability_score', 'ability_by_subject', 'ability_by_tag')
        }),
        ('Performance Metrics', {
            'fields': ('total_quizzes_attempted', 'total_correct_answers', 'recent_performance_trend')
        }),
        ('Ranking', {
            'fields': ('global_rank', 'percentile')
        }),
        ('Metadata', {
            'fields': ('last_computed_at', 'metadata'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ContentDifficultyProfile)
class ContentDifficultyProfileAdmin(admin.ModelAdmin):
    list_display = ('content_type', 'object_id', 'computed_difficulty_score', 'get_difficulty_level', 'success_rate', 'attempt_count', 'last_computed_at')
    list_filter = ('content_type', 'last_computed_at')
    search_fields = ('object_id',)
    readonly_fields = ('last_computed_at', 'metadata', 'content_object')
    ordering = ('-computed_difficulty_score',)
    
    fieldsets = (
        ('Content', {
            'fields': ('content_type', 'object_id', 'content_object')
        }),
        ('Difficulty Score', {
            'fields': ('computed_difficulty_score', 'difficulty_by_user_segment')
        }),
        ('Performance Metrics', {
            'fields': ('success_rate', 'avg_time_spent_seconds', 'attempt_count')
        }),
        ('Metadata', {
            'fields': ('last_computed_at', 'metadata'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MatchScore)
class MatchScoreAdmin(admin.ModelAdmin):
    list_display = ('user', 'content_type', 'object_id', 'match_score', 'difficulty_gap', 'computed_at')
    list_filter = ('content_type', 'computed_at')
    search_fields = ('user__username', 'object_id')
    readonly_fields = ('computed_at', 'metadata', 'content_object')
    ordering = ('-match_score',)
    
    fieldsets = (
        ('Match', {
            'fields': ('user', 'content_type', 'object_id', 'content_object', 'match_score')
        }),
        ('Component Scores', {
            'fields': ('difficulty_gap', 'zpd_score', 'preference_alignment_score', 'topic_similarity_score', 'recency_penalty')
        }),
        ('Metadata', {
            'fields': ('computed_at', 'metadata'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RecommendationCache)
class RecommendationCacheAdmin(admin.ModelAdmin):
    list_display = ('user', 'feed_type', 'cached_at', 'expires_at', 'hit_count', 'is_valid')
    list_filter = ('feed_type', 'cached_at', 'expires_at')
    search_fields = ('user__username',)
    readonly_fields = ('cached_at', 'hit_count')
    ordering = ('-cached_at',)
    
    fieldsets = (
        ('Cache Info', {
            'fields': ('user', 'feed_type')
        }),
        ('Cached Data', {
            'fields': ('cached_quiz_ids', 'cached_metadata')
        }),
        ('Cache Management', {
            'fields': ('cached_at', 'expires_at', 'hit_count')
        }),
    )
