from django.contrib import admin
from django.core.mail import EmailMessage, EmailMultiAlternatives
from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib import messages
from django.utils.html import format_html
from .models import TeacherMailMagazine, MailMagazineIssue, MailMagazineTemplate, MailMagazineAutomation
from social.models import GuideRequest
from django.utils import timezone


@admin.register(TeacherMailMagazine)
class TeacherMailMagazineAdmin(admin.ModelAdmin):
    list_display = ['title', 'teacher', 'frequency', 'is_active', 'last_sent_at', 'created_at', 'recipient_count']
    list_filter = ['frequency', 'is_active']
    search_fields = ['title', 'subject']
    readonly_fields = ['created_at', 'updated_at', 'last_sent_at', 'recipient_count', 'attendee_list_display', 'teacher']
    actions = ['send_mail_magazine']
    filter_horizontal = ['selected_recipients']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('teacher', 'title', 'subject', 'body')
        }),
        ('Schedule Settings', {
            'fields': ('frequency', 'send_at', 'is_active')
        }),
        ('Recipients Selection', {
            'fields': ('selected_recipients', 'recipient_count', 'attendee_list_display'),
            'description': 'Select specific attendees or leave empty to send to all. Attendees are students who have accepted guide requests.'
        }),
        ('Timestamps', {
            'fields': ('last_sent_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Only show mail magazines created by the logged-in user"""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(teacher=request.user)
    
    def save_model(self, request, obj, form, change):
        """Automatically set teacher to the logged-in user"""
        if not change:  # Only set on create
            obj.teacher = request.user
        super().save_model(request, obj, form, change)

    def get_attendee_data(self, obj):
        """Helper method to get attendee emails and user info from accepted guide requests"""
        accepted_requests = GuideRequest.objects.filter(
            guide=obj.teacher,
            status='accepted'
        ).select_related('explorer')
        
        attendees = {}
        for request in accepted_requests:
            if request.explorer.email:
                attendees[request.explorer.id] = {
                    'id': request.explorer.id,
                    'username': request.explorer.username,
                    'email': request.explorer.email,
                    'full_name': f"{request.explorer.first_name} {request.explorer.last_name}".strip() or request.explorer.username
                }
        return list(attendees.values())

    def recipient_count(self, obj):
        """Count attendees that will receive this mail magazine"""
        if obj.selected_recipients.exists():
            return obj.selected_recipients.filter(email__isnull=False).exclude(email='').count()
        return len(self.get_attendee_data(obj))
    recipient_count.short_description = 'Will Send To'
    
    def attendee_list_display(self, obj):
        """Display formatted list of all attendees (privacy-friendly: no emails shown)"""
        all_attendees = self.get_attendee_data(obj)
        
        if not all_attendees:
            return format_html('<em style="color: #999;">No attendees yet (students need to send guide request and be accepted)</em>')
        
        selected_ids = set(obj.selected_recipients.values_list('id', flat=True)) if obj.pk else set()
        
        html_parts = ['<div style="max-height: 400px; overflow-y: auto; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">']
        
        if selected_ids:
            html_parts.append(f'<strong>Sending to: {len(selected_ids)} selected attendee(s)</strong><br>')
            html_parts.append(f'<em style="color: #666;">Total available: {len(all_attendees)} attendee(s)</em><br><br>')
        else:
            html_parts.append(f'<strong>Sending to: All {len(all_attendees)} attendee(s)</strong><br>')
            html_parts.append(f'<em style="color: #666;">(No specific selection - will send to all)</em><br><br>')
        
        html_parts.append('<ol style="margin: 0; padding-left: 20px;">')
        
        for attendee in sorted(all_attendees, key=lambda x: x['full_name'].lower()):
            full_name = attendee['full_name']
            username = attendee['username']
            is_selected = attendee['id'] in selected_ids
            
            style = 'margin-bottom: 8px;'
            if selected_ids and is_selected:
                style += ' background: #e8f5e9; padding: 8px; border-radius: 4px; border-left: 3px solid #4caf50;'
            elif selected_ids and not is_selected:
                style += ' opacity: 0.5;'
            
            # Privacy: Only show username and display name, no email addresses
            if full_name != username:
                html_parts.append(
                    f'<li style="{style}">'
                    f'<strong>{full_name}</strong> '
                    f'<span style="color: #666;">(@{username})</span>'
                    f'{" ✓ Selected" if selected_ids and is_selected else ""}'
                    f'</li>'
                )
            else:
                html_parts.append(
                    f'<li style="{style}">'
                    f'<strong>@{username}</strong>'
                    f'{" ✓ Selected" if selected_ids and is_selected else ""}'
                    f'</li>'
                )
        
        html_parts.append('</ol>')
        html_parts.append('<p style="margin-top: 10px; color: #666; font-size: 12px; font-style: italic;">🔒 Email addresses are hidden for privacy. Users will receive notifications through the app.</p>')
        html_parts.append('</div>')
        return format_html(''.join(html_parts))
    
    attendee_list_display.short_description = 'Attendee List (Guide Request Accepted)'

    def send_mail_magazine(self, request, queryset):
        """Send mail magazine to selected attendees or all attendees"""
        for magazine in queryset:
            # If specific recipients are selected, use those
            if magazine.selected_recipients.exists():
                selected_users = magazine.selected_recipients.filter(
                    email__isnull=False
                ).exclude(email='')
                recipient_emails = [user.email for user in selected_users]
                recipient_users = list(selected_users)
                recipient_type = 'selected attendees'
            else:
                # Otherwise, send to all attendees
                attendees = self.get_attendee_data(magazine)
                recipient_emails = [a['email'] for a in attendees]
                recipient_ids = [a['id'] for a in attendees]
                from django.contrib.auth import get_user_model
                User = get_user_model()
                recipient_users = User.objects.filter(id__in=recipient_ids)
                recipient_type = 'all attendees'
            
            if not recipient_emails:
                self.message_user(
                    request,
                    f"No recipients found for '{magazine.title}' - please select attendees or ensure you have accepted guide requests",
                    level=messages.WARNING
                )
                continue
            
            try:
                # Create issue record first to get ID for "View in browser" link
                issue = MailMagazineIssue.objects.create(
                    magazine=magazine,
                    title=magazine.title,
                    subject=magazine.subject,
                    html_content='',  # Will update after building wrapper
                )
                issue.recipients.set(recipient_users)
                
                # Prepare HTML wrapper with "View in browser" link
                html_body = magazine.body or ''
                site_url = getattr(settings, 'SITE_URL', 'https://zportaacademy.com')
                view_in_browser_url = f"{site_url}/mail-magazines/{issue.id}"
                
                html_wrapper = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #0b1523; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <div style="max-width: 600px; margin: 20px auto; background-color: #142233; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
                        <div style="background-color: #0b1523; padding: 12px; text-align: center; border-bottom: 1px solid #1e293b;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                                Having trouble viewing this email? <a href="{view_in_browser_url}" style="color: #ffb703; text-decoration: none;">View in browser</a>
                            </p>
                        </div>
                        <div style="background: linear-gradient(135deg, #ffb703 0%, #fb8500 100%); padding: 24px; text-align: center;">
                            <h1 style="margin: 0; color: #0b1523; font-size: 24px; font-weight: 600;">{magazine.title}</h1>
                        </div>
                        <div style="padding: 32px 24px; color: #e2e8f0;">
                            {html_body}
                        </div>
                        <div style="background-color: #0b1523; padding: 20px 24px; text-align: center; border-top: 1px solid #1e293b;">
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                                You received this because you're an attendee of {magazine.teacher.username}
                            </p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                # Update issue with final HTML content
                issue.html_content = html_wrapper
                issue.save(update_fields=['html_content'])
                
                plain_body = BeautifulSoup(html_body, 'html.parser').get_text(separator='\n', strip=True)
                email = EmailMultiAlternatives(
                    subject=magazine.subject,
                    body=plain_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[settings.DEFAULT_FROM_EMAIL],
                    bcc=recipient_emails,
                )
                email.attach_alternative(html_wrapper, "text/html")
                email.send(fail_silently=False)
                
                magazine.last_sent_at = timezone.now()
                magazine.save(update_fields=['last_sent_at'])
                
                self.message_user(
                    request,
                    f"Successfully sent '{magazine.title}' to {len(recipient_emails)} {recipient_type}",
                    level=messages.SUCCESS
                )
            except Exception as e:
                self.message_user(
                    request,
                    f"Error sending '{magazine.title}': {str(e)}",
                    level=messages.ERROR
                )
    
    send_mail_magazine.short_description = "Send selected mail magazines"
    
    def formfield_for_manytomany(self, db_field, request, **kwargs):
        """Filter the selected_recipients dropdown to show only attendees of the logged-in user"""
        if db_field.name == "selected_recipients":
            # Use the logged-in user as the teacher
            teacher = request.user
            
            # Only show accepted attendees (explorers who have accepted guide requests)
            accepted_explorer_ids = GuideRequest.objects.filter(
                guide=teacher,
                status='accepted'
            ).values_list('explorer_id', flat=True)
            
            from django.contrib.auth import get_user_model
            User = get_user_model()
            kwargs["queryset"] = User.objects.filter(
                id__in=accepted_explorer_ids
            ).order_by('first_name', 'last_name', 'username')
                
        return super().formfield_for_manytomany(db_field, request, **kwargs)


@admin.register(MailMagazineTemplate)
class MailMagazineTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'template_type', 'created_by', 'is_active', 'created_at']
    list_filter = ['template_type', 'is_active', 'created_at']
    search_fields = ['name', 'subject', 'body']
    readonly_fields = ['created_by', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Template Information', {
            'fields': ('name', 'template_type', 'is_active'),
        }),
        ('Email Content', {
            'fields': ('subject', 'body'),
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Only show templates created by the logged-in user"""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(created_by=request.user)
    
    def save_model(self, request, obj, form, change):
        """Automatically set created_by to the logged-in user"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(MailMagazineAutomation)
class MailMagazineAutomationAdmin(admin.ModelAdmin):
    list_display = ['name', 'trigger_type', 'teacher', 'is_active', 'template', 'created_at']
    list_filter = ['trigger_type', 'is_active', 'created_at']
    search_fields = ['name', 'subject', 'body']
    readonly_fields = ['teacher', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Automation Settings', {
            'fields': ('name', 'trigger_type', 'is_active'),
        }),
        ('Email Content', {
            'fields': ('template', 'subject', 'body'),
            'description': 'Choose a template OR write custom content. Custom content overrides template.'
        }),
        ('Filters (Optional)', {
            'fields': ('specific_course',),
            'description': 'Restrict this automation to specific items. Leave empty to apply to all.'
        }),
        ('Metadata', {
            'fields': ('teacher', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Only show automations created by the logged-in user"""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(teacher=request.user)
    
    def save_model(self, request, obj, form, change):
        """Automatically set teacher to the logged-in user"""
        if not change:
            obj.teacher = request.user
        super().save_model(request, obj, form, change)
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Filter templates to show only those created by the current user"""
        if db_field.name == "template":
            kwargs["queryset"] = MailMagazineTemplate.objects.filter(
                created_by=request.user,
                is_active=True
            )
        if db_field.name == "specific_course":
            from courses.models import Course
            kwargs["queryset"] = Course.objects.filter(created_by=request.user)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

