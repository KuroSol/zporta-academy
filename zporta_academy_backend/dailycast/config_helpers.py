"""
Helpers to read TeacherContentConfig throughout the codebase.
Use these functions instead of accessing the model directly.

Example:
    from dailycast.config_helpers import get_config, get_tts_provider
    
    config = get_config()
    provider = get_tts_provider()
    word_limit = get_script_word_limit(is_short=True)
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def get_config():
    """
    Get the singleton TeacherContentConfig.
    Creates default if doesn't exist.
    
    Returns:
        TeacherContentConfig instance
    """
    from dailycast.models import TeacherContentConfig
    try:
        return TeacherContentConfig.get_config()
    except Exception as e:
        logger.error(f"Error fetching config: {e}")
        # Return minimal default to prevent crashes
        return TeacherContentConfig.get_config()


def is_enabled() -> bool:
    """Check if teacher content generation is enabled."""
    return get_config().enabled


def get_default_language() -> str:
    """Get default language for generation."""
    return get_config().default_language


def get_default_output_format() -> str:
    """Get default output format (text, audio, or both)."""
    return get_config().default_output_format


def get_llm_provider() -> str:
    """Get default LLM provider (openai, gemini, template)."""
    return get_config().default_llm_provider


def get_openai_model() -> str:
    """Get OpenAI model name."""
    return get_config().openai_model


def get_gemini_model() -> str:
    """Get Google Gemini model name."""
    return get_config().gemini_model


def get_tts_provider() -> str:
    """Get default TTS provider (elevenlabs, google, openai, polly, etc)."""
    return get_config().default_tts_provider


def get_tts_fallback_chain() -> List[str]:
    """
    Get TTS fallback chain order.
    
    Returns:
        List like ["elevenlabs", "google", "openai"]
    """
    chain = get_config().tts_fallback_chain
    if not chain:
        # Default fallback chain if not configured
        return ["elevenlabs", "google", "openai"]
    return chain if isinstance(chain, list) else ["elevenlabs", "google", "openai"]


def get_tts_speaking_rate() -> float:
    """Get TTS speaking rate (1.0=normal, 0.5=slow, 1.5=fast)."""
    return get_config().tts_speaking_rate


def get_tts_pitch() -> float:
    """Get TTS pitch adjustment (-20 to +20)."""
    return get_config().tts_pitch


def get_tts_volume_gain() -> float:
    """Get TTS volume gain in dB."""
    return get_config().tts_volume_gain


def get_voice_for_language(language: str) -> Optional[str]:
    """
    Get voice ID/name for specific language.
    
    Args:
        language: Language code (en, ja, es, etc)
    
    Returns:
        Voice ID if configured, else None
    """
    import random

    voice_map = get_config().voice_map_json or {}
    if not isinstance(voice_map, dict):
        return None
    value = voice_map.get(language)

    # Support single voice string or list of voices (for random rotation / multi-language selection)
    if isinstance(value, list):
        return random.choice(value) if value else None
    return value


def get_script_word_limit(is_short: bool = False) -> int:
    """
    Get target word count for generated scripts.
    
    Args:
        is_short: If True, return limit for "short" scripts
    
    Returns:
        Word count target
    """
    config = get_config()
    if is_short:
        return config.script_word_limit_short
    return config.script_word_limit_normal


def should_include_questions() -> bool:
    """Check if generated scripts should include Q&A format."""
    return get_config().script_include_questions


def get_num_questions() -> int:
    """Get number of questions to include in scripts."""
    return get_config().num_questions_per_script


def should_include_quote() -> bool:
    """Check if scripts should include motivational quotes."""
    return get_config().include_motivational_quote


def get_prompt_system_role() -> str:
    """Get system role/personality for LLM."""
    return get_config().prompt_system_role


def get_prompt_script_intro() -> str:
    """Get introduction instruction for script generation."""
    return get_config().prompt_script_intro


def get_prompt_tone_guide() -> str:
    """Get tone guidance for generated content."""
    return get_config().prompt_tone_guide


def get_cooldown_hours() -> int:
    """Get cooldown period in hours between generations."""
    return get_config().cooldown_hours


def is_test_user_cooldown_enabled() -> bool:
    """Check if cooldown applies to test users (Alex)."""
    return get_config().test_user_cooldown_enabled


def get_max_generations_per_day() -> int:
    """Get max generations per day per user (0=unlimited)."""
    return get_config().max_generations_per_day


def get_cost_per_generation() -> float:
    """Get credit cost per generation."""
    cost = get_config().cost_per_generation
    return float(cost) if cost else 0.0


def is_credit_system_enabled() -> bool:
    """Check if credit system is enabled."""
    return get_config().enable_credit_system


def is_bilingual_supported() -> bool:
    """Check if bilingual content generation is supported."""
    return get_config().support_bilingual


def get_bilingual_default_pair() -> str:
    """Get default bilingual pair (e.g. 'en_ja')."""
    return get_config().bilingual_default_pair


def should_stitch_bilingual_audio() -> bool:
    """Check if bilingual audio should be stitched into single file."""
    return get_config().bilingual_audio_stitch


def is_verbose_logging_enabled() -> bool:
    """Check if verbose logging is enabled."""
    return get_config().verbose_logging


def is_debug_mode_enabled() -> bool:
    """Check if debug mode is enabled."""
    return get_config().debug_mode


def log_config_debug(message: str):
    """Log debug message if verbose logging is enabled."""
    if is_verbose_logging_enabled():
        logger.info(f"[CONFIG_DEBUG] {message}")


# ===== CONVENIENCE FUNCTIONS =====

def get_full_config_dict() -> Dict:
    """
    Get entire config as dictionary (useful for templates/API).
    
    Returns:
        Dict with all config fields
    """
    config = get_config()
    return {
        "enabled": config.enabled,
        "default_language": config.default_language,
        "default_output_format": config.default_output_format,
        "default_llm_provider": config.default_llm_provider,
        "openai_model": config.openai_model,
        "gemini_model": config.gemini_model,
        "default_tts_provider": config.default_tts_provider,
        "tts_fallback_chain": get_tts_fallback_chain(),
        "tts_speaking_rate": config.tts_speaking_rate,
        "tts_pitch": config.tts_pitch,
        "tts_volume_gain": config.tts_volume_gain,
        "script_word_limit_normal": config.script_word_limit_normal,
        "script_word_limit_short": config.script_word_limit_short,
        "script_include_questions": config.script_include_questions,
        "num_questions_per_script": config.num_questions_per_script,
        "include_motivational_quote": config.include_motivational_quote,
        "cooldown_hours": config.cooldown_hours,
        "test_user_cooldown_enabled": config.test_user_cooldown_enabled,
        "max_generations_per_day": config.max_generations_per_day,
        "cost_per_generation": float(config.cost_per_generation),
        "enable_credit_system": config.enable_credit_system,
        "support_bilingual": config.support_bilingual,
        "bilingual_default_pair": config.bilingual_default_pair,
        "bilingual_audio_stitch": config.bilingual_audio_stitch,
        "verbose_logging": config.verbose_logging,
        "debug_mode": config.debug_mode,
    }
