from django.contrib import admin
from .models import Page, Snippet
from django import forms

class PageAdminForm(forms.ModelForm):
    """
    Custom admin form for the Page model to include a Textarea for the 'content' field 
    and support SEO-related fields.
    """
    class Meta:
        model = Page
        fields = '__all__'
        widgets = {
            'content': forms.Textarea(attrs={'rows': 20, 'cols': 80}),  # Use Textarea instead of CKEditor
        }

@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    """
    Custom admin configuration for the Page model with SEO fields.
    """
    form = PageAdminForm
    list_display = ('title', 'permalink', 'created_by', 'created_at')
    search_fields = ('title', 'permalink', 'content')
    list_filter = ('created_at',)
    readonly_fields = ('created_by', 'created_at')
    
    # Group fields into logical sections for better admin UI organization
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'permalink', 'content'),
        }),
        ('SEO Settings', {
            'fields': (
                'seo_title', 'seo_description', 'focus_keyword', 
                'canonical_url', 'og_title', 'og_description', 'og_image'
            ),
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at'),
        }),
    )

    def save_model(self, request, obj, form, change):
        """
        Override save_model to automatically set the created_by field to the current user.
        """
        if not obj.pk:  # If the object is being created
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(Snippet)
class SnippetAdmin(admin.ModelAdmin):
    """
    Admin configuration for Snippet model.
    """
    list_display = ('name', 'created_at', 'updated_at')
    search_fields = ('name',)
    list_filter = ('created_at', 'updated_at')
