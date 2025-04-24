from django.contrib import admin
from .models import ManagedImage

@admin.register(ManagedImage)
class ManagedImageAdmin(admin.ModelAdmin):
    list_display = ['image', 'uploaded_at', 'uploaded_by']
    readonly_fields = ['uploaded_at', 'uploaded_by']

    def save_model(self, request, obj, form, change):
        if not obj.pk:  # Ensures that this is a new object
            obj.uploaded_by = request.user  # Set the user on initial save
        super().save_model(request, obj, form, change)
