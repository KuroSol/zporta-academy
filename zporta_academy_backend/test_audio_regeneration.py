#!/usr/bin/env python
"""
Test the audio regeneration AJAX endpoint.
Run this from the Django shell or with: python manage.py shell < test_audio_regeneration.py
"""

import json
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from dailycast.models import DailyPodcast

# Create a test client
client = Client()

# Try to get a podcast with script_text
print("Looking for podcasts with script_text...")
podcasts = DailyPodcast.objects.filter(
    script_text__isnull=False
).exclude(script_text__exact='')

if not podcasts.exists():
    print("❌ No podcasts found with script_text")
    exit(1)

podcast = podcasts.first()
print(f"✅ Found podcast: {podcast.id} - {podcast.primary_language}")
print(f"   Script: {podcast.script_text[:100]}...")

# Get an admin user for authentication
admin_user = User.objects.filter(is_staff=True, is_superuser=True).first()
if not admin_user:
    print("❌ No admin user found")
    exit(1)

print(f"✅ Using admin user: {admin_user.username}")

# Login the test client
client.force_login(admin_user)

# Test the regenerate audio endpoint
print("\nTesting /api/admin/ajax/regenerate-audio/ endpoint...")
response = client.post(
    '/api/admin/ajax/regenerate-audio/',
    data=json.dumps({'podcast_id': podcast.id}),
    content_type='application/json'
)

print(f"Response status: {response.status_code}")
print(f"Response data: {response.json()}")

if response.status_code == 200:
    data = response.json()
    if data.get('success'):
        print("✅ Audio regeneration succeeded!")
    else:
        print(f"❌ Error: {data.get('error')}")
else:
    print(f"❌ Request failed with status {response.status_code}")
