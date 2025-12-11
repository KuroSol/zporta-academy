import logging
import time
from math import ceil
from typing import Dict, Tuple

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from dailycast.models import DailyPodcast

logger = logging.getLogger(__name__)


try:
    from intelligence.models import UserAbilityProfile
except Exception:  # pragma: no cover - optional dependency guard
    UserAbilityProfile = None

try:
    from analytics.models import ActivityEvent
except Exception:  # pragma: no cover - optional dependency guard
    ActivityEvent = None


def collect_user_stats(user) -> Dict:
    """Lightweight stats collection from existing apps."""
    stats = {
        "ability_score": None,
        "ability_level": None,
        "weak_subject": None,
        "recent_quiz": None,
    }

    if UserAbilityProfile:
        ability = getattr(user, "ability_profile", None)
        if ability:
            stats["ability_score"] = ability.overall_ability_score
            stats["ability_level"] = ability.get_ability_level()
            if ability.ability_by_subject:
                # Pick the weakest subject by lowest score
                weakest = min(
                    ability.ability_by_subject.items(),
                    key=lambda kv: kv[1],
                )
                stats["weak_subject"] = weakest[0]

    if ActivityEvent:
        last_quiz = (
            ActivityEvent.objects.filter(user=user, event_type="quiz_completed")
            .order_by("-timestamp")
            .first()
        )
        if last_quiz:
            stats["recent_quiz"] = {
                "id": last_quiz.object_id,
                "timestamp": last_quiz.timestamp,
            }

    return stats


def _generate_with_openai(api_key: str, prompt: str, model: str = "gpt-4o-mini") -> Tuple[str, str]:
    """Call OpenAI Chat Completions with a selectable model (defaults to gpt-4o-mini)."""
    model_name = model or "gpt-4o-mini"
    logger.info(f"Dailycast: attempting OpenAI {model_name}")
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "messages": [
                {"role": "system", "content": "You are a concise podcast script writer."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1200,  # Increased for 5 min script
            "temperature": 0.7,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"].strip()
    return text, "openai"


def _generate_with_gemini(api_key: str, prompt: str, model: str = "gemini-2.0-pro-exp") -> Tuple[str, str]:
    """Call Gemini with a selectable model (defaults to gemini-2.0-pro-exp)."""
    model_name = model or "gemini-2.0-pro-exp"
    logger.info(f"Dailycast: attempting Gemini model {model_name}")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent"
        f"?key={api_key}"
    )
    response = requests.post(
        url,
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        if parts and parts[0].get("text"):
            return parts[0]["text"].strip(), "gemini"
    raise ValueError("No content returned from Gemini")


def _build_prompt(user, language: str, user_stats: Dict) -> str:
    ability_level = user_stats.get("ability_level") or "mixed"
    weak_subject = user_stats.get("weak_subject") or "general study skills"
    recent_quiz = user_stats.get("recent_quiz")
    recent_quiz_text = (
        f"latest quiz {recent_quiz['id']} completed at {recent_quiz['timestamp'].strftime('%Y-%m-%d')}"
        if recent_quiz
        else "recent quiz activity not available"
    )

    return (
        "Create a daily learning podcast script. "
        f"Language: {language}. Target length: 5 minutes (≈750 words). "
        "Tone: warm, encouraging, concise sentences that are easy to read aloud. "
        f"Learner level: {ability_level}. Focus area: {weak_subject}. "
        f"Context: {recent_quiz_text}. "
        "Structure: 1) warm hello, 2) quick progress recap, 3) one focused lesson, "
        "4) one practical tip, 5) motivating close with a tiny homework suggestion. "
        "Return only the script text."
    )


def generate_podcast_script(user, language: str, user_stats: Dict, provider: str = None) -> Tuple[str, str]:
    """Generate script via specified provider, or fallback chain."""
    prompt = _build_prompt(user, language, user_stats)

    openai_key = getattr(settings, "OPENAI_API_KEY", None)
    gemini_key = getattr(settings, "GEMINI_API_KEY", None)

    # If provider is explicitly requested, try it first
    if provider == 'openai' and openai_key:
        try:
            return _generate_with_openai(openai_key, prompt)
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            # Fall through to normal chain or re-raise? 
            # For comparison purposes, maybe we should just return the error?
            # But let's keep it robust for now and fall through if it fails.
    
    if provider == 'gemini' and gemini_key:
        try:
            return _generate_with_gemini(gemini_key, prompt)
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")

    # Default fallback chain
    if openai_key:
        try:
            return _generate_with_openai(openai_key, prompt)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Dailycast: OpenAI failed, falling back to Gemini (%s)", exc)

    if gemini_key:
        try:
            return _generate_with_gemini(gemini_key, prompt)
        except Exception as exc:
             logger.warning("Dailycast: Gemini failed, using template (%s)", exc)

    # Fallback template

    # Fallback template
    logger.info("Dailycast: using template fallback")
    username = getattr(user, "username", "Learner")
    template_script = (
        f"Hey {username}, welcome back! Today we're keeping it short and useful. "
        f"You're working at a {user_stats.get('ability_level') or 'steady'} level. "
        f"Let's spend a few minutes on {user_stats.get('weak_subject') or 'a quick refresher topic'}. "
        "We'll start with one key idea, then a practical example, and finish with a tiny homework item. "
        "Take a breath, keep it light, and let's dive in!"
    )
    return template_script, "template"


def _pick_polly_voice(language: str) -> Tuple[str, str]:
    language = (language or "en").lower()
    if language.startswith("ja"):
        return "Mizuki", "neural"
    if language.startswith("es"):
        return "Lucia", "neural"
    if language.startswith("fr"):
        return "Celine", "neural"
    if language.startswith("de"):
        return "Vicki", "neural"
    # Default to US English
    return "Joanna", "neural"


def synthesize_audio(script_text: str, language: str) -> Tuple[bytes, str]:
    """Convert text to speech using Amazon Polly (optional - saves MP3 to media folder).
    
    Audio files are saved directly to MEDIA_ROOT/podcasts/ (no S3 needed).
    If AWS credentials are not configured, gracefully skips audio generation.
    """
    import boto3  # Lazy import to avoid hard dependency on import time
    from botocore.exceptions import BotoCoreError, ClientError

    aws_key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    aws_secret = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    
    # Skip Polly if credentials are not configured
    if not aws_key or not aws_secret:
        logger.warning("Dailycast: AWS credentials not configured, skipping audio generation")
        # Return empty bytes with "none" provider to skip audio
        return b"", "none"
    
    voice_id, engine = _pick_polly_voice(language)
    try:
        polly = boto3.client(
            "polly",
            region_name=getattr(settings, "AWS_REGION", "us-east-1"),
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
        )
        response = polly.synthesize_speech(
            Text=script_text[:4500],  # Polly limit safety
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine=engine,
        )
    except (BotoCoreError, ClientError) as exc:  # pragma: no cover - network error path
        logger.error("Dailycast: Polly synthesis failed: %s", exc)
        logger.warning("Dailycast: Skipping audio, will store script only")
        return b"", "none"

    audio_stream = response.get("AudioStream")
    if not audio_stream:
        raise ValueError("Polly returned no audio stream")

    audio_bytes = audio_stream.read()
    return audio_bytes, "polly"


def estimate_duration_seconds(script_text: str) -> int:
    words = len(script_text.split())
    return max(60, ceil(words / 150 * 60))  # assume 150 wpm


def create_podcast_for_user(
    user,
    language: str | None = None,
    requested_by=None,
    request_type: str = "user",
) -> DailyPodcast:
    """Orchestrate script + audio generation. No automatic triggers, no hardcoded users."""
    language = language or getattr(settings, "DAILYCAST_DEFAULT_LANGUAGE", "en")

    # Optional per-admin config: cooldown can be toggled in settings; default OFF
    enforce_cooldown = getattr(settings, "DAILYCAST_ENFORCE_COOLDOWN", False)
    if enforce_cooldown:
        now = timezone.now()
        from datetime import timedelta

        recent = DailyPodcast.objects.filter(
            user=user,
            status=DailyPodcast.STATUS_COMPLETED,
            created_at__gte=now - timedelta(hours=24),
        ).order_by("-created_at").first()
        if recent:
            wait_until = recent.created_at + timedelta(hours=24)
            raise PermissionError(
                f"Podcast already generated. Please wait until {wait_until.strftime('%Y-%m-%d %H:%M UTC')}"
            )

    stats = collect_user_stats(user)

    podcast = DailyPodcast(
        user=user,
        primary_language=language,
        status=DailyPodcast.STATUS_PENDING,
        requested_by_user=requested_by is not None,
        requested_by=requested_by,
        user_request_type=request_type or "user",
    )

    try:
        script_text, llm_provider = generate_podcast_script(user, language, stats)
        audio_bytes, tts_provider = synthesize_audio(script_text, language)

        podcast.script_text = script_text
        podcast.llm_provider = llm_provider
        podcast.tts_provider = tts_provider
        podcast.duration_seconds = estimate_duration_seconds(script_text)

        # Only save audio file if we have bytes
        if audio_bytes:
            filename = f"podcast_{user.id}_{int(time.time())}.mp3"
            podcast.audio_file.save(filename, ContentFile(audio_bytes), save=False)

        podcast.status = DailyPodcast.STATUS_COMPLETED
        podcast.error_message = None
        podcast.save()

        return podcast
    except Exception as exc:  # noqa: BLE001
        podcast.status = DailyPodcast.STATUS_FAILED
        podcast.error_message = str(exc)
        # Store partial context if we have it
        if not podcast.script_text:
            podcast.script_text = "Podcast generation failed before script was saved."
        podcast.save()
        logger.exception("Dailycast: podcast generation failed")
        raise
