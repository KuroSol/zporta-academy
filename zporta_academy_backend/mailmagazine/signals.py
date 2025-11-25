from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.db import models
from bs4 import BeautifulSoup
from .models import MailMagazineAutomation, MailMagazineIssue


def send_automated_email(automation, user, **context):
    """
    Send an automated email based on the automation rule
    
    Args:
        automation: MailMagazineAutomation instance
        user: User who triggered the automation
        context: Additional context variables for email customization
    """
    if not automation.is_active:
        return
    
    if not user.email:
        return
    
    # Get email content from automation
    content = automation.get_email_content()
    subject = content['subject']
    html_body = content['body']
    
    # Build email wrapper
    site_url = getattr(settings, 'SITE_URL', 'https://zportaacademy.com')
    html_wrapper = f"""
    <html>
      <body style='background:#0b1523;margin:0;padding:24px;font-family:Segoe UI,Arial,sans-serif;color:#ffffff;'>
        <div style='max-width:600px;margin:0 auto;background:#142233;padding:32px;border-radius:8px;'>
          {html_body}
          <hr style='border:none;border-top:1px solid #1f2e40;margin:32px 0;' />
          <p style='font-size:12px;color:#94a3b8;margin:0;'>This is an automated message from {automation.teacher.username}.</p>
        </div>
      </body>
    </html>
    """.strip()
    
    # Send email
    try:
        plain_text = BeautifulSoup(html_body, 'html.parser').get_text(separator='\n', strip=True)
        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=settings.EMAIL_HOST_USER,
            to=[user.email],
        )
        email.attach_alternative(html_wrapper, "text/html")
        email.send(fail_silently=False)
        
        # Log the sent email (optional - could create MailMagazineIssue for tracking)
        print(f"Automated email sent: {subject} to {user.email}")
    except Exception as e:
        print(f"Failed to send automated email: {str(e)}")


@receiver(post_save, sender='enrollment.Enrollment')
def handle_enrollment(sender, instance, created, **kwargs):
    """
    Trigger automation when user enrolls in a course
    """
    if not created:
        return
    
    if instance.enrollment_type != 'course':
        return
    
    # Get the course
    from django.contrib.contenttypes.models import ContentType
    from courses.models import Course
    
    if instance.content_type != ContentType.objects.get_for_model(Course):
        return
    
    try:
        course = Course.objects.get(id=instance.object_id)
    except Course.DoesNotExist:
        return
    
    # Find matching automation rules
    automations = MailMagazineAutomation.objects.filter(
        teacher=course.teacher,
        trigger_type='enrollment',
        is_active=True
    ).filter(
        models.Q(specific_course=course) | models.Q(specific_course__isnull=True)
    )
    
    for automation in automations:
        send_automated_email(
            automation,
            instance.user,
            course=course,
            teacher=course.teacher
        )


@receiver(post_save, sender='social.GuideRequest')
def handle_guide_attend(sender, instance, created, **kwargs):
    """
    Trigger automation when user's guide request is accepted (attends)
    """
    # Only trigger when status changes to 'accepted'
    if instance.status != 'accepted':
        return
    
    # Find matching automation rules for the guide (teacher)
    automations = MailMagazineAutomation.objects.filter(
        teacher=instance.guide,
        trigger_type='guide_attend',
        is_active=True
    )
    
    for automation in automations:
        send_automated_email(
            automation,
            instance.explorer,  # The user who attended
            guide=instance.guide
        )


# Note: For payment/purchase triggers, you'll need to add similar handlers
# based on your payment model. Example:
#
# @receiver(post_save, sender='payments.Payment')
# def handle_purchase(sender, instance, created, **kwargs):
#     if not created or instance.status != 'completed':
#         return
#     
#     automations = MailMagazineAutomation.objects.filter(
#         teacher=instance.teacher,  # adjust based on your model
#         trigger_type='purchase',
#         is_active=True
#     )
#     
#     for automation in automations:
#         send_automated_email(automation, instance.user)
