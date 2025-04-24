from django.contrib import admin
from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'created_at', 'calculate_seo_score')
    search_fields = ('title', 'permalink', 'seo_title', 'focus_keyword')
    list_filter = ('created_at',)

    fieldsets = (
        ('Content', {
            'fields': ('title', 'permalink', 'content')
        }),
        ('SEO Metadata', {
            'fields': (
                'seo_title', 'seo_description', 'focus_keyword',
                'canonical_url', 'og_title', 'og_description', 'og_image'
            )
        }),
    )

    readonly_fields = ('calculate_seo_score',)

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
