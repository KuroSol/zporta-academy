from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models


User = get_user_model()


class DailyPodcast(models.Model):
    """On-demand podcast generated for user learning.
    
    Audio MP3 files are saved directly to MEDIA_ROOT/podcasts/ (local disk).
    No S3 or cloud storage required - all files stay on your server.
    
    Features:
    - Personalized with user's enrolled courses
    - Interactive Q&A format (questions + answers)
    - Multi-language support (up to 2 languages)
    - Flexible output: text only, audio only, or both
    - Teacher-style review format (~6 minutes)
    """
    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    LLM_PROVIDER_CHOICES = [
        ("openai", "OpenAI"),
        ("gemini", "Google Gemini"),
        ("template", "Template"),
    ]

    TTS_PROVIDER_CHOICES = [
        ("elevenlabs", "🎵 ElevenLabs (Most Natural)"),
        ("google", "🎤 Google TTS (Standard Quality)"),
        ("google_chirp", "✨ Google Wavenet Premium (Highest Quality)"),
        ("gemini", "🎧 Google Standard (Fast & Good)"),
        ("openai", "🔊 OpenAI TTS (Consistent)"),
        ("polly", "🗣️ Amazon Polly (Multi-accent)"),
        ("none", "🚫 None (Text Only)"),
    ]

    OUTPUT_FORMAT_CHOICES = [
        ("text", "Text Only"),
        ("audio", "Audio Only"),
        ("both", "Text & Audio"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="daily_podcasts",
        db_index=True,
    )

    # Request tracking info
    requested_by_user = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True = user/staff clicked button, False = system/task generated"
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="podcasts_requested",
        help_text="Who triggered this generation (for auditing)"
    )
    user_request_type = models.CharField(
        max_length=20,
        choices=[
            ('user', 'User Self-Request'),
            ('admin_dashboard', 'Admin Dashboard Button'),
            ('api', 'API Endpoint'),
            ('celery_task', 'Scheduled Task'),
            ('cli', 'CLI Command'),
        ],
        default='user',
        help_text="How was this podcast requested?"
    )
    can_request_again_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When this user can request next podcast (24h cooldown)"
    )
    
    # Multi-language support (up to 2 languages)
    primary_language = models.CharField(
        max_length=12,
        default=getattr(settings, "DAILYCAST_DEFAULT_LANGUAGE", "en"),
        help_text="BCP-47 language code (e.g. en, ja, es, fr)",
    )
    secondary_language = models.CharField(
        max_length=12,
        default="",
        blank=True,
        help_text="Optional second language for multilingual content",
    )
    
    # Output format selection
    output_format = models.CharField(
        max_length=10,
        choices=OUTPUT_FORMAT_CHOICES,
        default="both",
        help_text="Text only, audio only, or both",
    )
    
    # Time period for content (month_range)
    month_range = models.CharField(
        max_length=20,
        choices=[
            ('current', 'Current Month'),
            ('last_3', 'Last 3 Months'),
            ('last_6', 'Last 6 Months'),
            ('last_12', 'Last Year (12 Months)'),
            ('all', 'All Time'),
        ],
        default='current',
        help_text="Time period for content included in podcast",
    )
    
    # Reply size/duration
    reply_size = models.CharField(
        max_length=20,
        choices=[
            ('short', 'Short (2-3 minutes)'),
            ('medium', 'Medium (4-5 minutes)'),
            ('long', 'Long (6-8 minutes)'),
            ('detailed', 'Detailed (10+ minutes)'),
        ],
        default='medium',
        help_text="Duration/depth of podcast response",
    )
    
    # Course personalization
    included_courses = models.JSONField(
        default=list,
        blank=True,
        help_text="List of course IDs/names included in podcast",
    )

    # User request details (Added for tracking generation parameters)
    category = models.CharField(max_length=100, blank=True, help_text="Category/Subject of the request")
    topic = models.CharField(max_length=255, blank=True, help_text="Specific topic requested")
    profession = models.CharField(max_length=100, blank=True, help_text="Professional context")
    notes = models.TextField(blank=True, help_text="Additional notes/instructions")
    request_data = models.JSONField(default=dict, blank=True, help_text="Full request payload including selected items")
    
    # Interactive Q&A content
    script_text = models.TextField(blank=True, help_text="Main script with Q&A format")
    questions_asked = models.JSONField(
        default=list,
        blank=True,
        help_text="List of questions asked in podcast",
    )
    student_answers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Store student answers if captured",
    )
    
    # Audio files (one per language)
    audio_file = models.FileField(
        upload_to="podcasts/",
        null=True,
        blank=True,
        help_text="Primary language audio",
    )
    audio_file_secondary = models.FileField(
        upload_to="podcasts/",
        null=True,
        blank=True,
        help_text="Secondary language audio (if multilingual)",
    )
    
    llm_provider = models.CharField(
        max_length=20,
        choices=LLM_PROVIDER_CHOICES,
        default="template",
    )
    tts_provider = models.CharField(
        max_length=20,
        choices=TTS_PROVIDER_CHOICES,
        default="polly",
    )
    
    # Duration for each language
    duration_seconds = models.PositiveIntegerField(default=0)
    duration_seconds_secondary = models.PositiveIntegerField(
        default=0,
        help_text="Duration of secondary language audio",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Daily Podcast"
        verbose_name_plural = "Daily Podcasts"
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        langs = self.primary_language
        if self.secondary_language:
            langs += f" + {self.secondary_language}"
        return f"Podcast for {self.user} ({langs}) [{self.status}]"


class UserCategory(models.Model):
    """
    Group/category for organizing users.
    Each category can have different content generation settings.
    
    Examples:
    - "Teachers" - teachers get full podcast features
    - "Students" - students get limited features
    - "Admins" - admins get all features + admin tools
    - "Trial Users" - trial users get restricted features
    """
    
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Category name (e.g., Teachers, Students, Admins)"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of this category"
    )
    users = models.ManyToManyField(
        User,
        related_name="podcast_categories",
        help_text="Users in this category"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Enable/disable this category"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Student Group"
        verbose_name_plural = "Student Groups"
        ordering = ["name"]
    
    def __str__(self) -> str:
        user_count = self.users.count()
        return f"{self.name} ({user_count} users)"


class UserCategoryConfig(models.Model):
    """
    Per-group settings override for a student group.
    
    This lets you customize podcast generation for specific groups:
    - Beginners might get: cheaper model, shorter scripts
    - Advanced might get: expensive model, longer scripts
    
    IMPORTANT: Leave a field blank to use the Global Defaults.
    Only fill in fields you want to override.
    """
    
    category = models.OneToOneField(
        UserCategory,
        on_delete=models.CASCADE,
        related_name="config",
        help_text="User category this config applies to"
    )
    
    # ===== BASIC SETTINGS =====
    enabled = models.BooleanField(
        default=True,
        help_text="Enable/disable content generation for this category"
    )
    default_language = models.CharField(
        max_length=12,
        default="en",
        help_text="Default language for this category"
    )
    default_output_format = models.CharField(
        max_length=10,
        choices=DailyPodcast.OUTPUT_FORMAT_CHOICES,
        default="both",
        help_text="Default output format for this category"
    )
    
    # ===== LLM SETTINGS =====
    default_llm_provider = models.CharField(
        max_length=20,
        choices=DailyPodcast.LLM_PROVIDER_CHOICES,
        default="template",
        help_text="Default LLM provider for this category"
    )
    openai_model = models.CharField(
        max_length=50,
        default="gpt-4o-mini",
        blank=True,
        help_text="OpenAI model for this category"
    )
    gemini_model = models.CharField(
        max_length=50,
        default="gemini-2.0-pro-exp",
        blank=True,
        help_text="Google Gemini model for this category"
    )
    claude_model = models.CharField(
        max_length=50,
        default="claude-3-5-sonnet",
        blank=True,
        help_text="Anthropic Claude model for this category"
    )
    template_model = models.CharField(
        max_length=50,
        default="template",
        blank=True,
        help_text="Template model for this category (no AI)"
    )
    
    # ===== TTS SETTINGS =====
    default_tts_provider = models.CharField(
        max_length=20,
        choices=DailyPodcast.TTS_PROVIDER_CHOICES,
        default="elevenlabs",
        help_text="Default TTS provider for this category"
    )
    tts_speaking_rate = models.FloatField(
        default=1.0,
        help_text="TTS speaking rate (0.5=slow, 1.0=normal, 1.5=fast)"
    )
    
    # ===== SCRIPT GENERATION SETTINGS =====
    script_word_limit = models.PositiveIntegerField(
        default=700,
        help_text="Default word limit for scripts in this category"
    )
    
    # ===== COOLDOWN & QUOTAS =====
    cooldown_hours = models.PositiveIntegerField(
        default=24,
        help_text="Hours between generations (0=no limit)"
    )
    max_generations_per_day = models.PositiveIntegerField(
        default=5,
        help_text="Max generations per day (0=unlimited)"
    )
    
    # ===== PRICING =====
    cost_per_generation = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.50,
        help_text="Cost per podcast generation for this category"
    )
    
    # ===== METADATA =====
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Category Override"
        verbose_name_plural = "Category Overrides"
    
    def __str__(self) -> str:
        return f"Config: {self.category.name}"
    
    @staticmethod
    def get_config_for_user(user):
        """
        Get the config for a user's category.
        Falls back to global TeacherContentConfig if no category config found.
        """
        try:
            # Check if user has a category
            category = user.podcast_categories.filter(config__enabled=True).first()
            if category and category.config:
                return category.config
        except Exception:
            pass
        
        # Fallback to global config
        return TeacherContentConfig.get_config()


class TeacherContentConfig(models.Model):
    """
    Master configuration for teacher/content generation.
    All settings can be customized from Django admin without code changes.
    
    Singleton pattern: only one config should exist. Use:
        config = TeacherContentConfig.get_config()
    """
    
    # ===== BASIC SETTINGS =====
    enabled = models.BooleanField(
        default=True,
        help_text="Enable/disable teacher content generation globally"
    )
    default_language = models.CharField(
        max_length=12,
        default="en",
        help_text="Default language for generation (en, ja, es, fr, de, etc)"
    )
    default_output_format = models.CharField(
        max_length=10,
        choices=DailyPodcast.OUTPUT_FORMAT_CHOICES,
        default="both",
        help_text="Default output: text only, audio only, or both"
    )
    
    # ===== LLM PROVIDER SETTINGS =====
    default_llm_provider = models.CharField(
        max_length=20,
        choices=DailyPodcast.LLM_PROVIDER_CHOICES,
        default="template",
        help_text="Default LLM for script generation (template, OpenAI, Gemini)"
    )
    openai_model = models.CharField(
        max_length=50,
        default="gpt-4o-mini",
        help_text="OpenAI model name (gpt-4, gpt-4o-mini, gpt-3.5-turbo, etc)"
    )
    gemini_model = models.CharField(
        max_length=50,
        default="gemini-2.0-pro-exp",
        help_text="Google Gemini model name"
    )
    
    # ===== TTS PROVIDER SETTINGS =====
    default_tts_provider = models.CharField(
        max_length=20,
        choices=DailyPodcast.TTS_PROVIDER_CHOICES,
        default="elevenlabs",
        help_text="Default TTS provider (elevenlabs, google, openai, polly)"
    )
    tts_fallback_chain = models.JSONField(
        default=list,
        blank=True,
        help_text='Fallback order: ["elevenlabs", "google", "openai"]'
    )
    tts_speaking_rate = models.FloatField(
        default=1.0,
        help_text="TTS speaking rate (0.5=slow, 1.0=normal, 1.5=fast)"
    )
    tts_pitch = models.FloatField(
        default=0.0,
        help_text="TTS pitch adjustment (-20.0 to +20.0)"
    )
    tts_volume_gain = models.FloatField(
        default=0.0,
        help_text="TTS volume gain in dB (-16.0 to +16.0)"
    )
    
    # ===== VOICE SELECTION BY LANGUAGE =====
    voice_map_json = models.JSONField(
        default=dict,
        blank=True,
        help_text='Map of language codes to voice IDs/names: {"en": "voice-id", "ja": "voice-id"}'
    )
    
    # ===== SCRIPT GENERATION SETTINGS =====
    script_word_limit_normal = models.PositiveIntegerField(
        default=700,
        help_text="Target word count for normal scripts (for audio ~6-8 min)"
    )
    script_word_limit_short = models.PositiveIntegerField(
        default=300,
        help_text="Target word count for short scripts (when notes say 'short')"
    )
    script_include_questions = models.BooleanField(
        default=True,
        help_text="Include Q&A format in generated scripts"
    )
    num_questions_per_script = models.PositiveIntegerField(
        default=3,
        help_text="Number of questions to include in interactive scripts"
    )
    include_motivational_quote = models.BooleanField(
        default=True,
        help_text="Include motivational quote at the end"
    )
    
    # ===== PROMPT TEMPLATES =====
    # Store custom prompts so users can tweak generation behavior
    prompt_system_role = models.TextField(
        default="You are a warm, enthusiastic, and engaging teacher.",
        help_text="System role/personality for LLM generation"
    )
    prompt_script_intro = models.TextField(
        default="Create a conversational teacher script for a student who is learning.",
        help_text="Introduction instruction for script generation"
    )
    prompt_tone_guide = models.TextField(
        default="Use natural pauses, show genuine emotion, speak with warmth like chatting with a friend.",
        help_text="Tone guidance for generated content"
    )
    
    # ===== COOLDOWN & QUOTA SETTINGS =====
    cooldown_hours = models.PositiveIntegerField(
        default=24,
        help_text="Hours to wait between generations for regular users"
    )
    test_user_cooldown_enabled = models.BooleanField(
        default=False,
        help_text="Apply cooldown to test users (Alex)"
    )
    max_generations_per_day = models.PositiveIntegerField(
        default=0,  # 0 = unlimited
        help_text="Max generations per day per user (0=unlimited)"
    )
    
    # ===== PRICING & CREDITS =====
    cost_per_generation = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0.50,
        help_text="Credit cost per generation (0=free)"
    )
    enable_credit_system = models.BooleanField(
        default=False,
        help_text="Require users to spend credits for generation"
    )
    
    # ===== BILINGUAL SETTINGS =====
    support_bilingual = models.BooleanField(
        default=True,
        help_text="Allow bilingual content (e.g. EN + JA)"
    )
    bilingual_default_pair = models.CharField(
        max_length=20,
        default="en_ja",
        help_text='Default bilingual pair format: "en_ja", "en_es", etc'
    )
    bilingual_audio_stitch = models.BooleanField(
        default=True,
        help_text="Stitch bilingual audio into single MP3 (vs separate files)"
    )
    
    # ===== LOGGING & DEBUG =====
    verbose_logging = models.BooleanField(
        default=True,
        help_text="Log detailed info about each generation"
    )
    debug_mode = models.BooleanField(
        default=False,
        help_text="Enable debug output (use carefully in production)"
    )
    
    # ===== METADATA =====
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="config_modifications"
    )
    
    class Meta:
        verbose_name = "Global Podcast Defaults"
        verbose_name_plural = "Global Podcast Defaults"
    
    def __str__(self):
        status = "ENABLED" if self.enabled else "DISABLED"
        return f"Teacher Config [{status}] - LLM:{self.default_llm_provider}, TTS:{self.default_tts_provider}"
    
    def save(self, *args, **kwargs):
        """Ensure only one config instance exists (singleton pattern)."""
        if not self.pk and TeacherContentConfig.objects.exists():
            # Update existing instead of creating new
            instance = TeacherContentConfig.objects.first()
            for field in self._meta.fields:
                if field.name != 'id':
                    setattr(instance, field.name, getattr(self, field.name))
            instance.save(*args, **kwargs)
            self.pk = instance.pk
            return
        super().save(*args, **kwargs)
    
    @classmethod
    def get_config(cls):
        """Get or create the singleton config."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config


# ============================================================================
# CACHE MODELS - Store AI Insights & Analytics to Reduce Token Usage
# ============================================================================

class CachedAIInsight(models.Model):
    """
    Stores AI-generated insights to avoid re-generating for same student+subject+engine.
    This significantly reduces token usage and API costs.
    """
    
    ENGINE_CHOICES = [
        ('gemini-2.0-flash-exp', '⚡ Gemini 2.0 Flash'),
        ('gemini-2.0-pro-exp', '✨ Gemini 2.0 Pro'),
        ('gemini-1.5-pro', '🔧 Gemini 1.5 Pro'),
        ('gpt-4o-mini', '⚡ GPT-4o Mini'),
        ('gpt-4o', '🎯 GPT-4o'),
        ('gpt-4-turbo', '🚀 GPT-4 Turbo'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='cached_ai_insights',
        db_index=True,
    )
    
    subject = models.CharField(
        max_length=50,
        default='',
        blank=True,
        db_index=True,
        help_text="Subject focus (empty = all subjects)"
    )
    
    engine = models.CharField(
        max_length=50,
        default='gemini-2.0-flash-exp',
        choices=ENGINE_CHOICES,
    )
    
    ai_insights = models.JSONField(
        help_text="Cached AI analysis (11 sections)"
    )
    
    tokens_used = models.IntegerField(default=0)
    tokens_saved = models.IntegerField(default=0)
    hits = models.IntegerField(default=0, help_text="Times this cache was reused")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    
    class Meta:
        verbose_name = "Cached AI Insight"
        verbose_name_plural = "💾 Cached AI Insights"
        unique_together = ['user', 'subject', 'engine']
        indexes = [
            models.Index(fields=['user', 'subject', 'engine']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.subject or 'All'} - {self.engine} ({self.hits} hits)"


class CachedUserAnalytics(models.Model):
    """
    Stores collected user learning analytics to avoid re-querying database.
    Improves page load speed and reduces database queries.
    """
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='cached_analytics',
        primary_key=True,
    )
    
    analytics_data = models.JSONField(
        help_text="Collected learning data snapshot"
    )
    
    reads = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    
    class Meta:
        verbose_name = "Cached User Analytics"
        verbose_name_plural = "📊 Cached User Analytics"
    
    def __str__(self):
        return f"{self.user.username} - {self.reads} reads"


class CacheStatistics(models.Model):
    """
    Tracks overall cache performance, token savings, and API costs.
    
    Pricing (as of Dec 2025):
    - GPT-4o: $2.50 per 1M input tokens, $10.00 per 1M output tokens
    - GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
    - Gemini 2.0 Flash: Free tier then $0.075/$0.30 per 1M tokens
    - Gemini 2.0 Pro: $1.25/$5.00 per 1M tokens
    """
    
    date = models.DateField(auto_now_add=True, unique=True, db_index=True)
    
    # Request tracking
    ai_insights_generated = models.IntegerField(default=0)
    ai_insights_cached = models.IntegerField(default=0)
    ai_insights_hits = models.IntegerField(default=0)
    
    # Token tracking
    ai_tokens_used = models.IntegerField(default=0)
    ai_tokens_saved = models.IntegerField(default=0)
    
    # Cost tracking (in USD cents to avoid floating point issues)
    cost_usd_cents = models.IntegerField(default=0, help_text="Total API cost in cents (e.g., 150 = $1.50)")
    cost_saved_cents = models.IntegerField(default=0, help_text="Cost saved by caching in cents")
    
    analytics_generated = models.IntegerField(default=0)
    analytics_cached = models.IntegerField(default=0)
    
    class Meta:
        verbose_name = "Cache Statistics"
        verbose_name_plural = "📈 Cache Statistics & API Costs"
        ordering = ['-date']
    
    def __str__(self):
        return f"Stats {self.date} - ${self.cost_usd():.2f} spent, ${self.cost_saved_usd():.2f} saved"
    
    def cache_hit_rate(self):
        """Calculate cache hit rate percentage."""
        total = self.ai_insights_generated + self.ai_insights_cached
        if total == 0:
            return 0
        return round((self.ai_insights_cached / total) * 100, 2)
    
    def cost_usd(self):
        """Get cost in USD dollars."""
        return self.cost_usd_cents / 100.0
    
    def cost_saved_usd(self):
        """Get saved cost in USD dollars."""
        return self.cost_saved_cents / 100.0
    
    @staticmethod
    def estimate_cost(tokens, model_name='gpt-4o', input_tokens=None, output_tokens=None):
        """
        Calculate cost for API request based on actual or estimated token usage.
        Returns cost in cents.
        
        Args:
            tokens: Total token count (used if input/output not specified)
            model_name: Model name (gpt-4o, gpt-4o-mini, gemini-2.0-flash-exp, etc.)
            input_tokens: Actual input tokens from API (optional, more accurate)
            output_tokens: Actual output tokens from API (optional, more accurate)
        """
        # Use actual token breakdown if provided, otherwise estimate
        if input_tokens is None or output_tokens is None:
            # Average assumption: 60% input tokens, 40% output tokens
            input_tokens = tokens * 0.6
            output_tokens = tokens * 0.4
        
        # Pricing per 1M tokens in USD (as of December 2025)
        pricing = {
            'gpt-4o': {'input': 2.50, 'output': 10.00},
            'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
            'gpt-4-turbo': {'input': 10.00, 'output': 30.00},  # Legacy
            'gemini-2.0-flash-exp': {'input': 0.075, 'output': 0.30},
            'gemini-2.0-pro-exp': {'input': 1.25, 'output': 5.00},
            'gemini-1.5-pro': {'input': 1.25, 'output': 5.00},
        }
        
        # Default to gpt-4o pricing if unknown
        rates = pricing.get(model_name, pricing['gpt-4o'])
        
        # Calculate cost in USD based on actual usage
        cost_usd = (input_tokens / 1_000_000 * rates['input']) + \
                   (output_tokens / 1_000_000 * rates['output'])
        
        # Convert to cents
        return int(cost_usd * 100)
