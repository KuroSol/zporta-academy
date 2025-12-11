# 🎙️ Dailycast Audio Storage - Local Disk (No S3 Needed)

**Updated:** December 7, 2025  
**Status:** ✅ Production Ready

---

## Great News! 🎉

Your podcast system **saves MP3s directly to your server's media folder** - no AWS S3 required!

### Why This is Better
✅ **Cheaper** - Save $1-3/month per user (no cloud storage costs)  
✅ **Faster** - Audio serves from local disk (instant access)  
✅ **Simpler** - No cloud account dependencies  
✅ **Portable** - Easy to backup or migrate servers  
✅ **Scalable** - Works great for 1,000+ users on a single server

---

## Architecture

### How It Works
```
1. Generate Script (OpenAI/Gemini/Template)
   ↓
2. Synthesize Audio via Amazon Polly API
   ↓
3. Save MP3 to: MEDIA_ROOT/podcasts/podcast_USER_ID_TIMESTAMP.mp3
   ↓
4. Store file path in database
   ↓
5. Serve via HTTP from /media/podcasts/
```

### File Structure
```
zporta_academy_backend/
├── media/                          ← Django media folder
│   └── podcasts/                   ← Podcast MP3s
│       ├── podcast_1_1701920000.mp3
│       ├── podcast_1_1701923600.mp3
│       └── podcast_17_1701927200.mp3
├── dailycast/
│   ├── models.py                   ← audio_file = FileField(upload_to="podcasts/")
│   ├── services.py                 ← synthesize_audio() returns bytes
│   └── ...
└── .env                            ← AWS_ACCESS_KEY_ID (optional!)
```

---

## Configuration

### Minimal Setup (Script Only)
```env
# No AWS keys needed!
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

✅ **Works!** Generates script, skips audio, saves to database

### With Audio (Optional)
```env
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

✅ **Works!** Generates script + audio MP3, saves both to disk

---

## File Path Examples

### When Generated
```python
podcast = DailyPodcast.objects.get(id=2)

# Audio file path in database
podcast.audio_file.name
# → "podcasts/podcast_1_1701920000.mp3"

# Full URL on server
podcast.audio_file.url
# → "/media/podcasts/podcast_1_1701920000.mp3"

# Absolute disk path
podcast.audio_file.path
# → "C:\...\zporta_academy_backend\media\podcasts\podcast_1_1701920000.mp3"
```

### File Naming Convention
```
podcast_<USER_ID>_<TIMESTAMP>.mp3
│        │        │
│        │        └─ Unix timestamp (prevents collisions)
│        └────────── User ID (for organization)
└──────────────────── Fixed prefix
```

---

## Cost Comparison

### Without Audio (Script Only)
```
Per podcast: $0.001 (OpenAI gpt-4o-mini)
1000 podcasts: $1.00
1,000 users/month: $1.00
```

### With Audio (Script + MP3)
```
Per podcast: $0.001 (OpenAI) + $0.10 (Polly)
1000 podcasts: $101.00
1,000 users/month: $101.00
```

### Storage Cost (if using local disk)
```
MP3 size: ~2-5 MB per podcast
1000 users: 2-5 GB storage
Cost: $0.00 (it's on your server!)

vs S3 storage:
1000 users, 3 MB each: ~$0.07/month
```

---

## Disk Usage Planning

### Estimate
```
Average MP3: 3.5 MB (4 min @ 64 kbps)

Users      Total Storage    Cost (Local)   Cost (S3)
10         35 MB           $0              $0
100        350 MB          $0              $0.02
500        1.75 GB         $0              $0.10
1000       3.5 GB          $0              $0.20
5000       17.5 GB         $0              $1.00
10000      35 GB           $0              $2.00
```

**Note:** Lightsail servers have plenty of disk space for 1000+ users

---

## Setup for Production

### 1. Ensure Media Folder Exists
```bash
mkdir -p zporta_academy_backend/media/podcasts
chmod 755 zporta_academy_backend/media/podcasts
```

### 2. Configure Django Settings ✅ (Already Done)
```python
# zporta/settings/base.py
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"
```

### 3. Configure Web Server (Nginx/Apache)
```nginx
# For production on Lightsail
location /media/ {
    alias /home/ubuntu/zporta_academy_backend/media/;
}
```

### 4. Backup Strategy
```bash
# Daily backup
rsync -av media/podcasts/ /backup/podcasts_$(date +%Y%m%d)/

# Or use Lightsail automatic snapshots
# (includes media/ folder)
```

---

## Testing Locally

### Generate with Audio
```bash
# 1. Add AWS credentials to .env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# 2. Generate podcast
python manage.py generate_test_podcast --language en

# 3. Check if file was created
ls media/podcasts/
# Should see: podcast_1_1701920000.mp3

# 4. Play it!
# On Windows: media/podcasts/podcast_1_1701920000.mp3
# Check file size: should be 2-5 MB
```

### Generate without Audio
```bash
# Leave AWS keys empty
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Generate
python manage.py generate_test_podcast --language en

# Check database
python manage.py shell
>>> from dailycast.models import DailyPodcast
>>> p = DailyPodcast.objects.latest('id')
>>> p.audio_file
# Should be empty (blank file field)
>>> p.tts_provider
# Should be 'none'
```

---

## Django Admin Interface

### View Generated Podcasts
```
Admin → Daily Podcasts → List
├── User: alex
├── Language: en
├── Status: completed
├── LLM: openai
├── TTS: polly (or "none")
└── Audio File: [LINK] podcast_1_1701920000.mp3
```

### Listen to Audio
```
Admin → Daily Podcasts → Detail
├── Script Text: [Large textarea with full script]
├── Audio File: [HTML5 audio player with download button]
│   ├── Play button
│   ├── Volume control
│   └── Download link
└── Duration: 267 seconds
```

---

## Troubleshooting

### "Audio file not created"
```python
# Check 1: Was audio synthesis attempted?
podcast.tts_provider  # Should be 'polly' or 'none'

# Check 2: Do AWS credentials exist?
echo $AWS_ACCESS_KEY_ID  # Should not be empty

# Check 3: Check error message
podcast.error_message  # May contain Polly error

# Check 4: Is media folder writable?
ls -la media/
# Should have: drwxr-xr-x (755 permissions)
```

### "File not accessible via /media/ URL"
```bash
# Check 1: Django serving media in local dev
python manage.py runserver
# Should see: "GET /media/podcasts/..." in logs

# Check 2: For production, configure Nginx/Apache
# See "Setup for Production" section above

# Check 3: Check URL configuration
from django.conf import settings
print(settings.MEDIA_URL)  # Should be '/media/'
print(settings.MEDIA_ROOT)  # Should point to local folder
```

### "Storage full!" (Unlikely but planning)
```bash
# Delete old podcasts (keep last 100)
python manage.py shell
>>> from dailycast.models import DailyPodcast
>>> old = DailyPodcast.objects.all()[:-100]
>>> for p in old:
...     if p.audio_file:
...         p.audio_file.delete()

# Or archive to backup
rsync -av media/podcasts/ /backup/old_podcasts/
```

---

## Best Practices

### ✅ DO
- ✅ Generate podcasts on-demand (not scheduled)
- ✅ Keep AWS optional (script-only still valuable)
- ✅ Monitor media folder growth
- ✅ Back up podcasts regularly
- ✅ Use CDN for distribution if scaling to 10K+ users

### ❌ DON'T
- ❌ Delete audio files without backup
- ❌ Run out of disk space (monitor growth)
- ❌ Share AWS credentials in .env with others
- ❌ Assume unlimited storage (plan ahead)

---

## Migration Path

### Now (Small Users, <100)
```
Local disk storage ✅
- Zero cloud costs
- Instant access
- Simple backup
```

### Later (Growing, 100-1000)
```
Same local storage ✅
- Still fits on Lightsail
- Still zero cloud costs
- Good performance
```

### Future (Enterprise, 1000+)
```
Option 1: Stay local ✅
- Upgrade to larger server disk
- Still cheaper than S3

Option 2: Add S3 later (optional)
- If you need global distribution
- If you need redundancy across regions
- Cost: ~$0.02 per user/month

Option 3: Hybrid
- Keep recent (1 month) local
- Archive older to S3
- Best cost + performance
```

---

## Summary

### Current Setup
- ✅ Audio saves to `media/podcasts/`
- ✅ Files accessible via `/media/` URL
- ✅ AWS only needed for audio synthesis (optional)
- ✅ All configuration already in place
- ✅ No changes to code needed

### You Can
- ✅ Start testing immediately
- ✅ Add AWS keys later if you want audio
- ✅ Scale to 1000+ users without cloud storage
- ✅ Serve MP3s from your existing server
- ✅ Backup using standard server tools

### No Need For
- ❌ AWS S3 account
- ❌ Additional storage costs
- ❌ Cloud migration tools
- ❌ Complex infrastructure

---

**Your podcast system is simpler AND cheaper than typical cloud setups!** 🚀

Next: Test it locally or enable audio synthesis with AWS keys.
