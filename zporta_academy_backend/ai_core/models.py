"""
AI Core Models - Memory & Training System

This module provides:
1. AiMemory - Cache for all AI-generated content (text + audio)
2. AiProviderConfig - Central configuration for all AI providers
3. AiTrainingData - Verified examples for fine-tuning our own model
4. AiUsageLog - Track costs and performance per request
"""

import hashlib
import json
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class AiProviderConfig(models.Model):
    """
    Central configuration for all AI providers.
    Defines which models are available and their cost/quality tiers.
    """
    PROVIDER_CHOICES = [
        ('openai', 'OpenAI'),
        ('gemini', 'Google Gemini'),
        ('claude', 'Anthropic Claude'),
        ('elevenlabs', 'ElevenLabs TTS'),
        ('google_tts', 'Google Cloud TTS'),
        ('local_small_model', 'Local Fine-tuned Model'),
    ]
    
    TIER_CHOICES = [
        ('cheap', 'Cheap/Fast'),
        ('normal', 'Normal Quality'),
        ('premium', 'Premium Quality'),
    ]
    
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    model_name = models.CharField(max_length=100, help_text="e.g. gpt-4o-mini, gemini-2.0-pro")
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='normal')
    
    # Cost estimation (USD per 1M tokens or per request)
    cost_per_million_tokens = models.DecimalField(
        max_digits=10, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="Cost in USD per 1M tokens (for text models)"
    )
    cost_per_request = models.DecimalField(
        max_digits=10, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="Cost in USD per request (for audio/image models)"
    )
    
    # Quality/Performance metrics
    avg_latency_ms = models.IntegerField(null=True, blank=True, help_text="Average response time in ms")
    quality_score = models.FloatField(default=0.8, help_text="Quality rating 0.0-1.0 based on user feedback")
    
    # Control flags
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Use this as default for this tier")
    max_tokens = models.IntegerField(null=True, blank=True, help_text="Max tokens supported")
    
    # Metadata
    capabilities = models.JSONField(
        default=dict, 
        blank=True,
        help_text="JSON with supported features: {languages: [...], output_formats: [...]}"
    )
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "AI Provider Config"
        verbose_name_plural = "AI Provider Configs"
        ordering = ['tier', 'provider']
        unique_together = ('provider', 'model_name')
        indexes = [
            models.Index(fields=['provider', 'tier', 'is_active']),
            models.Index(fields=['is_default', 'tier']),
        ]
    
    def __str__(self):
        return f"{self.provider}/{self.model_name} ({self.tier})"


class AiMemory(models.Model):
    """
    Smart cache for ALL AI-generated content.
    Before calling external AI, check if we already have a good response.
    
    Key Features:
    - Deduplication via prompt_hash
    - User ratings for quality
    - Reusable for training data
    - Links to audio files
    """
    REQUEST_TYPE_CHOICES = [
        ('lesson_script', 'Lesson Script'),
        ('quiz_generation', 'Quiz Generation'),
        ('podcast_script', 'Podcast Script'),
        ('email_content', 'Email Content'),
        ('report', 'Report/Summary'),
        ('translation', 'Translation'),
        ('tts_audio', 'Text-to-Speech Audio'),
        ('other', 'Other'),
    ]
    
    # Request identification
    request_type = models.CharField(max_length=50, choices=REQUEST_TYPE_CHOICES, db_index=True)
    prompt_hash = models.CharField(
        max_length=64, 
        db_index=True, 
        unique=True,
        help_text="SHA256 hash of normalized prompt + key options"
    )
    prompt_text = models.TextField(help_text="Original prompt for reference")
    prompt_options = models.JSONField(
        default=dict, 
        help_text="Key options like {language: 'en', difficulty: 'easy'}"
    )
    
    # Generated content
    generated_text = models.TextField(blank=True, help_text="AI-generated text response")
    generated_audio_file = models.FileField(
        upload_to='ai_memory/audio/%Y/%m/', 
        null=True, 
        blank=True,
        help_text="TTS audio file if applicable"
    )
    audio_metadata = models.JSONField(
        default=dict, 
        blank=True,
        help_text="Audio details: {voice_id, language, duration_sec, format}"
    )
    
    # AI provider details
    provider = models.CharField(max_length=50, help_text="Which AI provider was used")
    model = models.CharField(max_length=100, help_text="Specific model name")
    tokens_used = models.IntegerField(null=True, blank=True)
    cost_estimate = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    
    # Quality tracking
    is_verified_good = models.BooleanField(
        default=False, 
        db_index=True,
        help_text="Manually approved for high quality (use for training)"
    )
    user_rating = models.FloatField(
        null=True, 
        blank=True,
        help_text="Average user rating 0.0-5.0"
    )
    usage_count = models.IntegerField(
        default=0,
        help_text="How many times this cached response was reused"
    )
    
    # Training data flags
    use_for_training = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Include in training dataset for fine-tuning"
    )
    training_tags = models.JSONField(
        default=list, 
        blank=True,
        help_text="Tags for training: ['jlpt_n5', 'grammar', 'beginner']"
    )
    
    # Related objects (optional - link to specific lesson/quiz/etc)
    content_type = models.ForeignKey(
        ContentType, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "AI Memory"
        verbose_name_plural = "AI Memory Cache"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request_type', 'is_verified_good']),
            models.Index(fields=['use_for_training']),
            models.Index(fields=['prompt_hash']),
            models.Index(fields=['provider', 'model']),
            models.Index(fields=['-usage_count']),
        ]
    
    def __str__(self):
        return f"{self.request_type} | {self.provider}/{self.model} | hash: {self.prompt_hash[:12]}..."
    
    def mark_as_used(self):
        """Increment usage counter and update last_used_at"""
        self.usage_count += 1
        self.last_used_at = timezone.now()
        self.save(update_fields=['usage_count', 'last_used_at'])
    
    def mark_verified(self, verified=True):
        """Admin action to mark content as high quality"""
        self.is_verified_good = verified
        if verified:
            self.use_for_training = True
        self.save(update_fields=['is_verified_good', 'use_for_training'])
    
    @staticmethod
    def compute_prompt_hash(request_type, prompt_text, options=None):
        """
        Generate stable hash for deduplication.
        Normalizes prompt and options before hashing.
        """
        # Normalize prompt (strip whitespace, lowercase where safe)
        normalized_prompt = ' '.join(prompt_text.strip().split())
        
        # Sort and normalize options
        normalized_options = json.dumps(options or {}, sort_keys=True)
        
        # Combine
        combined = f"{request_type}|{normalized_prompt}|{normalized_options}"
        
        # SHA256 hash
        return hashlib.sha256(combined.encode('utf-8')).hexdigest()


class AiTrainingData(models.Model):
    """
    Curated dataset for fine-tuning our own model.
    Only includes verified, high-quality examples from AiMemory.
    """
    # Link to original memory item
    memory_item = models.OneToOneField(
        AiMemory, 
        on_delete=models.CASCADE, 
        related_name='training_data'
    )
    
    # Training metadata
    training_weight = models.FloatField(
        default=1.0,
        help_text="Importance weight for training (1.0 = normal, 2.0 = double weight)"
    )
    difficulty_label = models.CharField(
        max_length=20,
        choices=[
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard'),
        ],
        null=True,
        blank=True
    )
    subject_tags = models.JSONField(
        default=list,
        help_text="Subject classification: ['math', 'science', 'language']"
    )
    
    # Quality metrics
    human_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='verified_training_data'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Training batch tracking
    included_in_training = models.BooleanField(default=False)
    training_batch_id = models.CharField(max_length=50, blank=True, db_index=True)
    training_date = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "AI Training Data"
        verbose_name_plural = "AI Training Dataset"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['human_verified', '-created_at']),
            models.Index(fields=['training_batch_id']),
            models.Index(fields=['included_in_training']),
        ]
    
    def __str__(self):
        status = "✓ Verified" if self.human_verified else "Pending"
        return f"{status} | {self.memory_item.request_type} | {self.memory_item.prompt_hash[:12]}"


class AiUsageLog(models.Model):
    """
    Detailed tracking of every AI request for cost monitoring and analytics.
    """
    # Request details
    request_type = models.CharField(max_length=50, db_index=True)
    endpoint = models.CharField(max_length=200, help_text="Which function/endpoint made the request")
    
    # User context (optional)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='ai_usage_logs'
    )
    
    # Provider details
    provider = models.CharField(max_length=50)
    model = models.CharField(max_length=100)
    
    # Performance metrics
    tokens_used = models.IntegerField(null=True, blank=True)
    cost_estimate = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    latency_ms = models.IntegerField()
    
    # Cache hit or miss
    cache_hit = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Was this served from AiMemory cache?"
    )
    memory_item = models.ForeignKey(
        AiMemory, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='usage_logs'
    )
    
    # Success tracking
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    # Auto or Manual choice
    selection_mode = models.CharField(
        max_length=20,
        choices=[
            ('auto', 'Auto Selected'),
            ('manual', 'Manual Choice'),
        ],
        default='auto'
    )
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        verbose_name = "AI Usage Log"
        verbose_name_plural = "AI Usage Logs"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['provider', 'model', '-timestamp']),
            models.Index(fields=['request_type', '-timestamp']),
            models.Index(fields=['cache_hit', '-timestamp']),
            models.Index(fields=['user', '-timestamp']),
        ]
    
    def __str__(self):
        cache = "CACHE" if self.cache_hit else "API"
        return f"{cache} | {self.provider}/{self.model} | {self.endpoint} | {self.timestamp.strftime('%Y-%m-%d %H:%M')}"


class AiModelTrainingRun(models.Model):
    """
    Track each training run for our fine-tuned model.
    """
    training_batch_id = models.CharField(max_length=50, unique=True, db_index=True)
    model_version = models.CharField(max_length=50, help_text="e.g. zporta_v1, zporta_v2")
    
    # Training data stats
    training_size = models.IntegerField(help_text="Number of examples used")
    data_source_start_date = models.DateField()
    data_source_end_date = models.DateField()
    
    # Training config
    base_model = models.CharField(max_length=100, help_text="e.g. gpt-4o-mini, gemini-flash")
    training_provider = models.CharField(max_length=50)
    training_config = models.JSONField(
        default=dict,
        help_text="Training hyperparameters and settings"
    )
    
    # Cost tracking
    training_cost = models.DecimalField(max_digits=10, decimal_places=2)
    training_duration_minutes = models.IntegerField()
    
    # Performance metrics
    validation_accuracy = models.FloatField(null=True, blank=True)
    validation_loss = models.FloatField(null=True, blank=True)
    performance_notes = models.TextField(blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('training', 'Training'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('deployed', 'Deployed to Production'),
        ],
        default='pending'
    )
    
    # Deployment
    deployed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False, help_text="Currently in production use")
    
    notes = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "AI Model Training Run"
        verbose_name_plural = "AI Model Training Runs"
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['is_active', '-started_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.model_version} | {self.status} | {self.started_at.strftime('%Y-%m-%d')}"
