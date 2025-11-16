# enrollment/admin.py
from django.contrib import admin
from .models import Enrollment, CourseCompletion

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'content_object', 'enrollment_type', 'status', 'enrollment_date')
    list_filter = ('enrollment_type', 'status', 'enrollment_date')
    search_fields = ('user__username',)


@admin.register(CourseCompletion)
class CourseCompletionAdmin(admin.ModelAdmin):
    list_display = ('user', 'course', 'completed_at')
    list_filter = ('user', 'completed_at', 'course__subject')
    search_fields = ('user__username', 'course__title')
    readonly_fields = ('completed_at',)
    ordering = ('-completed_at',)

    def has_add_permission(self, request):
        # Prevent manual creation - completions should only be created via system logic/API
        return False
