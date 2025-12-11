"""
AI Core Services - Central Router for All AI Requests

This module provides:
1. generate_text() - ONE entry point for all text generation
2. generate_audio() - ONE entry point for all audio/TTS
3. Smart caching before external API calls
4. Auto vs Manual model selection
5. Cost tracking and optimization

Usage:
    from ai_core.services import generate_text, generate_audio
    
    # Auto mode (system picks cheapest good model)
    response = generate_text(
        request_type='podcast_script',
        prompt="Create a podcast about...",
        options={'language': 'en', 'difficulty': 'easy'},
        selection_mode='auto'
    )
    
    # Manual mode (user/admin specifies exact model)
    response = generate_text(
        request_type='lesson_script',
        prompt="Explain quantum physics...",
        provider='openai',
        model='gpt-4o',
        selection_mode='manual'
    )
"""

import logging
import time
from typing import Dict, Tuple, Optional, Any
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import AiMemory, AiProviderConfig, AiUsageLog

logger = logging.getLogger(__name__)


# ============================================
# MAIN TEXT GENERATION ROUTER
# ============================================

def generate_text(
    request_type: str,
    prompt: str,
    options: Dict[str, Any] = None,
    provider: str = None,
    model: str = None,
    selection_mode: str = 'auto',
    user=None,
    endpoint: str = 'unknown',
    force_refresh: bool = False
) -> Tuple[str, str]:
    """
    Central router for ALL text generation.
    
    Args:
        request_type: Type of content ('podcast_script', 'quiz_generation', etc.)
        prompt: The text prompt
        options: Dict with {language, difficulty, output_format, etc.}
        provider: Specific provider (if manual mode)
        model: Specific model (if manual mode)
        selection_mode: 'auto' or 'manual'
        user: User object (optional, for logging)
        endpoint: Which function called this (for analytics)
        force_refresh: Skip cache and call API (default: False)
    
    Returns:
        Tuple of (generated_text, provider_used)
    """
    options = options or {}
    start_time = time.time()
    
    # Step 1: Check cache (unless force_refresh)
    if not force_refresh:
        prompt_hash = AiMemory.compute_prompt_hash(request_type, prompt, options)
        cached = _check_memory_cache(request_type, prompt_hash)
        
        if cached:
            latency_ms = int((time.time() - start_time) * 1000)
            _log_usage(
                request_type=request_type,
                endpoint=endpoint,
                user=user,
                provider=cached['provider'],
                model=cached['model'],
                tokens_used=cached['tokens_used'],
                cost_estimate=cached['cost_estimate'],
                latency_ms=latency_ms,
                cache_hit=True,
                memory_item=cached['memory_item'],
                selection_mode=selection_mode
            )
            logger.info(f"✅ [AI_CACHE_HIT] {request_type} | {prompt_hash[:12]} | {cached['provider']}/{cached['model']}")
            return cached['text'], cached['provider']
    
    # Step 2: Select AI provider/model
    if selection_mode == 'auto' or not (provider and model):
        provider, model = _auto_select_model(request_type, options)
        logger.info(f"🤖 [AI_AUTO_SELECT] {request_type} → {provider}/{model}")
    else:
        logger.info(f"👤 [AI_MANUAL_SELECT] {request_type} → {provider}/{model}")
    
    # Step 3: Call external AI
    try:
        generated_text, tokens_used, cost_estimate = _call_text_provider(
            provider=provider,
            model=model,
            prompt=prompt,
            options=options
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Step 4: Save to memory cache
        prompt_hash = AiMemory.compute_prompt_hash(request_type, prompt, options)
        memory_item = _save_to_memory(
            request_type=request_type,
            prompt_hash=prompt_hash,
            prompt_text=prompt,
            prompt_options=options,
            generated_text=generated_text,
            provider=provider,
            model=model,
            tokens_used=tokens_used,
            cost_estimate=cost_estimate,
            latency_ms=latency_ms
        )
        
        # Step 5: Log usage
        _log_usage(
            request_type=request_type,
            endpoint=endpoint,
            user=user,
            provider=provider,
            model=model,
            tokens_used=tokens_used,
            cost_estimate=cost_estimate,
            latency_ms=latency_ms,
            cache_hit=False,
            memory_item=memory_item,
            selection_mode=selection_mode
        )
        
        logger.info(f"✅ [AI_GENERATED] {request_type} | {provider}/{model} | {tokens_used} tokens | ${cost_estimate} | {latency_ms}ms")
        return generated_text, provider
        
    except Exception as e:
        logger.error(f"❌ [AI_ERROR] {request_type} | {provider}/{model} | {e}")
        _log_usage(
            request_type=request_type,
            endpoint=endpoint,
            user=user,
            provider=provider,
            model=model,
            tokens_used=0,
            cost_estimate=0,
            latency_ms=int((time.time() - start_time) * 1000),
            cache_hit=False,
            success=False,
            error_message=str(e),
            selection_mode=selection_mode
        )
        raise


# ============================================
# MAIN AUDIO GENERATION ROUTER
# ============================================

def generate_audio(
    text: str,
    language: str = 'en',
    provider: str = None,
    voice_id: str = None,
    selection_mode: str = 'auto',
    user=None,
    endpoint: str = 'unknown',
    force_refresh: bool = False
) -> Tuple[bytes, str]:
    """
    Central router for ALL audio/TTS generation.
    
    Args:
        text: Text to convert to speech
        language: Language code (en, ja, es, etc.)
        provider: 'openai', 'elevenlabs', 'google_tts', etc.
        voice_id: Specific voice ID (optional)
        selection_mode: 'auto' or 'manual'
        user: User object (optional)
        endpoint: Which function called this
        force_refresh: Skip cache and call API
    
    Returns:
        Tuple of (audio_bytes, provider_used)
    """
    start_time = time.time()
    options = {'language': language, 'voice_id': voice_id}
    
    # Step 1: Check audio cache
    if not force_refresh:
        text_hash = AiMemory.compute_prompt_hash('tts_audio', text, options)
        cached = _check_audio_cache(text_hash)
        
        if cached:
            latency_ms = int((time.time() - start_time) * 1000)
            _log_usage(
                request_type='tts_audio',
                endpoint=endpoint,
                user=user,
                provider=cached['provider'],
                model=cached['model'],
                tokens_used=0,
                cost_estimate=cached['cost_estimate'],
                latency_ms=latency_ms,
                cache_hit=True,
                memory_item=cached['memory_item'],
                selection_mode=selection_mode
            )
            logger.info(f"✅ [TTS_CACHE_HIT] {language} | {text_hash[:12]} | {cached['provider']}")
            return cached['audio_bytes'], cached['provider']
    
    # Step 2: Select TTS provider
    if selection_mode == 'auto' or not provider:
        provider = _auto_select_tts_provider(language)
        logger.info(f"🎵 [TTS_AUTO_SELECT] {language} → {provider}")
    else:
        logger.info(f"👤 [TTS_MANUAL_SELECT] {language} → {provider}")
    
    # Step 3: Call TTS provider
    try:
        audio_bytes, cost_estimate = _call_tts_provider(
            provider=provider,
            text=text,
            language=language,
            voice_id=voice_id
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Step 4: Save audio to memory
        text_hash = AiMemory.compute_prompt_hash('tts_audio', text, options)
        memory_item = _save_audio_to_memory(
            text_hash=text_hash,
            text=text,
            audio_bytes=audio_bytes,
            provider=provider,
            language=language,
            voice_id=voice_id,
            cost_estimate=cost_estimate,
            latency_ms=latency_ms
        )
        
        # Step 5: Log usage
        _log_usage(
            request_type='tts_audio',
            endpoint=endpoint,
            user=user,
            provider=provider,
            model=voice_id or 'default',
            tokens_used=0,
            cost_estimate=cost_estimate,
            latency_ms=latency_ms,
            cache_hit=False,
            memory_item=memory_item,
            selection_mode=selection_mode
        )
        
        logger.info(f"✅ [TTS_GENERATED] {language} | {provider} | ${cost_estimate} | {latency_ms}ms")
        return audio_bytes, provider
        
    except Exception as e:
        logger.error(f"❌ [TTS_ERROR] {language} | {provider} | {e}")
        _log_usage(
            request_type='tts_audio',
            endpoint=endpoint,
            user=user,
            provider=provider,
            model=voice_id or 'default',
            tokens_used=0,
            cost_estimate=0,
            latency_ms=int((time.time() - start_time) * 1000),
            cache_hit=False,
            success=False,
            error_message=str(e),
            selection_mode=selection_mode
        )
        raise


# ============================================
# INTERNAL HELPER FUNCTIONS
# ============================================

def _check_memory_cache(request_type: str, prompt_hash: str) -> Optional[Dict]:
    """Check if we have cached response in AiMemory"""
    try:
        memory = AiMemory.objects.filter(
            request_type=request_type,
            prompt_hash=prompt_hash
        ).order_by('-user_rating', '-created_at').first()
        
        if memory and (memory.is_verified_good or (memory.user_rating or 0) >= 4.0):
            memory.mark_as_used()
            return {
                'text': memory.generated_text,
                'provider': memory.provider,
                'model': memory.model,
                'tokens_used': memory.tokens_used,
                'cost_estimate': memory.cost_estimate,
                'memory_item': memory
            }
    except Exception as e:
        logger.warning(f"Cache check failed: {e}")
    return None


def _check_audio_cache(text_hash: str) -> Optional[Dict]:
    """Check if we have cached audio in AiMemory"""
    try:
        memory = AiMemory.objects.filter(
            request_type='tts_audio',
            prompt_hash=text_hash,
            generated_audio_file__isnull=False
        ).first()
        
        if memory and memory.generated_audio_file:
            memory.mark_as_used()
            with memory.generated_audio_file.open('rb') as f:
                audio_bytes = f.read()
            return {
                'audio_bytes': audio_bytes,
                'provider': memory.provider,
                'model': memory.model,
                'cost_estimate': memory.cost_estimate,
                'memory_item': memory
            }
    except Exception as e:
        logger.warning(f"Audio cache check failed: {e}")
    return None


def _auto_select_model(request_type: str, options: Dict) -> Tuple[str, str]:
    """
    Auto-select best AI model based on request type and options.
    
    Logic:
    - Simple/routine content → Cheap tier
    - Complex/important content → Normal tier
    - Explicit requirement → Premium tier
    """
    # Determine tier
    tier = 'cheap'  # Default
    
    if request_type in ['podcast_script', 'report', 'lesson_script']:
        tier = 'normal'  # Important content
    
    if options.get('quality') == 'premium' or options.get('deep_reasoning'):
        tier = 'premium'
    
    # Get best model for this tier
    config = AiProviderConfig.objects.filter(
        tier=tier,
        is_active=True
    ).order_by('cost_per_million_tokens', '-quality_score').first()
    
    if config:
        return config.provider, config.model_name
    
    # Fallback
    logger.warning(f"No config found for tier={tier}, using default")
    return 'openai', 'gpt-4o-mini'


def _auto_select_tts_provider(language: str) -> str:
    """Auto-select best TTS provider for language"""
    # Simple logic: prefer ElevenLabs for quality, fallback to OpenAI
    if hasattr(settings, 'ELEVENLABS_API_KEY') and settings.ELEVENLABS_API_KEY:
        return 'elevenlabs'
    return 'openai'


def _call_text_provider(provider: str, model: str, prompt: str, options: Dict) -> Tuple[str, int, float]:
    """
    Call external AI provider for text generation.
    Returns: (generated_text, tokens_used, cost_estimate)
    """
    # Import here to avoid circular dependencies
    if provider == 'openai':
        from dailycast.services_interactive import _call_openai_for_text
        return _call_openai_for_text(model, prompt, options)
    
    elif provider == 'gemini':
        from dailycast.services_interactive import _call_gemini_for_text
        return _call_gemini_for_text(model, prompt, options)
    
    elif provider == 'claude':
        from dailycast.services_interactive import _call_claude_for_text
        return _call_claude_for_text(model, prompt, options)
    
    elif provider == 'local_small_model':
        return _call_local_model(model, prompt, options)
    
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _call_tts_provider(provider: str, text: str, language: str, voice_id: str = None) -> Tuple[bytes, float]:
    """
    Call TTS provider for audio generation.
    Returns: (audio_bytes, cost_estimate)
    """
    # Import here to avoid circular dependencies
    if provider == 'elevenlabs':
        from dailycast.services_interactive import _synthesize_with_elevenlabs
        audio_bytes, _ = _synthesize_with_elevenlabs(text, language)
        cost = len(text) * 0.000015  # Rough estimate
        return audio_bytes, cost
    
    elif provider == 'openai':
        from dailycast.services_interactive import _synthesize_with_openai_tts
        audio_bytes, _ = _synthesize_with_openai_tts(text, language)
        cost = len(text) * 0.000015
        return audio_bytes, cost
    
    elif provider == 'google_tts':
        from dailycast.services_interactive import _synthesize_with_google_tts
        audio_bytes, _ = _synthesize_with_google_tts(text, language)
        cost = len(text) * 0.000004
        return audio_bytes, cost
    
    else:
        raise ValueError(f"Unknown TTS provider: {provider}")


def _call_local_model(model: str, prompt: str, options: Dict) -> Tuple[str, int, float]:
    """Call our fine-tuned local model (placeholder for now)"""
    # TODO: Implement actual local model inference
    logger.warning("Local model not yet implemented, using template")
    return f"[Template response for: {prompt[:50]}...]", 0, 0.0


def _save_to_memory(
    request_type: str,
    prompt_hash: str,
    prompt_text: str,
    prompt_options: Dict,
    generated_text: str,
    provider: str,
    model: str,
    tokens_used: int,
    cost_estimate: float,
    latency_ms: int
) -> AiMemory:
    """Save generated text to AiMemory cache"""
    memory, created = AiMemory.objects.get_or_create(
        request_type=request_type,
        prompt_hash=prompt_hash,
        defaults={
            'prompt_text': prompt_text,
            'prompt_options': prompt_options,
            'generated_text': generated_text,
            'provider': provider,
            'model': model,
            'tokens_used': tokens_used,
            'cost_estimate': cost_estimate,
            'latency_ms': latency_ms,
        }
    )
    
    if not created:
        # Update existing
        memory.generated_text = generated_text
        memory.provider = provider
        memory.model = model
        memory.tokens_used = tokens_used
        memory.cost_estimate = cost_estimate
        memory.latency_ms = latency_ms
        memory.save()
    
    return memory


def _save_audio_to_memory(
    text_hash: str,
    text: str,
    audio_bytes: bytes,
    provider: str,
    language: str,
    voice_id: str,
    cost_estimate: float,
    latency_ms: int
) -> AiMemory:
    """Save generated audio to AiMemory cache"""
    import io
    from django.core.files.uploadedfile import InMemoryUploadedFile
    
    # Create file object
    audio_file = InMemoryUploadedFile(
        io.BytesIO(audio_bytes),
        None,
        f"{text_hash[:12]}.mp3",
        'audio/mpeg',
        len(audio_bytes),
        None
    )
    
    memory, created = AiMemory.objects.get_or_create(
        request_type='tts_audio',
        prompt_hash=text_hash,
        defaults={
            'prompt_text': text,
            'prompt_options': {'language': language, 'voice_id': voice_id},
            'generated_audio_file': audio_file,
            'audio_metadata': {
                'language': language,
                'voice_id': voice_id,
                'duration_sec': len(audio_bytes) / (16000 * 2),  # Rough estimate
                'format': 'mp3'
            },
            'provider': provider,
            'model': voice_id or 'default',
            'cost_estimate': cost_estimate,
            'latency_ms': latency_ms,
        }
    )
    
    if not created and not memory.generated_audio_file:
        memory.generated_audio_file = audio_file
        memory.save()
    
    return memory


def _log_usage(
    request_type: str,
    endpoint: str,
    provider: str,
    model: str,
    tokens_used: int,
    cost_estimate: float,
    latency_ms: int,
    cache_hit: bool,
    user=None,
    memory_item=None,
    selection_mode: str = 'auto',
    success: bool = True,
    error_message: str = ''
):
    """Log AI usage to AiUsageLog"""
    try:
        AiUsageLog.objects.create(
            request_type=request_type,
            endpoint=endpoint,
            user=user,
            provider=provider,
            model=model,
            tokens_used=tokens_used,
            cost_estimate=cost_estimate,
            latency_ms=latency_ms,
            cache_hit=cache_hit,
            memory_item=memory_item,
            selection_mode=selection_mode,
            success=success,
            error_message=error_message
        )
    except Exception as e:
        logger.error(f"Failed to log AI usage: {e}")


# ============================================
# ADMIN/UTILITY FUNCTIONS
# ============================================

def get_cost_summary(days=30):
    """Get AI cost summary for last N days"""
    from datetime import timedelta
    from django.db.models import Sum, Count, Avg
    
    cutoff = timezone.now() - timedelta(days=days)
    
    logs = AiUsageLog.objects.filter(timestamp__gte=cutoff)
    
    summary = logs.aggregate(
        total_requests=Count('id'),
        total_cost=Sum('cost_estimate'),
        total_tokens=Sum('tokens_used'),
        cache_hits=Count('id', filter=models.Q(cache_hit=True)),
        avg_latency=Avg('latency_ms')
    )
    
    # Per-provider breakdown
    by_provider = logs.values('provider', 'model').annotate(
        requests=Count('id'),
        cost=Sum('cost_estimate'),
        tokens=Sum('tokens_used')
    ).order_by('-cost')
    
    return {
        'summary': summary,
        'by_provider': list(by_provider),
        'cache_hit_rate': (summary['cache_hits'] / summary['total_requests'] * 100) if summary['total_requests'] > 0 else 0
    }


def export_training_data(min_rating=4.0, verified_only=True):
    """Export high-quality data for fine-tuning"""
    query = AiMemory.objects.filter(use_for_training=True)
    
    if verified_only:
        query = query.filter(is_verified_good=True)
    else:
        query = query.filter(user_rating__gte=min_rating)
    
    data = []
    for item in query:
        data.append({
            'prompt': item.prompt_text,
            'completion': item.generated_text,
            'request_type': item.request_type,
            'tags': item.training_tags,
            'options': item.prompt_options
        })
    
    return data
