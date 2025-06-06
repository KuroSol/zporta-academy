# analytics/admin.py
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from .models import ActivityEvent, MemoryStat

@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_link', 'event_type_display', 'content_object_link', 'timestamp_formatted')
    list_filter = ('event_type', 'timestamp', 'content_type')
    search_fields = ('user__username', 'metadata__question_id', 'object_id')
    readonly_fields = ('timestamp',)

    def user_link(self, obj):
        if obj.user:
            link = reverse("admin:auth_user_change", args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', link, obj.user.username)
        return "N/A"
    user_link.short_description = 'User'
    user_link.admin_order_field = 'user'

    def event_type_display(self, obj):
        return obj.get_event_type_display()
    event_type_display.short_description = 'Event Type'
    event_type_display.admin_order_field = 'event_type'

    def content_object_link(self, obj):
        if obj.content_object:
            try:
                app_label = obj.content_type.app_label
                model_name = obj.content_type.model
                link = reverse(f"admin:{app_label}_{model_name}_change", args=[obj.content_object.id])
                return format_html('<a href="{}">{} (ID: {})</a>', link, str(obj.content_object), obj.object_id)
            except Exception:
                return f"{str(obj.content_object)} (Type: {obj.content_type.model}, ID: {obj.object_id})"
        return "N/A"
    content_object_link.short_description = 'Content Object'
    
    def timestamp_formatted(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    timestamp_formatted.admin_order_field = 'timestamp'
    timestamp_formatted.short_description = 'Timestamp'

@admin.register(MemoryStat)
class MemoryStatAdmin(admin.ModelAdmin):
    list_display = (
        'user', 
        'learnable_item_display', 
        'last_reviewed_at', 
        'next_review_at', 
        'interval_days', 
        'easiness_factor', 
        'repetitions',
        'current_retention_estimate',
        'updated_at'
    )
    list_filter = ('user', 'content_type', 'last_reviewed_at', 'next_review_at', 'current_retention_estimate')
    search_fields = ('user__username', 'object_id')
    readonly_fields = ('created_at', 'updated_at', 'learnable_item_admin_link')
    list_select_related = ('user', 'content_type') 
    ordering = ('-updated_at',)

    fieldsets = (
        (None, {'fields': ('user', ('content_type', 'object_id'), 'learnable_item_admin_link')}),
        ('Review State', {'fields': ('last_reviewed_at', 'next_review_at', 'current_retention_estimate')}),
        ('SM-2 Parameters', {'classes': ('collapse',),'fields': ('interval_days', 'easiness_factor', 'repetitions')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    def learnable_item_display(self, obj):
        if obj.learnable_item: return str(obj.learnable_item)[:100]
        return f"{obj.content_type.model if obj.content_type else 'N/A'} ID: {obj.object_id}"
    learnable_item_display.short_description = 'Learnable Item'

    def learnable_item_admin_link(self, obj):
        if obj.learnable_item:
            try:
                app_label = obj.content_type.app_label; model_name = obj.content_type.model
                url = reverse(f"admin:{app_label}_{model_name}_change", args=[obj.learnable_item.id])
                return format_html('<a href="{}">View {}</a>', url, model_name)
            except Exception: return "N/A (Link not available)"
        return "N/A"
    learnable_item_admin_link.short_description = 'Item Admin Link'
