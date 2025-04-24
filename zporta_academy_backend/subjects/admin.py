from django.contrib import admin
from .models import Subject

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'permalink', 'created_by', 'created_at']
    search_fields = ['name', 'permalink']
    list_filter = ['created_at', 'created_by']
    readonly_fields = ['permalink']  # Ensure permalink is not editable manually

    def save_model(self, request, obj, form, change):
        if not obj.pk:  # Set the creator only when the object is first created
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
