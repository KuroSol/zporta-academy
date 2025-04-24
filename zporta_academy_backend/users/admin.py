from django.contrib import admin
from django.contrib.auth.models import User
from .models import Profile

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profiles"

class UserAdmin(admin.ModelAdmin):
    inlines = (ProfileInline,)
    list_display = ("username", "email", "date_joined", "is_active")
    search_fields = ("username", "email")

admin.site.unregister(User)
admin.site.register(User, UserAdmin)

    #list_display = ['user', 'role', 'active_guide', 'created_at']
    #list_filter = ['role', 'active_guide']
