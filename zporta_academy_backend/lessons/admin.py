from django.contrib import admin
from .models import Lesson
from .forms import LessonAdminForm

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    form = LessonAdminForm
    list_display = ['title', 'video_url', 'permalink', 'subject', 'created_by']
    list_filter = ['subject', 'created_by']
    search_fields = ['title', 'content']

    def save_model(self, request, obj, form, change):
        # Ensure the permalink is generated if not already set
        if not obj.permalink:
            obj.save()
        super().save_model(request, obj, form, change)
