from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from django.core.mail import EmailMultiAlternatives
from bs4 import BeautifulSoup
from django.conf import settings
from django.utils import timezone
from .models import TeacherMailMagazine
from .serializers import TeacherMailMagazineSerializer


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
        """Send email to selected recipients"""
        magazine = self.get_object()
        
        # Get recipients
        recipients = list(magazine.selected_recipients.all())
        
        # If no specific recipients, get all enrolled students from teacher's courses
        if not recipients:
            from enrollment.models import Enrollment
            from courses.models import Course
            from django.contrib.contenttypes.models import ContentType
            
            # Get all courses by this teacher
            teacher_courses = Course.objects.filter(teacher=request.user)
            course_ct = ContentType.objects.get_for_model(Course)
            
            # Get all students enrolled in these courses
            enrollments = Enrollment.objects.filter(
                content_type=course_ct,
                object_id__in=teacher_courses.values_list('id', flat=True),
                enrollment_type='course'
            ).select_related('user')
            
            recipients = [enrollment.user for enrollment in enrollments]
        
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
                        raw_html = magazine.body or ''
                        # Build minimal wrapper to ensure proper HTML rendering
                        html_wrapper = f"""
                        <html>
                            <body style='background:#0b1523;margin:0;padding:24px;font-family:Segoe UI,Arial,sans-serif;color:#ffffff;'>
                                <div style='max-width:600px;margin:0 auto;background:#142233;padding:32px;border-radius:8px;'>
                                    {raw_html}
                                    <hr style='border:none;border-top:1px solid #1f2e40;margin:32px 0;' />
                                    <p style='font-size:12px;color:#94a3b8;margin:0;'>You are receiving this because you subscribed to this teacher's mail magazine.</p>
                                    <p style='font-size:12px;color:#94a3b8;margin:8px 0 0;'>Manage preferences: <a href='https://zportaacademy.com/preferences/mail-magazines' style='color:#ffb703;'>Click here</a></p>
                                </div>
                            </body>
                        </html>
                        """.strip()
                        plain_text = BeautifulSoup(raw_html, 'html.parser').get_text(separator='\n', strip=True)
                        email = EmailMultiAlternatives(
                                subject=magazine.subject,
                                body=plain_text,
                                from_email=settings.EMAIL_HOST_USER,
                                to=[],
                                bcc=recipient_emails,
                        )
                        email.attach_alternative(html_wrapper, "text/html")
                        email.send(fail_silently=False)
            
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
