# enrollment/admin.py
from django.contrib import admin
from .models import Enrollment

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'content_object', 'enrollment_type', 'status', 'enrollment_date')
    list_filter = ('enrollment_type', 'status', 'enrollment_date')
    search_fields = ('user__username',)
