from django.db import models
from django.conf import settings


class MailMagazineTemplate(models.Model):
    """
    Predefined email templates for common scenarios
    """
    TEMPLATE_TYPES = [
        ('thank_attend', 'Thank You for Attending'),
        ('thank_purchase', 'Thank You for Purchase'),
        ('welcome_enroll', 'Welcome - Course Enrollment'),
        ('completion', 'Course Completion Congratulations'),
        ('custom', 'Custom Template'),
    ]
    
    name = models.CharField(max_length=200, help_text='Template name for identification')
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES, default='custom')
    subject = models.CharField(max_length=200, help_text='Email subject line')
    body = models.TextField(help_text='Email body content (HTML supported)')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['template_type', 'name']
        indexes = [
            models.Index(fields=['created_by', 'template_type']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"


class MailMagazineAutomation(models.Model):
    """
    Automated email sending based on user actions
    """
    TRIGGER_TYPES = [
        ('enrollment', 'When User Enrolls in Course'),
        ('purchase', 'When User Purchases Product'),
        ('guide_attend', 'When User Attends as Guide'),
        ('course_complete', 'When User Completes Course'),
    ]
    
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mail_automations'
    )
    name = models.CharField(max_length=200, help_text='Automation rule name')
    trigger_type = models.CharField(max_length=50, choices=TRIGGER_TYPES)
    template = models.ForeignKey(
        MailMagazineTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='automations'
    )
    subject = models.CharField(max_length=200, help_text='Email subject (overrides template if set)')
    body = models.TextField(help_text='Email body (overrides template if set)', blank=True)
    is_active = models.BooleanField(default=True, help_text='Enable/disable this automation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Optional filters
    specific_course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Only trigger for this specific course (leave empty for all courses)'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['teacher', 'trigger_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.get_trigger_type_display()}"
    
    def get_email_content(self):
        """Get the email content, preferring custom over template"""
        if self.body:
            return {
                'subject': self.subject,
                'body': self.body
            }
        elif self.template:
            return {
                'subject': self.subject or self.template.subject,
                'body': self.template.body
            }
        return {
            'subject': self.subject,
            'body': ''
        }


class TeacherMailMagazine(models.Model):
    FREQUENCY_CHOICES = [
        ('one_time', 'One Time'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mail_magazines'
    )
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    template = models.ForeignKey(
        MailMagazineTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='magazines',
        help_text='Optional: Use a predefined template'
    )
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default='one_time'
    )
    send_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    times_sent = models.IntegerField(default=0, help_text='Number of times this magazine has been sent')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    selected_recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='received_mail_magazines',
        blank=True,
        help_text='Select specific attendees to send this mail magazine to. Leave empty to send to all attendees.'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['teacher', 'is_active']),
            models.Index(fields=['frequency', 'is_active']),
        ]

    def __str__(self):
        return f"{self.title} by {self.teacher.username}"


class MailMagazineIssue(models.Model):
    """
    Stores each sent mail magazine issue for gated web viewing.
    Recipients can view past issues; optionally public if is_public=True.
    """
    magazine = models.ForeignKey(
        TeacherMailMagazine,
        on_delete=models.CASCADE,
        related_name='issues'
    )
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=200)
    html_content = models.TextField(help_text='Full HTML content including wrapper')
    sent_at = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=False, help_text='Make visible to non-recipients')
    recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='received_issues',
        help_text='Users who received this issue'
    )

    class Meta:
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['magazine', '-sent_at']),
        ]

    def __str__(self):
        return f"{self.subject} - {self.sent_at.strftime('%Y-%m-%d')}"


class RecipientGroup(models.Model):
    """
    Saved recipient groups for reuse across mail magazines.
    Teachers can create groups of students and apply them to multiple campaigns.
    """
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mail_recipient_groups'
    )
    name = models.CharField(
        max_length=200,
        help_text='Group name (e.g., "Japanese Course A", "Premium Students")'
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text='Optional description of the group'
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='recipient_groups',
        blank=True,
        help_text='Students in this recipient group'
    )
    is_dynamic = models.BooleanField(
        default=False,
        help_text='If True, automatically includes all course attendees'
    )
    linked_course = models.ForeignKey(
        'courses.Course',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='For dynamic groups: link to a course'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['teacher', '-updated_at']),
        ]
        unique_together = ('teacher', 'name')

    def __str__(self):
        member_count = self.members.count()
        return f"{self.name} ({member_count} members)"

    def get_members_queryset(self):
        """Get all members, including dynamic course members if applicable"""
        if self.is_dynamic and self.linked_course:
            # For dynamic groups, include all course attendees
            from enrollment.models import Enrollment
            from django.contrib.contenttypes.models import ContentType
            from courses.models import Course
            course_ct = ContentType.objects.get_for_model(Course)
            course_enrolled = Enrollment.objects.filter(
                content_type=course_ct,
                object_id=self.linked_course.id,
                status='active'
            ).values_list('user_id', flat=True)
            User = settings.AUTH_USER_MODEL
            return User.objects.filter(id__in=course_enrolled)
        else:
            # Static group
            return self.members.all()
