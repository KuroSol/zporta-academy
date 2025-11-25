from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import TeacherMailMagazine, MailMagazineIssue, MailMagazineTemplate, MailMagazineAutomation

User = get_user_model()


class SimpleRecipientSerializer(serializers.ModelSerializer):
    """Serializer for displaying recipient information (privacy-friendly: no emails)"""
    display_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'display_name']
    
    def get_display_name(self, obj):
        """Get user's display name or full name"""
        if hasattr(obj, 'profile') and obj.profile.display_name:
            return obj.profile.display_name
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.username


class TeacherMailMagazineSerializer(serializers.ModelSerializer):
    # For reading - return full user objects (privacy-friendly)
    selected_recipients_details = SimpleRecipientSerializer(
        source='selected_recipients', 
        many=True, 
        read_only=True
    )
    # For writing - accept list of user IDs
    selected_recipients = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        many=True,
        required=False,
        allow_empty=True
    )
    template_name = serializers.CharField(source='template.name', read_only=True, allow_null=True)
    
    class Meta:
        model = TeacherMailMagazine
        fields = [
            'id',
            'title',
            'subject',
            'body',
            'template',
            'template_name',
            'frequency',
            'send_at',
            'is_active',
            'last_sent_at',
            'times_sent',
            'created_at',
            'updated_at',
            'selected_recipients',
            'selected_recipients_details',
        ]
        read_only_fields = ['id', 'last_sent_at', 'times_sent', 'created_at', 'updated_at', 'selected_recipients_details', 'template_name']


class MailMagazineTemplateSerializer(serializers.ModelSerializer):
    """Serializer for email templates"""
    template_type_display = serializers.CharField(source='get_template_type_display', read_only=True)
    
    class Meta:
        model = MailMagazineTemplate
        fields = [
            'id',
            'name',
            'template_type',
            'template_type_display',
            'subject',
            'body',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'template_type_display']


class MailMagazineAutomationSerializer(serializers.ModelSerializer):
    """Serializer for email automation rules"""
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True, allow_null=True)
    course_title = serializers.CharField(source='specific_course.title', read_only=True, allow_null=True)
    
    class Meta:
        model = MailMagazineAutomation
        fields = [
            'id',
            'name',
            'trigger_type',
            'trigger_type_display',
            'template',
            'template_name',
            'subject',
            'body',
            'is_active',
            'specific_course',
            'course_title',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'trigger_type_display', 'template_name', 'course_title']


class MailMagazineIssueSerializer(serializers.ModelSerializer):
    """Serializer for mail magazine issues (sent archive)"""
    magazine_title = serializers.CharField(source='magazine.title', read_only=True)
    teacher_username = serializers.CharField(source='magazine.teacher.username', read_only=True)
    
    class Meta:
        model = MailMagazineIssue
        fields = [
            'id',
            'magazine',
            'magazine_title',
            'teacher_username',
            'title',
            'subject',
            'html_content',
            'sent_at',
            'is_public',
        ]
        read_only_fields = ['id', 'sent_at', 'magazine_title', 'teacher_username']
