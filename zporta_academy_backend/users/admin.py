from django.contrib import admin
from django.contrib.auth.models import User
from .models import Profile
from .activity_models import UserActivity

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


@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'activity_type', 'points', 'created_at']
    list_filter = ['role', 'activity_type', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

