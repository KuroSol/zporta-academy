"""
Serializers for Daily Podcast API.

Converts DailyPodcast model to/from JSON for REST API.
"""
from rest_framework import serializers
from dailycast.models import DailyPodcast


class DailyPodcastSerializer(serializers.ModelSerializer):
    """Serializer for DailyPodcast model."""
    
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    # Format display values
    status_display = serializers.SerializerMethodField()
    output_format_display = serializers.SerializerMethodField()
    language_display = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()
    
    # Audio URLs
    audio_url = serializers.SerializerMethodField()
    audio_url_secondary = serializers.SerializerMethodField()
    
    class Meta:
        model = DailyPodcast
        fields = [
            'id',
            'user',
            'user_username',
            'user_email',
            'primary_language',
            'secondary_language',
            'output_format',
            'output_format_display',
            'language_display',
            'script_text',
            'included_courses',
            'questions_asked',
            'student_answers',
            'audio_file',
            'audio_url',
            'audio_file_secondary',
            'audio_url_secondary',
            'duration_seconds',
            'duration_seconds_secondary',
            'duration_display',
            'status',
            'status_display',
            'llm_provider',
            'tts_provider',
            'error_message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'script_text',
            'included_courses',
            'questions_asked',
            'student_answers',
            'audio_file',
            'audio_file_secondary',
            'duration_seconds',
            'duration_seconds_secondary',
            'status',
            'llm_provider',
            'tts_provider',
            'error_message',
            'created_at',
            'updated_at',
        ]
    
    def get_status_display(self, obj):
        """Format status for display."""
        status_icons = {
            'pending': '⏳ Generating',
            'completed': '✅ Ready',
            'failed': '❌ Error',
        }
        return status_icons.get(obj.status, obj.status)
    
    def get_output_format_display(self, obj):
        """Format output format for display."""
        formats = {
            'text': '📄 Text Only',
            'audio': '🎧 Audio Only',
            'both': '📄+🎧 Text & Audio',
        }
        return formats.get(obj.output_format, obj.output_format)
    
    def get_language_display(self, obj):
        """Format languages for display."""
        primary = obj.primary_language.upper()
        if obj.secondary_language:
            return f"{primary} + {obj.secondary_language.upper()}"
        return primary
    
    def get_duration_display(self, obj):
        """Format duration for display."""
        minutes = obj.duration_seconds // 60
        seconds = obj.duration_seconds % 60
        text = f"{minutes}:{seconds:02d}"
        
        if obj.duration_seconds_secondary:
            minutes_sec = obj.duration_seconds_secondary // 60
            seconds_sec = obj.duration_seconds_secondary % 60
            text += f" + {minutes_sec}:{seconds_sec:02d}"
        
        return text
    
    def get_audio_url(self, obj):
        """Get URL for primary audio file."""
        if obj.audio_file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.audio_file.url) if request else obj.audio_file.url
        return None
    
    def get_audio_url_secondary(self, obj):
        """Get URL for secondary audio file."""
        if obj.audio_file_secondary:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.audio_file_secondary.url) if request else obj.audio_file_secondary.url
        return None
