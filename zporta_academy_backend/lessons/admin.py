from django.contrib import admin
from .models import Lesson, LessonTemplate


@admin.register(LessonTemplate)
class LessonTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'accent_color']
    search_fields = ['name', 'description']
    fields         = ['name', 'description', 'accent_color', 'predefined_css']

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'video_url', 'permalink', 'subject', 'created_by']
    list_filter = ['subject', 'created_by']
    search_fields = ['title', 'content']

    def save_model(self, request, obj, form, change):
        # Ensure the permalink is generated if not already set
        if not obj.permalink:
            obj.save()
        super().save_model(request, obj, form, change)

