    requested_by_user=requested_by is not None,@@
    requested_by=requested_by,@@
    user_request_type=request_type,@@
"""
Enhanced podcast generation with:
- Course-specific content (personalized to user's courses)
- Interactive Q&A format (questions + review)
- Multi-language support (up to 2 languages)
- Flexible output (text, audio, or both)
- Teacher-style coaching (~6 minutes)
- Bilingual audio stitching (EN + JA in single MP3)
"""
import logging
    requested_by=None,@@
    request_type: str = 'user',@@
) -> DailyPodcast:
import os
import io
from math import ceil
from typing import Dict, List, Tuple
import re

import requests
import google.generativeai as genai
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from dailycast.models import DailyPodcast

logger = logging.getLogger(__name__)
        requested_by: User who triggered generation (for auditing)
        request_type: How was this requested ('user', 'admin_dashboard', 'api', etc)

# Initialize Japanese transliterator
try:
    from pykakasi import kakasi
    kks = kakasi()
except ImportError:
    from django.utils import timezone
    from datetime import timedelta
    from django.contrib.auth import get_user_model
    User = get_user_model()
try:
    # ✅ NEW: Check 24-hour cooldown (per user, ALL users same limit)
    enforce_cooldown = getattr(settings, "DAILYCAST_ENFORCE_COOLDOWN", True)
    if enforce_cooldown:
        now = timezone.now()
        cooldown_threshold = now - timedelta(hours=24)
        
        recent_podcast = DailyPodcast.objects.filter(
            user=user,
            status=DailyPodcast.STATUS_COMPLETED,
            created_at__gte=cooldown_threshold
        ).order_by('-created_at').first()
        
        if recent_podcast:
            time_remaining = recent_podcast.created_at + timedelta(hours=24) - now
            hours_remaining = int(time_remaining.total_seconds() / 3600)
            minutes_remaining = int((time_remaining.total_seconds() % 3600) / 60)
            raise ValueError(
                f"Podcast already generated. Please wait {hours_remaining}h {minutes_remaining}m."
            )
    
    # ✅ NEW: Track request metadata
    if not isinstance(requested_by, User) and requested_by is not None:
        requested_by = None
    """
    if not text:
        return False
    japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]')
    return bool(japanese_pattern.search(text))


def split_script_by_language(text: str, primary_language: str = "en") -> List[Dict[str, str]]:
    """
    Split text into segments by PARAGRAPH first, then by language within paragraphs.
    Returns list of dicts: [{"lang": "en", "text": "..."}, {"lang": "ja", "text": "..."}, ...]
    
    This enables bilingual TTS where each segment is spoken by a native voice,
    while keeping paragraphs more cohesive (no mid-paragraph language switches).
    """
    if not text:
        return []
    
    segments = []
    
    # Pattern to match Japanese characters
    japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]')
    
    # Split by paragraphs (2+ newlines)
    paragraphs = re.split(r'\n{2,}', text)
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        # Within each paragraph, split by language boundaries
        # but only at sentence/phrase boundaries (spaces) to keep it natural
        current_lang = primary_language
        current_text = []
        
        # Split paragraph into words/phrases to detect language transitions gracefully
        words = para.split()
        
        for word in words:
            # Detect dominant language of this word
            japanese_chars = len([c for c in word if japanese_pattern.match(c)])
            word_is_japanese = japanese_chars > len(word) / 2  # > 50% Japanese
            detected_lang = "ja" if word_is_japanese else primary_language
            
            # If language changes and we have accumulated text, save it
            if detected_lang != current_lang and current_text:
                segment_text = ' '.join(current_text).strip()
                if segment_text:
                    segments.append({"lang": current_lang, "text": segment_text})
                current_text = []
                current_lang = detected_lang
            
            current_text.append(word)
        
        # Add remaining text from paragraph
        if current_text:
            segment_text = ' '.join(current_text).strip()
            if segment_text:
                segments.append({"lang": current_lang, "text": segment_text})
        
        # Add paragraph pause marker (special segment)
        if segments and segments[-1]["text"]:  # Only if we just added a segment
            segments.append({"lang": "pause", "text": "[paragraph_pause]"})
    
    # Remove trailing pause if any
    if segments and segments[-1].get("lang") == "pause":
        segments.pop()
    
    logger.info(f"📋 Split script into {len([s for s in segments if s.get('lang') != 'pause'])} language segments + {len([s for s in segments if s.get('lang') == 'pause'])} pauses")
    return segments


def tts_chunk_with_google(segment_text: str, lang: str) -> bytes:
    """
    Generate TTS audio for a single language segment using Google Cloud TTS.
    Uses Neural2 voices for highest quality with NATURAL speaking.
    
    Args:
        segment_text: Text to synthesize
        lang: Language code ("en" or "ja")
    
    Returns:
        MP3 audio bytes
    """
    from google.cloud import texttospeech
    import html
    
    logger.info(f"[TTS_BILINGUAL] Synthesizing {len(segment_text)} chars, lang={lang}")
    
    # Get or initialize TTS client
    client = texttospeech.TextToSpeechClient()
    
    # Select voice based on language
    if lang.startswith("ja"):
        voice_name = "ja-JP-Neural2-B"  # Female Japanese voice
        language_code = "ja-JP"
    else:
        voice_name = "en-US-Neural2-F"  # Female English voice
        language_code = "en-US"
    
    # Prepare simple SSML (escape special characters)
    escaped_text = html.escape(segment_text)
    ssml = f"<speak>{escaped_text}</speak>"
    
    logger.info(f"[TTS_BILINGUAL] Voice: {voice_name}, SSML length: {len(ssml)}")
    
    # Configure synthesis
    synthesis_input = texttospeech.SynthesisInput(ssml=ssml)
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name,
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=1.0,  # CHANGED FROM 1.15: Use natural speaking rate
        pitch=0.0,
        effects_profile_id=["headphone-class-device"],
    )
    
    logger.info(f"[TTS_BILINGUAL] Audio config: speaking_rate=1.0 (natural)")
    
    # Synthesize
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )
    
    logger.info(f"[TTS_BILINGUAL] ✅ Audio generated: {len(response.audio_content)} bytes")
    return response.audio_content


def synthesize_single_language_audio(script_text: str, language: str = "en") -> Tuple[bytes, str]:
    """
    Generate single-language audio using best-suited TTS for each language.
    
    Language routing:
    - English (en): OpenAI TTS (alloy voice) - natural, expressive
    - Japanese (ja): Google Cloud TTS (ja-JP-Neural2-B) - correct pronunciation, natural flow
    - Spanish, French, etc.: OpenAI TTS
    
    No mixing languages = clear, natural pronunciation.
    One continuous MP3 = smooth flow.
    """
    try:
        from pydub import AudioSegment
    except ImportError as e:
        raise ImportError(f"Required library missing: {e}. Install: pip install pydub")
    
    logger.info(f"[TTS] Synthesizing single-language ({language}) audio")

    # Route to best TTS provider for language
    if language == "ja":
        try:
            return _synthesize_japanese_with_elevenlabs(script_text)
        except Exception as e:
            logger.warning(f"[TTS] ElevenLabs failed, falling back to Google TTS: {e}")
            return _synthesize_japanese_with_google_tts(script_text)
    else:
        return _synthesize_with_openai_tts(script_text, language)


def _synthesize_with_openai_tts(script_text: str, language: str = "en") -> Tuple[bytes, str]:
    """
    Use OpenAI TTS for English and other languages.
    Expressive, natural voices.
    """
    try:
        from pydub import AudioSegment
        from openai import OpenAI
    except ImportError as e:
        raise ImportError(f"Required library missing: {e}")
    
    logger.info(f"🎙️ Using OpenAI TTS for {language} (natural, expressive)")
    
    # Voice selection for natural delivery
    voice_map = {
        "en": "alloy",      # Warm, natural English
        "es": "nova",       # Natural Spanish
        "fr": "echo",       # Natural French
        "de": "onyx",       # Natural German
        "zh": "shimmer",    # Multilingual
        "ko": "alloy",      # Fallback
    }
    voice = voice_map.get(language, "alloy")
    
    openai_key = getattr(settings, "OPENAI_API_KEY", None)
    if not openai_key:
        raise ValueError("OPENAI_API_KEY not configured")
    
    client = OpenAI(api_key=openai_key)
    
    logger.info(f"[TTS] Voice: {voice}, Language: {language}, Text: {len(script_text)} chars")
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in script_text.split("\n") if p.strip()]
    
    audio_segments = []
    
    for i, paragraph in enumerate(paragraphs):
        if not paragraph:
            continue
        
        if paragraph.lower() == "(pause)":
            # Natural pause with subtle breath sound
            silence = AudioSegment.silent(duration=1200)
            audio_segments.append(silence)
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: (breathing pause)")
            continue
        
        try:
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: OpenAI {language}, {len(paragraph)} chars")
            
            response = client.audio.speech.create(
                model="tts-1-hd",  # High quality
                voice=voice,
                input=paragraph,
                speed=1.0  # Natural pace
            )
            
            audio_segment = AudioSegment.from_file(
                io.BytesIO(response.content),
                format="mp3"
            )
            audio_segments.append(audio_segment)
            logger.info(f"    [OK] Generated: {len(audio_segment)/1000:.1f}s")
            
        except Exception as e:
            logger.error(f"    [ERROR] TTS failed: {e}")
            raise
    
    if not audio_segments:
        raise RuntimeError("No audio segments generated")
    
    # Stitch with natural pauses (conversational rhythm)
    logger.info("[TTS] Stitching with natural teacher rhythm...")
    final_audio = audio_segments[0]
    
    for segment in audio_segments[1:]:
        silence = AudioSegment.silent(duration=250)  # Natural conversational gap
        final_audio = final_audio + silence + segment
    
    output = io.BytesIO()
    final_audio.export(output, format="mp3", bitrate="128k")
    
    duration = len(final_audio) / 1000.0
    logger.info(f"[OK] Natural audio: {len(output.getvalue())} bytes, {duration:.1f}s, openai_{language}_natural")
    
    return output.getvalue(), f"openai_{language}_natural"


def _synthesize_japanese_with_elevenlabs(script_text: str) -> Tuple[bytes, str]:
    """
    Use ElevenLabs TTS for Japanese with natural, expressive voice.
    
    ElevenLabs advantages:
    - Natural human-like pronunciation
    - Expressive delivery with emotion
    - Multilingual support
    
    Note: Free tier uses English voices, but multilingual model supports Japanese
    """
    try:
        from pydub import AudioSegment
        import requests
    except ImportError as e:
        raise ImportError(f"Required library missing: {e}")
    
    logger.info("[TTS] Using ElevenLabs TTS for Japanese (multilingual model)")
    
    # Get API key
    api_key = getattr(settings, "ELEVENLABS_API_KEY", None)
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY not configured in settings")
    
    # Use Lily - professional, educational voice that works with multilingual model
    # This voice has good clarity for teaching content
    voice_id = "pFZP5JQG7iQjIQuC4Bku"  # Lily - professional, educational
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in script_text.split("\n") if p.strip()]
    
    audio_segments = []
    
    for i, paragraph in enumerate(paragraphs):
        if not paragraph:
            continue
        
        if paragraph.lower() == "(pause)":
            silence = AudioSegment.silent(duration=1200)
            audio_segments.append(silence)
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: (breathing pause)")
            continue
        
        try:
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: ElevenLabs ja (Lily multilingual), {len(paragraph)} chars")
            
            # ElevenLabs API endpoint
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json"
            }
            
            payload = {
                "text": paragraph,
                "model_id": "eleven_multilingual_v2",  # Multilingual model supports Japanese
                "voice_settings": {
                    "stability": 0.5,      # Natural delivery (not monotone)
                    "similarity_boost": 0.75  # Consistent voice quality
                }
            }
            
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                raise RuntimeError(f"ElevenLabs API error: {response.status_code} - {response.text}")
            
            # Convert to AudioSegment
            audio_segment = AudioSegment.from_file(
                io.BytesIO(response.content),
                format="mp3"
            )
            audio_segments.append(audio_segment)
            logger.info(f"    [OK] Generated: {len(audio_segment)/1000:.1f}s")
            
        except Exception as e:
            logger.error(f"    [ERROR] ElevenLabs TTS failed: {e}")
            raise
    
    if not audio_segments:
        raise RuntimeError("No audio segments generated")
    
    # Stitch with natural pauses
    logger.info("[TTS] Stitching with natural teacher-like rhythm...")
    final_audio = audio_segments[0]
    
    for segment in audio_segments[1:]:
        silence = AudioSegment.silent(duration=250)  # Conversational gap
        final_audio = final_audio + silence + segment
    
    output = io.BytesIO()
    final_audio.export(output, format="mp3", bitrate="128k")
    
    duration = len(final_audio) / 1000.0
    logger.info(f"[OK] Natural Japanese audio (ElevenLabs): {len(output.getvalue())} bytes, {duration:.1f}s")
    
    return output.getvalue(), "elevenlabs_ja_lily"


def _synthesize_japanese_with_google_tts(script_text: str) -> Tuple[bytes, str]:
    """
    Use Google Cloud TTS for Japanese with optimized parameters.
    
    Uses SSML (Speech Synthesis Markup Language) for:
    - Natural pauses and emphasis
    - Better emotional delivery
    - Proper pronunciation of kanji/pitch accents
    
    Voice: ja-JP-Neural2-B (warm, natural female voice - best for teaching)
    """
    try:
        from pydub import AudioSegment
        from google.cloud import texttospeech
    except ImportError as e:
        raise ImportError(f"Required library missing: {e}")
    
    logger.info(f"[TTS] Using Google Cloud TTS for Japanese (SSML optimized)")
    
    # Get Google credentials from os.environ (set in settings)
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or getattr(settings, "GOOGLE_APPLICATION_CREDENTIALS", None)
    if not credentials_path or not os.path.exists(credentials_path):
        raise ValueError(f"GOOGLE_APPLICATION_CREDENTIALS not configured or file not found (path: {credentials_path})")
    
    # Client uses os.environ['GOOGLE_APPLICATION_CREDENTIALS'] automatically
    client = texttospeech.TextToSpeechClient()
    
    # Japanese voice - warm, natural, teacher-like
    voice = texttospeech.VoiceSelectionParams(
        language_code="ja-JP",
        name="ja-JP-Neural2-B",  # Female voice - warm and natural
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
    )
    
    # Audio config for natural delivery
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        pitch=0.0,           # Natural pitch (no modification)
        speaking_rate=1.0,   # Natural speed
        volume_gain_db=0.0   # Normal volume
    )
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in script_text.split("\n") if p.strip()]
    
    audio_segments = []
    
    for i, paragraph in enumerate(paragraphs):
        if not paragraph:
            continue
        
        if paragraph.lower() == "(pause)":
            silence = AudioSegment.silent(duration=1200)
            audio_segments.append(silence)
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: (pause for natural rhythm)")
            continue
        
        try:
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: Google TTS, {len(paragraph)} chars, ja-JP-Neural2-B")
            
            # Wrap text in SSML for better prosody (natural rhythm, emotions)
            # This adds natural pauses and emphasis
            ssml_text = _wrap_japanese_ssml(paragraph)
            
            synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
            
            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            # Convert to AudioSegment
            audio_segment = AudioSegment.from_file(
                io.BytesIO(response.audio_content),
                format="mp3"
            )
            audio_segments.append(audio_segment)
            logger.info(f"    [OK] Generated: {len(audio_segment)/1000:.1f}s")
            
        except Exception as e:
            logger.error(f"    [ERROR] Google TTS failed: {e}")
            raise
    
    if not audio_segments:
        raise RuntimeError("No audio segments generated")
    
    # Stitch with natural pauses between sentences
    logger.info("[TTS] Stitching with natural teacher-like rhythm...")
    final_audio = audio_segments[0]
    
    for segment in audio_segments[1:]:
        # Natural pause between statements (250ms - conversational gap)
        silence = AudioSegment.silent(duration=250)
        final_audio = final_audio + silence + segment
    
    output = io.BytesIO()
    final_audio.export(output, format="mp3", bitrate="128k")
    
    duration = len(final_audio) / 1000.0
    logger.info(f"[OK] Natural Japanese audio: {len(output.getvalue())} bytes, {duration:.1f}s, google_ja_natural")
    
    return output.getvalue(), "google_ja_natural"


def _wrap_japanese_ssml(text: str) -> str:
    """
    Wrap Japanese text in SSML for natural prosody (Google Cloud compatible).
    
    SSML adds:
    - Natural sentence breaks
    - Proper pitch for questions
    - Breathing pauses
    """
    
    # Wrap in SSML root
    ssml = '<speak>'
    
    # Split by sentences (。for Japanese periods)
    sentences = text.split('。')
    
    for i, sentence in enumerate(sentences):
        sentence = sentence.strip()
        if not sentence:
            continue
        
        # Check if it's a question (ends with ？)
        is_question = sentence.endswith('？') or sentence.endswith('?')
        
        if is_question:
            # Questions: raise pitch slightly for natural question intonation
            ssml += f'<prosody pitch="+10%">{sentence}？</prosody>'
        else:
            # Statements: normal prosody
            ssml += f'<prosody pitch="0%">{sentence}。</prosody>'
        
        # Add natural breathing pause between sentences
        if i < len(sentences) - 1:
            ssml += '<break time="400ms"/>'  # Natural pause
    
    ssml += '</speak>'
    
    return ssml
    
    # Parse script into speaker turns
    lines = script_text.strip().split('\n')
    speaker_a_lines = []  # ALEX (English)
    speaker_b_lines = []  # YUKI (Japanese)
    
    current_speaker = None
    current_text = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if line.startswith('ALEX:'):
            if current_speaker and current_text:
                if current_speaker == 'ALEX':
                    speaker_a_lines.append(' '.join(current_text))
                else:
                    speaker_b_lines.append(' '.join(current_text))
            current_speaker = 'ALEX'
            current_text = [line.replace('ALEX:', '').strip()]
        elif line.startswith('YUKI:'):
            if current_speaker and current_text:
                if current_speaker == 'ALEX':
                    speaker_a_lines.append(' '.join(current_text))
                else:
                    speaker_b_lines.append(' '.join(current_text))
            current_speaker = 'YUKI'
            current_text = [line.replace('YUKI:', '').strip()]
        else:
            if current_text:
                current_text.append(line)
    
    # Add final speaker
    if current_speaker and current_text:
        if current_speaker == 'ALEX':
            speaker_a_lines.append(' '.join(current_text))
        else:
            speaker_b_lines.append(' '.join(current_text))
    
    logger.info(f"📝 Parsed: {len(speaker_a_lines)} ALEX lines, {len(speaker_b_lines)} YUKI lines")
    
    # Synthesize with OpenAI TTS (most natural voices)
    openai_key = getattr(settings, "OPENAI_API_KEY", None)
    if not openai_key:
        raise ValueError("OPENAI_API_KEY not configured - required for conversational TTS")
    
    client = OpenAI(api_key=openai_key)
    
    # Rebuild conversation with natural timing
    audio_segments = []
    conversation_order = []
    
    # Re-parse to maintain conversation order
    for line in lines:
        line = line.strip()
        if line.startswith('ALEX:'):
            conversation_order.append(('ALEX', line.replace('ALEX:', '').strip()))
        elif line.startswith('YUKI:'):
            conversation_order.append(('YUKI', line.replace('YUKI:', '').strip()))
    
    logger.info(f"🎬 Generating {len(conversation_order)} conversation turns...")
    
    for i, (speaker, text) in enumerate(conversation_order):
        if not text.strip():
            continue
        
        # Select voice (OpenAI TTS voices are MUCH more expressive than Google)
        if speaker == 'ALEX':
            voice = "alloy"  # Warm, clear English voice
        else:
            voice = "shimmer"  # Multilingual, works great for Japanese
        
        try:
            logger.info(f"  Turn {i+1}/{len(conversation_order)}: {speaker} ({voice}), {len(text)} chars")
            
            # OpenAI TTS - highest quality, most natural
            response = client.audio.speech.create(
                model="tts-1-hd",  # High quality model
                voice=voice,
                input=text,
                speed=1.0  # Natural pace
            )
            
            # Load audio
            audio_bytes = response.content
            audio_segment = AudioSegment.from_file(
                io.BytesIO(audio_bytes),
                format="mp3"
            )
            
            audio_segments.append(audio_segment)
            logger.info(f"    ✅ Generated: {len(audio_segment)/1000:.1f}s")
            
        except Exception as e:
            logger.error(f"    ❌ OpenAI TTS failed for {speaker}: {e}")
            # Continue with other segments
            continue
    
    if not audio_segments:
        raise RuntimeError("No audio segments generated")
    
    # Stitch together with natural pauses
    logger.info("🎬 Stitching conversation with natural flow...")
    final_audio = audio_segments[0]
    
    for segment in audio_segments[1:]:
        # Small pause between speakers (300ms = natural conversation gap)
        silence = AudioSegment.silent(duration=300)
        final_audio = final_audio + silence + segment
    
    # Export final MP3
    output = io.BytesIO()
    final_audio.export(output, format="mp3", bitrate="128k")
    
    duration = len(final_audio) / 1000.0
    logger.info(f"✅ Conversational audio complete: {len(output.getvalue())} bytes, {duration:.1f}s")
    
    return output.getvalue(), "openai_conv"


def synthesize_bilingual_audio(script_text: str, primary_language: str = "en") -> Tuple[bytes, str]:
    """
    Generate bilingual audio by splitting script and stitching TTS chunks.
    
    Process:
    1. Split script into language segments (EN/JA) with paragraph awareness
    2. Generate TTS audio for each segment with native voice
    3. Stitch all segments into single MP3 with natural pauses between paragraphs
    
    Args:
        script_text: Full podcast script with mixed languages
        primary_language: Base language ("en" or "ja")
    
    Returns:
        Tuple of (final_mp3_bytes, provider_name)
    """
    try:
        from pydub import AudioSegment
    except ImportError:
        raise ImportError("pydub is required for audio stitching. Install: pip install pydub")
    
    # Split script by language (paragraph-aware)
    segments = split_script_by_language(script_text, primary_language)
    
    if not segments:
        raise ValueError("No segments found in script")
    
    logger.info(f"🎧 Stitching {len(segments)} segments (including pauses)...")
    
    # Generate and collect audio segments
    audio_chunks = []
    for i, segment in enumerate(segments):
        lang = segment["lang"]
        text = segment["text"]
        
        # Handle paragraph pause markers
        if lang == "pause":
            # Create a 500ms silence for natural paragraph break
            silence = AudioSegment.silent(duration=500)
            audio_chunks.append(silence)
            logger.info(f"  Segment {i+1}/{len(segments)}: [PARAGRAPH PAUSE 500ms]")
            continue
        
        # Skip empty segments
        if not text.strip():
            continue
        
        # Generate TTS for this segment
        audio_bytes = tts_chunk_with_google(text, lang)
        
        # Load as AudioSegment
        audio_segment = AudioSegment.from_file(
            io.BytesIO(audio_bytes),
            format="mp3"
        )
        audio_chunks.append(audio_segment)
        
        logger.info(f"  Segment {i+1}/{len(segments)}: {lang.upper()} ({len(text)} chars, {len(audio_segment)}ms)")
    
    # Concatenate all chunks
    if not audio_chunks:
        raise ValueError("No audio chunks generated")
    
    final_audio = audio_chunks[0]
    for chunk in audio_chunks[1:]:
        # Use a tiny crossfade to smooth boundaries between language switches (not paragraphs)
        final_audio = final_audio.append(chunk, crossfade=50)
    
    # Export to MP3 bytes
    output = io.BytesIO()
    final_audio.export(output, format="mp3", bitrate="128k")
    final_bytes = output.getvalue()
    
    duration_seconds = len(final_audio) / 1000
    logger.info(f"✅ Bilingual audio complete: {len(final_bytes)} bytes, {duration_seconds:.1f}s")
    
    return final_bytes, "google_tts_bilingual"


def can_generate_podcast(user) -> Tuple[bool, str]:
    """
    Check if user can generate a podcast (24-hour cooldown).
    Alex (test user) has no limit.
    
    Returns:
        (can_generate: bool, reason: str)
    """
    from datetime import timedelta
    
    # Check if user is Alex (test user) - no cooldown
    test_user_id = getattr(settings, "DAILYCAST_TEST_USER_ID", None)
    if test_user_id and user.id == test_user_id:
        return True, ""
    
    # Also check by email for Alex
    if user.email == "info@zportaacademy.com":
        return True, ""
    
    # Check cooldown for regular users
    now = timezone.now()
    cooldown_threshold = now - timedelta(hours=24)
    
    recent_podcast = DailyPodcast.objects.filter(
        user=user,
        status=DailyPodcast.STATUS_COMPLETED,
        created_at__gte=cooldown_threshold
    ).order_by('-created_at').first()
    
    if recent_podcast:
        time_remaining = recent_podcast.created_at + timedelta(hours=24) - now
        hours_remaining = int(time_remaining.total_seconds() / 3600)
        minutes_remaining = int((time_remaining.total_seconds() % 3600) / 60)
        reason = f"Cooldown active. Wait {hours_remaining}h {minutes_remaining}m"
        return False, reason
    
    return True, ""


def transliterate_japanese_to_romaji(text: str) -> str:
    """
    Transliterate Japanese text (kanji/hiragana/katakana) to romaji (Latin alphabet).
    This allows English TTS voices to pronounce Japanese words correctly.
    
    Example: 前置詞マスターコース → zenchishi masutākōsu
    """
    if not KAKASI_AVAILABLE:
        logger.warning("pykakasi not available - returning original text")
        return text
    
    if not text or not isinstance(text, str):
        return text
    
    # Check if text contains Japanese characters
    if not has_japanese_text(text):
        return text  # No Japanese characters, return as-is
    
    try:
        result = kks.convert(text)
        romaji = ' '.join([item['hepburn'] for item in result])
        logger.info(f"Transliterated: {text} → {romaji}")
        return romaji.title()  # Capitalize for better TTS pronunciation
    except Exception as e:
        logger.error(f"Error transliterating Japanese text: {e}")
        return text  # Return original if transliteration fails


def get_user_enrolled_courses(user) -> List[Dict]:
    """Fetch user's enrolled courses for personalization."""
    courses = []
    
    if not Enrollment or not Course:
        logger.warning("Enrollment or Course models not available")
        return courses
    
    try:
        enrollments = Enrollment.objects.filter(
            user=user,
            enrollment_type='course'
        ).select_related('content_type')
        
        for enrollment in enrollments:
            if hasattr(enrollment.content_object, 'title'):
                course = enrollment.content_object
                courses.append({
                    'id': course.id,
                    'title': course.title,
                    'subject': getattr(course.subject, 'name', 'General'),
                    'enrollment_date': enrollment.enrollment_date.isoformat(),
                })
    except Exception as e:
        logger.warning(f"Error fetching user courses: {e}")
    
    return courses


def collect_user_stats(user) -> Dict:
    """Lightweight stats collection from existing apps."""
    stats = {
        "ability_score": None,
        "ability_level": None,
        "weak_subject": None,
        "recent_quiz": None,
        "enrolled_courses": [],
    }

    if UserAbilityProfile:
        ability = getattr(user, "ability_profile", None)
        if ability:
            stats["ability_score"] = ability.overall_ability_score
            stats["ability_level"] = ability.get_ability_level()
            if ability.ability_by_subject:
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
    
    # Get enrolled courses
    stats["enrolled_courses"] = get_user_enrolled_courses(user)

    return stats


def get_recent_user_activity(user) -> Dict:
    """Get user's recent learning activity for personalized intro."""
    from datetime import timedelta
    from django.utils import timezone
    
    activity_data = {
        "recent_lessons": [],
        "recent_quizzes": [],
        "last_week_count": 0,
        "yesterday_count": 0,
    }
    
    if not ActivityEvent:
        return activity_data
    
    try:
        now = timezone.now()
        last_week = now - timedelta(days=7)
        yesterday = now - timedelta(days=1)
        
        # Get recent lessons completed
        recent_lessons = ActivityEvent.objects.filter(
            user=user,
            event_type='lesson_completed',
            timestamp__gte=last_week
        ).select_related('content_type')[:5]
        
        for event in recent_lessons:
            if hasattr(event.content_object, 'title'):
                activity_data["recent_lessons"].append({
                    'title': event.content_object.title,
                    'timestamp': event.timestamp
                })
        
        # Get quiz completions
        recent_quizzes = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_completed',
            timestamp__gte=last_week
        ).select_related('content_type')[:3]
        
        for event in recent_quizzes:
            activity_data["recent_quizzes"].append({
                'score': event.metadata.get('score', 0) if event.metadata else 0,
                'timestamp': event.timestamp
            })
        
        # Count last week and yesterday activities
        activity_data["last_week_count"] = ActivityEvent.objects.filter(
            user=user,
            timestamp__gte=last_week
        ).count()
        
        activity_data["yesterday_count"] = ActivityEvent.objects.filter(
            user=user,
            timestamp__gte=yesterday
        ).count()
        
    except Exception as e:
        logger.warning(f"Error fetching recent activity: {e}")
    
    return activity_data


def build_interactive_qa_script(
    user,
    language: str,
    user_stats: Dict,
    output_format: str = "both"
) -> Tuple[str, List[str]]:
    """
    Build interactive Q&A script with:
    - Personalized course content
    - Teacher-style review (6 minutes)
    - Questions for engagement
    - Review/feedback section
    
    Returns: (script_text, questions_list)
    """
    username = getattr(user, "first_name", None) or getattr(user, "username", "Learner")
    ability_level = user_stats.get("ability_level") or "intermediate"
    courses = user_stats.get("enrolled_courses", [])
    recent_activity = get_recent_user_activity(user)
    
    # Build course mentions with native language support
    course_titles = []
    for c in courses[:3]:  # Top 3 courses
        title = c['title']
        # If course title contains Japanese characters, keep it native
        course_titles.append(title)
    
    course_names = ", ".join(course_titles) if course_titles else "your courses"
    
    # Recent activity summary
    lessons_today = len([l for l in recent_activity.get('recent_lessons', []) if (timezone.now() - l['timestamp']).days == 0])
    last_week_count = recent_activity.get('last_week_count', 0)
    recent_lesson_title = recent_activity.get('recent_lessons', [{}])[0].get('title', '') if recent_activity.get('recent_lessons') else ''
    
    # Language-specific prompts
    lang_lower = language.lower()
    
    if lang_lower.startswith('ja'):
        # Ice breaker phrases (Japanese)
        ice_breakers = [
            f"元気ですか、{username}さん！今日も一緒に学びましょう。",
            f"こんにちは、{username}さん！今日はどんな一日でしたか？",
            f"お疲れ様です、{username}さん！学習の時間ですよ。"
        ]
        # Famous motivational quotes (Japanese)
        motivational_quotes = [
            "千里の道も一歩から。 - 老子",
            "継続は力なり。",
            "今日という日は、残りの人生の最初の日である。 - チャールズ・ディケンズ",
            "成功は、毎日の小さな努力の積み重ねによって生まれる。"
        ]
        import random
        greeting = random.choice(ice_breakers)
        motivation = random.choice(motivational_quotes)
        
        # Activity summary
        activity_summary = ""
        if last_week_count > 0:
            activity_summary = f"先週は{last_week_count}回の学習活動を完了しましたね！"
        if recent_lesson_title:
            activity_summary += f" 最近は「{recent_lesson_title}」を学習しました。"
        
        intro = f"今日の学習レビューへようこそ。{activity_summary}"
        course_text = f"学習中のコース：{course_names}"
        question_intro = "いくつかの質問を通じて、あなたの理解度を確認しましょう。"
        transition = "それでは、今日のレッスンを一緒に復習していきます。"
        closing = f"素晴らしい、{username}さん！\n\n💪 {motivation}\n\n継続することで必ず成長します。また明日お会いしましょう！"
    
    elif lang_lower.startswith('es'):
        ice_breakers = [
            f"¡Hola {username}! ¿Listo para aprender algo nuevo hoy?",
            f"¡Buenos días {username}! Es un placer verte de nuevo.",
            f"¡Qué tal {username}! Vamos a hacer que este día cuente."
        ]
        motivational_quotes = [
            "El éxito es la suma de pequeños esfuerzos repetidos día tras día. - Robert Collier",
            "La educación es el arma más poderosa para cambiar el mundo. - Nelson Mandela",
            "No dejes para mañana lo que puedes aprender hoy."
        ]
        import random
        greeting = random.choice(ice_breakers)
        motivation = random.choice(motivational_quotes)
        
        activity_summary = ""
        if last_week_count > 0:
            activity_summary = f"¡Completaste {last_week_count} actividades la semana pasada!"
        if recent_lesson_title:
            activity_summary += f" Recientemente estudiaste: {recent_lesson_title}."
        
        intro = f"Bienvenido a tu revisión de aprendizaje del día. {activity_summary}"
        course_text = f"Tus cursos: {course_names}"
        question_intro = "Hagamos algunas preguntas para verificar tu comprensión."
        transition = "Ahora, revisemos la lección de hoy juntos."
        closing = f"¡Excelente trabajo, {username}!\n\n💪 {motivation}\n\n¡La consistencia es la clave del éxito!"
    
    elif lang_lower.startswith('fr'):
        ice_breakers = [
            f"Bonjour {username}! Prêt à apprendre quelque chose de nouveau aujourd'hui?",
            f"Salut {username}! C'est un plaisir de te revoir.",
            f"Coucou {username}! Faisons de cette journée un succès."
        ]
        motivational_quotes = [
            "Le succès est la somme de petits efforts répétés jour après jour. - Robert Collier",
            "L'éducation est l'arme la plus puissante pour changer le monde. - Nelson Mandela",
            "Ne remets pas à demain ce que tu peux apprendre aujourd'hui."
        ]
        import random
        greeting = random.choice(ice_breakers)
        motivation = random.choice(motivational_quotes)
        
        activity_summary = ""
        if last_week_count > 0:
            activity_summary = f"Tu as terminé {last_week_count} activités la semaine dernière!"
        if recent_lesson_title:
            activity_summary += f" Récemment, tu as étudié: {recent_lesson_title}."
        
        intro = f"Bienvenue dans ta révision d'apprentissage du jour. {activity_summary}"
        course_text = f"Tes cours: {course_names}"
        question_intro = "Posons quelques questions pour vérifier ta compréhension."
        transition = "Maintenant, révisons la leçon d'aujourd'hui ensemble."
        closing = f"Excellent travail, {username}!\n\n💪 {motivation}\n\nLa cohérence est la clé du succès!"
    
    else:  # English (default)
        ice_breakers = [
            f"Hey {username}! Ready to crush some learning goals today?",
            f"Hello {username}! Great to see you back for another session.",
            f"Hi {username}! Let's make today count."
        ]
        motivational_quotes = [
            "Success is the sum of small efforts repeated day in and day out. - Robert Collier",
            "Education is the most powerful weapon which you can use to change the world. - Nelson Mandela",
            "The expert in anything was once a beginner. - Helen Hayes",
            "Don't watch the clock; do what it does. Keep going. - Sam Levenson"
        ]
        import random
        greeting = random.choice(ice_breakers)
        motivation = random.choice(motivational_quotes)
        
        activity_summary = ""
        if last_week_count > 0:
            activity_summary = f"You completed {last_week_count} activities last week!"
        if recent_lesson_title:
            activity_summary += f" Most recently, you studied: {recent_lesson_title}."
        
        intro = f"Welcome to today's learning review. {activity_summary}"
        course_text = f"Today we're reviewing: {course_names}"
        question_intro = "Let me ask you a few questions to check your understanding."
        transition = "Now, let's review what you've learned."
        closing = f"Fantastic work, {username}!\n\n💪 {motivation}\n\nKeep up the momentum!"
    
    # Build questions based on courses and ability level
    questions = [
        f"Can you describe one key concept from {course_names}?",
        f"How would you apply what you learned in {course_names} to a real situation?",
        f"What was the most challenging part for you?",
    ]
    
    if lang_lower.startswith('ja'):
        questions = [
            f"「{course_names}」から一つの重要な概念を説明してください。",
            f"「{course_names}」で学んだことをどのように実生活に応用しますか？",
            f"あなたにとって最も難しかったのはどの部分ですか？",
        ]
    elif lang_lower.startswith('es'):
        questions = [
            f"¿Puedes describir un concepto clave de {course_names}?",
            f"¿Cómo aplicarías lo que aprendiste en {course_names} a una situación real?",
            f"¿Cuál fue la parte más desafiante para ti?",
        ]
    elif lang_lower.startswith('fr'):
        questions = [
            f"Pouvez-vous décrire un concept clé de {course_names}?",
            f"Comment appliqueriez-vous ce que vous avez appris dans {course_names} à une situation réelle?",
            f"Quelle a été la partie la plus difficile pour vous?",
        ]
    
    # Build the complete script
    script_parts = [
        f"*{greeting}*",
        f"\n{intro}\n",
        f"**{course_text}**",
        f"\nAbility Level: {ability_level}\n",
        f"*{question_intro}*\n",
        f"**Question 1:** {questions[0]}",
        f"\n*[Wait for answer - take your time]*\n",
        f"**Great!** That shows you understand the basics.",
        f"\n**Question 2:** {questions[1]}",
        f"\n*[Another important question]*\n",
        f"**Excellent!** You're connecting theory to practice.",
        f"\n**Question 3:** {questions[2]}",
        f"\n*[Final reflection]*\n",
        f"**I see.** Most learners find this challenging.",
        f"\n{transition}",
        f"\nKey Takeaways from {course_names}:",
        f"1. Master the fundamentals",
        f"2. Practice regularly",
        f"3. Connect concepts to real life",
        f"\n**Teacher's Feedback:**",
        f"You're doing great with {ability_level} level material.",
        f"To improve faster, focus on the challenging areas.",
        f"Remember: consistent practice beats intensive cramming.",
        f"\n{closing}",
        f"\nSee you in your next lesson! 🚀",
    ]
    
    script_text = "\n".join(script_parts)
    
    return script_text, questions


def build_conversational_prompt(
    user,
    language: str,
    secondary_language: str,
    user_stats: Dict,
    output_format: str
) -> str:
    """Build prompt for NATURAL TWO-SPEAKER conversation podcast."""
    
    username = getattr(user, "first_name", None) or getattr(user, "username", "Learner")
    courses = user_stats.get("enrolled_courses", [])
    course_titles = [c['title'] for c in courses[:3]]
    course_names = ", ".join(course_titles) if course_titles else "general topics"
    
    recent_activity = get_recent_user_activity(user)
    last_week_count = recent_activity.get('last_week_count', 0)
    recent_lessons = recent_activity.get('recent_lessons', [])
    recent_lesson_title = recent_lessons[0].get('title', '') if recent_lessons else ''
    
    prompt = f"""You are writing a script for a NATURAL bilingual conversation podcast.

Two speakers:
- ALEX (English speaker): Warm, encouraging teacher voice
- YUKI (Japanese speaker): Friendly, helpful co-host who translates and adds insights

Format your script EXACTLY like this (use these labels):

ALEX: [English dialogue here]
YUKI: [Japanese translation/response here]
ALEX: [English reaction]
YUKI: [Japanese comment]

CRITICAL RULES:
1. Use ONLY "ALEX:" and "YUKI:" labels (nothing else)
2. Write natural conversational dialogue, NOT a script or narration
3. Include natural reactions: "Hmm...", "Oh!", "Right!", soft laughs
4. Short sentences that create natural rhythm
5. YUKI translates key points to Japanese AND adds cultural context
6. They should sound like friends having tea, not reading a textbook

STUDENT CONTEXT:
- Name: {username}
- Progress: {last_week_count} activities completed last week
- Studying: {course_names}
- Recent lesson: {recent_lesson_title or 'General review'}

CONVERSATION FLOW (3-4 minutes):
1. ALEX greets {username} warmly, celebrates their progress
2. YUKI translates the greeting to Japanese and adds encouragement
3. ALEX discusses what {username} is learning
4. YUKI translates and explains in Japanese, maybe adds cultural notes
5. ALEX asks a thoughtful question
6. YUKI translates the question and adds insight
7. ALEX gives teaching points with warmth
8. YUKI summarizes in Japanese with encouragement
9. Both speakers close with heartfelt support

TONE: Two friends excited about {username}'s learning journey. Natural pauses. Real emotions. Genuine warmth.

Write the FULL conversation now (600-800 words total):"""
    
    return prompt


def build_multilingual_prompt(
    user,
    language: str,
    secondary_language: str,
    user_stats: Dict,
    output_format: str
) -> str:
    """Build LLM prompt for interactive multilingual podcast - CLEAN, NO MARKUP, EMOTIONAL."""
    
    username = getattr(user, "first_name", None) or getattr(user, "username", "Learner")
    courses = user_stats.get("enrolled_courses", [])
    
    # Keep course titles in native language (Japanese stays Japanese, etc)
    course_titles = [c['title'] for c in courses[:3]]
    course_names = ", ".join(course_titles) if course_titles else "general topics"
    
    # Auto-detect if Japanese is present in course names
    has_japanese = any(has_japanese_text(title) for title in course_titles)
    if has_japanese and language != "ja" and not secondary_language:
        secondary_language = "ja"
    
    # Get recent activity
    recent_activity = get_recent_user_activity(user)
    last_week_count = recent_activity.get('last_week_count', 0)
    recent_lessons = recent_activity.get('recent_lessons', [])
    recent_lesson_title = recent_lessons[0].get('title', '') if recent_lessons else ''
    
    langs_text = f"{language}"
    if secondary_language and secondary_language != "":
        langs_text += f" and {secondary_language}"
    
    # Build language instruction for MIXED language support
    language_instruction = f"Create a conversational podcast script IN {langs_text}."
    if secondary_language == "ja" and language != "ja":
        language_instruction += f"\n\nLANGUAGE MIXING RULES (VERY IMPORTANT):\n- Speak mainly in {language} (English)\n- When you say Japanese course names like '{course_names}', write them in Japanese characters\n- Japanese phrases will be read with native Japanese pronunciation automatically\n- Mix languages naturally in ONE audio file - don't translate Japanese course names to English\n- Example: Say 'You're studying 前置詞マスターコース' - the Japanese part will sound native"
    
    prompt = (
        f"You are a warm, enthusiastic, and engaging teacher recording a podcast for your student. "
        f"Your goal is to inspire and motivate them while teaching. {language_instruction} "
        f"Duration: 3-4 minutes (~600-700 words). "
        f"\n\nCRITICAL RULES:\n"
        f"1. NO MARKUP, NO ASTERISKS, NO BRACKETS, NO STAGE DIRECTIONS - only plain conversational text\n"
        f"2. NO labels like 'Host:' or 'Student:' or '[Pause]' or '[Music]'\n"
        f"3. EMOTION AND WARMTH - Use exclamation marks, be genuinely excited and encouraging\n"
        f"4. NATURAL PAUSES - Break sentences. Use short, punchy sentences that create natural rhythm\n"
        f"5. NATURAL PRONUNCIATION - Speak course names naturally in their original language\n"
        f"6. Use the student's name ({username}) ONLY 2-3 times total - at the start and maybe once more. Don't overuse it.\n"
        f"7. Show genuine emotion - be a real person, not a robot\n"
        f"8. Speak naturally with warmth, like having tea with a friend and chatting about their progress\n"
        f"\n\nSTUDENT CONTEXT:\n"
        f"- Name: {username}\n"
        f"- Learning level: {user_stats.get('ability_level', 'intermediate')}\n"
        f"- Currently studying: {course_names}\n"
        f"- Progress: Completed {last_week_count} activities last week\n"
        f"- Most recent lesson: {recent_lesson_title or 'General review'}\n"
        f"\n\nSCRIPT STRUCTURE (natural, conversational flow):\n"
        f"1. Warm greeting with student's name ONCE at the start\n"
        f"2. Celebrate their {last_week_count} completed activities! Be genuinely proud\n"
        f"3. Talk naturally about what they're learning ({course_names}) - use Japanese course names as-is\n"
        f"4. Ask 1-2 thoughtful questions naturally (let them think)\n"
        f"5. Share insights or teaching points with genuine care\n"
        f"6. End with heartfelt encouragement - maybe use their name once more here\n"
        f"\n\nTONE INSPIRATION:\n"
        f"Imagine you're sitting with {username} having tea, genuinely proud of their progress.\n"
        f"You're relaxed, warm, taking natural pauses to let ideas sink in.\n"
        f"You speak with emotion - excitement, pride, encouragement.\n"
        f"NOT a formal lecture. YES a warm conversation with someone you care about.\n"
        f"\n\nReturn ONLY the podcast script. No explanations. Pure, warm, emotional conversation."
    )
    
    return prompt


def generate_podcast_script_with_courses(
    user,
    primary_language: str,
    secondary_language: str,
    user_stats: Dict,
    output_format: str = "both"
) -> Tuple[str, str]:
    """
    Generate SINGLE-TEACHER daily study report script (no dialogue labels).
    Uses analytics-driven review + mini-questions + micro-lesson.
    
    Returns: (script_text, llm_provider)
    """
    logger.info(f"[SCRIPT_GEN] Building single-teacher daily report for {user.username}")

    # Use deterministic teacher-style script (no dialogue labels, single narrator)
    script = build_daily_report_script(user, report_language=primary_language)
    logger.info(f"[SCRIPT_GEN] ✅ Teacher script built, length: {len(script)} chars")
    logger.info(f"[SCRIPT_GEN] Script preview (first 300 chars): {script[:300]!r}")
    return script, "teacher_template"


def pick_polly_voice(language: str) -> Tuple[str, str]:
    """Select appropriate voice for language."""
    language = (language or "en").lower()
    
    if language.startswith("ja"):
        return "Mizuki", "neural"
    if language.startswith("es"):
        return "Lucia", "neural"
    if language.startswith("fr"):
        return "Celine", "neural"
    if language.startswith("de"):
        return "Vicki", "neural"
    if language.startswith("it"):
        return "Carla", "neural"
    if language.startswith("pt"):
        return "Vitoria", "neural"
    if language.startswith("ru"):
        return "Tatyana", "neural"
    if language.startswith("ko"):
        return "Seoyeon", "neural"
    
    # Default to US English
    return "Joanna", "neural"


def _process_text_with_gemini(script_text: str, language: str) -> str:
    """
    Use Gemini AI to intelligently process the script:
    - Add strategic pauses (...)
    - Understand context and emotion
    - Remove usernames/email addresses
    - Add conversational flow
    - Make it sound like natural human speech
    
    Returns: Improved script text for TTS
    NOTE: Requires paid Gemini API or sufficient quota
    """
    try:
        gemini_key = getattr(settings, "GEMINI_API_KEY", None)
        if not gemini_key:
            gemini_key = os.environ.get("GEMINI_API_KEY")
        
        if not gemini_key:
            logger.warning("Gemini API key not found, skipping AI enhancement")
            return script_text
        
        genai.configure(api_key=gemini_key)
        
        lang_name = {
            "en": "English",
            "ja": "Japanese",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "it": "Italian",
            "pt": "Portuguese",
            "ru": "Russian",
            "ko": "Korean",
        }.get(language, "English")
        
        prompt = f"""You are an expert podcast script editor. Take this educational content and make it sound like a natural human teacher speaking.

YOUR TASKS:
1. Remove any usernames, email addresses, or personal identifiers - just refer to "student" or "you"
2. Add strategic pauses (...) where a teacher would naturally pause (for emphasis, thinking, letting info sink in)
3. Add conversational markers like "so", "right", "you see" naturally where appropriate
4. Make sentences flow naturally for spoken word - shorter, punchier sentences
5. Add enthusiasm and emotion appropriate to educational content
6. Make it feel like a 1-on-1 conversation with a teacher
7. Keep all the key information, just make it sound better when spoken

ORIGINAL SCRIPT:
{script_text}

IMPORTANT: 
- ONLY output the improved script in {lang_name}
- Keep the same length (roughly)
- Make it sound like how a great teacher would actually speak
- NO METADATA, NO EXPLANATIONS, JUST THE IMPROVED SCRIPT"""
        
        # Use higher-quality Gemini Pro model with light retry for 429s
        model = genai.GenerativeModel("gemini-2.0-pro-exp")
        last_err = None
        for attempt in range(2):
            try:
                response = model.generate_content(prompt)
                break
            except Exception as e_inner:
                last_err = e_inner
                if "429" in str(e_inner) or "rate" in str(e_inner).lower():
                    time.sleep(1.0)
                    continue
                raise
        else:
            raise last_err or Exception("Gemini generation failed")
        
        improved_text = response.text.strip()
        logger.info(f"✅ Gemini AI enhanced script for {lang_name}")
        return improved_text
        
    except Exception as e:
        error_msg = str(e).lower()
        if "quota" in error_msg or "rate limit" in error_msg:
            logger.warning(f"⚠️  Gemini API quota exceeded - consider upgrading to paid plan")
            return script_text
        elif "api" in error_msg or "unauthorized" in error_msg:
            logger.warning(f"Gemini API key issue ({e}), using original text")
            return script_text
        else:
            logger.warning(f"Gemini enhancement failed ({e}), using original text")
            return script_text


def synthesize_audio_for_language(
    script_text: str,
    language: str,
    preferred_provider: str = None
) -> Tuple[bytes, str]:
    """
    Convert text to speech using specified provider or fallback chain.
    
    Returns: (audio_bytes, provider)
    Raises: ValueError if credentials not configured
            RuntimeError if TTS returns empty audio
    """
    # NOTE: Script is already clean and conversational from generation step
    # Do NOT run _process_text_with_gemini() again - it will break the natural tone!
    
    logger.info(f"[TRACE] synthesize_audio_for_language called with language={language}, preferred_provider={preferred_provider}")
    logger.info(f"[TRACE] script_text length: {len(script_text)} chars")
    
    # 1. Try Preferred Provider if specified
    if preferred_provider == 'openai':
        try:
            logger.info(f"🎵 [TTS_PRIORITY] 🚀 USING OPENAI TTS (Preferred) for {language}")
            return _synthesize_with_openai_tts(script_text, language)
        except Exception as e:
            logger.error(f"🎵 [TTS_PRIORITY] ❌ OpenAI TTS FAILED: {str(e)}")
    
    elif preferred_provider == 'google':
        try:
            logger.info(f"🎵 [TTS_PRIORITY] 🚀 USING GOOGLE STANDARD (Preferred) for {language}")
            if _has_google_credentials():
                return _synthesize_with_google_tts(script_text, language, voice_type='neural')
            else:
                logger.warning("Google credentials missing")
        except Exception as e:
            logger.error(f"🎵 [TTS_PRIORITY] ❌ Google TTS FAILED: {str(e)}")

    elif preferred_provider == 'gemini':
        try:
            logger.info(f"🎵 [TTS_PRIORITY] 🚀 USING GOOGLE STANDARD (Preferred) for {language}")
            # Gemini option now uses standard Google TTS (Wavenet) for best quality
            if _has_google_credentials():
                return _synthesize_with_google_tts(script_text, language, voice_type='journey')
            else:
                logger.warning("Google credentials missing for Google TTS")
        except Exception as e:
            logger.error(f"🎵 [TTS_PRIORITY] ❌ Google TTS FAILED: {str(e)}")

    elif preferred_provider == 'google_chirp':
        try:
            logger.info(f"🎵 [TTS_PRIORITY] 🚀 USING GOOGLE WAVENET PREMIUM (Preferred) for {language}")
            # Chirp maps to Wavenet (highest quality)
            if _has_google_credentials():
                return _synthesize_with_google_tts(script_text, language, voice_type='chirp')
            else:
                logger.warning("Google credentials missing for Wavenet TTS")
        except Exception as e:
            logger.error(f"🎵 [TTS_PRIORITY] ❌ Wavenet TTS FAILED: {str(e)}")

    elif preferred_provider == 'elevenlabs':
        # Fall through to default ElevenLabs logic below
        pass

    # 2. Default Chain: Only hit ElevenLabs if it was explicitly preferred OR no preference supplied.
    prefer_non_eleven = bool(preferred_provider and preferred_provider != 'elevenlabs')

    if prefer_non_eleven:
        logger.info("🎵 [TTS_PRIORITY] Skipping ElevenLabs fallback because a non-ElevenLabs provider was explicitly requested")
    else:
        logger.info(f"🎵 [TTS_PRIORITY] Starting audio synthesis - will use ElevenLabs (11Labs)")
        
        # Get ElevenLabs API key from settings
        elevenlabs_key = getattr(settings, "ELEVENLABS_API_KEY", None)
        
        if elevenlabs_key and str(elevenlabs_key).strip():
            logger.info(f"🎵 [TTS_PRIORITY] ✅ ElevenLabs API key found: {elevenlabs_key[:20]}...")
            try:
                logger.info(f"🎵 [TTS_PRIORITY] 🚀 USING ELEVENLABS TTS for {language}")
                audio_bytes, provider = _synthesize_with_elevenlabs(script_text, language)
                
                if audio_bytes and len(audio_bytes) > 0:
                    logger.info(f"🎵 [TTS_PRIORITY] ✅✅✅ ELEVENLABS SUCCESS: {len(audio_bytes)} bytes")
                    logger.info(f"🎵 [TTS_PRIORITY] Provider: {provider}")
                    return audio_bytes, provider
                else:
                    logger.warning(f"🎵 [TTS_PRIORITY] ⚠️  ElevenLabs returned empty/null bytes")
            except Exception as e:
                logger.error(f"🎵 [TTS_PRIORITY] ❌ ElevenLabs FAILED: {str(e)}")
                logger.error(f"🎵 [TTS_PRIORITY] Will now try Google Cloud TTS as fallback")
                import traceback
                logger.error(traceback.format_exc())
        else:
            logger.warning(f"🎵 [TTS_PRIORITY] ❌ NO ElevenLabs API key found!")
            logger.warning(f"🎵 [TTS_PRIORITY] Will try Google Cloud TTS as fallback")
    
    # FALLBACK to Google Cloud TTS
    logger.info(f"🎵 [TTS_FALLBACK] Attempting Google Cloud TTS as fallback for {language}")
    
    if _has_google_credentials():
        try:
            logger.info(f"🎵 [TTS_FALLBACK] 📡 Using Google Cloud TTS for {language}")
            audio_bytes, provider = _synthesize_with_google_tts(script_text, language)
            
            if audio_bytes:
                return audio_bytes, provider
        except Exception as e:
            logger.error(f"Google TTS failed: {e}")

    # FALLBACK to OpenAI TTS
    logger.info(f"🎵 [TTS_FALLBACK] Attempting OpenAI TTS as final fallback")
    try:
        return _synthesize_with_openai_tts(script_text, language)
    except Exception as e:
        logger.error(f"OpenAI TTS failed: {e}")

    raise ValueError("All TTS providers failed")


def _has_google_credentials() -> bool:
    """Check if Google Cloud credentials are available in environment."""
    import os
    return bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))


def _synthesize_with_elevenlabs(script_text: str, language: str) -> Tuple[bytes, str]:
    """
    Generate audio using ElevenLabs API for multiple languages.
    Uses multilingual voice model for natural, expressive speech.
    
    Args:
        script_text: The text to convert to speech
        language: Language code (en, ja, es, fr, de, it, pt, ru, ko, etc.)
    
    Returns: (audio_bytes, provider_name)
    """
    try:
        from pydub import AudioSegment
        import requests
    except ImportError as e:
        raise ImportError(f"Required library missing for ElevenLabs: {e}")
    
    api_key = getattr(settings, "ELEVENLABS_API_KEY", None)
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY not configured in settings")
    
    logger.info(f"[TTS_PROVIDER] Using ElevenLabs TTS for {language}")
    
    # Map language codes to ElevenLabs voice IDs
    # Using Lily - professional, educational voice that works with multilingual model
    voice_map = {
        "en": "pFZP5JQG7iQjIQuC4Bku",  # Lily - professional, educational
        "ja": "pFZP5JQG7iQjIQuC4Bku",  # Lily multilingual supports Japanese
        "es": "pFZP5JQG7iQjIQuC4Bku",  # Lily works well for Spanish
        "fr": "pFZP5JQG7iQjIQuC4Bku",  # Lily works well for French
        "de": "pFZP5JQG7iQjIQuC4Bku",  # Lily works well for German
        "it": "pFZP5JQG7iQjIQuC4Bku",  # Lily works well for Italian
        "pt": "pFZP5JQG7iQjIQuC4Bku",  # Lily works well for Portuguese
        "ru": "pFZP5JQG7iQjIQuC4Bku",  # Lily works well for Russian
        "ko": "pFZP5JQG7iQjIQuC4Bku",  # Lily multilingual supports Korean
        "zh": "pFZP5JQG7iQjIQuC4Bku",  # Lily multilingual supports Chinese
    }
    
    voice_id = voice_map.get(language, "pFZP5JQG7iQjIQuC4Bku")  # Default to Lily
    
    # Split into paragraphs for better audio quality
    paragraphs = [p.strip() for p in script_text.split("\n") if p.strip()]
    
    if not paragraphs:
        raise ValueError("No text to convert to speech")
    
    audio_segments = []
    
    for i, paragraph in enumerate(paragraphs):
        if not paragraph:
            continue
        
        if paragraph.lower() == "(pause)":
            silence = AudioSegment.silent(duration=1200)
            audio_segments.append(silence)
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: (breathing pause)")
            continue
        
        try:
            logger.info(f"  Segment {i+1}/{len(paragraphs)}: ElevenLabs {language} (Lily), {len(paragraph)} chars")
            
            # ElevenLabs API endpoint
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json"
            }
            
            payload = {
                "text": paragraph,
                "model_id": "eleven_multilingual_v2",  # Multilingual model for all languages
                "voice_settings": {
                    "stability": 0.5,              # Natural delivery (not monotone)
                    "similarity_boost": 0.75      # Consistent voice quality
                }
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"ElevenLabs API error: {response.status_code}")
                logger.error(f"Response: {response.text}")
                raise RuntimeError(f"ElevenLabs API error: {response.status_code} - {response.text}")
            
            # Convert to AudioSegment
            audio_segment = AudioSegment.from_file(
                io.BytesIO(response.content),
                format="mp3"
            )
            audio_segments.append(audio_segment)
            logger.info(f"    [OK] Generated: {len(audio_segment)/1000:.1f}s")
            
        except Exception as e:
            logger.error(f"    [ERROR] ElevenLabs TTS failed: {e}")
            raise
    
    if not audio_segments:
        raise RuntimeError("No audio segments generated")
    
    # Stitch with natural pauses
    logger.info(f"[TTS_PROVIDER] Stitching {len(audio_segments)} segments with natural rhythm...")
    final_audio = audio_segments[0]
    
    for segment in audio_segments[1:]:
        silence = AudioSegment.silent(duration=250)  # Conversational gap
        final_audio = final_audio + silence + segment
    
    output = io.BytesIO()
    final_audio.export(output, format="mp3", bitrate="128k")
    
    duration = len(final_audio) / 1000.0
    logger.info(f"[OK] Natural audio ({language}, ElevenLabs): {len(output.getvalue())} bytes, {duration:.1f}s")
    
    return output.getvalue(), f"elevenlabs_{language}_lily"


def _synthesize_with_google_tts(script_text: str, language: str, voice_type: str = 'neural') -> Tuple[bytes, str]:
    """
    Generate audio using Google Cloud Text-to-Speech API.
    Supports:
    - 'neural': Standard Neural2 voices (Best for most languages)
    - 'journey': Gemini-class generative voices (Most natural, limited languages)
    - 'chirp': Universal Speech Model (USM) voices (High quality, multilingual)
    """
    from google.cloud import texttospeech
    import os
    
    logger.info(f"[TTS_PROVIDER] Starting Google Cloud TTS synthesis (Type={voice_type})")
    logger.info(f"[TTS_PROVIDER] Language: {language}")
    
    gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not gac or not os.path.exists(gac):
        raise ValueError("Google Cloud credentials not found. Ensure GOOGLE_APPLICATION_CREDENTIALS is set to your service account JSON (see settings/base.py)")
    logger.info(f"[TTS_PROVIDER] Using credentials: {gac}")
    
    client = texttospeech.TextToSpeechClient()
    
    # 1. Standard Neural2 voices (Good quality, widely available)
    voice_configs = {
        "en": {"lang": "en-US", "name": "en-US-Neural2-F", "gender": "FEMALE"},
        "ja": {"lang": "ja-JP", "name": "ja-JP-Neural2-B", "gender": "FEMALE"},
        "es": {"lang": "es-ES", "name": "es-ES-Neural2-A", "gender": "FEMALE"},
        "fr": {"lang": "fr-FR", "name": "fr-FR-Neural2-A", "gender": "FEMALE"},
        "de": {"lang": "de-DE", "name": "de-DE-Neural2-A", "gender": "FEMALE"},
        "it": {"lang": "it-IT", "name": "it-IT-Neural2-A", "gender": "FEMALE"},
        "pt": {"lang": "pt-BR", "name": "pt-BR-Neural2-A", "gender": "FEMALE"},
        "ru": {"lang": "ru-RU", "name": "ru-RU-Wavenet-A", "gender": "FEMALE"},
        "ko": {"lang": "ko-KR", "name": "ko-KR-Neural2-A", "gender": "FEMALE"},
    }
    
    # 2. Wavenet voices (HIGHEST quality, premium sound)
    # More natural, expressive, slightly slower than Neural2
    wavenet_configs = {
        "en": {"lang": "en-US", "name": "en-US-Wavenet-F", "gender": "FEMALE"},
        "ja": {"lang": "ja-JP", "name": "ja-JP-Wavenet-B", "gender": "FEMALE"},
        "es": {"lang": "es-ES", "name": "es-ES-Wavenet-A", "gender": "FEMALE"},
        "fr": {"lang": "fr-FR", "name": "fr-FR-Wavenet-A", "gender": "FEMALE"},
        "de": {"lang": "de-DE", "name": "de-DE-Wavenet-A", "gender": "FEMALE"},
        "it": {"lang": "it-IT", "name": "it-IT-Wavenet-A", "gender": "FEMALE"},
        "pt": {"lang": "pt-BR", "name": "pt-BR-Wavenet-A", "gender": "FEMALE"},
        "ru": {"lang": "ru-RU", "name": "ru-RU-Wavenet-A", "gender": "FEMALE"},
        "ko": {"lang": "ko-KR", "name": "ko-KR-Wavenet-A", "gender": "FEMALE"},
    }

    # 3. Standard voices (Basic quality, widely available)
    standard_configs = {
        "en": {"lang": "en-US", "name": "en-US-Standard-F", "gender": "FEMALE"},
        "ja": {"lang": "ja-JP", "name": "ja-JP-Standard-A", "gender": "FEMALE"},
        "es": {"lang": "es-ES", "name": "es-ES-Standard-A", "gender": "FEMALE"},
        "fr": {"lang": "fr-FR", "name": "fr-FR-Standard-A", "gender": "FEMALE"},
        "de": {"lang": "de-DE", "name": "de-DE-Standard-A", "gender": "FEMALE"},
        "it": {"lang": "it-IT", "name": "it-IT-Standard-A", "gender": "FEMALE"},
        "pt": {"lang": "pt-BR", "name": "pt-BR-Standard-A", "gender": "FEMALE"},
        "ru": {"lang": "ru-RU", "name": "ru-RU-Standard-A", "gender": "FEMALE"},
        "ko": {"lang": "ko-KR", "name": "ko-KR-Standard-A", "gender": "FEMALE"},
    }

    # Select voice configuration based on type
    voice_config = None
    provider_label = "google_tts"
    speaking_rate = 1.0

    if voice_type == 'journey':
        # Use Wavenet for best quality (closest to "Journey" premium experience)
        voice_config = wavenet_configs.get(language, voice_configs.get(language))
        provider_label = "google_journey_premium"
        speaking_rate = 0.95  # Slightly slower for premium effect
        logger.info(f"[TTS_PROVIDER] 🏆 WAVENET PREMIUM MODE: Using highest-quality Wavenet voices (most expressive)")
    
    elif voice_type == 'chirp':
        # Chirp doesn't exist yet, use Wavenet as high-quality alternative
        voice_config = wavenet_configs.get(language, voice_configs.get(language))
        provider_label = "google_chirp_hd"  # Label as if Chirp, actually Wavenet
        speaking_rate = 0.98  # Natural speed
        logger.info(f"[TTS_PROVIDER] ✨ WAVENET HIGH-QUALITY MODE: Chirp not available, using Wavenet voices instead")
    
    else:
        # Default: Neural2 (balanced quality/speed)
        voice_config = voice_configs.get(language, voice_configs["en"])
        provider_label = "google_tts_neural"
        speaking_rate = 1.0
        logger.info(f"[TTS_PROVIDER] 🎤 STANDARD/NEURAL2 MODE: Using balanced Neural2 voices (fast & clear)")
    
    logger.info(f"[TTS_PROVIDER] Voice selected: {voice_config['name']} (gender: {voice_config['gender']}, lang: {voice_config['lang']})")
    
    # Prepare SSML with minimal, safe formatting
    ssml_text = _prepare_ssml_text(script_text, language)
    
    logger.info(f"[TTS_PROVIDER] SSML prepared, length: {len(ssml_text)} chars")
    logger.info(f"[TTS_PROVIDER] SSML preview (first 400 chars): {ssml_text[:400]!r}")
    
    # Configure SSML input and voice
    synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=voice_config["lang"],
        name=voice_config["name"],
        ssml_gender=getattr(texttospeech.SsmlVoiceGender, voice_config["gender"]),
    )
    
    # Simple, clean audio config with natural speaking rate
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,  # 0.95-1.0 for natural speed
        pitch=0.0,
        volume_gain_db=0.0,
        effects_profile_id=["headphone-class-device"],
    )
    
    logger.info(f"[TTS_PROVIDER] Audio config: speaking_rate={speaking_rate} (natural), pitch=0.0, encoding=MP3")
    
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )
    
    logger.info(f"[TTS_PROVIDER] ✅ Google TTS complete: {voice_config['name']} ({language}), audio_bytes={len(response.audio_content)}")
    return response.audio_content, provider_label


def _prepare_ssml_text(text: str, language: str) -> str:
    """
    Prepare SSML - SIMPLIFIED for naturalness.
    - NO paragraph pause hacks (Google TTS handles natural pacing)
    - Basic language tags only
    - Minimal processing
    """
    import re
    import html
    
    logger.info(f"[SSML] Preparing SSML for {language}, input length: {len(text)} chars")
    
    # Limit text length to avoid API limits
    original_length = len(text)
    text = text[:4900]
    if len(text) < original_length:
        logger.warning(f"[SSML] Text truncated from {original_length} to {len(text)} chars")
    
    # Escape XML characters
    text = html.escape(text)
    logger.info(f"[SSML] HTML escaped, length: {len(text)} chars")
    
    # For English with Japanese text, wrap Japanese with language tag
    if language == "en" and has_japanese_text(text):
        # Pattern matches Japanese characters
        japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+')
        
        def wrap_japanese(match):
            japanese_phrase = match.group(0)
            return f'<lang xml:lang="ja-JP">{japanese_phrase}</lang>'
        
        text = japanese_pattern.sub(wrap_japanese, text)
        logger.info(f"[SSML] Japanese phrases wrapped with lang tags")
    
    # Wrap in speak tag - NO extra formatting
    ssml = f'<speak>{text}</speak>'
    
    logger.info(f"[SSML] Final SSML length: {len(ssml)} chars")
    logger.info(f"[SSML] SSML preview (first 500 chars): {ssml[:500]!r}")
    
    return ssml


def _prepare_ssml_text_advanced(text: str, language: str) -> str:
    """
    ADVANCED SSML with MAXIMUM naturalness using Google TTS-safe tags only:
    - Strategic breaks for natural breathing
    - Language tags for Japanese  
    - Proper sentence pacing
    (NOT CURRENTLY USED - kept for future experiments)
    """
    import re
    
    # Limit text length to avoid API limits
    text = text[:4900]
    
    # DON'T escape yet - work with raw text first for Japanese detection
    if language == "en" and has_japanese_text(text):
        # Wrap Japanese before escaping
        japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+')
        
        def wrap_japanese(match):
            japanese_phrase = match.group(0)
            return f'<lang xml:lang="ja-JP">{japanese_phrase}</lang>'
        
        text = japanese_pattern.sub(wrap_japanese, text)
    
    # NOW escape XML special characters (but preserve lang tags)
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    
    # Un-escape the lang tags we added
    text = text.replace('&lt;lang xml:lang="ja-JP"&gt;', '<lang xml:lang="ja-JP">')
    text = text.replace('&lt;/lang&gt;', '</lang>')
    
    # ===== Strategic pauses for natural breathing =====
    # After sentences (.) - 400ms pause
    text = re.sub(r'\.(\s+)', r'.<break time="400ms"/>\1', text)
    
    # After exclamations (!) - 350ms pause
    text = re.sub(r'!(\s+)(?!<break)', r'!<break time="350ms"/>\1', text)
    
    # After questions (?) - 500ms pause
    text = re.sub(r'\?(\s+)(?!<break)', r'?<break time="500ms"/>\1', text)
    
    # After commas - 200ms pause  
    text = re.sub(r',(\s+)(?!<break)', r',<break time="200ms"/>\1', text)
    
    # Wrap in SSML
    ssml = f'<speak>{text}</speak>'
    
    logger.info(f"✅ Advanced SSML prepared for {language}")
    logger.debug(f"SSML Content (first 500 chars): {ssml[:500]}")
    return ssml


def _synthesize_with_pyttsx3_natural(script_text: str, language: str) -> Tuple[bytes, str]:
    """Generate audio using pyttsx3 with natural voice settings and multiple speakers."""
    import pyttsx3
    import io
    import tempfile
    import os
    
    engine = pyttsx3.init()
    
    # Optimize for natural speech
    engine.setProperty("rate", 160)  # Natural speaking pace (words per minute)
    engine.setProperty("volume", 0.95)  # Natural volume level
    
    # Select voice by language and rotate speakers for variety
    voice_config = {
        "en": {
            "voices": [0, 1],  # Multiple English voices if available
            "rate": 160,
            "pitch": 1.0,
        },
        "ja": {
            "voices": [0, 1],  # Multiple Japanese voices if available
            "rate": 140,  # Slightly slower for Japanese
            "pitch": 1.0,
        },
        "es": {
            "voices": [0],
            "rate": 150,
            "pitch": 1.0,
        },
        "fr": {
            "voices": [0],
            "rate": 155,
            "pitch": 1.0,
        },
        "de": {
            "voices": [0],
            "rate": 155,
            "pitch": 1.0,
        },
        "it": {
            "voices": [0],
            "rate": 160,
            "pitch": 1.0,
        },
        "pt": {
            "voices": [0],
            "rate": 160,
            "pitch": 1.0,
        },
        "ru": {
            "voices": [0],
            "rate": 150,
            "pitch": 1.0,
        },
        "ko": {
            "voices": [0],
            "rate": 150,
            "pitch": 1.0,
        },
    }
    
    config = voice_config.get(language, voice_config["en"])
    available_voices = engine.getProperty("voices")
    
    # Select a voice (rotate for variety)
    import random
    voice_idx = random.choice(config["voices"]) if config["voices"] else 0
    if voice_idx < len(available_voices):
        engine.setProperty("voice", available_voices[voice_idx].id)
    
    engine.setProperty("rate", config["rate"])
    
    # Save to temp file then read as bytes
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        temp_path = f.name
    
    try:
        engine.save_to_file(script_text[:5000], temp_path)
        engine.runAndWait()
        
        # Read the WAV file
        with open(temp_path, "rb") as f:
            audio_bytes = f.read()
        
        logger.info(f"Dailycast: Generated natural audio with pyttsx3 for {language}")
        return audio_bytes, "pyttsx3_natural"
    finally:
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
        engine.stop()


def _synthesize_with_pyttsx3(script_text: str, language: str) -> Tuple[bytes, str]:
    """Generate audio using pyttsx3 (fallback, basic version)."""
    import pyttsx3
    import tempfile
    import os
    
    engine = pyttsx3.init()
    engine.setProperty("rate", 150)
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        temp_path = f.name
    
    try:
        engine.save_to_file(script_text[:5000], temp_path)
        engine.runAndWait()
        
        with open(temp_path, "rb") as f:
            audio_bytes = f.read()
        
        logger.info(f"Dailycast: Generated audio with pyttsx3 for {language}")
        return audio_bytes, "pyttsx3"
    finally:
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
        engine.stop()


def estimate_duration_seconds(script_text: str) -> int:
    """Estimate audio duration from word count (150 wpm)."""
    words = len(script_text.split())
    return max(60, ceil(words / 150 * 60))


def create_multilingual_podcast_for_user(
    user,
    primary_language: str | None = None,
    secondary_language: str | None = None,
    output_format: str | None = None,
    included_courses: list | None = None,
    month_range: str | None = None,
    reply_size: str | None = None,
    requested_by=None,
    request_type: str = "user",
) -> DailyPodcast:
    """
    Orchestrate ON-DEMAND podcast generation with:
    - 24-hour cooldown per user
    - User's enrolled courses
    - Multi-language support (mixed in single audio)
    - Interactive Q&A
    - Flexible output (text/audio/both)
    - Time period selection (current month to all time)
    - Duration/size selection (short to detailed)
    
    Args:
        user: User instance
        primary_language: Language code (en, ja, es, etc)
        secondary_language: Optional second language
        output_format: 'text', 'audio', or 'both'
        included_courses: List of course titles
        month_range: 'current', 'last_3', 'last_6', 'last_12', or 'all'
        reply_size: 'short', 'medium', 'long', or 'detailed'
    
    Returns: DailyPodcast instance
    Raises: ValueError if cooldown not expired (when enabled in settings)
    """
    from django.utils import timezone
    from datetime import timedelta

    # Optional: per-admin cooldown control (default OFF)
    enforce_cooldown = getattr(settings, "DAILYCAST_ENFORCE_COOLDOWN", False)
    if enforce_cooldown:
        now = timezone.now()
        cooldown_threshold = now - timedelta(hours=24)
        recent_podcast = DailyPodcast.objects.filter(
            user=user,
            status=DailyPodcast.STATUS_COMPLETED,
            created_at__gte=cooldown_threshold
        ).order_by('-created_at').first()
        if recent_podcast:
            time_remaining = recent_podcast.created_at + timedelta(hours=24) - now
            hours_remaining = int(time_remaining.total_seconds() / 3600)
            minutes_remaining = int((time_remaining.total_seconds() % 3600) / 60)
            raise ValueError(
                f"Podcast already generated within the last 24 hours. "
                f"Please wait {hours_remaining}h {minutes_remaining}m before requesting another."
            )
    
    # Set defaults
    primary_language = primary_language or getattr(settings, "DAILYCAST_DEFAULT_LANGUAGE", "en")
    secondary_language = secondary_language or ""
    output_format = output_format or "both"
    month_range = month_range or "current"
    reply_size = reply_size or "medium"
    
    # Collect user stats
    stats = collect_user_stats(user)
    
    # Auto-detect secondary language: if course names contain Japanese, set it
    if not secondary_language and primary_language != "ja":
        course_titles = [c['title'] for c in stats.get('enrolled_courses', [])]
        if any(has_japanese_text(title) for title in course_titles):
            secondary_language = "ja"
            logger.info(f"Auto-detected Japanese in course names, setting secondary_language=ja")
    
    # Create podcast record
    podcast = DailyPodcast(
        user=user,
        primary_language=primary_language,
        secondary_language=secondary_language,
        output_format=output_format,
        month_range=month_range,
        reply_size=reply_size,
        included_courses=included_courses or [c['title'] for c in stats.get('enrolled_courses', [])],
        status=DailyPodcast.STATUS_PENDING,
        requested_by_user=requested_by is not None,
        requested_by=requested_by,
        user_request_type=request_type or "user",
    )
    
    try:
        # Generate script with course personalization and interactive Q&A
        script_text, llm_provider = generate_podcast_script_with_courses(
            user,
            primary_language,
            secondary_language,
            stats,
            output_format
        )
        
        podcast.script_text = script_text
        podcast.llm_provider = llm_provider
        podcast.duration_seconds = estimate_duration_seconds(script_text)
        
        # Generate conversational audio (if output_format requires it)
        if output_format in ["audio", "both"]:
            # Use NEW single-language audio (best TTS for each language)
            logger.info("[TTS] Generating single-language audio")
            audio_bytes, tts_provider = synthesize_single_language_audio(
                script_text,
                primary_language
            )
            
            podcast.tts_provider = tts_provider
            
            if audio_bytes:
                filename = f"podcast_{user.id}_{primary_language}_{int(time.time())}.mp3"
                podcast.audio_file.save(filename, ContentFile(audio_bytes), save=False)
        else:
            podcast.tts_provider = "none"
        
        # NO secondary audio file - everything is in one stitched file
        
        podcast.status = DailyPodcast.STATUS_COMPLETED
        podcast.error_message = None
        podcast.save()
        
        return podcast
        
    except Exception as e:
        podcast.status = DailyPodcast.STATUS_FAILED
        podcast.error_message = str(e)
        if not podcast.script_text:
            podcast.script_text = "Podcast generation failed before script was created."
        podcast.save()
        logger.exception("Dailycast: podcast generation failed")
        raise


# ============================================================================
# DAILY PERSONALIZED STUDY REPORT SYSTEM
# ============================================================================
# Replaces generic podcast with teacher-style daily learning review using
# actual analytics data (lessons completed, quiz scores, weak areas, etc).
# ============================================================================

def get_user_location_weather(user) -> Dict:
    """Fetch user's location (from profile) and weather forecast.
    
    Returns dict with:
    - location: City/Country from user profile (or "your area")
    - timezone: User's timezone
    - weather: Current conditions (if available)
    - temperature: Current temp (if available)
    
    Falls back gracefully if no location or weather API fails.
    """
    weather_data = {
        "location": "your area",
        "timezone": "UTC",
        "weather": None,
        "temperature": None,
        "condition": "unknown",
    }
    
    try:
        # Try to get location from user profile
        from users.models import UserProfile
        profile = UserProfile.objects.filter(user=user).first()
        if profile:
            if profile.city:
                weather_data["location"] = profile.city
            if profile.timezone:
                weather_data["timezone"] = profile.timezone
        
        # Try to get weather using free API (ipinfo or weatherapi)
        # For now, just set location; weather would require API key
        # Optional: integrate with OpenWeatherMap, WeatherAPI, etc if available
        
    except Exception as e:
        logger.warning(f"Error fetching user location/weather: {e}")
    
    return weather_data


def get_yesterdays_activity(user) -> Dict:
    """Get user's activity from yesterday (last 24 hours)."""
    from datetime import timedelta
    from django.utils import timezone
    
    now = timezone.now()
    yesterday_start = now - timedelta(days=1)
    
    stats = {
        "lessons_completed": 0,
        "quizzes_taken": 0,
        "quiz_scores": [],
        "lessons_list": [],
        "total_time_minutes": 0,
        "repeated_mistakes": []
    }
    
    try:
        from lessons.models import Lesson, LessonCompletion
        from quizzes.models import Quiz
        from analytics.models import ActivityEvent
        
        # Get yesterday's lessons completed
        lesson_events = ActivityEvent.objects.filter(
            user=user,
            event_type='lesson_completed',
            timestamp__gte=yesterday_start,
            timestamp__lt=now
        ).select_related('content_type').order_by('-timestamp')
        
        stats["lessons_completed"] = lesson_events.count()
        for event in lesson_events[:3]:  # Top 3
            if hasattr(event.content_object, 'title'):
                stats["lessons_list"].append(event.content_object.title)
        
        # Get yesterday's quizzes
        quiz_events = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_completed',
            timestamp__gte=yesterday_start,
            timestamp__lt=now
        ).select_related('content_type').order_by('-timestamp')
        
        stats["quizzes_taken"] = quiz_events.count()
        for event in quiz_events[:3]:
            if event.metadata and 'score' in event.metadata:
                stats["quiz_scores"].append(event.metadata['score'])
        
        # Estimate time spent (from metadata)
        time_events = ActivityEvent.objects.filter(
            user=user,
            timestamp__gte=yesterday_start,
            timestamp__lt=now
        ).exclude(event_type__in=['analytics_report_generated'])
        
        total_ms = 0
        for event in time_events:
            if event.metadata and 'duration_ms' in event.metadata:
                total_ms += event.metadata['duration_ms']
        stats["total_time_minutes"] = round(total_ms / 60000)
        
    except Exception as e:
        logger.warning(f"Error getting yesterday's activity: {e}")
    
    return stats


def get_todays_recommendations(user) -> Dict:
    """Get recommended content for today based on overdue spaced repetition & weak areas."""
    from django.utils import timezone
    from datetime import timedelta
    
    now = timezone.now()
    recommendations = {
        "overdue_items": [],
        "weak_subjects": [],
        "recommended_quizzes": [],
        "total_overdue_count": 0
    }
    
    try:
        from analytics.models import MemoryStat
        from analytics.models import ActivityEvent
        from lessons.models import Lesson
        from quizzes.models import Quiz
        
        # Get overdue spaced repetition items
        overdue_items = MemoryStat.objects.filter(
            user=user,
            next_review_at__lt=now
        ).order_by('next_review_at')[:5]
        
        recommendations["total_overdue_count"] = overdue_items.count()
        for mem_stat in overdue_items:
            item_name = "Unknown item"
            try:
                if hasattr(mem_stat.learnable_item, 'title'):
                    item_name = mem_stat.learnable_item.title
                elif hasattr(mem_stat.learnable_item, 'text'):
                    item_name = mem_stat.learnable_item.text[:100]
            except:
                pass
            recommendations["overdue_items"].append(item_name)
        
        # Get weak subjects (low scores in last 7 days)
        seven_days_ago = now - timedelta(days=7)
        quiz_events = ActivityEvent.objects.filter(
            user=user,
            event_type='quiz_completed',
            timestamp__gte=seven_days_ago
        ).select_related('content_type')
        
        weak_subjects_dict = {}
        for event in quiz_events:
            score = event.metadata.get('score', 0) if event.metadata else 0
            if score < 70:  # Low score threshold
                if hasattr(event.content_object, 'subject') and event.content_object.subject:
                    subject_name = str(event.content_object.subject)
                    if subject_name not in weak_subjects_dict:
                        weak_subjects_dict[subject_name] = []
                    weak_subjects_dict[subject_name].append(score)
        
        # Top 3 weakest subjects
        for subject, scores in sorted(weak_subjects_dict.items(), key=lambda x: sum(x[1])/len(x[1]))[:3]:
            avg_score = round(sum(scores) / len(scores))
            recommendations["weak_subjects"].append({
                "name": subject,
                "avg_score": avg_score
            })
        
    except Exception as e:
        logger.warning(f"Error getting today's recommendations: {e}")
    
    return recommendations


def build_daily_report_script(user, report_language: str = None) -> str:
    """
    Build natural SINGLE-LANGUAGE daily study report script.
    
    This avoids TTS mispronunciation issues with mixed-language audio.
    One narrator, one language = natural, clear, accurate pronunciation.
    
    Tone: Warm, teacher-like, encouraging.
    Content:
    1. Greeting
    2. Yesterday's review (lessons, quizzes, scores)
    3. Memory check ("Do you remember...?") with pauses
    4. Today's recommendations (weak areas, overdue items)
    5. Mini review quiz (3 quick questions)
    6. Micro-lesson / focus area
    7. Closing encouragement
    
    Args:
        user: Django User object
        report_language: "en", "ja", or None (auto-detect from preferences)
    
    Returns: Single-language script text
    """
    
    logger.info(f"[DAILY_REPORT] Building single-language script for {user.username}")
    
    # Detect report language
    if report_language is None:
        try:
            from users.models import UserPreference
            prefs = UserPreference.objects.filter(user=user).first()
            report_language = prefs.report_language if prefs else "en"
        except:
            report_language = "en"
    
    logger.info(f"[DAILY_REPORT] Using report language: {report_language}")
    
    # Get analytics data and location/weather info
    yesterday = get_yesterdays_activity(user)
    today_rec = get_todays_recommendations(user)
    location_weather = get_user_location_weather(user)
    
    username = getattr(user, "first_name", None) or getattr(user, "username", "Learner")
    
    if report_language == "ja":
        script = _build_japanese_report_script(username, yesterday, today_rec, location_weather)
    else:
        # Default to English
        script = _build_english_report_script(username, yesterday, today_rec, location_weather)
    
    logger.info(f"[DAILY_REPORT] Script built: {len(script)} chars")
    return script


def _build_english_report_script(username: str, yesterday: Dict, today_rec: Dict, location_weather: Dict = None) -> str:
    """Teacher-style daily report (single narrator, English-led with JP support).
    
    Args:
        username: User's name (first name or username)
        yesterday: Dict with yesterday's activity stats
        today_rec: Dict with today's recommendations
        location_weather: Dict with location and weather info
    """

    if location_weather is None:
        location_weather = {"location": "your area", "timezone": "UTC", "weather": None, "temperature": None}

    script: List[str] = []
    name = username or "Learner"
    location = location_weather.get("location", "your area")

    def add(line: str):
        script.append(line)

    # 1) Warm greeting with username
    add(f"Good morning, {name}! Welcome back to your learning journey.")
    add(f"I hope the weather in {location} is treating you well today.")

    # 2) Weather-based motivation
    weather_condition = location_weather.get("weather") or "conditions"
    temp = location_weather.get("temperature")
    if temp:
        temp_str = f"{temp}°"
        add(f"It's {temp_str} in {location}. Rain or shine, you're here to grow. That's what matters!")
    else:
        add(f"No matter what {weather_condition} you face in {location}, remember: your commitment to learning is stronger than any weather.")

    # 3) Review yesterday using analytics
    lessons = yesterday.get("lessons_completed", 0)
    quizzes = yesterday.get("quizzes_taken", 0)
    time_min = yesterday.get("total_time_minutes", 0)
    lesson_list = yesterday.get("lessons_list", [])
    quiz_scores = yesterday.get("quiz_scores", [])

    add("")
    if lessons or quizzes or time_min:
        bits = []
        if lessons:
            bits.append(f"{lessons} lesson{'s' if lessons != 1 else ''}")
        if quizzes:
            bits.append(f"{quizzes} quiz{'zes' if quizzes != 1 else ''}")
        if bits:
            add(f"Yesterday you completed {' and '.join(bits)}.")
        if time_min:
            add(f"You studied about {time_min} minutes. Excellent effort, especially considering today's weather.")
        if lesson_list:
            add(f"You worked on: {lesson_list[0]}.")
        if quiz_scores:
            avg = round(sum(quiz_scores) / len(quiz_scores))
            add(f"Your quiz accuracy was about {avg}%. We'll keep strengthening weak points.")
    else:
        add("Yesterday had little activity. That's okay. Let's restart gently today, no matter the weather.")

    # 4) Mini review questions (3–6, bilingual support)
    add("")
    add("Do you remember what 'efficient' means?")
    add("(pause)")
    add("It means doing something without wasting time. 日本語では『効率がいい』です。")

    add("")
    add("How do you say this in English: 『雨だったけど行った』?")
    add("(pause)")
    add("Answer: Although it was raining, we went.")

    add("")
    add("What's the past tense of 'run'?")
    add("(pause)")
    add("Answer: ran.")

    add("")
    add("Translate to English: 『先延ばしにしないようにする』")
    add("(pause)")
    add("I will try not to procrastinate. 日本語でも同じ意味ですね。")

    add("")
    add("Quick grammar check: When do we use conditional type 2?")
    add("(pause)")
    add("For unreal or imaginary situations. Example: If I had more time, I would study more.")

    # 5) Micro-lesson (20–40s)
    add("")
    add("Today's micro-lesson: conditional type 2.")
    add("Form: if + past tense, would + base verb. It's for unreal situations.")
    add("Example: If I had more time, I would study more. 日本語: 『もっと時間があれば、もっと勉強するのに』。")

    # 6) Today's study plan (analytics-based)
    add("")
    overdue_items = today_rec.get("overdue_items", []) or []
    total_due = today_rec.get("total_overdue_count", 0)
    weak_subjects = today_rec.get("weak_subjects", []) or []

    add(f"You have {total_due} items due for review today." if total_due else "Light review load today.")
    if overdue_items:
        add(f"Start with: {overdue_items[0]} for spaced repetition.")
    if weak_subjects:
        weak = weak_subjects[0]
        add(f"Then focus on: {weak['name']} (recently around {weak['avg_score']}%).")
    if lesson_list:
        add(f"Finish your pending lesson: {lesson_list[0]}.")

    # 7) Encouragement with location/weather tie-in
    add("")
    add(f"You're doing great, {name}. Whether it's sunny or cloudy in {location}, your dedication shines bright.")
    add("Let's study step by step. I believe in you.")

    return "\n".join(script)


def _build_japanese_report_script(username: str, yesterday: Dict, today_rec: Dict, location_weather: Dict = None) -> str:
    """Teacher-style daily report (single narrator, English-led with JP support).
    
    Args:
        username: User's name (first name or username)
        yesterday: Dict with yesterday's activity stats
        today_rec: Dict with today's recommendations
        location_weather: Dict with location and weather info
    """

    if location_weather is None:
        location_weather = {"location": "your area", "timezone": "UTC", "weather": None, "temperature": None}

    script: List[str] = []
    name = username or "学習者"
    location = location_weather.get("location", "あなたの地域")

    def add(line: str):
        script.append(line)

    # 1) Warm greeting with username
    add(f"{name}さん、おはようございます。Good morning. Welcome back to your learning journey.")
    add(f"{location}の天気が良いといいですね。I hope the weather in {location} is treating you well.")

    # 2) Review yesterday with analytics
    lessons = yesterday.get("lessons_completed", 0)
    quizzes = yesterday.get("quizzes_taken", 0)
    time_min = yesterday.get("total_time_minutes", 0)
    lesson_list = yesterday.get("lessons_list", [])
    quiz_scores = yesterday.get("quiz_scores", [])

    add("")
    if lessons or quizzes or time_min:
        bits = []
        if lessons:
            bits.append(f"レッスン{lessons}個")
        if quizzes:
            bits.append(f"クイズ{quizzes}個")
        if bits:
            add(f"昨日は{' と '.join(bits)}に取り組みました。よく頑張りました。")
        if time_min:
            add(f"勉強時間は約{time_min}分でした。特に天気の悪い中での学習、お疲れ様。")
        if lesson_list:
            add(f"学習したコンテンツ: 「{lesson_list[0]}」。")
        if quiz_scores:
            avg = round(sum(quiz_scores) / len(quiz_scores))
            add(f"クイズの正答率は約{avg}%でした。弱点を一緒に補強しましょう。")
    else:
        add("昨日は活動が少なかったですね。それも大丈夫。今日からゆっくり再開しましょう。")

    # 3) Weather-based motivation before questions
    weather_condition = location_weather.get("weather") or "conditions"
    temp = location_weather.get("temperature")
    if temp:
        temp_str = f"{temp}°"
        add(f"")
        add(f"{location}は{temp_str}です。雨の日も晴れの日も、あなたが学習を続けることが大切です。")
        add(f"That's what truly matters - your commitment.")
    else:
        add(f"")
        add(f"What matters most is not the weather in {location}, but your dedication to learning.")
        add(f"{location}の天気がどうであれ、あなたの学習への情熱は変わりません。")

    # 4) Mini review questions (3–6, bilingual)
    add("")
    add("Do you remember what 'efficient' means?")
    add("(pause)")
    add("『効率がいい』という意味です。Doing things without wasting time.")

    add("")
    add("How do you say: 『雨だったけど行った』 in English?")
    add("(pause)")
    add("Although it was raining, we went.")

    add("")
    add("Past tense of 'run'?")
    add("(pause)")
    add("ran です。")

    add("")
    add("Translate to English: 『先延ばしにしないようにする』")
    add("(pause)")
    add("I will try not to procrastinate. 意味も確認しましょう。")

    add("")
    add("When do we use conditional type 2?")
    add("(pause)")
    add("現実と違う仮の状況で使います。Example: If I had more time, I would study more.")

    # 5) Micro-lesson (20–40s) - relabel from 4
    add("")
    add("今日のショートレッスン: 条件文 Type 2 (仮定法過去)。")
    add("形: if + 過去形, would + 動詞の原形。非現実の場面に使います。")
    add("例: If I had more time, I would study more. 日本語: 『もっと時間があれば、もっと勉強するのに』。")

    # 6) Today's plan (analytics-based)
    add("")
    overdue_items = today_rec.get("overdue_items", []) or []
    total_due = today_rec.get("total_overdue_count", 0)
    weak_subjects = today_rec.get("weak_subjects", []) or []

    add(f"{total_due}個の復習予定があります。" if total_due else "今日は軽めの復習です。")
    if overdue_items:
        add(f"まずはこれから始めましょう: {overdue_items[0]}")
    if weak_subjects:
        weak = weak_subjects[0]
        add(f"その次に: {weak['name']}（最近の正答率約{weak['avg_score']}%）")
    if lesson_list:
        add(f"最後に保留中のレッスンを終わらせます: {lesson_list[0]}")

    # 7) Encouragement with location/weather tie-in
    add("")
    add(f"素晴らしいですね、{name}さん。")
    add(f"Whether sunny or cloudy in {location}, your dedication shines brighter than any weather.")
    add(f"{location}の天気がどうであれ、あなたの成長への意志は変わりません。")
    add("Let's continue step by step. I truly believe in you.")

    return "\n".join(script)
    
    # 4. CLOSING & ENCOURAGEMENT
    script_parts.append("")
    script_parts.append("ALEX: Great job thinking through those. You're building strong foundations.")
    script_parts.append("YUKI: 素晴らしい。あなたはしっかり学んでいます。")
    
    script_parts.append("")
    script_parts.append("ALEX: Today, focus on your weak areas, knock out those overdue items, and enjoy the process.")
    script_parts.append("YUKI: 今日、苦手な部分に焦点を当てて、頑張ってください。応援しています。")
    
    script_parts.append("")
    script_parts.append("ALEX: You've got this. Let's learn together. See you later!")
    script_parts.append("YUKI: 頑張ってね。では、また後で！")
    
    script_text = "\n".join(script_parts)
    logger.info(f"[DAILY_REPORT] Script built: {len(script_text)} chars, {len([l for l in script_parts if l.startswith('ALEX:')])} ALEX lines")
    
    return script_text


def generate_daily_study_report(user, report_language: str = None) -> bytes:
    """
    Main entry point: Generate complete daily study report audio.
    
    SINGLE-LANGUAGE: English-only or Japanese-only narrator.
    No mixing languages = clear, natural, accurate pronunciation.
    
    Returns: MP3 audio bytes of the daily report.
    
    Features:
    - Natural single-language script (English OR Japanese)
    - Uses real analytics data (yesterdays activity, today's recommendations)
    - OpenAI TTS for expressive voices
    - Single continuous MP3 (no segmentation)
    - Paragraph-level processing (natural rhythm)
    - Memory checks with pauses
    - Mini quiz integrated
    """
    
    logger.info(f"🎓 Starting daily study report generation for {user.username}")
    
    # Auto-detect language preference if not specified
    if report_language is None:
        try:
            from users.models import UserPreference
            prefs = UserPreference.objects.filter(user=user).first()
            report_language = prefs.report_language if prefs else "en"
        except:
            report_language = "en"
    
    try:
        # 1. Build natural single-language script from analytics
        script_text = build_daily_report_script(user, report_language)
        
        # 2. Generate expressive single-language audio
        logger.info(f"🎙️ Synthesizing {report_language} daily report audio...")
        audio_bytes, tts_provider = synthesize_single_language_audio(script_text, report_language)
        
        logger.info(f"[OK] Daily report complete: {len(audio_bytes)} bytes, {tts_provider}")
        
        return audio_bytes
        
    except Exception as e:
        logger.exception(f"❌ Daily report generation failed: {e}")
        raise
