import logging
import time
import json

from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import models
from django.urls import path, reverse
from django.utils.safestring import mark_safe
from django.http import JsonResponse
from django import forms
from django.shortcuts import redirect

from dailycast.models import DailyPodcast, UserCategory, UserCategoryConfig, TeacherContentConfig
from dailycast.services import create_podcast_for_user

logger = logging.getLogger(__name__)


# ===== LLM PROVIDER CONFIGURATION =====
LLM_PROVIDER_MODELS = {
    "openai": [
        ("gpt-4o-mini", "GPT-4o Mini - Fast & Cost-Effective (Recommended for most users)"),
        ("gpt-4-turbo", "GPT-4 Turbo - Very Smart, Higher Cost"),
        ("gpt-4", "GPT-4 - Most Powerful (Most Expensive)"),
        ("gpt-3.5-turbo", "GPT-3.5 Turbo - Budget-Friendly"),
    ],
    "gemini": [
        ("gemini-2.0-pro-exp", "Gemini 2.0 Pro Exp - Newest, Most Capable"),
        ("gemini-1.5-pro", "Gemini 1.5 Pro - Very Smart, Balanced"),
        ("gemini-1.5-flash", "Gemini 1.5 Flash - Fast & Cheap"),
        ("gemini-pro", "Gemini Pro - Standard Model"),
    ],
    "template": [
        ("template", "Template - No AI (Free, but basic output)"),
    ],
    "claude": [
        ("claude-3-5-sonnet", "Claude 3.5 Sonnet - Best for long content"),
        ("claude-3-opus", "Claude 3 Opus - Most Powerful"),
        ("claude-3-sonnet", "Claude 3 Sonnet - Balanced"),
        ("claude-3-haiku", "Claude 3 Haiku - Fast & Cheap"),
    ],
}

# ===== TOOLTIP HELP TEXT =====
LLM_PROVIDER_TOOLTIPS = {
    "openai": "🤖 OpenAI (GPT-4 family)\n\n💡 Best for: Professional quality content, technical explanations\n⚡ Speed: Fast\n💰 Cost: Medium to High\n📝 Example: 'Create a detailed podcast about biology'",
    
    "gemini": "✨ Google Gemini\n\n💡 Best for: Creative content, multilingual support\n⚡ Speed: Very Fast\n💰 Cost: Low to Medium\n📝 Example: 'Generate a fun podcast in Japanese and English'",
    
    "template": "📚 Template (No AI)\n\n💡 Best for: Testing, free tier, basic content\n⚡ Speed: Instant\n💰 Cost: Free\n📝 This is a template - use real AI providers for quality",
    
    "claude": "🧠 Anthropic Claude\n\n💡 Best for: Writing, analysis, complex reasoning\n⚡ Speed: Medium\n💰 Cost: Medium\n📝 Example: 'Write a thoughtful podcast about climate change'",
}


class UserCategoryConfigForm(forms.ModelForm):
    """Custom form for UserCategoryConfig with dynamic model dropdown based on provider."""
    
    default_llm_provider = forms.ChoiceField(
        choices=DailyPodcast.LLM_PROVIDER_CHOICES,
        widget=forms.Select(attrs={
            'class': 'llm-provider-select',
            'onchange': 'updateLLMModels(this)',
        }),
        help_text="Choose your AI provider (OpenAI, Gemini, Claude, or Template)"
    )
    
    # Dynamic model field - uses Select UI but we accept any value (front-end supplies options)
    llm_model = forms.CharField(
        required=False,
        widget=forms.Select(attrs={
            'class': 'llm-model-select',
            'id': 'llm_model_select',
        }),
        help_text="Select the model for your chosen provider. Will auto-update when you change provider."
    )
    
    class Meta:
        model = UserCategoryConfig
        fields = [
            'category',
            'enabled',
            'default_language',
            'default_output_format',
            'default_llm_provider',
            # Note: llm_model is form-only, handled in save()
            'default_tts_provider',
            'tts_speaking_rate',
            'script_word_limit',
            'cooldown_hours',
            'max_generations_per_day',
            'cost_per_generation',
        ]
        widgets = {
            'category': forms.Select(attrs={'class': 'django-select2'}),
            'default_language': forms.Select(attrs={
                'help_text': 'Primary language for podcasts in this category'
            }),
            'default_output_format': forms.Select(attrs={
                'title': '📄 Text Only = Just the script\n🎧 Audio Only = Just the MP3\n📄+🎧 Both = Script AND Audio'
            }),
            'default_tts_provider': forms.Select(attrs={
                'title': '🎧 ElevenLabs = Natural, human-like voices (best quality)\n🎤 Google = Fast, good quality, free tier available\n🎵 OpenAI = Consistent voices'
            }),
            'tts_speaking_rate': forms.NumberInput(attrs={
                'step': '0.1',
                'min': '0.5',
                'max': '2.0',
                'title': 'How fast the voice reads (0.5=slow, 1.0=normal, 2.0=fast)'
            }),
            'script_word_limit': forms.NumberInput(attrs={
                'title': 'How long podcasts can be. Higher = longer podcasts'
            }),
            'cooldown_hours': forms.NumberInput(attrs={
                'title': 'Hours users must wait between generations. 0=no wait'
            }),
            'max_generations_per_day': forms.NumberInput(attrs={
                'title': 'How many podcasts per day. 0=unlimited'
            }),
            'cost_per_generation': forms.NumberInput(attrs={
                'step': '0.01',
                'title': 'Cost charged per generation (for billing)'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # If editing existing object, set the correct models for the selected provider
        if self.instance and self.instance.pk:
            provider = self.instance.default_llm_provider
            # Get base choices for this provider
            base_choices = LLM_PROVIDER_MODELS.get(
                provider, 
                LLM_PROVIDER_MODELS["template"]
            )
            
            # Get the current saved model value
            if provider == "openai":
                current_model = self.instance.openai_model
            elif provider == "gemini":
                current_model = self.instance.gemini_model
            elif provider == "claude":
                current_model = self.instance.claude_model
            else:
                current_model = self.instance.template_model
            
            # Add current model to choices if not already present (for backward compatibility)
            choices_list = list(base_choices)
            if current_model and not any(choice[0] == current_model for choice in choices_list):
                choices_list.insert(0, (current_model, f"{current_model} (legacy)"))
            
            # Populate dropdown options for the UI (no server-side choice validation)
            self.fields['llm_model'].widget.choices = choices_list
            self.fields['llm_model'].initial = current_model
    
    def clean_llm_model(self):
        """Validate llm_model against the selected provider's allowed models."""
        llm_model = self.cleaned_data.get('llm_model', '')
        provider = self.cleaned_data.get('default_llm_provider', 'template')
        
        # If no model selected, that's ok (it's optional)
        if not llm_model:
            return llm_model
        
        # Get allowed models for this provider
        allowed_models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
        allowed_values = [m[0] for m in allowed_models]
        
        # Validate the selected model is in the allowed list
        if llm_model not in allowed_values:
            from django.core.exceptions import ValidationError
            raise ValidationError(
                f"Invalid model '{llm_model}' for provider '{provider}'. "
                f"Allowed: {', '.join(allowed_values)}"
            )
        
        return llm_model
    
    def clean_voice_map_json(self):
        """Allow empty/invalid JSON and coerce to dict for hidden voice map field."""
        value = self.cleaned_data.get('voice_map_json')
        if not value or value == '':
            return {}
        if isinstance(value, dict):
            return value
        # If value is a string, try to parse; fallback to empty dict
        try:
            import json
            parsed = json.loads(value) if value else {}
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    
    def save(self, commit=True):
        """Save the form and map llm_model to the correct provider-specific field."""
        # Extract llm_model from cleaned_data BEFORE calling super().save()
        # because llm_model is not a model field
        selected_model = self.cleaned_data.pop('llm_model', '')
        
        instance = super().save(commit=False)
        
        # Map the selected model back to the provider-specific field
        provider = instance.default_llm_provider
        
        if provider == "openai":
            instance.openai_model = selected_model
        elif provider == "gemini":
            instance.gemini_model = selected_model
        elif provider == "claude":
            instance.claude_model = selected_model
        else:
            instance.template_model = selected_model
        
        if commit:
            instance.save()
        return instance


class TeacherContentConfigForm(forms.ModelForm):
    """Custom form for TeacherContentConfig with dynamic model dropdown based on provider."""
    
    # DEBUG LOGGER
    import logging
    debug_logger = logging.getLogger("django")
    
    # Language choices
    default_language = forms.ChoiceField(
        choices=[
            ('en', 'English'),
            ('ja', 'Japanese (日本語)'),
            ('es', 'Spanish (Español)'),
            ('fr', 'French (Français)'),
            ('de', 'German (Deutsch)'),
            ('it', 'Italian (Italiano)'),
            ('pt', 'Portuguese (Português)'),
            ('ru', 'Russian (Русский)'),
            ('ko', 'Korean (한국어)'),
            ('zh', 'Chinese (中文)'),
        ],
        initial='en',
        help_text="Default language for generation"
    )
    
    # Output format choices
    default_output_format = forms.ChoiceField(
        choices=DailyPodcast.OUTPUT_FORMAT_CHOICES,
        initial='both',
        help_text="Default output: text only, audio only, or both"
    )
    
    default_llm_provider = forms.ChoiceField(
        choices=DailyPodcast.LLM_PROVIDER_CHOICES,
        widget=forms.Select(attrs={
            'class': 'llm-provider-select',
            'onchange': 'updateLLMModels(this)',
        }),
        help_text="Choose your AI provider (OpenAI, Gemini, Claude, or Template)"
    )
    
    # Dynamic model field - uses Select UI but accepts any value from front-end options
    llm_model = forms.CharField(
        required=False,
        widget=forms.Select(attrs={
            'class': 'llm-model-select',
            'id': 'llm_model_select',
        }),
        help_text="Select the model for your chosen provider. Will auto-update when you change provider.",
        initial='template'
    )
    
    # TTS Fallback Chain as multi-select dropdown
    tts_fallback_chain = forms.MultipleChoiceField(
        choices=DailyPodcast.TTS_PROVIDER_CHOICES,
        widget=forms.SelectMultiple(attrs={
            'class': 'tts-fallback-select',
            'size': '4',
            'title': 'Select providers in order of preference. First = primary, others = fallback if first fails'
        }),
        help_text="🔄 Select TTS providers in priority order (top to bottom). If primary fails, system tries next one.",
        required=False
    )

    # Voice map field - visible textarea for editing JSON
    voice_map_json = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'rows': 3,
            'cols': 60,
            'placeholder': '{"en": "voice-id-here", "ja": "voice-id-here"}',
            'style': 'font-family: monospace;'
        }),
        help_text='Map languages to voice IDs. Example: {"en": "EXAMPLEvoiceID123", "ja": "EXAMPLEvoiceID456"}',
        initial='{}'
    )
    
    class Meta:
        model = TeacherContentConfig
        fields = [
            'enabled',
            'default_language',
            'default_output_format',
            'default_llm_provider',
            # Note: llm_model is a form-only field, not in DB - handled in save()
            # Note: voice_map_json is a form-only field, not in Meta.fields - handled in clean() and save()
            'default_tts_provider',
            'tts_fallback_chain',
            'tts_speaking_rate',
            'tts_pitch',
            'tts_volume_gain',
            'script_word_limit_normal',
            'script_word_limit_short',
            'script_include_questions',
            'num_questions_per_script',
            'include_motivational_quote',
            'prompt_system_role',
            'prompt_script_intro',
            'prompt_tone_guide',
            'cooldown_hours',
            'test_user_cooldown_enabled',
            'max_generations_per_day',
            'cost_per_generation',
            'enable_credit_system',
            'support_bilingual',
            'bilingual_default_pair',
            'bilingual_audio_stitch',
            'verbose_logging',
            'debug_mode',
        ]
        widgets = {
            'default_tts_provider': forms.Select(attrs={
                'title': '🎧 ElevenLabs = Natural, human-like voices (best quality)\n🎤 Google = Fast, good quality, free tier available\n🎵 OpenAI = Consistent voices'
            }),
            'tts_speaking_rate': forms.NumberInput(attrs={
                'step': '0.1',
                'min': '0.5',
                'max': '2.0',
                'title': 'How fast the voice reads (0.5=slow, 1.0=normal, 2.0=fast)'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Always set initial choices for llm_model based on current provider
        current_provider = self.instance.default_llm_provider if self.instance and self.instance.pk else 'template'
        base_choices = LLM_PROVIDER_MODELS.get(current_provider, LLM_PROVIDER_MODELS["template"])
        self.fields['llm_model'].widget.choices = base_choices
        
        # If editing existing object, set the correct models for the selected provider
        if self.instance and self.instance.pk:
            # Set initial values for language and output format
            self.fields['default_language'].initial = self.instance.default_language
            self.fields['default_output_format'].initial = self.instance.default_output_format
            
            provider = self.instance.default_llm_provider
            # Get base choices for this provider
            base_choices = LLM_PROVIDER_MODELS.get(
                provider, 
                LLM_PROVIDER_MODELS["template"]
            )
            
            # Get the current saved model value (TeacherContentConfig only has openai_model and gemini_model)
            if provider == "openai":
                current_model = self.instance.openai_model
            elif provider == "gemini":
                current_model = self.instance.gemini_model
            else:
                # For other providers (claude, template, etc), default to first choice
                current_model = base_choices[0][0] if base_choices else ''
            
            # Add current model to choices if not already present (for backward compatibility)
            choices_list = list(base_choices)
            if current_model and not any(choice[0] == current_model for choice in choices_list):
                choices_list.insert(0, (current_model, f"{current_model} (legacy)"))
            
            # Populate dropdown options for the UI (no server-side choice validation)
            self.fields['llm_model'].widget.choices = choices_list
            self.fields['llm_model'].initial = current_model
            
            # Load tts_fallback_chain from JSON field
            if self.instance.tts_fallback_chain:
                if isinstance(self.instance.tts_fallback_chain, list):
                    self.fields['tts_fallback_chain'].initial = self.instance.tts_fallback_chain
                else:
                    # Try to parse if it's a string
                    try:
                        import json
                        parsed = json.loads(self.instance.tts_fallback_chain) if isinstance(self.instance.tts_fallback_chain, str) else self.instance.tts_fallback_chain
                        if isinstance(parsed, list):
                            self.fields['tts_fallback_chain'].initial = parsed
                    except:
                        pass
    
    def clean_llm_model(self):
        """Validate llm_model against the selected provider's allowed models."""
        self.debug_logger.error("=" * 80)
        self.debug_logger.error("🔍 CLEAN_LLM_MODEL CALLED (TeacherContentConfigForm)")
        self.debug_logger.error(f"cleaned_data BEFORE clean_llm_model: {self.cleaned_data}")
        
        llm_model = self.cleaned_data.get('llm_model', '')
        provider = self.cleaned_data.get('default_llm_provider', 'template')
        
        self.debug_logger.error(f"llm_model value: {repr(llm_model)}")
        self.debug_logger.error(f"provider value: {repr(provider)}")
        
        # If no model selected, that's ok (it's optional)
        if not llm_model:
            self.debug_logger.error("llm_model is empty, returning empty")
            return llm_model
        
        # Get allowed models for this provider
        allowed_models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
        allowed_values = [m[0] for m in allowed_models]
        
        self.debug_logger.error(f"allowed_values: {allowed_values}")
        
        # Validate the selected model is in the allowed list
        if llm_model not in allowed_values:
            from django.core.exceptions import ValidationError
            self.debug_logger.error(f"❌ VALIDATION ERROR: {llm_model} not in {allowed_values}")
            raise ValidationError(
                f"Invalid model '{llm_model}' for provider '{provider}'. "
                f"Allowed: {', '.join(allowed_values)}"
            )
        
        self.debug_logger.error(f"✅ llm_model validation passed: {llm_model}")
        return llm_model
    
    def clean_voice_map_json(self):
        """Allow empty/invalid JSON and coerce to dict for hidden voice map field."""
        self.debug_logger.error("=" * 80)
        self.debug_logger.error("🔍 CLEAN_VOICE_MAP_JSON CALLED")
        
        value = self.cleaned_data.get('voice_map_json')
        self.debug_logger.error(f"voice_map_json raw value: {repr(value)}, type: {type(value)}")
        
        if not value or value == '':
            self.debug_logger.error("voice_map_json is empty, returning empty dict")
            return {}
        if isinstance(value, dict):
            self.debug_logger.error(f"voice_map_json already dict: {value}")
            return value
        # If value is a string, try to parse; fallback to empty dict
        try:
            import json
            parsed = json.loads(value) if value else {}
            result = parsed if isinstance(parsed, dict) else {}
            self.debug_logger.error(f"✅ voice_map_json parsed: {result}")
            return result
        except Exception as e:
            self.debug_logger.error(f"⚠️ voice_map_json parse failed: {e}, returning empty dict")
            return {}
    
    def clean(self):
        """Override clean to log the full validation state."""
        self.debug_logger.error("=" * 80)
        self.debug_logger.error("🔍 CLEAN() CALLED - FULL FORM VALIDATION")
        self.debug_logger.error(f"cleaned_data at start of clean(): {self.cleaned_data}")
        self.debug_logger.error(f"errors at start of clean(): {self.errors}")
        
        cleaned_data = super().clean()
        
        self.debug_logger.error("=" * 80)
        self.debug_logger.error("🔍 CLEAN() FINISHED")
        self.debug_logger.error(f"cleaned_data after clean(): {cleaned_data}")
        self.debug_logger.error(f"errors after clean(): {self.errors}")
        self.debug_logger.error(f"is_valid() would return: {not self.errors}")
        self.debug_logger.error("=" * 80)
        
        return cleaned_data
    
    def save(self, commit=True):
        """Save the form and map llm_model to the correct provider-specific field."""
        self.debug_logger.error("=" * 80)
        self.debug_logger.error("🔍 SAVE() CALLED")
        self.debug_logger.error(f"cleaned_data at save(): {self.cleaned_data}")
        self.debug_logger.error(f"errors at save(): {self.errors}")
        
        # Extract llm_model from cleaned_data BEFORE calling super().save()
        # because llm_model is a form-only field, not a model field
        selected_model = self.cleaned_data.pop('llm_model', '')
        self.debug_logger.error(f"Extracted llm_model: {repr(selected_model)}")
        
        # Extract voice_map_json as dict (cleaned by clean_voice_map_json)
        voice_map = self.cleaned_data.pop('voice_map_json', {})
        self.debug_logger.error(f"Extracted voice_map_json: {repr(voice_map)}")
        
        instance = super().save(commit=False)
        self.debug_logger.error(f"Instance after super().save(commit=False): {instance}")
        
        # Map the selected model back to the provider-specific field
        # TeacherContentConfig only has openai_model and gemini_model fields
        provider = instance.default_llm_provider
        self.debug_logger.error(f"Provider: {provider}")
        
        if provider == "openai":
            instance.openai_model = selected_model
            self.debug_logger.error(f"Set openai_model = {selected_model}")
        elif provider == "gemini":
            instance.gemini_model = selected_model
            self.debug_logger.error(f"Set gemini_model = {selected_model}")
        # For other providers (claude, template, etc), we don't have fields to save to
        
        # CRITICAL: Manually set voice_map_json since it's not in Meta.fields
        instance.voice_map_json = voice_map
        self.debug_logger.error(f"Set voice_map_json = {voice_map}")
        
        # Save tts_fallback_chain as JSON list
        fallback_chain = self.cleaned_data.get('tts_fallback_chain', [])
        instance.tts_fallback_chain = list(fallback_chain) if fallback_chain else []
        self.debug_logger.error(f"Set tts_fallback_chain = {instance.tts_fallback_chain}")
        
        if commit:
            self.debug_logger.error("Calling instance.save()...")
            instance.save()
            self.debug_logger.error("✅ Instance saved successfully")
        
        self.debug_logger.error("=" * 80)
        return instance


class DailyPodcastGenerationForm(forms.ModelForm):
    """Form for interactive podcast generation with language and format selection."""
    
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
    
    class Meta:
        model = DailyPodcast
        fields = ['user']


class DailyPodcastAdmin(admin.ModelAdmin):
    list_display = (
        "podcast_id",
        "user_display",
        "language_display",
        "format_display",
        "status",
        "created_at",
        "duration_display",
        "has_audio",
    )
    
    list_filter = (
        "status",
        "output_format",
        "primary_language",
        "secondary_language",
        "llm_provider",
        "tts_provider",
        "created_at",
    )
    
    search_fields = (
        "user__username",
        "user__email",
        "included_courses",
    )
    
    readonly_fields = (
        "created_at",
        "updated_at",
        "llm_provider",
        "duration_seconds",
        "duration_seconds_secondary",
        "audio_player",
        "audio_player_secondary",
        "questions_display",
        "error_display",
        # request_data is kept readonly to prevent manual JSON editing errors, 
        # but we'll need to handle it carefully if we want to save it from frontend.
        # For now, let's make it editable so we can debug/populate it.
    )
    
    fieldsets = (
        ('User & Configuration', {
            'fields': ('user', 'primary_language', 'secondary_language', 'output_format')
        }),
        ('Request Details', {
            'fields': ('category', 'topic', 'profession', 'notes', 'request_data'),
            'classes': ('collapse',)
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
    
    change_list_template = "admin/dailycast/dailypodcast/change_list.html"
    change_form_template = "admin/dailycast/dailypodcast/change_form.html"
    actions = ['add_audio_to_text_only', 'regenerate_audio_from_script']  # Custom admin actions

    def add_audio_to_text_only(self, request, queryset):
        """Admin action: Generate audio for text-only podcasts that don't have audio yet."""
        from dailycast.services_interactive import synthesize_single_language_audio
        
        text_only_podcasts = queryset.filter(
            output_format='text',
            script_text__isnull=False
        ).exclude(script_text__exact='')
        
        success_count = 0
        error_count = 0
        
        for podcast in text_only_podcasts:
            try:
                logger.info(f"Generating audio for text-only podcast {podcast.id}...")
                
                # Generate audio
                audio_bytes, tts_provider = synthesize_single_language_audio(
                    podcast.script_text,
                    podcast.primary_language
                )
                
                if audio_bytes:
                    # Save audio
                    filename = f"podcast_{podcast.id}_{podcast.primary_language}_{int(time.time())}.mp3"
                    podcast.audio_file.save(filename, ContentFile(audio_bytes), save=False)
                    podcast.tts_provider = tts_provider
                    
                    # Update format to "both"
                    podcast.output_format = 'both'
                    podcast.status = DailyPodcast.STATUS_COMPLETED
                    podcast.save()
                    
                    success_count += 1
                    logger.info(f"✅ Audio added to podcast {podcast.id}: {filename}")
                else:
                    error_count += 1
                    logger.warning(f"⚠️ Audio generation returned empty bytes for podcast {podcast.id}")
                    
            except Exception as e:
                error_count += 1
                logger.exception(f"Error generating audio for podcast {podcast.id}: {e}")
        
        self.message_user(
            request,
            f"✅ Added audio to {success_count} text-only podcasts. Errors: {error_count}",
            messages.SUCCESS if error_count == 0 else messages.WARNING
        )
    
    add_audio_to_text_only.short_description = "🎧 Add audio to selected text-only podcasts"

    def regenerate_audio_from_script(self, request, queryset):
        """Admin action: Regenerate audio from existing scripts (fix quality issues or provider changes)."""
        from dailycast.services_interactive import synthesize_audio_for_language
        
        podcasts_with_scripts = queryset.filter(
            script_text__isnull=False
        ).exclude(script_text__exact='')
        
        success_count = 0
        error_count = 0
        skip_count = 0
        
        for podcast in podcasts_with_scripts:
            try:
                logger.info(f"Regenerating audio for podcast {podcast.id}...")
                
                # Regenerate primary language audio
                if podcast.primary_language and podcast.script_text:
                    audio_bytes, tts_provider = synthesize_audio_for_language(
                        podcast.script_text,
                        podcast.primary_language
                    )
                    
                    if audio_bytes:
                        filename = f"podcast_{podcast.id}_{podcast.primary_language}_{int(time.time())}.mp3"
                        podcast.audio_file.save(filename, ContentFile(audio_bytes), save=False)
                        podcast.tts_provider = tts_provider
                        logger.info(f"✅ Regenerated primary audio ({podcast.primary_language}) for podcast {podcast.id}")
                    else:
                        logger.warning(f"⚠️ Audio generation returned empty for primary language")
                        error_count += 1
                        continue
                
                # Regenerate secondary language audio if applicable
                if podcast.secondary_language and podcast.script_text:
                    audio_bytes_sec, provider_sec = synthesize_audio_for_language(
                        podcast.script_text,
                        podcast.secondary_language
                    )
                    
                    if audio_bytes_sec:
                        filename_sec = f"podcast_{podcast.id}_{podcast.secondary_language}_{int(time.time())}.mp3"
                        podcast.audio_file_secondary.save(filename_sec, ContentFile(audio_bytes_sec), save=False)
                        logger.info(f"✅ Regenerated secondary audio ({podcast.secondary_language}) for podcast {podcast.id}")
                
                # Save the podcast with updated audio files
                podcast.save()
                success_count += 1
                logger.info(f"✅ Successfully regenerated audio for podcast {podcast.id}")
                    
            except Exception as e:
                error_count += 1
                logger.exception(f"Error regenerating audio for podcast {podcast.id}: {e}")
        
        self.message_user(
            request,
            f"✅ Regenerated audio for {success_count} podcast(s). Errors: {error_count}",
            messages.SUCCESS if error_count == 0 else messages.WARNING
        )
    
    regenerate_audio_from_script.short_description = "🔄 Regenerate audio from existing scripts"

    formfield_overrides = {
        # Bigger text area for script_text
        models.TextField: {"widget": forms.Textarea(attrs={"rows": 20, "cols": 120})},
    }

    def save_model(self, request, obj, form, change):
        """Save podcast and regenerate audio if TTS provider OR script text changed.
        Uses the edited script from the form (manual edits are preserved)."""
        super().save_model(request, obj, form, change)
        
        # If TTS provider OR script_text was changed, regenerate audio using the (possibly edited) script
        if change and ('tts_provider' in form.changed_data or 'script_text' in form.changed_data) and obj.script_text:
            try:
                from dailycast.services_interactive import synthesize_audio_for_language
                
                # Determine what changed
                if 'tts_provider' in form.changed_data:
                    logger.info(f"🎵 ADMIN_SAVE: TTS provider changed to {obj.tts_provider} for podcast {obj.id}")
                if 'script_text' in form.changed_data:
                    logger.info(f"🎵 ADMIN_SAVE: Script text was manually edited for podcast {obj.id}")
                
                logger.info(f"🎵 ADMIN_SAVE: Regenerating audio using the current script text ({len(obj.script_text)} chars)")
                
                # Regenerate primary audio using the CURRENT (possibly edited) script
                if obj.primary_language:
                    logger.info(f"🎵 ADMIN_SAVE: Calling synthesize_audio_for_language for {obj.primary_language} with provider {obj.tts_provider}")
                    
                    audio_bytes, provider = synthesize_audio_for_language(
                        obj.script_text, 
                        obj.primary_language,
                        preferred_provider=obj.tts_provider
                    )
                    
                    logger.info(f"🎵 ADMIN_SAVE: synthesize_audio_for_language returned: provider={provider}, bytes={len(audio_bytes) if audio_bytes else 0}")
                    
                    if audio_bytes:
                        filename = f"podcast_{obj.id}_{obj.primary_language}.mp3"
                        obj.audio_file.save(filename, ContentFile(audio_bytes), save=True)
                        obj.tts_provider = provider
                        logger.info(f"✅ ADMIN_SAVE: Regenerated primary audio with provider={provider}")
                
                # Regenerate secondary audio if applicable
                if obj.secondary_language:
                    logger.info(f"🎵 ADMIN_SAVE: Calling synthesize_audio_for_language for secondary language {obj.secondary_language} with provider {obj.tts_provider}")
                    
                    audio_bytes_sec, provider_sec = synthesize_audio_for_language(
                        obj.script_text, 
                        obj.secondary_language,
                        preferred_provider=obj.tts_provider
                    )
                    
                    logger.info(f"🎵 ADMIN_SAVE: Secondary synthesize_audio_for_language returned: provider={provider_sec}, bytes={len(audio_bytes_sec) if audio_bytes_sec else 0}")
                    
                    if audio_bytes_sec:
                        filename_sec = f"podcast_{obj.id}_{obj.secondary_language}.mp3"
                        obj.audio_file_secondary.save(filename_sec, ContentFile(audio_bytes_sec), save=True)
                        logger.info(f"✅ ADMIN_SAVE: Regenerated secondary audio with provider={provider_sec}")
                
                obj.save()
                
                change_type = []
                if 'tts_provider' in form.changed_data:
                    change_type.append("TTS provider")
                if 'script_text' in form.changed_data:
                    change_type.append("script text")
                
                messages.success(
                    request,
                    f"✅ Audio regenerated with {provider} (changed: {', '.join(change_type)})"
                )
                logger.info(f"✅ ADMIN_SAVE: Successfully saved podcast {obj.id} with regenerated audio")
            except Exception as e:
                logger.error(f"❌ ADMIN_SAVE: Audio regeneration failed: {str(e)}")
                messages.error(request, f"⚠️ Audio regeneration failed: {str(e)}")

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "llm-models/",
                self.admin_site.admin_view(self.get_llm_models_api),
                name="dailycast_get_llm_models",
            ),
            path(
                "generate-test/",
                self.admin_site.admin_view(self.generate_test_podcast),
                name="dailycast_dailypodcast_generate_test",
            ),
        ]
        return custom_urls + urls
    
    def get_llm_models_api(self, request):
        """AJAX endpoint to get available models for selected LLM provider."""
        provider = request.GET.get('provider', 'template')
        
        # Get models for the provider
        models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
        
        # Format for AJAX response
        response_data = {
            'models': [{'value': m[0], 'label': m[1]} for m in models],
            'tooltip': LLM_PROVIDER_TOOLTIPS.get(provider, 'Choose a provider')
        }
        
        return JsonResponse(response_data)
    
    def generate_test_podcast(self, request):
        """Generate podcast for ANY user (admin/staff only).
        
        Query params:
        - user_id: Target user ID to generate podcast for
        - language: Language code (en, ja, es, etc)
        """
        User = get_user_model()
        user_id = request.GET.get("user_id") or request.POST.get("user_id")
        language = request.GET.get("language") or getattr(
            settings, "DAILYCAST_DEFAULT_LANGUAGE", "en"
        )
        
        # ✅ NEW: Accept user_id parameter (any user, not just test user)
        if not user_id:
            messages.error(request, "user_id parameter required")
            return self._redirect_to_changelist()
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            messages.error(request, f"User with ID {user_id} not found")
            return self._redirect_to_changelist()

        try:
            # Try to generate podcast synchronously (on-demand, no Celery)
            from dailycast.services_interactive import create_multilingual_podcast_for_user
            
            # ✅ NEW: Track that admin requested this, not the user
            podcast = create_multilingual_podcast_for_user(
                user,
                primary_language=language,
                output_format="both",
                requested_by=request.user,  # Admin who triggered it
                request_type='admin_dashboard'  # How it was triggered
            )
            messages.success(
                request,
                f"✅ Podcast generated for {user.username} (ID {user_id})"
            )
        except ValueError as e:
            messages.warning(request, f"⏳ {e}")
        except PermissionError as e:
            messages.error(request, f"🚫 {e}")
        except Exception as e:
            logger.exception("Podcast generation failed")
            messages.error(request, f"❌ Podcast generation failed: {e}")

        return self._redirect_to_changelist()

    def generate_interactive_podcast(self, request, podcast_id):
        """Generate interactive multilingual podcast."""
        if request.method != 'POST':
            return redirect(f'/admin/dailycast/dailypodcast/{podcast_id}/change/')
        
        try:
            podcast = DailyPodcast.objects.get(id=podcast_id)
            
            # Generate new podcast with current settings
            from dailycast.services_interactive import create_multilingual_podcast_for_user
            
            new_podcast = create_multilingual_podcast_for_user(
                user=podcast.user,
                primary_language=podcast.primary_language,
                secondary_language=podcast.secondary_language,
                output_format=podcast.output_format,
                included_courses=podcast.included_courses,
            )
            
            messages.success(
                request,
                f"✅ Podcast generated successfully! (ID: {new_podcast.id})"
            )
            return redirect(f'/admin/dailycast/dailypodcast/{new_podcast.id}/change/')
            
        except Exception as e:
            messages.error(request, f"❌ Error: {str(e)}")
            return redirect(f'/admin/dailycast/dailypodcast/{podcast_id}/change/')

    def _redirect_to_changelist(self):
        changelist_url = reverse("admin:dailycast_dailypodcast_changelist")
        return redirect(changelist_url)

    # Display methods for list_display
    def podcast_id(self, obj):
        return f"#{obj.id}"
    podcast_id.short_description = "ID"
    
    def user_display(self, obj):
        return f"{obj.user.username}"
    user_display.short_description = "User"
    
    def language_display(self, obj):
        # Support both old 'language' field and new fields
        if hasattr(obj, 'primary_language') and obj.primary_language:
            langs = obj.primary_language.upper()
            if hasattr(obj, 'secondary_language') and obj.secondary_language:
                langs += f" + {obj.secondary_language.upper()}"
            return langs
        elif hasattr(obj, 'language'):
            return obj.language.upper()
        return "—"
    language_display.short_description = "Languages"
    
    def format_display(self, obj):
        if hasattr(obj, 'output_format') and obj.output_format:
            formats = {
                'text': '📄 Text',
                'audio': '🎧 Audio',
                'both': '📄+🎧',
            }
            return formats.get(obj.output_format, obj.output_format)
        return "—"
    format_display.short_description = "Format"
    
    def duration_display(self, obj):
        if not hasattr(obj, 'duration_seconds') or not obj.duration_seconds:
            return "—"
        
        minutes = obj.duration_seconds // 60
        seconds = obj.duration_seconds % 60
        text = f"{minutes}:{seconds:02d}"
        
        if hasattr(obj, 'duration_seconds_secondary') and obj.duration_seconds_secondary:
            minutes_sec = obj.duration_seconds_secondary // 60
            seconds_sec = obj.duration_seconds_secondary % 60
            text += f" + {minutes_sec}:{seconds_sec:02d}"
        
        return text
    duration_display.short_description = "Duration"
    
    def has_audio(self, obj):
        if hasattr(obj, 'output_format'):
            if obj.output_format == 'text':
                return '📄'
            elif obj.output_format == 'audio':
                return '🎧' if obj.audio_file else '❌'
            else:  # both
                audio = '🎧' if obj.audio_file else '❌'
                secondary = '🎧' if (hasattr(obj, 'audio_file_secondary') and obj.audio_file_secondary) else '⭕'
                return f"{audio} {secondary}"
        return "—"
    has_audio.short_description = "Audio"

    # Readonly field renderers
    def audio_player(self, obj):
        """Render HTML5 audio player for primary language."""
        if not obj.audio_file:
            return "❌ No audio file"
        
        lang = getattr(obj, 'primary_language', 'unknown').upper()
        return mark_safe(f'''
        <div style="margin: 10px 0;">
            <strong>Primary Language ({lang}):</strong><br>
            <audio controls style="width: 100%; max-width: 400px;">
                <source src="{obj.audio_file.url}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <br><small>{obj.duration_seconds // 60}:{obj.duration_seconds % 60:02d}</small>
        </div>
        ''')
    audio_player.short_description = "Primary Audio"
    
    def audio_player_secondary(self, obj):
        """Render HTML5 audio player for secondary language."""
        if not hasattr(obj, 'audio_file_secondary') or not obj.audio_file_secondary:
            return "⭕ No secondary language audio"
        
        lang = getattr(obj, 'secondary_language', 'unknown').upper()
        return mark_safe(f'''
        <div style="margin: 10px 0;">
            <strong>Secondary Language ({lang}):</strong><br>
            <audio controls style="width: 100%; max-width: 400px;">
                <source src="{obj.audio_file_secondary.url}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <br><small>{obj.duration_seconds_secondary // 60}:{obj.duration_seconds_secondary % 60:02d}</small>
        </div>
        ''')
    audio_player_secondary.short_description = "Secondary Audio"
    
    def questions_display(self, obj):
        """Display questions asked in podcast."""
        if not hasattr(obj, 'questions_asked') or not obj.questions_asked:
            return "No questions asked"
        
        html = "<ul>"
        for i, q in enumerate(obj.questions_asked, 1):
            html += f"<li>{q}</li>"
        html += "</ul>"
        return mark_safe(html)
    questions_display.short_description = "Questions Asked"
    
    def error_display(self, obj):
        """Display error message if generation failed."""
        if not obj.error_message:
            return "✅ No errors"
        
        return mark_safe(f'<span style="color: red; font-weight: bold;">❌ {obj.error_message}</span>')
    error_display.short_description = "Status"


admin.site.register(DailyPodcast, DailyPodcastAdmin)


# ===== TEACHER CONTENT CONFIG ADMIN =====

class GlobalPodcastDefaultsAdmin(admin.ModelAdmin):
    """
    Global default settings for ALL podcast generation.
    
    ✅ These settings apply to every user UNLESS overridden by their student group.
    
    How it works:
    1. You set global defaults here (cost, AI model, cooldown, etc.)
    2. If a user is in a Student Group, that group can override any setting
    3. Settings without overrides fall back to these global values
    
    Example:
    - Global default: cost = $0.50
    - Beginner group: cost = $0.25 (override)
    - Advanced group: (blank, uses global $0.50)
    """
    
    form = TeacherContentConfigForm
    
    # Don't allow adding multiple instances
    def has_add_permission(self, request):
        return not TeacherContentConfig.objects.exists()
    
    # Don't allow deletion
    def has_delete_permission(self, request, obj=None):
        return False
    
    class Media:
        js = ('dailycast/js/llm_model_selector.js',)
    
    def get_urls(self):
        """Add AJAX endpoint for model selection."""
        urls = super().get_urls()
        custom_urls = [
            path(
                "llm-models/",
                self.admin_site.admin_view(self.get_llm_models_api),
                name="dailycast_teachercontentconfig_llm_models",
            ),
        ]
        return custom_urls + urls
    
    def get_llm_models_api(self, request):
        """AJAX endpoint to get available models for selected LLM provider."""
        provider = request.GET.get('provider', 'template')
        
        # Get models for the provider
        models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
        
        # Format for AJAX response
        response_data = {
            'models': [{'value': m[0], 'label': m[1]} for m in models],
            'tooltip': LLM_PROVIDER_TOOLTIPS.get(provider, 'Choose a provider')
        }
        
        return JsonResponse(response_data)
    
    fieldsets = (
        ('✅ CURRENTLY SAVED CONFIGURATION', {
            'fields': ('saved_config_display',),
            'classes': ('wide',),
            'description': mark_safe(
                '<div style="background: #d4edda; border: 2px solid #28a745; padding: 15px; border-radius: 5px; margin-bottom: 15px;">'
                '<strong style="color: #155724; font-size: 16px;">✅ WHAT IS CURRENTLY SAVED IN DATABASE</strong>'
                '</div>'
            )
        }),
        ('🟢 ENABLED', {
            'fields': ('enabled',),
            'classes': ('wide',),
        }),
        ('🌐 BASIC SETTINGS', {
            'fields': ('default_language', 'default_output_format'),
            'classes': ('wide',),
        }),
        ('🤖 LLM PROVIDER SETTINGS', {
            'fields': ('default_llm_provider', 'llm_model'),
            'description': 'Configure which AI model generates teacher scripts',
            'classes': ('wide',),
        }),
        ('🎵 TTS PROVIDER SETTINGS', {
            'fields': (
                'default_tts_provider',
                'tts_fallback_chain',
                'tts_speaking_rate',
                'tts_pitch',
                'tts_volume_gain',
            ),
            'description': 'Configure text-to-speech audio generation',
            'classes': ('wide',),
        }),
        ('🗣️ VOICE SELECTION (Optional)', {
            'fields': ('voice_map_json',),
            'description': mark_safe(
                '<strong>Optional:</strong> Leave empty to use default voices. '
                'To customize voices for specific languages, enter JSON format:<br>'
                '<code>{"en": "your-voice-id-for-english", "ja": "your-voice-id-for-japanese"}</code><br>'
                '<em>Example with ElevenLabs voice IDs:</em><br>'
                '<code>{"en": "EXAMPLEvoice123", "ja": "EXAMPLEvoice456", "es": "EXAMPLEvoice789"}</code>'
            ),
            'classes': ('wide',),
        }),
        ('📝 SCRIPT GENERATION', {
            'fields': (
                'script_word_limit_normal',
                'script_word_limit_short',
                'script_include_questions',
                'num_questions_per_script',
                'include_motivational_quote',
            ),
            'description': 'Control how teacher scripts are generated',
            'classes': ('wide',),
        }),
        ('💬 PROMPT TEMPLATES', {
            'fields': (
                'prompt_system_role',
                'prompt_script_intro',
                'prompt_tone_guide',
            ),
            'description': 'Customize the prompts sent to LLM',
            'classes': ('wide', 'collapse'),
        }),
        ('⏱️ COOLDOWN & QUOTA', {
            'fields': (
                'cooldown_hours',
                'test_user_cooldown_enabled',
                'max_generations_per_day',
            ),
            'description': 'Control rate limiting and usage quotas',
            'classes': ('wide',),
        }),
        ('💰 PRICING & CREDITS', {
            'fields': (
                'cost_per_generation',
                'enable_credit_system',
            ),
            'description': 'Configure credit costs for generations',
            'classes': ('wide',),
        }),
        ('🌍 BILINGUAL SETTINGS', {
            'fields': (
                'support_bilingual',
                'bilingual_default_pair',
                'bilingual_audio_stitch',
            ),
            'description': 'Configure multilingual content generation',
            'classes': ('wide',),
        }),
        ('🔍 LOGGING & DEBUG', {
            'fields': (
                'verbose_logging',
                'debug_mode',
            ),
            'description': 'Enable detailed logging (debug_mode should be False in production)',
            'classes': ('wide',),
        }),
        ('📅 METADATA', {
            'fields': ('created_at', 'updated_at', 'last_modified_by'),
            'classes': ('wide', 'collapse'),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'saved_config_display')
    
    def saved_config_display(self, obj):
        """Display what is currently saved in the database."""
        if not obj.pk:
            return mark_safe('<em>New configuration - not yet saved</em>')
        
        html = '<div style="background: #f8f9fa; padding: 15px; border: 2px solid #28a745; border-radius: 5px;">'
        html += '<h3 style="color: #28a745; margin-top: 0;">✅ CURRENTLY SAVED CONFIGURATION</h3>'
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">'
        
        # Helper function for table rows
        def add_row(label, value, highlight=True):
            color = '#28a745' if highlight else '#333'
            weight = 'bold' if highlight else 'normal'
            return f'<tr><td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold; width: 30%;"><strong>{label}:</strong></td><td style="padding: 10px; border-bottom: 1px solid #dee2e6; color: {color}; font-weight: {weight};">{value}</td></tr>'
        
        # ===== BASIC SETTINGS =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">🌐 BASIC SETTINGS</td></tr>'
        html += add_row('Enabled', '✅ Yes' if obj.enabled else '❌ No')
        html += add_row('Default Language', obj.default_language)
        html += add_row('Default Output Format', obj.default_output_format)
        
        # ===== LLM SETTINGS =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">🤖 LLM PROVIDER SETTINGS</td></tr>'
        html += add_row('LLM Provider', obj.default_llm_provider)
        
        if obj.default_llm_provider == 'openai':
            model = obj.openai_model
        elif obj.default_llm_provider == 'gemini':
            model = obj.gemini_model
        elif obj.default_llm_provider == 'claude':
            model = getattr(obj, 'claude_model', 'N/A')
        else:
            model = getattr(obj, 'template_model', 'template')
        
        html += add_row('LLM Model', model)
        
        # ===== TTS SETTINGS =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">🎵 TTS PROVIDER SETTINGS</td></tr>'
        html += add_row('TTS Provider', obj.default_tts_provider)
        html += add_row('TTS Speaking Rate', f'{obj.tts_speaking_rate}x', False)
        html += add_row('TTS Pitch', f'{obj.tts_pitch}', False)
        html += add_row('TTS Volume Gain', f'{obj.tts_volume_gain} dB', False)
        
        fallback = str(obj.tts_fallback_chain) if obj.tts_fallback_chain else '[]'
        html += add_row('TTS Fallback Chain', fallback, False)
        
        # ===== VOICE SELECTION =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">🗣️ VOICE SELECTION</td></tr>'
        voice_text = str(obj.voice_map_json) if obj.voice_map_json else '{}'
        html += add_row('Voice Map', f'<code style="background: #fff; padding: 5px; border-radius: 3px; font-family: monospace;">{voice_text}</code>', False)
        
        # ===== SCRIPT GENERATION =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">📝 SCRIPT GENERATION</td></tr>'
        html += add_row('Script Word Limit (Normal)', f'{obj.script_word_limit_normal} words', False)
        html += add_row('Script Word Limit (Short)', f'{obj.script_word_limit_short} words', False)
        html += add_row('Include Questions', '✅ Yes' if obj.script_include_questions else '❌ No', False)
        html += add_row('Questions per Script', f'{obj.num_questions_per_script}', False)
        html += add_row('Include Motivational Quote', '✅ Yes' if obj.include_motivational_quote else '❌ No', False)
        
        # ===== PROMPT TEMPLATES =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">💬 PROMPT TEMPLATES</td></tr>'
        html += add_row('System Role', f'<em>{obj.prompt_system_role[:100]}...</em>' if len(obj.prompt_system_role) > 100 else f'<em>{obj.prompt_system_role}</em>', False)
        html += add_row('Script Intro', f'<em>{obj.prompt_script_intro[:100]}...</em>' if len(obj.prompt_script_intro) > 100 else f'<em>{obj.prompt_script_intro}</em>', False)
        html += add_row('Tone Guide', f'<em>{obj.prompt_tone_guide[:100]}...</em>' if len(obj.prompt_tone_guide) > 100 else f'<em>{obj.prompt_tone_guide}</em>', False)
        
        # ===== COOLDOWN & QUOTA =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">⏱️ COOLDOWN & QUOTA</td></tr>'
        html += add_row('Cooldown Hours', f'{obj.cooldown_hours} hours', False)
        html += add_row('Test User Cooldown Enabled', '✅ Yes' if obj.test_user_cooldown_enabled else '❌ No', False)
        html += add_row('Max Generations per Day', f'{obj.max_generations_per_day} (0=unlimited)', False)
        
        # ===== PRICING =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">💰 PRICING & CREDITS</td></tr>'
        html += add_row('Cost per Generation', f'${obj.cost_per_generation}')
        html += add_row('Enable Credit System', '✅ Yes' if obj.enable_credit_system else '❌ No', False)
        
        # ===== BILINGUAL SETTINGS =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">🌍 BILINGUAL SETTINGS</td></tr>'
        html += add_row('Support Bilingual', '✅ Yes' if obj.support_bilingual else '❌ No', False)
        html += add_row('Bilingual Default Pair', obj.bilingual_default_pair, False)
        html += add_row('Bilingual Audio Stitch', '✅ Yes' if obj.bilingual_audio_stitch else '❌ No', False)
        
        # ===== LOGGING & DEBUG =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">🔍 LOGGING & DEBUG</td></tr>'
        html += add_row('Verbose Logging', '✅ Yes' if obj.verbose_logging else '❌ No', False)
        html += add_row('Debug Mode', '✅ Yes' if obj.debug_mode else '❌ No', False)
        
        # ===== METADATA =====
        html += '<tr><td colspan="2" style="padding: 12px 10px; background: #e9ecef; font-weight: bold; border-bottom: 2px solid #dee2e6;">📅 METADATA</td></tr>'
        html += add_row('Created At', str(obj.created_at), False)
        html += add_row('Updated At', str(obj.updated_at), False)
        if obj.last_modified_by:
            html += add_row('Last Modified By', str(obj.last_modified_by), False)
        
        html += '</table>'
        html += '</div>'
        
        return mark_safe(html)
    saved_config_display.short_description = "✅ Currently Saved"
    
    def save_model(self, request, obj, form, change):
        """Track who modified the config."""
        import logging
        logger = logging.getLogger("django")
        logger.error("=" * 80)
        logger.error("🔍 ADMIN save_model() CALLED")
        logger.error(f"obj: {obj}")
        logger.error(f"form.is_valid(): {form.is_valid()}")
        logger.error(f"form.errors: {form.errors}")
        logger.error(f"form.cleaned_data: {form.cleaned_data if hasattr(form, 'cleaned_data') else 'NO CLEANED_DATA'}")
        logger.error("=" * 80)
        
        obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)
    
    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        """Override to log POST processing."""
        import logging
        logger = logging.getLogger("django")
        
        if request.method == 'POST':
            logger.error("=" * 80)
            logger.error("🔍 ADMIN changeform_view() - POST RECEIVED")
            logger.error(f"POST data keys: {list(request.POST.keys())}")
            logger.error(f"llm_model in POST: {request.POST.get('llm_model')}")
            logger.error(f"default_llm_provider in POST: {request.POST.get('default_llm_provider')}")
            logger.error(f"voice_map_json in POST: {request.POST.get('voice_map_json')}")
            logger.error("=" * 80)
        
        result = super().changeform_view(request, object_id, form_url, extra_context)
        
        if request.method == 'POST':
            logger.error("=" * 80)
            logger.error("🔍 ADMIN changeform_view() - POST COMPLETED")
            logger.error(f"Result type: {type(result)}")
            logger.error(f"Result status_code: {getattr(result, 'status_code', 'NO STATUS')}")
            logger.error("=" * 80)
        
        return result
    
    def changelist_view(self, request, extra_context=None):
        """Redirect to config edit page directly."""
        config = TeacherContentConfig.get_config()
        from django.http import HttpResponseRedirect
        from django.urls import reverse
        return HttpResponseRedirect(reverse('admin:dailycast_teachercontentconfig_change', args=[config.pk]))


class UserCategoryConfigInline(admin.StackedInline):
    """Inline admin for category configuration."""
    from dailycast.models import UserCategoryConfig
    model = UserCategoryConfig
    extra = 0
    form = UserCategoryConfigForm
    
    fieldsets = (
        ("Basic Settings", {
            "fields": ("enabled", "default_language", "default_output_format")
        }),
        ("LLM Settings", {
            "fields": ("default_llm_provider", "llm_model"),
            "description": mark_safe(
                "<div style='background-color: #f0f0f0; padding: 10px; border-radius: 5px; margin-bottom: 10px;'>"
                "<strong>💡 How to use:</strong><br>"
                "1. Choose an AI provider (OpenAI, Google Gemini, Claude, or Template)<br>"
                "2. The available models will automatically update below<br>"
                "<strong>🤖 What's the difference?</strong><br>"
                "• <strong>OpenAI (GPT)</strong>: Most popular, very smart, good for professional content<br>"
                "• <strong>Gemini</strong>: Google's AI, fast, great for creativity, cheap<br>"
                "• <strong>Claude</strong>: Best for writing, analysis, reasoning<br>"
                "• <strong>Template</strong>: Free but basic (for testing only)<br>"
                "</div>"
            )
        }),
        ("TTS Settings", {
            "fields": ("default_tts_provider", "tts_speaking_rate")
        }),
        ("Generation Settings", {
            "fields": ("script_word_limit",)
        }),
        ("Cooldown & Quotas", {
            "fields": ("cooldown_hours", "max_generations_per_day")
        }),
        ("Pricing", {
            "fields": ("cost_per_generation",)
        }),
    )
    
    class Media:
        js = ('dailycast/js/llm_model_selector.js',)


class StudentGroupAdmin(admin.ModelAdmin):
    """Manage Student Groups and show their override config inline."""

    class Media:
        js = ('dailycast/js/llm_model_selector.js',)

    inlines = [UserCategoryConfigInline]

    list_display = (
        "name",
        "user_count",
        "is_active",
        "config_status",
        "created_date",
    )

    list_filter = (
        "is_active",
        "created_at",
    )

    search_fields = (
        "name",
        "description",
        "users__username",
        "users__email",
    )

    filter_horizontal = ("users",)

    fieldsets = (
        ("🎓 Group Information", {
            "fields": ("name", "description", "is_active")
        }),
        ("👥 Users", {
            "fields": ("users",),
            "description": "Select users to add to this student group"
        }),
    )

    readonly_fields = ("created_at", "updated_at")

    def user_count(self, obj):
        return obj.users.count()
    user_count.short_description = "👥 Users"

    def config_status(self, obj):
        if hasattr(obj, "config") and obj.config:
            status = "✅ Configured" if obj.config.enabled else "❌ Disabled"
            return mark_safe(f'<span style="color: green;">{status}</span>')
        return "⚠️ No Config"
    config_status.short_description = "Override Status"

    def created_date(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")
    created_date.short_description = "Created"


class PerCategoryOverrideAdmin(admin.ModelAdmin):
    """
    Settings overrides for specific student groups.
    
    ✅ Only edit this if you want to OVERRIDE global defaults for a group.
    
    IMPORTANT:
    - You should NOT edit this directly - use the student group page instead
    - Click the student group, then scroll to "SETTINGS OVERRIDE" section
    - Leave fields blank to use the global default
    - Only fill in fields you want to change
    """
    
    form = UserCategoryConfigForm
    
    list_display = (
        "category",
        "user_count",
        "llm_provider_display",
        "cost_display",
        "cooldown_display",
    )
    
    fieldsets = (
        ("Settings Override", {
            "fields": (
                "enabled",
                "default_llm_provider",
                "llm_model",
                "default_tts_provider",
                "tts_speaking_rate",
                "cost_per_generation",
                "cooldown_hours",
                "max_generations_per_day",
                "script_word_limit",
            ),
            "description": mark_safe(
                "<div style='background: #275495; padding: 12px; border-radius: 5px; border-left: 4px solid #ff9800;'>"
                "<strong>💡 Tip:</strong> Leave a field BLANK to use the global default.<br>"
                "Only fill in values you want to OVERRIDE for this group.<br><br>"
                "<strong>Example:</strong><br>"
                "• Global cost: $0.50<br>"
                "• This group cost: $0.25 (override) → Beginners pay less<br>"
                "• Global cooldown: 24 hours<br>"
                "• This group cooldown: (blank) → Beginners use global 24 hours"
                "</div>"
            )
        }),
    )
    
    class Media:
        js = ('dailycast/js/llm_model_selector.js',)
    
    def get_urls(self):
        """Add AJAX endpoint for model selection."""
        urls = super().get_urls()
        custom_urls = [
            path(
                "llm-models/",
                self.admin_site.admin_view(self.get_llm_models_api),
                name="dailycast_usercategoryconfig_llm_models",
            ),
        ]
        return custom_urls + urls
    
    def get_llm_models_api(self, request):
        """AJAX endpoint to get available models for selected LLM provider."""
        provider = request.GET.get('provider', 'template')
        
        # Get models for the provider
        models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
        
        # Format for AJAX response
        response_data = {
            'models': [{'value': m[0], 'label': m[1]} for m in models],
            'tooltip': LLM_PROVIDER_TOOLTIPS.get(provider, 'Choose a provider')
        }
        
        return JsonResponse(response_data)
    
    def user_count(self, obj):
        return obj.category.users.count()
    user_count.short_description = "👥 Users in Group"
    
    def llm_provider_display(self, obj):
        if obj.default_llm_provider:
            return f"🤖 {obj.default_llm_provider} (override)"
        return "— (uses global)"
    llm_provider_display.short_description = "AI Model"
    
    def cost_display(self, obj):
        if obj.cost_per_generation:
            return f"💰 ${obj.cost_per_generation} (override)"
        return "— (uses global)"
    cost_display.short_description = "Cost/Podcast"
    
    def cooldown_display(self, obj):
        if obj.cooldown_hours:
            return f"⏱️ {obj.cooldown_hours}h (override)"
        return "— (uses global)"
    cooldown_display.short_description = "Cooldown"
    
    def config_status(self, obj):
        if hasattr(obj, "config") and obj.config:
            status = "✅ Configured" if obj.config.enabled else "❌ Disabled"
            return mark_safe(f'<span style="color: green;">{status}</span>')
        return "⚠️ No Config"
    config_status.short_description = "Config Status"
    
    def created_date(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")
    created_date.short_description = "Created"


class UserCategoryConfigAdmin(admin.ModelAdmin):
    """Admin interface for category-specific configurations."""
    form = UserCategoryConfigForm
    change_form_template = 'admin/change_form.html'
    
    class Media:
        js = ('dailycast/js/llm_model_selector.js',)
    
    list_display = (
        "category_name",
        "enabled",
        "default_language",
        "llm_display",
        "model_display",
        "default_tts_provider",
        "cooldown_hours",
        "max_generations_per_day",
        "cost_display",
    )
    
    list_filter = (
        "enabled",
        "default_language",
        "default_llm_provider",
        "default_tts_provider",
        "created_at",
    )
    
    search_fields = (
        "category__name",
        "category__description",
    )
    
    fieldsets = (
        ("Category", {
            "fields": ("category",)
        }),
        ("Basic Settings", {
            "fields": ("enabled", "default_language", "default_output_format")
        }),
        ("LLM Provider Settings", {
            "fields": ("default_llm_provider", "llm_model"),
            "description": mark_safe(
                "<div style='background-color: #417690; padding: 12px; border-radius: 5px; border-left: 4px solid #0066cc;'>"
                "<strong style='font-size: 16px;'>🤖 AI Provider & Model Selection</strong><br><br>"
                "<strong>What is an AI Provider?</strong><br>"
                "It's the company that creates the artificial intelligence. Different providers have different AI models.<br><br>"
                "<strong>What is a Model?</strong><br>"
                "A model is a specific version of AI within that provider. Think of it like choosing between:\n"
                "• iPhone 15 (newest, best features)\n"
                "• iPhone 14 (good, cheaper)\n"
                "• iPhone 13 (older, cheapest)<br><br>"
                "<strong>💡 Quick Guide:</strong><br>"
                "<strong style='color: #0066cc;'>OpenAI (GPT):</strong> Most used, great for all types of content. Choose gpt-4o-mini for best balance of quality and cost.<br>"
                "<strong style='color: #009900;'>Google Gemini:</strong> Very fast, creative, cheaper. Great for educational content.<br>"
                "<strong style='color: #cc6600;'>Claude:</strong> Best for writing and detailed analysis. Slightly slower.<br>"
                "<strong style='color: #999999;'>Template:</strong> Free, basic output. Use only for testing.<br><br>"
                "<strong>📊 Cost Comparison (approximate):</strong><br>"
                "Template < Gemini-Flash < GPT-3.5 < GPT-4o-mini < Claude-Haiku < GPT-4 Turbo < Claude-Opus<br>"
                "</div>"
            )
        }),
        ("TTS Provider Settings", {
            "fields": ("default_tts_provider", "tts_speaking_rate"),
            "description": mark_safe(
                "<div style='background-color: #417690; padding: 10px; border-radius: 5px;'>"
                "<strong>🎧 Voice Provider Tips:</strong><br>"
                "• <strong>ElevenLabs:</strong> Most natural voice (best choice!)<br>"
                "• <strong>Google:</strong> Free tier available, good quality<br>"
                "• <strong>OpenAI:</strong> Simple voices, lower cost"
                "</div>"
            )
        }),
        ("Script Generation", {
            "fields": ("script_word_limit",),
            "description": "How long can podcasts be? Higher number = longer podcasts (but uses more AI tokens)"
        }),
        ("Cooldown & Quota", {
            "fields": ("cooldown_hours", "max_generations_per_day"),
            "description": mark_safe(
                "<div style='background-color: #417690; padding: 10px; border-radius: 5px;'>"
                "<strong>⏱️ Limits Explained:</strong><br>"
                "• <strong>Cooldown Hours:</strong> How long users must wait between generations (0 = no wait)<br>"
                "• <strong>Max Per Day:</strong> How many they can generate in 24 hours (0 = unlimited)"
                "</div>"
            )
        }),
        ("Pricing", {
            "fields": ("cost_per_generation",),
            "description": "How much to charge users per podcast (for billing/accounting purposes)"
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )
    
    readonly_fields = ("created_at", "updated_at")
    
    def category_name(self, obj):
        return obj.category.name
    category_name.short_description = "Category"
    
    def llm_display(self, obj):
        """Display LLM provider with icon."""
        icons = {
            'openai': '🤖',
            'gemini': '✨',
            'claude': '🧠',
            'template': '📚',
        }
        icon = icons.get(obj.default_llm_provider, '🔧')
        return f"{icon} {obj.get_default_llm_provider_display()}"
    llm_display.short_description = "AI Provider"
    
    def model_display(self, obj):
        """Display the selected model."""
        return obj.openai_model
    model_display.short_description = "Model"
    
    def cost_display(self, obj):
        return f"${obj.cost_per_generation}"
    cost_display.short_description = "Cost per Generation"
    
    def get_urls(self):
        """Add AJAX endpoint for model selection."""
        urls = super().get_urls()
        custom_urls = [
            path(
                "llm-models/",
                self.admin_site.admin_view(self.get_llm_models_api),
                name="dailycast_get_llm_models",
            ),
        ]
        return custom_urls + urls
    
    def get_llm_models_api(self, request):
        """AJAX endpoint to get available models for selected LLM provider."""
        provider = request.GET.get('provider', 'template')
        
        # Get models for the provider
        models = LLM_PROVIDER_MODELS.get(provider, LLM_PROVIDER_MODELS['template'])
        
        # Format for AJAX response
        response_data = {
            'models': [{'value': m[0], 'label': m[1]} for m in models],
            'tooltip': LLM_PROVIDER_TOOLTIPS.get(provider, 'Choose a provider')
        }
        
        return JsonResponse(response_data)


admin.site.register(UserCategory, StudentGroupAdmin)
admin.site.register(UserCategoryConfig, PerCategoryOverrideAdmin)
admin.site.register(TeacherContentConfig, GlobalPodcastDefaultsAdmin)

# Register Student Learning Insights Dashboard
from dailycast.admin_student_insights import StudentLearningInsight, StudentLearningInsightAdmin
admin.site.register([StudentLearningInsight], StudentLearningInsightAdmin)

# ============================================================================
# CACHE MANAGEMENT ADMIN INTERFACE
# ============================================================================
from dailycast.models import CachedAIInsight, CachedUserAnalytics, CacheStatistics

@admin.register(CachedAIInsight)
class CachedAIInsightAdmin(admin.ModelAdmin):
    """Display and manage cached AI insights with performance metrics."""
    
    list_display = (
        'user_display',
        'subject_display', 
        'engine_display',
        'hits_display',
        'tokens_saved_display',
        'freshness_status',
        'created_at_display',
    )
    
    list_filter = (
        'engine',
        'subject',
        'created_at',
        'expires_at',
    )
    
    search_fields = ('user__username', 'user__email', 'subject')
    readonly_fields = (
        'user',
        'subject',
        'engine',
        'tokens_used',
        'tokens_saved',
        'hits',
        'created_at',
        'ai_insights_preview',
        'cache_info',
    )
    
    fieldsets = (
        ('Cache Identity', {
            'fields': ('user', 'subject', 'engine')
        }),
        ('Cached Data', {
            'fields': ('ai_insights_preview',),
            'classes': ('collapse',)
        }),
        ('Performance Metrics', {
            'fields': ('hits', 'tokens_used', 'tokens_saved', 'cache_info'),
            'description': '💾 Shows how much this cache is being reused and tokens saved'
        }),
        ('Lifetime', {
            'fields': ('created_at', 'expires_at'),
        }),
    )
    
    def user_display(self, obj):
        return f"👤 {obj.user.get_full_name() or obj.user.username}"
    user_display.short_description = 'Student'
    user_display.admin_order_field = 'user__username'
    
    def subject_display(self, obj):
        return obj.subject or '📚 All Subjects'
    subject_display.short_description = 'Subject'
    
    def engine_display(self, obj):
        engines = {
            'gemini-2.0-flash-exp': '⚡ Gemini Flash',
            'gemini-2.0-pro-exp': '✨ Gemini Pro',
            'gpt-4o-mini': '⚡ GPT-4o Mini',
            'gpt-4o': '🎯 GPT-4o',
        }
        return engines.get(obj.engine, obj.engine)
    engine_display.short_description = 'AI Engine'
    
    def hits_display(self, obj):
        return f"🔄 {obj.hits} reuses"
    hits_display.short_description = 'Cache Hits'
    hits_display.admin_order_field = 'hits'
    
    def tokens_saved_display(self, obj):
        return f"💾 {obj.tokens_saved:,} tokens"
    tokens_saved_display.short_description = 'Tokens Saved'
    tokens_saved_display.admin_order_field = 'tokens_saved'
    
    def freshness_status(self, obj):
        from django.utils import timezone
        is_fresh = obj.expires_at > timezone.now()
        if is_fresh:
            return '✅ Fresh'
        return '⏱️ Expired'
    freshness_status.short_description = 'Status'
    
    def created_at_display(self, obj):
        return obj.created_at.strftime('%m/%d %H:%M')
    created_at_display.short_description = 'Created'
    created_at_display.admin_order_field = 'created_at'
    
    def ai_insights_preview(self, obj):
        """Show a formatted preview of the cached insights."""
        insights = obj.ai_insights
        html = '<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px;">'
        
        # Show each section
        sections = [
            'summary', 'assessment', 'vocabulary_gaps', 'grammar_analysis',
            'quiz_recommendations', 'difficulty_progression', 'external_resources',
            'study_guide', 'learning_journey', 'specific_actions', 'potential_struggles'
        ]
        
        for section in sections:
            value = insights.get(section, 'N/A')
            if isinstance(value, (list, dict)):
                preview = str(value)[:100] + '...' if len(str(value)) > 100 else str(value)
            else:
                preview = str(value)[:100] + '...' if len(str(value)) > 100 else str(value)
            
            html += f'<div style="margin-bottom: 8px;"><strong>{section}:</strong> {preview}</div>'
        
        html += '</div>'
        return mark_safe(html)
    ai_insights_preview.short_description = 'AI Insights Content'
    
    def cache_info(self, obj):
        """Show cache performance information."""
        from django.utils import timezone
        
        freshness = "✅ Fresh" if obj.expires_at > timezone.now() else "⏱️ Expired"
        html = f'''
        <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
            <p style="margin: 0 0 10px 0;"><strong>📊 Cache Performance</strong></p>
            <p style="margin: 5px 0;"><strong>Status:</strong> {freshness}</p>
            <p style="margin: 5px 0;"><strong>Created:</strong> {obj.created_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p style="margin: 5px 0;"><strong>Expires:</strong> {obj.expires_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p style="margin: 5px 0;"><strong>Reused:</strong> {obj.hits} times</p>
            <p style="margin: 5px 0;"><strong>Tokens Saved:</strong> {obj.tokens_saved:,}</p>
            <p style="margin: 5px 0;"><strong>Cost Saved:</strong> ~${(obj.tokens_saved / 1000) * 0.0001:.4f}</p>
        </div>
        '''
        return mark_safe(html)
    cache_info.short_description = 'Performance Info'
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return True


@admin.register(CachedUserAnalytics)
class CachedUserAnalyticsAdmin(admin.ModelAdmin):
    """Display cached user learning analytics."""
    
    list_display = (
        'user_display',
        'reads_display',
        'freshness_status',
        'last_updated_display',
    )
    
    list_filter = (
        'last_updated',
        'expires_at',
    )
    
    search_fields = ('user__username', 'user__email')
    readonly_fields = (
        'user',
        'reads',
        'last_updated',
        'analytics_preview',
    )
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Cached Analytics Data', {
            'fields': ('analytics_preview',),
            'classes': ('collapse',)
        }),
        ('Performance', {
            'fields': ('reads', 'last_updated', 'expires_at'),
        }),
    )
    
    def user_display(self, obj):
        return f"👤 {obj.user.get_full_name() or obj.user.username}"
    user_display.short_description = 'Student'
    user_display.admin_order_field = 'user__username'
    
    def reads_display(self, obj):
        return f"👁️ {obj.reads} reads"
    reads_display.short_description = 'Cache Reads'
    reads_display.admin_order_field = 'reads'
    
    def freshness_status(self, obj):
        from django.utils import timezone
        is_fresh = obj.expires_at > timezone.now()
        if is_fresh:
            return '✅ Fresh'
        return '⏱️ Expired'
    freshness_status.short_description = 'Status'
    
    def last_updated_display(self, obj):
        return obj.last_updated.strftime('%m/%d %H:%M')
    last_updated_display.short_description = 'Updated'
    last_updated_display.admin_order_field = 'last_updated'
    
    def analytics_preview(self, obj):
        """Show preview of cached analytics."""
        data = obj.analytics_data
        html = '<div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">'
        
        for key, value in list(data.items())[:10]:
            html += f'<p><strong>{key}:</strong> {str(value)[:80]}</p>'
        
        html += '</div>'
        return mark_safe(html)
    analytics_preview.short_description = 'Analytics Data'
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return True


@admin.register(CacheStatistics)
class CacheStatisticsAdmin(admin.ModelAdmin):
    """Display cache performance statistics."""
    
    list_display = (
        'date',
        'ai_insights_stats',
        'analytics_stats',
        'tokens_saved_display',
        'hit_rate_display',
    )
    
    list_filter = ('date',)
    readonly_fields = (
        'date',
        'ai_insights_generated',
        'ai_insights_cached',
        'ai_insights_hits',
        'ai_tokens_used',
        'ai_tokens_saved',
        'analytics_generated',
        'analytics_cached',
        'detailed_stats',
    )
    
    fieldsets = (
        ('Date', {
            'fields': ('date',)
        }),
        ('AI Insights Cache', {
            'fields': (
                'ai_insights_generated',
                'ai_insights_cached',
                'ai_insights_hits',
                'ai_tokens_used',
                'ai_tokens_saved',
            ),
            'description': '📊 Tracks AI analysis caching performance'
        }),
        ('Analytics Cache', {
            'fields': (
                'analytics_generated',
                'analytics_cached',
            ),
            'description': '📈 Tracks user analytics caching'
        }),
        ('Summary Statistics', {
            'fields': ('detailed_stats',),
        }),
    )
    
    def ai_insights_stats(self, obj):
        return f"🤖 Gen: {obj.ai_insights_generated} | Cache: {obj.ai_insights_cached}"
    ai_insights_stats.short_description = 'AI Insights'
    
    def analytics_stats(self, obj):
        return f"📊 Gen: {obj.analytics_generated} | Cache: {obj.analytics_cached}"
    analytics_stats.short_description = 'Analytics'
    
    def tokens_saved_display(self, obj):
        return f"💾 {obj.ai_tokens_saved:,}"
    tokens_saved_display.short_description = 'Tokens Saved'
    
    def hit_rate_display(self, obj):
        rate = obj.cache_hit_rate()
        return f"📈 {rate}%"
    hit_rate_display.short_description = 'Hit Rate'
    
    def detailed_stats(self, obj):
        cost_saved = (obj.ai_tokens_saved / 1000) * 0.000125 if obj.ai_tokens_saved > 0 else 0
        hit_rate = obj.cache_hit_rate()
        
        html = f'''
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
            <p style="margin: 0 0 15px 0;"><strong>🎯 Cache Performance Summary</strong></p>
            
            <div style="background: white; padding: 10px; border-radius: 3px; margin-bottom: 10px;">
                <p style="margin: 5px 0;"><strong>🤖 AI Insights Cache:</strong></p>
                <p style="margin-left: 20px; margin: 5px 0;">• Generated: {obj.ai_insights_generated} new analyses</p>
                <p style="margin-left: 20px; margin: 5px 0;">• Cached: {obj.ai_insights_cached} from cache</p>
                <p style="margin-left: 20px; margin: 5px 0;">• Reuses: {obj.ai_insights_hits} total cache hits</p>
                <p style="margin-left: 20px; margin: 5px 0;">• Hit Rate: <strong>{hit_rate}%</strong></p>
            </div>
            
            <div style="background: white; padding: 10px; border-radius: 3px; margin-bottom: 10px;">
                <p style="margin: 5px 0;"><strong>💾 Token Savings:</strong></p>
                <p style="margin-left: 20px; margin: 5px 0;">• Tokens Used: {obj.ai_tokens_used:,}</p>
                <p style="margin-left: 20px; margin: 5px 0;">• Tokens Saved: {obj.ai_tokens_saved:,}</p>
                <p style="margin-left: 20px; margin: 5px 0;">• Cost Saved: ~${cost_saved:.4f}</p>
            </div>
            
            <div style="background: white; padding: 10px; border-radius: 3px;">
                <p style="margin: 5px 0;"><strong>📊 Analytics Cache:</strong></p>
                <p style="margin-left: 20px; margin: 5px 0;">• Generated: {obj.analytics_generated} new collections</p>
                <p style="margin-left: 20px; margin: 5px 0;">• Cached: {obj.analytics_cached} from cache</p>
            </div>
        </div>
        '''
        return mark_safe(html)
    detailed_stats.short_description = 'Detailed Statistics'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


