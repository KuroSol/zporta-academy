from django.contrib import admin
from .models import Asset


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ['id', 'kind', 'original_filename', 'suggested_name', 'provider', 'created_at']
    list_filter = ['kind', 'created_at', 'provider']
    search_fields = ['original_filename', 'suggested_name', 'provider']
    readonly_fields = ['id', 'created_at', 'suggested_name', 'get_url', 'get_path']
    
    fieldsets = (
        ('Metadata', {
            'fields': ('id', 'kind', 'original_filename', 'suggested_name', 'provider')
        }),
        ('File', {
            'fields': ('file', 'get_url', 'get_path')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
    
    def get_url(self, obj):
        """Display the URL in admin."""
        return obj.get_url() or 'No file'
    get_url.short_description = 'URL'
    
    def get_path(self, obj):
        """Display the path in admin."""
        return obj.get_path() or 'No file'
    get_path.short_description = 'Path'
