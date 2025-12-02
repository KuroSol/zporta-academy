from django.contrib import admin
from django.contrib.auth.models import User
from .models import Profile
from .activity_models import UserActivity
from .guide_application_models import GuideApplicationRequest
from .invitation_models import TeacherInvitation

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profiles"
    fields = ('role', 'active_guide', 'can_invite_teachers', 'bio', 'profile_image')

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


@admin.register(GuideApplicationRequest)
class GuideApplicationRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'subjects_to_teach', 'status', 'referred_by', 'created_at', 'reviewed_by']
    list_filter = ['status', 'created_at', 'reviewed_at']
    search_fields = ['user__username', 'user__email', 'subjects_to_teach', 'motivation']
    readonly_fields = ['created_at', 'updated_at', 'reviewed_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    fieldsets = (
        ('Applicant Info', {
            'fields': ('user', 'referred_by')
        }),
        ('Application Details', {
            'fields': ('motivation', 'experience', 'subjects_to_teach')
        }),
        ('Review', {
            'fields': ('status', 'reviewed_by', 'reviewed_at', 'admin_notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['approve_applications', 'reject_applications']
    
    def approve_applications(self, request, queryset):
        count = 0
        for application in queryset.filter(status='pending'):
            application.approve(request.user)
            count += 1
        self.message_user(request, f"Approved {count} guide application(s).")
    approve_applications.short_description = "Approve selected applications"
    
    def reject_applications(self, request, queryset):
        count = 0
        for application in queryset.filter(status='pending'):
            application.reject(request.user)
            count += 1
        self.message_user(request, f"Rejected {count} guide application(s).")
    reject_applications.short_description = "Reject selected applications"


@admin.register(TeacherInvitation)
class TeacherInvitationAdmin(admin.ModelAdmin):
    list_display = ['inviter', 'invitee_email', 'invitee', 'status', 'created_at', 'expires_at']
    list_filter = ['status', 'created_at', 'expires_at']
    search_fields = ['inviter__username', 'invitee_email', 'invitee__username']
    readonly_fields = ['token', 'created_at', 'accepted_at', 'expires_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    fieldsets = (
        ('Invitation Info', {
            'fields': ('inviter', 'invitee_email', 'invitee', 'token')
        }),
        ('Message', {
            'fields': ('personal_message',)
        }),
        ('Status', {
            'fields': ('status', 'created_at', 'accepted_at', 'expires_at')
        }),
    )
    
    def has_add_permission(self, request):
        # Prevent creating invitations through admin
        return False
