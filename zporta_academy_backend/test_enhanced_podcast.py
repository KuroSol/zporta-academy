"""Test enhanced podcast with ice breakers and motivational quotes"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.contrib.auth import get_user_model
from dailycast.models import DailyPodcast
from dailycast.services_interactive import create_multilingual_podcast_for_user

User = get_user_model()

# Get test user
user = User.objects.get(id=1)
print(f"\n🎙️ Generating enhanced podcast for: {user.username}")
print(f"   First name: {user.first_name or '(using username)'}")

# Delete old podcast
DailyPodcast.objects.filter(user=user).delete()

# Generate new podcast with enhancements
podcast = create_multilingual_podcast_for_user(
    user=user,
    primary_language="en",
    secondary_language="",
    output_format="both"
)

print(f"\n✅ Generated podcast #{podcast.id}")
print(f"   Script preview (first 500 chars):")
print(f"   {podcast.script_text[:500]}...")
print(f"\n   Audio file: {podcast.audio_file_primary.name if podcast.audio_file_primary else 'N/A'}")
print(f"   Listen at: http://127.0.0.1:8000/media/{podcast.audio_file_primary.name}")
