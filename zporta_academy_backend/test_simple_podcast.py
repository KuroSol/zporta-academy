"""Simple test to create enhanced podcast"""
import os
import sys

# Set encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
os.environ['PYTHONIOENCODING'] = 'utf-8'

import django
django.setup()

from django.contrib.auth import get_user_model
from dailycast.services_interactive import create_multilingual_podcast_for_user

User = get_user_model()

# Get test user
user = User.objects.get(id=1)
print(f"\n🎙️ Generating ENHANCED podcast for: {user.username}")

try:
    # Use the NEW interactive service with all enhancements
    podcast = create_multilingual_podcast_for_user(
        user,
        primary_language="en",
        secondary_language="",
        output_format="both"
    )
    
    print(f"\n✅ Podcast created: #{podcast.id}")
    print(f"   Status: {podcast.status}")
    print(f"   Language: {podcast.primary_language}")
    print(f"\n   Script preview:")
    print(f"   {podcast.script_text[:500]}...")
    
    if podcast.audio_file:
        print(f"\n   Audio: {podcast.audio_file.name}")
        print(f"   Listen: http://127.0.0.1:8000/media/{podcast.audio_file.name}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
