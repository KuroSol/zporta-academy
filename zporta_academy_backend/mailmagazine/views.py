from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from django.core.mail import EmailMultiAlternatives
from bs4 import BeautifulSoup
from django.conf import settings
from django.utils import timezone
from django.db import models
from .models import TeacherMailMagazine, MailMagazineIssue, MailMagazineTemplate, MailMagazineAutomation
from .serializers import (
    TeacherMailMagazineSerializer, 
    MailMagazineTemplateSerializer,
    MailMagazineAutomationSerializer
)


class IsTeacherOrAdmin(BasePermission):
    """Allow access only to guides (teachers) or staff."""

    message = "Only teachers or admins can manage mail magazines."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
            return True
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None)
        return role in ('guide', 'both')


class TeacherMailMagazineViewSet(viewsets.ModelViewSet):
    serializer_class = TeacherMailMagazineSerializer
    permission_classes = [IsAuthenticated, IsTeacherOrAdmin]

    def get_queryset(self):
        return TeacherMailMagazine.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send email to selected recipients (only followers with mail magazine enabled)"""
        magazine = self.get_object()
        
        # Get followers (students with accepted guide relationships)
        from social.models import GuideRequest
        
        # Get recipients - only users who are following this teacher (accepted guide requests)
        accepted_followers = GuideRequest.objects.filter(
            guide=request.user,
            status='accepted'
        ).select_related('explorer', 'explorer__profile')
        
        # Get users who opted into mail magazine
        recipients = [
            gr.explorer for gr in accepted_followers 
            if hasattr(gr.explorer, 'profile') and gr.explorer.profile.mail_magazine_enabled
        ]
        
        # If specific recipients were selected, filter to only those who opted in
        if magazine.selected_recipients.exists():
            selected_ids = set(magazine.selected_recipients.values_list('id', flat=True))
            recipients = [r for r in recipients if r.id in selected_ids]
        
        if not recipients:
            return Response(
                {'error': 'No recipients found. Please select recipients or ensure students are enrolled in your courses.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Send emails
        recipient_emails = [user.email for user in recipients if user.email]
        
        if not recipient_emails:
            return Response(
                {'error': 'No valid email addresses found for recipients.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            # Create issue record first to get ID for "View in browser" link
            issue = MailMagazineIssue.objects.create(
                magazine=magazine,
                title=magazine.title,
                subject=magazine.subject,
                html_content='',  # Will update after building wrapper
            )
            issue.recipients.set(recipients)
            
            raw_html = magazine.body or ''
            raw_subject = magazine.subject or ''
            site_url = getattr(settings, 'SITE_URL', 'https://zportaacademy.com')
            view_in_browser_url = f"{site_url}/mail-magazines/{issue.id}"
            
            # Send personalized email to each recipient
            import re
            from django.utils.html import escape
            
            for recipient in recipients:
                # Build variables for placeholder replacement
                variables = {
                    'student_name': recipient.get_full_name() or recipient.username,
                    'student_username': recipient.username,
                    'teacher_name': request.user.get_full_name() or request.user.username,
                    'teacher_username': request.user.username,
                    'course_name': '',  # Not applicable for manual sends
                    'course_title': '',
                    'site_url': site_url,
                }
                
                # Replace placeholders in subject and body
                def render_placeholders(text):
                    pattern = re.compile(r'{{\s*([a-zA-Z0-9_]+)\s*}}')
                    return pattern.sub(lambda m: escape(variables.get(m.group(1), '')), text)
                
                personalized_subject = render_placeholders(raw_subject)
                personalized_html = render_placeholders(raw_html)
                
                # Build wrapper with "View in browser" link
                html_wrapper = f"""
                <html>
                  <body style='background:#0b1523;margin:0;padding:24px;font-family:Segoe UI,Arial,sans-serif;color:#ffffff;'>
                    <div style='max-width:600px;margin:0 auto;background:#142233;padding:32px;border-radius:8px;'>
                      <div style='background:#0b1523;padding:12px;text-align:center;margin:-32px -32px 24px;border-bottom:1px solid #1e293b;'>
                        <p style='margin:0;font-size:12px;color:#94a3b8;'>Having trouble viewing this email? <a href='{view_in_browser_url}' style='color:#ffb703;text-decoration:none;'>View in browser</a></p>
                      </div>
                      {personalized_html}
                      <hr style='border:none;border-top:1px solid #1f2e40;margin:32px 0;' />
                      <p style='font-size:12px;color:#94a3b8;margin:0;'>You are receiving this because you subscribed to this teacher's mail magazine.</p>
                      <p style='font-size:12px;color:#94a3b8;margin:8px 0 0;'>Manage preferences: <a href='https://zportaacademy.com/preferences/mail-magazines' style='color:#ffb703;'>Click here</a></p>
                    </div>
                  </body>
                </html>
                """.strip()
                
                plain_text = BeautifulSoup(personalized_html, 'html.parser').get_text(separator='\n', strip=True)
                email = EmailMultiAlternatives(
                    subject=personalized_subject,
                    body=plain_text,
                    from_email=settings.EMAIL_HOST_USER,
                    to=[recipient.email],
                )
                email.attach_alternative(html_wrapper, "text/html")
                email.send(fail_silently=False)
            
            # Update issue with final HTML (store template version)
            issue.html_content = raw_html
            issue.save(update_fields=['html_content'])

            # Update last sent timestamp and increment counter
            magazine.last_sent_at = timezone.now()
            magazine.times_sent += 1
            magazine.save(update_fields=['last_sent_at', 'times_sent'])

            return Response({
                'success': True,
                'message': f'Email sent successfully to {len(recipient_emails)} recipients.',
                'recipients_count': len(recipient_emails)
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to send email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView, ListAPIView
from .serializers import MailMagazineIssueSerializer
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404


class MailMagazineIssueDetailView(RetrieveAPIView):
    """
    View a sent mail magazine issue.
    Access: teacher who sent it, recipients, or anyone if is_public=True
    """
    queryset = MailMagazineIssue.objects.all()
    serializer_class = MailMagazineIssueSerializer
    permission_classes = [IsAuthenticated]
    
    def retrieve(self, request, *args, **kwargs):
        issue = self.get_object()
        user = request.user
        
        # Check access: teacher, recipient, or public
        is_teacher = issue.magazine.teacher == user
        is_recipient = issue.recipients.filter(id=user.id).exists()
        is_public = issue.is_public
        
        if not (is_teacher or is_recipient or is_public):
            return Response(
                {'error': 'You do not have permission to view this issue.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(issue)
        return Response(serializer.data)


class TeacherMailMagazineIssuesListView(ListAPIView):
    """
    List all mail magazine issues by a specific teacher.
    Access: Only shows issues where logged-in user is a recipient or if is_public=True
    """
    serializer_class = MailMagazineIssueSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        username = self.kwargs.get('username')
        teacher = get_object_or_404(User, username=username)
        user = self.request.user
        
        # Get all issues by this teacher
        issues = MailMagazineIssue.objects.filter(magazine__teacher=teacher)
        
        # Filter to only issues the user can access
        # (where user is recipient OR issue is public OR user is the teacher)
        if user == teacher:
            # Teacher sees all their issues
            return issues
        else:
            # Others see only issues they received or public ones
            return issues.filter(
                models.Q(recipients=user) | models.Q(is_public=True)
            ).distinct()


class MailMagazineTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing email templates
    """
    serializer_class = MailMagazineTemplateSerializer
    permission_classes = [IsAuthenticated, IsTeacherOrAdmin]
    
    def get_queryset(self):
        return MailMagazineTemplate.objects.filter(created_by=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def list(self, request, *args, **kwargs):
        """Return user's templates. If none exist, auto-provision default set.

        This avoids empty UI states and gives immediate usable, styled templates.
        """
        qs = self.get_queryset()
        if not qs.exists():
            # Default starter templates (subjects/bodies include variables)
            defaults = [
                {
                    'name': 'Thank You for Attending',
                    'template_type': 'thank_attend',
                    'subject': 'Thank you for attending!',
                    'body': (
                        "<h2 style='color:#ffb703;'>Thank You for Attending!</h2>"
                        "<p>Hello {{student_name}},</p>"
                        "<p>I appreciate you taking time to visit my guide page. Your interest means a lot!"\
                        " Feel free to explore more resources and reach out with any questions.</p>"
                        "<p>Warm regards,<br/>{{teacher_name}}</p>"
                    ),
                },
                {
                    'name': 'Welcome Enrollment',
                    'template_type': 'welcome_enroll',
                    'subject': 'Welcome to {{course_name}}!',
                    'body': (
                        "<h2 style='color:#ffb703;'>Welcome to {{course_name}}!</h2>"
                        "<p>Hello {{student_name}},</p>"
                        "<p>Thrilled to have you onboard. Start with the intro module and set your learning goals."\
                        " I'm here if you need support.</p>"
                        "<p>To your success,<br/>{{teacher_name}}</p>"
                    ),
                },
                {
                    'name': 'Thank You for Purchase',
                    'template_type': 'thank_purchase',
                    'subject': 'Thank you for your purchase!',
                    'body': (
                        "<h2 style='color:#ffb703;'>Thank You for Your Purchase!</h2>"
                        "<p>Hello {{student_name}},</p>"
                        "<p>Thanks for purchasing {{course_name}}. Dive into the first lesson when ready."\
                        " Let me know if you need onboarding help.</p>"
                        "<p>Best,<br/>{{teacher_name}}</p>"
                    ),
                },
                {
                    'name': 'Course Completion Congratulations',
                    'template_type': 'completion',
                    'subject': 'Congratulations on completing {{course_name}}!',
                    'body': (
                        "<h2 style='color:#ffb703;'>🎉 Congratulations!</h2>"
                        "<p>Hi {{student_name}},</p>"
                        "<p>You just completed {{course_name}} — outstanding work! Consider leaving a review and exploring advanced courses.</p>"
                        "<p>Keep growing,<br/>{{teacher_name}}</p>"
                    ),
                },
                {
                    'name': 'Custom Blank Template',
                    'template_type': 'custom',
                    'subject': 'Your custom message',
                    'body': (
                        "<h2 style='color:#ffb703;'>Your Custom Message</h2>"
                        "<p>Hello {{student_name}},</p>"
                        "<p>Write your personalized content here...</p>"
                        "<p>Regards,<br/>{{teacher_name}}</p>"
                    ),
                },
            ]
            created = []
            for item in defaults:
                created.append(MailMagazineTemplate.objects.create(
                    created_by=request.user,
                    **item
                ))
            qs = MailMagazineTemplate.objects.filter(id__in=[t.id for t in created])
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class MailMagazineAutomationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing email automation rules
    """
    serializer_class = MailMagazineAutomationSerializer
    permission_classes = [IsAuthenticated, IsTeacherOrAdmin]
    
    def get_queryset(self):
        return MailMagazineAutomation.objects.filter(teacher=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

