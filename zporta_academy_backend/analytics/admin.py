# analytics/admin.py
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from .models import ActivityEvent, MemoryStat, QuizSessionProgress

@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    actions = ['export_lesson_completions_csv', 'export_quiz_completions_csv', 'export_course_completions_csv']

    def export_lesson_completions_csv(self, request, queryset):
        import csv
        from django.http import HttpResponse
        lesson_events = queryset.filter(event_type='lesson_completed')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=lesson_completions.csv'
        writer = csv.writer(response)
        writer.writerow(['User', 'Lesson', 'Timestamp'])
        for event in lesson_events:
            user = event.user.username if event.user else 'Anonymous'
            lesson = str(event.content_object) if event.content_object else f'ID {event.object_id}'
            writer.writerow([user, lesson, event.timestamp.strftime('%Y-%m-%d %H:%M:%S')])
        return response
    export_lesson_completions_csv.short_description = "Export selected lesson completions as CSV"

    def export_quiz_completions_csv(self, request, queryset):
        import csv
        from django.http import HttpResponse
        quiz_events = queryset.filter(event_type='quiz_completed')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=quiz_completions.csv'
        writer = csv.writer(response)
        writer.writerow(['User', 'Quiz', 'Timestamp'])
        for event in quiz_events:
            user = event.user.username if event.user else 'Anonymous'
            quiz = str(event.content_object) if event.content_object else f'ID {event.object_id}'
            writer.writerow([user, quiz, event.timestamp.strftime('%Y-%m-%d %H:%M:%S')])
        return response
    export_quiz_completions_csv.short_description = "Export selected quiz completions as CSV"

    def export_course_completions_csv(self, request, queryset):
        import csv
        from django.http import HttpResponse
        course_events = queryset.filter(event_type='course_completed')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=course_completions.csv'
        writer = csv.writer(response)
        writer.writerow(['User', 'Course', 'Timestamp'])
        for event in course_events:
            user = event.user.username if event.user else 'Anonymous'
            course = str(event.content_object) if event.content_object else f'ID {event.object_id}'
            writer.writerow([user, course, event.timestamp.strftime('%Y-%m-%d %H:%M:%S')])
        return response
    export_course_completions_csv.short_description = "Export selected course completions as CSV"
    """
    Admin configuration for the ActivityEvent model.
    This model logs various user interactions throughout the platform.
    """
    list_display = ('id', 'user_link', 'event_type_display', 'content_object_link', 'timestamp_formatted', 'session_id')
    list_filter = ('event_type', 'timestamp', 'content_type')

    class CompletionEventFilter(admin.SimpleListFilter):
        title = 'Completion Type'
        parameter_name = 'completion_type'

        def lookups(self, request, model_admin):
            return [
                ('lesson_completed', 'Lesson Completed'),
                ('quiz_completed', 'Quiz Completed'),
                ('course_completed', 'Course Completed'),
            ]

        def queryset(self, request, queryset):
            value = self.value()
            if value:
                return queryset.filter(event_type=value)
            return queryset

    # Add the filter class to list_filter after its definition
    list_filter = ('event_type', 'timestamp', 'content_type', CompletionEventFilter)
    search_fields = ('user__username', 'object_id', 'session_id', 'content_object__title')
    readonly_fields = ('timestamp',)
    list_select_related = ('user', 'content_type')

    class CompletionEventFilter(admin.SimpleListFilter):
        title = 'Completion Type'
        parameter_name = 'completion_type'

        def lookups(self, request, model_admin):
            return [
                ('lesson_completed', 'Lesson Completed'),
                ('quiz_completed', 'Quiz Completed'),
                ('course_completed', 'Course Completed'),
            ]

        def queryset(self, request, queryset):
            value = self.value()
            if value:
                return queryset.filter(event_type=value)
            return queryset

    def get_help_text(self, request):
        return (
            "<b>Tip:</b> Use the 'Completion Type' filter to view only lesson, quiz, or course completions. "
            "To undo a user's completion, simply delete the corresponding event record."
        )

    def user_link(self, obj):
        if obj.user:
            link = reverse("admin:auth_user_change", args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', link, obj.user.username)
        return "System/Anonymous"
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
                # Fallback if a reverse URL match fails for any reason
                return f"{str(obj.content_object)} (Type: {obj.content_type.model}, ID: {obj.object_id})"
        return "N/A"
    content_object_link.short_description = 'Content Object'
    
    def timestamp_formatted(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    timestamp_formatted.admin_order_field = 'timestamp'
    timestamp_formatted.short_description = 'Timestamp'

@admin.register(QuizSessionProgress)
class QuizSessionProgressAdmin(admin.ModelAdmin):
    """
    Admin configuration for the QuizSessionProgress model.
    This tracks the state of a single quiz attempt from start to completion.
    """
    list_display = ('session_id', 'user', 'quiz', 'status', 'answered_count', 'correct_count', 'total_questions', 'started_at', 'completed_at')
    list_filter = ('status', 'quiz', 'user')
    search_fields = ('session_id', 'user__username', 'quiz__title')
    readonly_fields = ('started_at', 'completed_at')
    list_select_related = ('user', 'quiz')

@admin.register(MemoryStat)
class MemoryStatAdmin(admin.ModelAdmin):
    """
    Admin configuration for the MemoryStat model.
    This tracks spaced repetition data for users and learnable items.
    """
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
    list_filter = ('user', 'content_type', 'last_reviewed_at', 'next_review_at')
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
        if obj.learnable_item: 
            return str(obj.learnable_item)[:100]
        return f"{obj.content_type.model if obj.content_type else 'N/A'} ID: {obj.object_id}"
    learnable_item_display.short_description = 'Learnable Item'

    def learnable_item_admin_link(self, obj):
        if obj.learnable_item:
            try:
                app_label = obj.content_type.app_label
                model_name = obj.content_type.model
                url = reverse(f"admin:{app_label}_{model_name}_change", args=[obj.learnable_item.id])
                return format_html('<a href="{}">View {}</a>', url, model_name)
            except Exception: 
                return "N/A (Link not available)"
        return "N/A"
    learnable_item_admin_link.short_description = 'Item Admin Link'
