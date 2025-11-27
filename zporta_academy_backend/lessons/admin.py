from django.contrib import admin
from .models import Lesson, LessonTemplate, LessonCompletion


@admin.register(LessonTemplate)
class LessonTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'accent_color']
    search_fields = ['name', 'description']
    fields         = ['name', 'description', 'accent_color', 'predefined_css']

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'video_url', 'permalink', 'subject', 'created_by']
    list_filter = ['subject', 'created_by', 'tags']
    search_fields = ['title', 'content']
    filter_horizontal = ('tags',)

    def save_model(self, request, obj, form, change):
        # Ensure the permalink is generated if not already set
        if not obj.permalink:
            obj.save()
        super().save_model(request, obj, form, change)

@admin.register(LessonCompletion)
class LessonCompletionAdmin(admin.ModelAdmin):
    list_display = ['user', 'lesson', 'completed_at']
    list_filter = ['user', 'completed_at', 'lesson__course']
    search_fields = ['user__username', 'lesson__title']
    readonly_fields = ['completed_at']
    ordering = ['-completed_at']
    
    def has_add_permission(self, request):
        # Prevent manual creation - completions should only be created via API
        return False


