#!/usr/bin/env python
"""Test local audio generation with pyttsx3."""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from dailycast.services_interactive import synthesize_audio_for_language
from pathlib import Path

# Test script
test_text = """Hello and welcome! This is a test of local audio generation.
The system can now generate audio completely offline using pyttsx3.
No AWS credentials needed! Let's test this out."""

print("Testing local audio generation with pyttsx3...")
print(f"Text: {test_text[:50]}...")

audio_bytes, provider = synthesize_audio_for_language(test_text, "en")

if audio_bytes:
    # Save to file
    output_path = Path("media/podcasts/test_local_audio.mp3")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    print(f"✅ Success! Generated {len(audio_bytes)} bytes of audio with {provider}")
    print(f"Saved to: {output_path}")
    print(f"\nYou can listen to it at: http://127.0.0.1:8000/media/podcasts/test_local_audio.mp3")
else:
    print("❌ Failed to generate audio")
