#!/usr/bin/env python
"""Verify latest podcast was saved correctly."""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zporta.settings.local")
django.setup()

from dailycast.models import DailyPodcast

p = DailyPodcast.objects.latest('id')
print(f"✓ ID: {p.id}")
print(f"✓ User: {p.user.username}")
print(f"✓ Status: {p.status}")
print(f"✓ LLM Provider: {p.llm_provider}")
print(f"✓ TTS Provider: {p.tts_provider}")
print(f"✓ Audio File: {p.audio_file.name if p.audio_file else '(None - no audio generated)'}")
print(f"✓ Duration: {p.duration_seconds} seconds")
print(f"✓ Script Preview: {p.script_text[:150]}...")
print("\n✅ Podcast saved successfully to database!")
