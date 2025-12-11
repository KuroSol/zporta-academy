#!/usr/bin/env python
"""
Quick test script for dailycast podcast generation.
"""
import os
import sys
import django

# Set up Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zporta.settings.local")
django.setup()

from django.contrib.auth import get_user_model
from django.conf import settings
from dailycast.services import create_podcast_for_user

User = get_user_model()

def test_podcast_generation():
    """Generate a test podcast for user ID 1 (Alex)"""
    
    try:
        user = User.objects.get(id=1)
        print(f"✓ Found user: {user.username} (ID: {user.id})")
    except User.DoesNotExist:
        print("✗ User ID 1 not found")
        return
    
    print("\n🎙️ Starting podcast generation...")
    print(f"   User: {user.username}")
    print(f"   Language: en")
    print(f"   OpenAI API: {'✓ Loaded' if getattr(settings, 'OPENAI_API_KEY', None) else '✗ Missing'}")
    print(f"   Gemini API: {'✓ Loaded' if getattr(settings, 'GEMINI_API_KEY', None) else '✗ Missing'}")
    print(f"   AWS Keys: {'✓ Loaded' if getattr(settings, 'AWS_ACCESS_KEY_ID', None) else '✗ Missing'}")
    
    try:
        podcast = create_podcast_for_user(user, language="en")
        
        print(f"\n✅ SUCCESS! Podcast generated:")
        print(f"   ID: {podcast.id}")
        print(f"   Status: {podcast.status}")
        print(f"   LLM Provider: {podcast.llm_provider}")
        print(f"   TTS Provider: {podcast.tts_provider}")
        print(f"   Duration: {podcast.duration_seconds} seconds")
        print(f"   Audio File: {podcast.audio_file}")
        print(f"\n📝 Script preview (first 200 chars):")
        print(f"   {podcast.script_text[:200]}...")
        
    except Exception as e:
        print(f"\n✗ ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_podcast_generation()
