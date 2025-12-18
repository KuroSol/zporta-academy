from django.apps import AppConfig


class BulkImportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bulk_import'

    def ready(self):
        # Register the admin index hook to show Quiz Import link
        from django.contrib import admin
        from django.urls import reverse
        
        original_index = admin.AdminSite.index
        
        def custom_index(self, request, extra_context=None):
            if extra_context is None:
                extra_context = {}
            try:
                quiz_import_url = reverse('admin:bulk_import_quiz_upload')
                extra_context['quiz_import_url'] = quiz_import_url
            except Exception:
                pass
            return original_index(self, request, extra_context)
        
        admin.AdminSite.index = custom_index
