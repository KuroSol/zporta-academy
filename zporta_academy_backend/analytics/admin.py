# analytics/admin.py
from django.contrib import admin
from .models import ActivityEvent

@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'event_type', 'timestamp')
    list_filter = ('event_type', 'timestamp')
    search_fields = ('user__username', 'metadata')
