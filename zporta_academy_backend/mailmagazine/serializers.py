from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import TeacherMailMagazine, MailMagazineIssue

User = get_user_model()


class SimpleRecipientSerializer(serializers.ModelSerializer):
    """Serializer for displaying recipient information"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class TeacherMailMagazineSerializer(serializers.ModelSerializer):
    # For reading - return full user objects
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
    
    class Meta:
        model = TeacherMailMagazine
        fields = [
            'id',
            'title',
            'subject',
            'body',
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
        read_only_fields = ['id', 'last_sent_at', 'times_sent', 'created_at', 'updated_at', 'selected_recipients_details']


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
