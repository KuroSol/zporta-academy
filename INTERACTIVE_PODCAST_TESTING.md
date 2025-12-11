# Interactive Podcast System - Testing & Verification Guide

## 🧪 Testing Checklist

### Pre-Migration Testing
- [ ] Code syntax verified
- [ ] Services layer imports working
- [ ] Models defined correctly
- [ ] Migration file generated

### Post-Migration Testing
- [ ] Migration applied successfully
- [ ] New database fields created
- [ ] Indexes created
- [ ] No data loss from old fields

### Admin Interface Testing
- [ ] Admin page loads
- [ ] User dropdown works
- [ ] Language selectors working
- [ ] Format radio buttons work
- [ ] Podcast created and saved
- [ ] Audio players display
- [ ] Questions show correctly
- [ ] Answer tracking works

### API Testing
- [ ] POST /api/podcasts/ works
- [ ] GET /api/podcasts/ returns list
- [ ] GET /api/podcasts/{id}/ returns details
- [ ] GET /api/podcasts/{id}/accuracy-check/ validates
- [ ] GET /api/podcasts/{id}/progress/ tracks progress
- [ ] PUT /api/podcasts/{id}/answers/ saves answers

### Service Layer Testing
- [ ] Course fetching works
- [ ] LLM prompt generation works
- [ ] Script generation works
- [ ] Audio synthesis works (if AWS configured)
- [ ] All 8 languages supported
- [ ] Error handling works
- [ ] Fallbacks work

### Real Data Testing
- [ ] Generate with real user
- [ ] Verify course mentions
- [ ] Check audio quality
- [ ] Verify question generation
- [ ] Test bilingual generation
- [ ] Test all output formats

---

## 🚀 Test Execution Guide

### Step 1: Apply Migration

```bash
cd zporta_academy_backend

# Check what will change
python manage.py migrate dailycast --plan

# Apply migration
python manage.py migrate dailycast

# Verify success
python manage.py shell
>>> from dailycast.models import DailyPodcast
>>> DailyPodcast._meta.fields  # Should show 20 fields
>>> print(len(DailyPodcast._meta.fields))
20
```

### Step 2: Test Services Layer

```bash
python manage.py shell

# Test imports
from dailycast.services_interactive import create_multilingual_podcast_for_user
from enrollment.models import Enrollment

# Get a real user with courses
from django.contrib.auth.models import User
user = User.objects.filter(enrollments__isnull=False).first()

if user:
    # Check courses
    enrollments = Enrollment.objects.filter(user=user)
    print(f"User has {enrollments.count()} enrollments")
    for e in enrollments:
        print(f"  - {e.content_object}")
    
    # Generate podcast
    podcast = create_multilingual_podcast_for_user(
        user=user,
        primary_language='en',
        secondary_language=None,
        output_format='text'  # Fast, no audio synthesis
    )
    
    print(f"✅ Podcast created: {podcast.id}")
    print(f"   Status: {podcast.status}")
    print(f"   Script length: {len(podcast.script_text)} chars")
    print(f"   Questions: {len(podcast.questions_asked)}")
    print(f"   Courses: {podcast.included_courses}")
else:
    print("❌ No user with enrollments found")
```

### Step 3: Test Admin Interface

```bash
# 1. Start dev server
python manage.py runserver

# 2. Go to http://localhost:8000/admin/
# 3. Login with superuser credentials
# 4. Click "Daily Podcasts"
# 5. Click "Add Daily Podcast"
# 6. Fill form:
#    - User: Select any user with courses
#    - Primary Language: en
#    - Secondary Language: (leave blank)
#    - Output Format: text
# 7. Click Save
# 8. Verify:
#    - Status shows "completed"
#    - Script text displays
#    - Questions show in Q&A section
#    - Courses mentioned in included_courses
```

### Step 4: Test API Endpoints

```bash
# Get auth token (if using DRF token auth)
curl -X POST http://localhost:8000/api-token-auth/ \
  -d "username=testuser&password=testpass"
# Returns: {"token": "abc123xyz..."}

# Create podcast via API
curl -X POST http://localhost:8000/api/podcasts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN_HERE" \
  -d '{
    "user": 1,
    "primary_language": "en",
    "secondary_language": "",
    "output_format": "text"
  }'
# Expected: 201 Created + podcast object

# List podcasts
curl http://localhost:8000/api/podcasts/ \
  -H "Authorization: Token YOUR_TOKEN_HERE"
# Expected: 200 OK + list of podcasts

# Get single podcast
curl http://localhost:8000/api/podcasts/1/ \
  -H "Authorization: Token YOUR_TOKEN_HERE"
# Expected: 200 OK + podcast details

# Check accuracy
curl http://localhost:8000/api/podcasts/1/accuracy-check/ \
  -H "Authorization: Token YOUR_TOKEN_HERE"
# Expected: 200 OK + accuracy report

# Check progress
curl http://localhost:8000/api/podcasts/1/progress/ \
  -H "Authorization: Token YOUR_TOKEN_HERE"
# Expected: 200 OK + progress data

# Submit answers
curl -X PUT http://localhost:8000/api/podcasts/1/answers/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN_HERE" \
  -d '{
    "answers": {
      "What is Django?": "A Python web framework",
      "How do models work?": "They define database schema"
    }
  }'
# Expected: 200 OK + updated podcast
```

### Step 5: Test with Multiple Languages

```python
# In Django shell
from dailycast.services_interactive import create_multilingual_podcast_for_user
from django.contrib.auth.models import User

user = User.objects.first()

# Test each language
for lang in ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko']:
    try:
        podcast = create_multilingual_podcast_for_user(
            user=user,
            primary_language=lang,
            secondary_language=None,
            output_format='text'
        )
        print(f"✅ {lang.upper()}: Created podcast {podcast.id}")
    except Exception as e:
        print(f"❌ {lang.upper()}: {str(e)}")
```

### Step 6: Test Bilingual Generation

```python
# In Django shell
from dailycast.services_interactive import create_multilingual_podcast_for_user
from django.contrib.auth.models import User

user = User.objects.first()

# Bilingual: English + Japanese
podcast = create_multilingual_podcast_for_user(
    user=user,
    primary_language='en',
    secondary_language='ja',
    output_format='text'  # Don't synthesize yet, just check script
)

print(f"✅ Bilingual podcast created: {podcast.id}")
print(f"   Primary: {podcast.primary_language}")
print(f"   Secondary: {podcast.secondary_language}")
print(f"   Script preview: {podcast.script_text[:200]}...")

# Now test with audio (takes longer)
podcast2 = create_multilingual_podcast_for_user(
    user=user,
    primary_language='en',
    secondary_language='ja',
    output_format='both'
)

print(f"\n✅ Bilingual audio podcast: {podcast2.id}")
print(f"   Primary audio: {podcast2.audio_file}")
print(f"   Secondary audio: {podcast2.audio_file_secondary}")
print(f"   Primary duration: {podcast2.duration_seconds}s")
print(f"   Secondary duration: {podcast2.duration_seconds_secondary}s")
```

### Step 7: Test Error Handling

```python
# Test with non-existent user
from django.contrib.auth.models import User
fake_user = User(id=99999, username='nonexistent')

from dailycast.services_interactive import create_multilingual_podcast_for_user
try:
    podcast = create_multilingual_podcast_for_user(
        user=fake_user,
        primary_language='en',
        secondary_language=None,
        output_format='text'
    )
except Exception as e:
    print(f"✅ Error handling works: {type(e).__name__}")

# Test with invalid language
try:
    podcast = create_multilingual_podcast_for_user(
        user=User.objects.first(),
        primary_language='invalid',
        secondary_language=None,
        output_format='text'
    )
except Exception as e:
    print(f"✅ Invalid language handled: {type(e).__name__}")
```

### Step 8: Performance Testing

```bash
# Test API response times
time curl http://localhost:8000/api/podcasts/ \
  -H "Authorization: Token YOUR_TOKEN" > /dev/null
# Should be <100ms

time curl http://localhost:8000/api/podcasts/1/ \
  -H "Authorization: Token YOUR_TOKEN" > /dev/null
# Should be <50ms

# Test concurrent requests
for i in {1..10}; do
  curl http://localhost:8000/api/podcasts/ \
    -H "Authorization: Token YOUR_TOKEN" &
done
wait
# All should complete quickly
```

---

## ✅ Verification Tests

### Test 1: Course Mention Verification

```python
# Verify podcast mentions user's actual courses
from dailycast.models import DailyPodcast
from enrollment.models import Enrollment
from django.contrib.auth.models import User

podcast = DailyPodcast.objects.latest('created_at')
user = podcast.user

# Get user's actual courses
enrollments = Enrollment.objects.filter(user=user)
actual_courses = [e.content_object.title for e in enrollments]

# Check if mentioned
print(f"Podcast courses: {podcast.included_courses}")
print(f"Actual courses: {actual_courses}")

for course in actual_courses:
    if course in podcast.included_courses:
        print(f"✅ Course '{course}' mentioned")
    else:
        print(f"❌ Course '{course}' NOT mentioned")
```

### Test 2: Q&A Presence Verification

```python
from dailycast.models import DailyPodcast

podcast = DailyPodcast.objects.latest('created_at')

print(f"Questions asked: {len(podcast.questions_asked) if podcast.questions_asked else 0}")
for i, q in enumerate(podcast.questions_asked or [], 1):
    print(f"{i}. {q}")

assert len(podcast.questions_asked or []) >= 3, "Should have at least 3 questions"
print("✅ Q&A requirement met (3+ questions)")
```

### Test 3: Audio File Verification

```python
from dailycast.models import DailyPodcast
import os

podcast = DailyPodcast.objects.latest('created_at')

if podcast.audio_file:
    file_path = podcast.audio_file.path
    if os.path.exists(file_path):
        size_mb = os.path.getsize(file_path) / 1024 / 1024
        print(f"✅ Primary audio file exists: {size_mb:.1f} MB")
    else:
        print(f"❌ Audio file not found: {file_path}")
else:
    print("⭕ No audio file (text-only podcast)")

if podcast.audio_file_secondary:
    file_path = podcast.audio_file_secondary.path
    if os.path.exists(file_path):
        size_mb = os.path.getsize(file_path) / 1024 / 1024
        print(f"✅ Secondary audio file exists: {size_mb:.1f} MB")
    else:
        print(f"❌ Secondary audio not found: {file_path}")
else:
    print("⭕ No secondary audio (single language or text-only)")
```

### Test 4: Duration Verification

```python
from dailycast.models import DailyPodcast

podcast = DailyPodcast.objects.latest('created_at')

min_duration = 5 * 60  # 5 minutes
target_duration = 6 * 60  # 6 minutes
max_duration = 7 * 60  # 7 minutes

duration = podcast.duration_seconds
print(f"Duration: {duration // 60}:{duration % 60:02d}")

if min_duration <= duration <= max_duration:
    print(f"✅ Duration within target range (5-7 minutes)")
elif duration < min_duration:
    print(f"⚠️  Duration too short ({duration // 60} min, target 6 min)")
else:
    print(f"⚠️  Duration too long ({duration // 60} min, target 6 min)")
```

### Test 5: Status Verification

```python
from dailycast.models import DailyPodcast

podcast = DailyPodcast.objects.latest('created_at')

print(f"Status: {podcast.status}")

if podcast.status == 'completed':
    print(f"✅ Podcast generation successful")
elif podcast.status == 'pending':
    print(f"⏳ Podcast still generating")
elif podcast.status == 'failed':
    print(f"❌ Generation failed: {podcast.error_message}")
```

### Test 6: API Response Format Verification

```bash
# Test response format
curl -s http://localhost:8000/api/podcasts/1/ \
  -H "Authorization: Token YOUR_TOKEN" | python -m json.tool

# Should output:
# {
#   "id": 1,
#   "user": 5,
#   "user_username": "john_doe",
#   "primary_language": "en",
#   "secondary_language": "ja",
#   "output_format": "both",
#   "script_text": "...",
#   "included_courses": [...],
#   "questions_asked": [...],
#   "student_answers": {},
#   "audio_url": "http://...",
#   "audio_url_secondary": "http://...",
#   "status": "completed",
#   "created_at": "2024-01-15T10:30:00Z",
#   ...
# }
```

---

## 🐛 Debugging Tips

### Enable SQL Logging
```python
# In Django shell
import logging
logging.basicConfig()
logger = logging.getLogger('django.db.backends')
logger.setLevel(logging.DEBUG)

# Now run queries and see SQL
from enrollment.models import Enrollment
enrollments = Enrollment.objects.filter(user=user)
# Will print actual SQL queries
```

### Check Services Layer Step by Step

```python
from dailycast.services_interactive import (
    get_user_enrolled_courses,
    collect_user_stats,
    build_interactive_qa_script,
    pick_polly_voice
)
from django.contrib.auth.models import User

user = User.objects.first()

# Step 1: Get courses
courses = get_user_enrolled_courses(user)
print(f"Step 1 - Courses: {courses}")

# Step 2: Collect stats
stats = collect_user_stats(user)
print(f"Step 2 - Stats: {stats}")

# Step 3: Build Q&A
script, questions = build_interactive_qa_script(user, 'en', stats, 'both')
print(f"Step 3 - Questions: {questions}")
print(f"Step 3 - Script preview: {script[:200]}...")

# Step 4: Pick voice
voice = pick_polly_voice('en')
print(f"Step 4 - Voice: {voice}")
```

### Test LLM Generation Separately

```python
from dailycast.services_interactive import generate_podcast_script_with_courses
from django.contrib.auth.models import User

user = User.objects.first()
stats = {
    'ability_score': 7,
    'ability_level': 'intermediate',
    'weak_subject': 'Database Design'
}

script, provider = generate_podcast_script_with_courses(
    user=user,
    primary_language='en',
    secondary_language=None,
    user_stats=stats,
    output_format='text'
)

print(f"Provider used: {provider}")
print(f"Script length: {len(script)} chars")
print(f"First 500 chars: {script[:500]}")
```

### Test Audio Synthesis

```python
from dailycast.services_interactive import synthesize_audio_for_language

script = "Hello, this is a test podcast. " * 50  # Make it long enough

# Test with each language
for lang in ['en', 'ja']:
    try:
        audio_bytes, provider = synthesize_audio_for_language(script, lang)
        print(f"✅ {lang.upper()}: Generated {len(audio_bytes)} bytes via {provider}")
    except Exception as e:
        print(f"❌ {lang.upper()}: {str(e)}")
```

---

## 📊 Test Results Template

Use this to document test results:

```markdown
# Test Results - [Date]

## Migration Tests
- [ ] Migration applied successfully
- [ ] 11 new fields created
- [ ] 2 new indexes created
- [ ] Old data preserved

## Service Layer Tests
- [ ] get_user_enrolled_courses() ✅
- [ ] collect_user_stats() ✅
- [ ] build_interactive_qa_script() ✅
- [ ] generate_podcast_script_with_courses() ✅
- [ ] pick_polly_voice() ✅
- [ ] synthesize_audio_for_language() ✅
- [ ] create_multilingual_podcast_for_user() ✅

## Admin Interface Tests
- [ ] Form loads ✅
- [ ] User dropdown works ✅
- [ ] Language selectors work ✅
- [ ] Podcast creates ✅
- [ ] Audio players display ✅

## API Tests
- [ ] POST /api/podcasts/ ✅
- [ ] GET /api/podcasts/ ✅
- [ ] GET /api/podcasts/{id}/ ✅
- [ ] GET /api/podcasts/{id}/accuracy-check/ ✅
- [ ] GET /api/podcasts/{id}/progress/ ✅
- [ ] PUT /api/podcasts/{id}/answers/ ✅

## Language Tests
- [ ] English (en) ✅
- [ ] Japanese (ja) ✅
- [ ] Spanish (es) ✅
- [ ] French (fr) ✅
- [ ] German (de) ✅
- [ ] Italian (it) ✅
- [ ] Portuguese (pt) ✅
- [ ] Russian (ru) ✅
- [ ] Korean (ko) ✅

## Real Data Tests
- [ ] Course mentions accurate ✅
- [ ] Questions generated ✅
- [ ] Audio quality good ✅
- [ ] Bilingual working ✅
- [ ] All formats working ✅

## Performance Tests
- [ ] GET response < 100ms ✅
- [ ] POST response < 20s ✅
- [ ] 10 concurrent requests ✅

## Notes
...
```

---

## 🎯 Success Criteria

✅ All tests pass = Ready for production

❌ Any test fails = Fix issue and re-test

**Minimum requirements:**
- [ ] Migration applied
- [ ] Services layer tests pass
- [ ] At least 1 podcast created successfully
- [ ] Courses mentioned in podcast
- [ ] Questions included
- [ ] API endpoints working
- [ ] Admin interface working
