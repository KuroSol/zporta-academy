"""
Django admin interface for creating interactive multilingual podcasts.

Features:
- Select user
- Choose primary & secondary languages
- Select output format (text, audio, or both)
- Custom button to generate podcast
- Audio player for listening
- Full script display
"""
from django import forms
from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from dailycast.models import DailyPodcast
from dailycast.services_interactive import create_multilingual_podcast_for_user


class DailyPodcastGenerationForm(forms.ModelForm):
    """Form for podcast generation with language and format selection."""
    
    LANGUAGE_CHOICES = [
        ('en', '🇺🇸 English'),
        ('ja', '🇯🇵 Japanese (日本語)'),
        ('es', '🇪🇸 Spanish (Español)'),
        ('fr', '🇫🇷 French (Français)'),
        ('de', '🇩🇪 German (Deutsch)'),
        ('it', '🇮🇹 Italian (Italiano)'),
        ('pt', '🇵🇹 Portuguese (Português)'),
        ('ru', '🇷🇺 Russian (Русский)'),
        ('ko', '🇰🇷 Korean (한국어)'),
        ('', '--- None (Single Language) ---'),
    ]
    
    primary_language = forms.ChoiceField(
        choices=[('en', '🇺🇸 English (Default)'), ('ja', '🇯🇵 Japanese'), ('es', '🇪🇸 Spanish'), 
                 ('fr', '🇫🇷 French'), ('de', '🇩🇪 German'), ('it', '🇮🇹 Italian'),
                 ('pt', '🇵🇹 Portuguese'), ('ru', '🇷🇺 Russian'), ('ko', '🇰🇷 Korean')],
        initial='en',
        widget=forms.RadioSelect(),
        help_text="Primary language for podcast"
    )
    
    secondary_language = forms.ChoiceField(
        choices=LANGUAGE_CHOICES,
        initial='',
        required=False,
        widget=forms.Select(),
        help_text="Optional second language for multilingual podcast (up to 2 languages)"
    )
    
    output_format = forms.ChoiceField(
        choices=[
            ('text', '📄 Text Only'),
            ('audio', '🎧 Audio Only'),
            ('both', '📄 + 🎧 Text & Audio'),
        ],
        initial='both',
        widget=forms.RadioSelect(),
        help_text="Choose output: script only, audio only, or both"
    )
    
    month_range = forms.ChoiceField(
        choices=[
            ('current', '📅 Current Month'),
            ('last_3', '📅 Last 3 Months'),
            ('last_6', '📅 Last 6 Months'),
            ('last_12', '📅 Last Year (12 Months)'),
            ('all', '📅 All Time'),
        ],
        initial='current',
        widget=forms.RadioSelect(),
        help_text="Select time period for content (affects what's included in review)"
    )
    
    reply_size = forms.ChoiceField(
        choices=[
            ('short', '⏱️ Short (2-3 minutes)'),
            ('medium', '⏱️ Medium (4-5 minutes)'),
            ('long', '⏱️ Long (6-8 minutes)'),
            ('detailed', '⏱️ Detailed (10+ minutes)'),
        ],
        initial='medium',
        widget=forms.RadioSelect(),
        help_text="Duration/depth of podcast response"
    )
    
    class Meta:
        model = DailyPodcast
        fields = ['user']
        widgets = {
            'user': forms.Select(attrs={
                'class': 'admin-autocomplete-field',
            })
        }


class DailyPodcastAdmin(admin.ModelAdmin):
    """Enhanced admin interface for podcast management."""
    
    form = DailyPodcastGenerationForm
    
    list_display = (
        'podcast_id',
        'user_display',
        'language_display',
        'format_display',
        'status',
        'created_date',
        'duration_display',
        'has_audio',
    )
    
    list_filter = (
        'status',
        'output_format',
        'primary_language',
        'secondary_language',
        'llm_provider',
        'tts_provider',
        'created_at',
    )
    
    search_fields = (
        'user__username',
        'user__email',
        'included_courses',
    )
    
    readonly_fields = (
        'created_at',
        'updated_at',
        'llm_provider',
        'tts_provider',
        'duration_seconds',
        'duration_seconds_secondary',
        'audio_player',
        'audio_player_secondary',
        'questions_display',
        'error_display',
    )
    
    fieldsets = (
        ('User & Configuration', {
            'fields': ('user', 'primary_language', 'secondary_language', 'output_format')
        }),
        ('Course Information', {
            'fields': ('included_courses',),
            'classes': ('collapse',)
        }),
        ('Generated Content', {
            'fields': ('script_text',),
            'classes': ('wide',)
        }),
        ('Audio Files', {
            'fields': (
                'audio_player',
                'audio_player_secondary',
                'duration_seconds',
                'duration_seconds_secondary',
            ),
            'classes': ('collapse',)
        }),
        ('Interactive Q&A', {
            'fields': ('questions_display', 'student_answers'),
            'classes': ('collapse',)
        }),
        ('Status & Metadata', {
            'fields': (
                'status',
                'llm_provider',
                'tts_provider',
                'error_display',
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',)
        }),
    )
    
    def get_urls(self):
        """Add custom URL for podcast generation."""
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:podcast_id>/generate/',
                self.admin_site.admin_view(self.generate_podcast_view),
                name='generate-podcast',
            ),
        ]
        return custom_urls + urls
    
    def generate_podcast_view(self, request, podcast_id):
        """Handle podcast generation from admin."""
        if request.method != 'POST':
            return JsonResponse({'error': 'POST required'}, status=400)
        
        try:
            podcast = DailyPodcast.objects.get(id=podcast_id)
            
            # Generate new podcast with current settings
            new_podcast = create_multilingual_podcast_for_user(
                user=podcast.user,
                primary_language=podcast.primary_language,
                secondary_language=podcast.secondary_language,
                output_format=podcast.output_format,
                included_courses=podcast.included_courses,
                month_range=podcast.month_range,
                reply_size=podcast.reply_size,
            )
            
            messages.success(
                request,
                f"✅ Podcast generated successfully! (ID: {new_podcast.id})"
            )
            return redirect(f'/admin/dailycast/dailypodcast/{new_podcast.id}/change/')
            
        except Exception as e:
            messages.error(request, f"❌ Error: {str(e)}")
            return redirect(f'/admin/dailycast/dailypodcast/{podcast_id}/change/')
    
    def change_view(self, request, object_id, form_url='', extra_context=None):
        """Add generate button to change form."""
        extra_context = extra_context or {}
        extra_context['show_generate_button'] = True
        extra_context['generate_url'] = f'/admin/dailycast/dailypodcast/{object_id}/generate/'
        return super().change_view(request, object_id, form_url, extra_context)
    
    # Display methods
    def podcast_id(self, obj):
        return f"#{obj.id}"
    podcast_id.short_description = "ID"
    
    def user_display(self, obj):
        return f"{obj.user.username}"
    user_display.short_description = "User"
    
    def language_display(self, obj):
        langs = obj.primary_language.upper()
        if obj.secondary_language:
            langs += f" + {obj.secondary_language.upper()}"
        return langs
    language_display.short_description = "Languages"
    
    def format_display(self, obj):
        formats = {
            'text': '📄 Text',
            'audio': '🎧 Audio',
            'both': '📄+🎧',
        }
        return formats.get(obj.output_format, obj.output_format)
    format_display.short_description = "Format"
    
    def created_date(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    created_date.short_description = "Created"
    
    def duration_display(self, obj):
        minutes = obj.duration_seconds // 60
        seconds = obj.duration_seconds % 60
        text = f"{minutes}:{seconds:02d}"
        
        if obj.duration_seconds_secondary:
            minutes_sec = obj.duration_seconds_secondary // 60
            seconds_sec = obj.duration_seconds_secondary % 60
            text += f" + {minutes_sec}:{seconds_sec:02d}"
        
        return text
    duration_display.short_description = "Duration"
    
    def has_audio(self, obj):
        if obj.output_format == 'text':
            return '📄'
        elif obj.output_format == 'audio':
            return '🎧' if obj.audio_file else '❌'
        else:  # both
            audio = '🎧' if obj.audio_file else '❌'
            secondary = '🎧' if obj.audio_file_secondary else '⭕'
            return f"{audio} {secondary}"
    has_audio.short_description = "Audio"
    
    # Readonly field renderers
    def audio_player(self, obj):
        """Render HTML5 audio player for primary language."""
        if not obj.audio_file:
            return "❌ No audio file"
        
        return f'''
        <div style="margin: 10px 0;">
            <strong>Primary Language ({obj.primary_language.upper()}):</strong><br>
            <audio controls style="width: 100%; max-width: 400px;">
                <source src="{obj.audio_file.url}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <br><small>{obj.duration_seconds // 60}:{obj.duration_seconds % 60:02d}</small>
        </div>
        '''
    audio_player.short_description = "Primary Audio"
    
    def audio_player_secondary(self, obj):
        """Render HTML5 audio player for secondary language."""
        if not obj.audio_file_secondary:
            return "⭕ No secondary language audio"
        
        return f'''
        <div style="margin: 10px 0;">
            <strong>Secondary Language ({obj.secondary_language.upper()}):</strong><br>
            <audio controls style="width: 100%; max-width: 400px;">
                <source src="{obj.audio_file_secondary.url}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <br><small>{obj.duration_seconds_secondary // 60}:{obj.duration_seconds_secondary % 60:02d}</small>
        </div>
        '''
    audio_player_secondary.short_description = "Secondary Audio"
    
    def questions_display(self, obj):
        """Display questions asked in podcast."""
        if not obj.questions_asked:
            return "No questions asked"
        
        html = "<ul>"
        for i, q in enumerate(obj.questions_asked, 1):
            html += f"<li>{q}</li>"
        html += "</ul>"
        return html
    questions_display.short_description = "Questions Asked"
    
    def error_display(self, obj):
        """Display error message if generation failed."""
        if not obj.error_message:
            return "✅ No errors"
        
        return f'<span style="color: red; font-weight: bold;">❌ {obj.error_message}</span>'
    error_display.short_description = "Status"
    
    def save_model(self, request, obj, form, change):
        """Override save to generate podcast if this is a new object."""
        if not change:  # New object
            # Don't save directly; let the form submission trigger generation
            pass
        else:
            super().save_model(request, obj, form, change)


# Register the admin
admin.site.register(DailyPodcast, DailyPodcastAdmin)
