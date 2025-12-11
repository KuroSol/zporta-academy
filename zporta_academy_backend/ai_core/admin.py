"""
AI Core Admin Interface
"""

from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.urls import reverse
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta

from .models import (
    AiProviderConfig,
    AiMemory,
    AiTrainingData,
    AiUsageLog,
    AiModelTrainingRun
)


@admin.register(AiProviderConfig)
class AiProviderConfigAdmin(admin.ModelAdmin):
    list_display = [
        'provider', 'model_name', 'tier', 'cost_display', 
        'quality_score', 'is_active', 'is_default'
    ]
    list_filter = ['provider', 'tier', 'is_active', 'is_default']
    search_fields = ['provider', 'model_name']
    ordering = ['tier', 'provider']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('provider', 'model_name', 'tier')
        }),
        ('Cost & Performance', {
            'fields': (
                'cost_per_million_tokens',
                'cost_per_request',
                'avg_latency_ms',
                'quality_score',
                'max_tokens'
            )
        }),
        ('Configuration', {
            'fields': ('is_active', 'is_default', 'capabilities', 'notes')
        }),
    )
    
    def cost_display(self, obj):
        if obj.cost_per_million_tokens:
            return f"${obj.cost_per_million_tokens}/1M tokens"
        elif obj.cost_per_request:
            return f"${obj.cost_per_request}/request"
        return "-"
    cost_display.short_description = "Cost"


@admin.register(AiMemory)
class AiMemoryAdmin(admin.ModelAdmin):
    list_display = [
        'request_type', 'provider_model', 'prompt_preview',
        'usage_count', 'is_verified_good', 'user_rating',
        'created_at_display'
    ]
    list_filter = [
        'request_type', 'provider', 'is_verified_good',
        'use_for_training', 'created_at'
    ]
    search_fields = ['prompt_text', 'prompt_hash']
    readonly_fields = [
        'prompt_hash', 'usage_count', 'created_at',
        'updated_at', 'last_used_at', 'cost_display'
    ]
    actions = ['mark_as_verified', 'mark_for_training', 'unmark_verified']
    
    fieldsets = (
        ('Request Info', {
            'fields': ('request_type', 'prompt_hash', 'prompt_text', 'prompt_options')
        }),
        ('Generated Content', {
            'fields': ('generated_text', 'generated_audio_file', 'audio_metadata')
        }),
        ('AI Provider', {
            'fields': ('provider', 'model', 'tokens_used', 'cost_display', 'latency_ms')
        }),
        ('Quality & Training', {
            'fields': (
                'is_verified_good',
                'user_rating',
                'usage_count',
                'use_for_training',
                'training_tags'
            )
        }),
        ('Related Object', {
            'classes': ('collapse',),
            'fields': ('content_type', 'object_id')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'last_used_at')
        }),
    )
    
    def provider_model(self, obj):
        return f"{obj.provider}/{obj.model}"
    provider_model.short_description = "Provider/Model"
    
    def prompt_preview(self, obj):
        preview = obj.prompt_text[:80] + "..." if len(obj.prompt_text) > 80 else obj.prompt_text
        return preview
    prompt_preview.short_description = "Prompt"
    
    def created_at_display(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    created_at_display.short_description = "Created"
    
    def cost_display(self, obj):
        if obj.cost_estimate:
            return f"${obj.cost_estimate:.6f}"
        return "-"
    cost_display.short_description = "Cost"
    
    def mark_as_verified(self, request, queryset):
        count = queryset.update(is_verified_good=True, use_for_training=True)
        self.message_user(request, f"Marked {count} items as verified")
    mark_as_verified.short_description = "✓ Mark as Verified (Training)"
    
    def mark_for_training(self, request, queryset):
        count = queryset.update(use_for_training=True)
        self.message_user(request, f"Marked {count} items for training")
    mark_for_training.short_description = "🎓 Mark for Training"
    
    def unmark_verified(self, request, queryset):
        count = queryset.update(is_verified_good=False)
        self.message_user(request, f"Unmarked {count} items")
    unmark_verified.short_description = "✗ Unmark Verified"


@admin.register(AiTrainingData)
class AiTrainingDataAdmin(admin.ModelAdmin):
    list_display = [
        'memory_request_type', 'training_weight', 'difficulty_label',
        'human_verified', 'verified_by', 'included_in_training',
        'training_batch_id'
    ]
    list_filter = [
        'human_verified', 'included_in_training',
        'difficulty_label', 'training_batch_id'
    ]
    search_fields = ['memory_item__prompt_text', 'training_batch_id', 'notes']
    readonly_fields = ['verified_at', 'created_at']
    
    fieldsets = (
        ('Memory Item', {
            'fields': ('memory_item',)
        }),
        ('Training Configuration', {
            'fields': (
                'training_weight',
                'difficulty_label',
                'subject_tags'
            )
        }),
        ('Verification', {
            'fields': (
                'human_verified',
                'verified_by',
                'verified_at'
            )
        }),
        ('Training Status', {
            'fields': (
                'included_in_training',
                'training_batch_id',
                'training_date'
            )
        }),
        ('Notes', {
            'fields': ('notes', 'created_at')
        }),
    )
    
    def memory_request_type(self, obj):
        return obj.memory_item.request_type
    memory_request_type.short_description = "Request Type"


@admin.register(AiUsageLog)
class AiUsageLogAdmin(admin.ModelAdmin):
    list_display = [
        'timestamp_display', 'request_type', 'provider_model',
        'cache_hit_display', 'cost_display', 'latency_ms',
        'selection_mode', 'success'
    ]
    list_filter = [
        'request_type', 'provider', 'cache_hit',
        'selection_mode', 'success', 'timestamp'
    ]
    search_fields = ['endpoint', 'user__username', 'error_message']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'
    
    fieldsets = (
        ('Request Info', {
            'fields': ('request_type', 'endpoint', 'user', 'selection_mode')
        }),
        ('Provider', {
            'fields': ('provider', 'model', 'tokens_used')
        }),
        ('Performance', {
            'fields': ('latency_ms', 'cost_estimate', 'cache_hit', 'memory_item')
        }),
        ('Status', {
            'fields': ('success', 'error_message', 'timestamp')
        }),
    )
    
    def timestamp_display(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    timestamp_display.short_description = "Time"
    
    def provider_model(self, obj):
        return f"{obj.provider}/{obj.model}"
    provider_model.short_description = "Provider"
    
    def cache_hit_display(self, obj):
        if obj.cache_hit:
            return format_html('<span style="color: green;">✓ CACHE</span>')
        return format_html('<span style="color: orange;">➤ API</span>')
    cache_hit_display.short_description = "Source"
    
    def cost_display(self, obj):
        if obj.cost_estimate:
            return f"${obj.cost_estimate:.6f}"
        return "-"
    cost_display.short_description = "Cost"


@admin.register(AiModelTrainingRun)
class AiModelTrainingRunAdmin(admin.ModelAdmin):
    list_display = [
        'model_version', 'training_batch_id', 'status',
        'training_size', 'training_cost', 'is_active',
        'started_at_display'
    ]
    list_filter = ['status', 'is_active', 'training_provider']
    search_fields = ['model_version', 'training_batch_id', 'notes']
    readonly_fields = ['started_at', 'completed_at']
    
    fieldsets = (
        ('Model Info', {
            'fields': ('model_version', 'training_batch_id', 'status', 'is_active')
        }),
        ('Training Data', {
            'fields': (
                'training_size',
                'data_source_start_date',
                'data_source_end_date'
            )
        }),
        ('Training Config', {
            'fields': (
                'base_model',
                'training_provider',
                'training_config'
            )
        }),
        ('Cost & Duration', {
            'fields': (
                'training_cost',
                'training_duration_minutes'
            )
        }),
        ('Performance', {
            'fields': (
                'validation_accuracy',
                'validation_loss',
                'performance_notes'
            )
        }),
        ('Deployment', {
            'fields': ('deployed_at',)
        }),
        ('Timestamps', {
            'fields': ('started_at', 'completed_at')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
    )
    
    def started_at_display(self, obj):
        return obj.started_at.strftime('%Y-%m-%d')
    started_at_display.short_description = "Started"


# ===== CUSTOM ADMIN VIEWS FOR ANALYTICS =====

class AiDashboardAdmin(admin.ModelAdmin):
    """
    Custom admin view for AI cost analytics.
    Shows summary stats without a real model.
    """
    change_list_template = 'admin/ai_core/dashboard.html'
    
    def changelist_view(self, request, extra_context=None):
        # Calculate stats
        thirty_days_ago = timezone.now() - timedelta(days=30)
        seven_days_ago = timezone.now() - timedelta(days=7)
        
        # Last 30 days
        stats_30d = AiUsageLog.objects.filter(timestamp__gte=thirty_days_ago).aggregate(
            total_requests=Count('id'),
            total_cost=Sum('cost_estimate'),
            total_tokens=Sum('tokens_used'),
            cache_hits=Count('id', filter=models.Q(cache_hit=True)),
            avg_latency=Avg('latency_ms')
        )
        
        # Last 7 days
        stats_7d = AiUsageLog.objects.filter(timestamp__gte=seven_days_ago).aggregate(
            total_requests=Count('id'),
            total_cost=Sum('cost_estimate'),
            cache_hits=Count('id', filter=models.Q(cache_hit=True))
        )
        
        # Cache hit rate
        cache_hit_rate_30d = (stats_30d['cache_hits'] / stats_30d['total_requests'] * 100) if stats_30d['total_requests'] else 0
        cache_hit_rate_7d = (stats_7d['cache_hits'] / stats_7d['total_requests'] * 100) if stats_7d['total_requests'] else 0
        
        # Top expensive providers
        top_providers = AiUsageLog.objects.filter(
            timestamp__gte=thirty_days_ago
        ).values('provider', 'model').annotate(
            cost=Sum('cost_estimate'),
            requests=Count('id')
        ).order_by('-cost')[:10]
        
        # Training data readiness
        training_ready = AiMemory.objects.filter(
            is_verified_good=True,
            use_for_training=True
        ).count()
        
        extra_context = extra_context or {}
        extra_context.update({
            'stats_30d': stats_30d,
            'stats_7d': stats_7d,
            'cache_hit_rate_30d': round(cache_hit_rate_30d, 1),
            'cache_hit_rate_7d': round(cache_hit_rate_7d, 1),
            'top_providers': top_providers,
            'training_ready': training_ready,
        })
        
        return super().changelist_view(request, extra_context=extra_context)

# Note: To register dashboard, uncomment after creating template:
# admin.site.register(AiDashboard, AiDashboardAdmin)
