from django.contrib import admin
from .models import Mention

@admin.register(Mention)
class MentionAdmin(admin.ModelAdmin):
    list_display = ('user', 'note', 'is_read', 'created_at')
    search_fields = ('user__username', 'note__text')
