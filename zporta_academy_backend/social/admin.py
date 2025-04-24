# social/admin.py
from django.contrib import admin
from .models import GuideRequest

@admin.register(GuideRequest)
class GuideRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'explorer', 'guide', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('explorer__username', 'guide__username')
