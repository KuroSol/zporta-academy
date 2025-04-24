from django.contrib import admin
from .models import Note

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'text', 'privacy', 'created_at']
    list_filter = ['privacy', 'created_at']
    search_fields = ['text', 'user__username']
