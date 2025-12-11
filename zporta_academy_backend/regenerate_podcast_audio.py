#!/usr/bin/env python
"""Regenerate existing podcast with local audio using pyttsx3."""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from dailycast.models import DailyPodcast
from dailycast.services_interactive import synthesize_audio_for_language
from django.core.files.base import ContentFile

# Find the most recent podcast
podcast = DailyPodcast.objects.latest('created_at')

print(f"Found podcast: #{podcast.id} - {podcast.user.username} ({podcast.primary_language})")
print(f"Status: {podcast.status}")
print(f"TTS Provider: {podcast.tts_provider}")
print(f"Has audio: {bool(podcast.audio_file)}")

if podcast.script_text:
    print("\n🎵 Generating audio with pyttsx3...")
    audio_bytes, provider = synthesize_audio_for_language(
        podcast.script_text,
        podcast.primary_language
    )
    
    if audio_bytes:
        filename = f"podcast_{podcast.id}_{podcast.primary_language}.mp3"
        podcast.audio_file.save(filename, ContentFile(audio_bytes), save=False)
        podcast.tts_provider = provider
        podcast.save()
        
        print(f"✅ Success! Generated {len(audio_bytes)} bytes with {provider}")
        print(f"Audio file: {podcast.audio_file.name}")
        print(f"Listen at: http://127.0.0.1:8000{podcast.audio_file.url}")
    else:
        print("❌ Failed to generate audio")
else:
    print("❌ No script text found")
