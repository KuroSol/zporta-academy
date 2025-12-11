# 🎧 DAILY PODCAST - QUICK REFERENCE CARD

**Print this out or pin it to your desk during development**

---

## 🚀 ONE-PAGE OVERVIEW

```
WHAT: Generate 3-6 min personalized podcast daily for each user
WHEN: 3 AM UTC (background job, not in user request)
WHERE: /study/dashboard (with play button)
HOW: LLM (script) → TTS (audio) → S3 (storage)
WHO: All active users (logged in last 2 weeks)
COST: $0.55/user/month

REPEAT: Once per user per day (never duplicate on same date)
```

---

## 📁 FILES YOU'LL CREATE

```
zporta_academy_backend/dailycast/
├── __init__.py
├── admin.py                    # Register DailyPodcast in admin
├── apps.py
├── models.py                   # DailyPodcast model (8 fields)
├── serializers.py              # DailyPodcastSerializer
├── views.py                    # DailyPodcastTodayView (GET endpoint)
├── urls.py                     # Register /api/dailycast/today/
├── services.py                 # LLM + TTS + S3 functions
├── tasks.py                    # Celery tasks
├── management/
│   └── commands/
│       └── generate_daily_podcasts.py  # Main generation command
├── migrations/
│   ├── 0001_initial.py         # DailyPodcast model
│   └── __init__.py
└── tests.py

MODIFIED FILES:
├── zporta/settings/base.py     # Add dailycast to INSTALLED_APPS + settings
├── zporta/urls.py              # Add path('api/dailycast/', ...)
├── zporta_academy_frontend/src/components/StudyDashboard.js  # Add podcast widget

3 NEW ANALYSIS DOCS (in repo root):
├── DAILY_PODCAST_PLAN.md                    # Complete spec
├── PODCAST_LLM_PROMPT_TEMPLATE.md           # LLM prompt to copy
└── PODCAST_ARCHITECTURE_VISUAL.md           # Diagrams & flows
```

---

## 🗄️ DATABASE MODEL (Copy This)

```python
class DailyPodcast(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_podcasts')
    date = models.DateField(db_index=True)

    # Content
    script_text = models.TextField()
    audio_url = models.URLField(max_length=500)
    duration_seconds = models.PositiveIntegerField(default=240)

    # Metadata
    ai_model_used = models.CharField(max_length=50)  # 'gpt-4o-mini', 'gemini-flash', etc.
    tts_provider = models.CharField(max_length=50)   # 'google', 'amazon', 'azure'
    tts_voice_gender = models.CharField(max_length=20, default='female')
    metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, default='pending')
    error_message = models.TextField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('user', 'date')  # ← IMPORTANT: One per user per day
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', 'date']),
        ]
```

---

## 🔗 API ENDPOINT (Copy This)

```python
# dailycast/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from .models import DailyPodcast
from .serializers import DailyPodcastSerializer

class DailyPodcastTodayView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        podcast = DailyPodcast.objects.filter(
            user=request.user,
            date=today,
            is_active=True
        ).first()

        if not podcast:
            return Response({
                'podcast': None,
                'status': 'not_available',
                'message': 'Your podcast will be available tomorrow at 3 AM UTC'
            }, status=status.HTTP_200_OK)

        serializer = DailyPodcastSerializer(podcast)
        return Response({
            'podcast': serializer.data,
            'status': podcast.status
        }, status=status.HTTP_200_OK)
```

---

## 🎯 CELERY TASK (Copy This Structure)

```python
# dailycast/tasks.py
from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@shared_task(name='dailycast.generate_daily_podcasts')
def generate_daily_podcasts():
    """Generate podcasts for all active users at 3 AM UTC."""
    today = timezone.now().date()

    # Get active users without today's podcast
    users = User.objects.filter(
        is_active=True,
        last_login__gte=timezone.now() - timedelta(days=14)
    ).exclude(
        daily_podcasts__date=today
    )

    # Batch them
    batch_size = 100
    for i in range(0, users.count(), batch_size):
        batch = list(users[i:i+batch_size])
        process_podcast_batch.delay(batch_ids=[u.id for u in batch])

    return f"Started generation for {users.count()} users"

@shared_task(name='dailycast.process_podcast_batch')
def process_podcast_batch(batch_ids):
    """Process a batch of users."""
    for user_id in batch_ids:
        try:
            process_user_podcast.delay(user_id)
        except Exception as e:
            logger.error(f"Error queuing podcast for user {user_id}: {e}")

@shared_task(name='dailycast.process_user_podcast')
def process_user_podcast(user_id):
    """Generate podcast for one user."""
    user = User.objects.get(id=user_id)
    today = timezone.now().date()

    try:
        # 1. Check if already exists
        if DailyPodcast.objects.filter(user=user, date=today).exists():
            return f"Podcast already exists for user {user_id}"

        # 2. Collect user data
        user_data = collect_user_data(user)

        # 3. Generate script
        script = generate_podcast_script(user_data)
        podcast = DailyPodcast.objects.create(
            user=user, date=today, script_text=script, status='script_generated'
        )

        # 4. Generate audio
        audio_bytes, tts_provider = generate_audio(script)
        podcast.tts_provider = tts_provider
        podcast.save()

        # 5. Upload to S3
        audio_url = upload_to_s3(audio_bytes, user_id, today)
        podcast.audio_url = audio_url
        podcast.status = 'completed'
        podcast.save()

        logger.info(f"✓ Generated podcast for user {user_id}")
        return f"Success for user {user_id}"

    except Exception as e:
        logger.error(f"✗ Failed to generate podcast for user {user_id}: {e}")
        DailyPodcast.objects.filter(user=user, date=today).update(
            status='failed',
            error_message=str(e)
        )
        return f"Failed for user {user_id}"
```

---

## 🧠 LLM PROVIDER SELECTION (Copy This)

```python
# dailycast/services.py

def select_llm_provider(user_data):
    """Try providers in order: GPT-4o Min → Gemini → Claude → Template"""

    providers = [
        ('openai', 'gpt-4o-mini', os.getenv('OPENAI_API_KEY')),
        ('google', 'gemini-1.5-flash', os.getenv('GOOGLE_API_KEY')),
        ('anthropic', 'claude-3-5-haiku', os.getenv('ANTHROPIC_API_KEY')),
    ]

    for name, model, api_key in providers:
        if not api_key:
            continue

        try:
            if name == 'openai':
                return generate_with_openai(model, user_data), name
            elif name == 'google':
                return generate_with_gemini(model, user_data), name
            elif name == 'anthropic':
                return generate_with_claude(model, user_data), name
        except Exception as e:
            logger.warning(f"LLM provider {name} failed: {e}")
            continue

    # All failed → template
    logger.error("All LLM providers failed, using template")
    return generate_template_podcast(user_data), 'template'

def select_tts_provider(user, script_text):
    """Select TTS based on user plan."""

    user_plan = get_user_plan(user)  # 'free', 'premium', 'enterprise'

    tts_matrix = {
        'free': [('amazon', 'Polly'), ('google', 'Cloud TTS')],
        'premium': [('google', 'Cloud TTS'), ('azure', 'Neural TTS')],
        'enterprise': [('azure', 'Neural TTS'), ('google', 'Cloud TTS')],
    }

    providers = tts_matrix.get(user_plan, tts_matrix['free'])

    for provider_name, provider_label in providers:
        try:
            if provider_name == 'amazon':
                return generate_with_polly(script_text), provider_name
            elif provider_name == 'google':
                return generate_with_google_tts(script_text), provider_name
            elif provider_name == 'azure':
                return generate_with_azure_tts(script_text), provider_name
        except Exception as e:
            logger.warning(f"TTS provider {provider_name} failed: {e}")
            continue

    # All failed
    logger.error(f"All TTS providers failed for user {user.id}")
    raise Exception("TTS generation failed for all providers")
```

---

## ⚙️ SETTINGS (Add to base.py)

```python
# zporta/settings/base.py

DAILYCAST_SETTINGS = {
    'LLM_PROVIDERS': [
        {'name': 'openai', 'model': 'gpt-4o-mini', 'api_key_env': 'OPENAI_API_KEY'},
        {'name': 'google', 'model': 'gemini-1.5-flash', 'api_key_env': 'GOOGLE_API_KEY'},
        {'name': 'anthropic', 'model': 'claude-3-5-haiku', 'api_key_env': 'ANTHROPIC_API_KEY'},
    ],
    'TTS_PROVIDERS': {
        'free': {'primary': 'amazon', 'fallback': 'google'},
        'premium': {'primary': 'google', 'fallback': 'azure'},
        'enterprise': {'primary': 'azure', 'fallback': 'google'},
    },
    'AUDIO_DURATION_MIN': 180,
    'AUDIO_DURATION_MAX': 360,
    'TTS_VOICE_GENDER': 'female',
    'STORAGE_BACKEND': 'aws_s3',
    'AWS_S3_BUCKET': 'zporta-podcasts',
    'PODCAST_EXPIRATION_DAYS': 30,
    'GENERATION_SCHEDULE': '0 3 * * *',  # 3 AM UTC daily
    'BATCH_SIZE': 100,
    'MAX_RETRIES': 3,
    'TIMEOUT_SECONDS': 300,
}

# Add to INSTALLED_APPS:
INSTALLED_APPS = [
    # ... existing apps ...
    'dailycast.apps.DailycastConfig',
]

# Celery Beat Schedule:
CELERY_BEAT_SCHEDULE = {
    # ... existing tasks ...
    'generate-daily-podcasts': {
        'task': 'dailycast.generate_daily_podcasts',
        'schedule': crontab(hour=3, minute=0),  # 3 AM UTC
    },
}
```

---

## 📝 URL ROUTING (Add to urls.py)

```python
# zporta/urls.py

urlpatterns = [
    # ... existing patterns ...
    path('api/dailycast/', include('dailycast.urls')),
]

# dailycast/urls.py
from django.urls import path
from .views import DailyPodcastTodayView

app_name = 'dailycast'

urlpatterns = [
    path('today/', DailyPodcastTodayView.as_view(), name='today'),
]
```

---

## 📊 COST QUICK REFERENCE

```
For 1000 users:

LLM (GPT-4o Mini):    $200-250/month
TTS (Google + Polly): $217/month
Storage (S3 + CDN):   $100/month
─────────────────────────────────
TOTAL:               ~$550/month ($0.55 per user)

Annual: ~$6,600 for 1000 users
```

---

## ✅ DEPLOYMENT CHECKLIST

```
BEFORE GOING LIVE:
☐ Test with 10 real users (manual)
☐ Run load test: 100 users (simulate batch)
☐ Check cost (compare actual vs. budget)
☐ Review first 20 podcast scripts (quality check)
☐ Set up monitoring alerts (failure rate > 5%)
☐ Test all provider fallbacks
☐ Document any customizations
☐ Prepare rollback plan (disable task if issues)

FIRST WEEK IN PRODUCTION:
☐ Monitor error logs daily
☐ Check user engagement (% playing podcast)
☐ Adjust TTS provider if quality issues
☐ Review user feedback (rate your podcast)
☐ Fine-tune LLM prompt if needed
```

---

## 🆘 QUICK FIXES

| Problem                  | Solution                                                      |
| ------------------------ | ------------------------------------------------------------- |
| Podcasts not generating  | Check Celery worker running: `celery -A zporta worker`        |
| API returns 404          | Check DailyPodcast exists for today: `python manage.py shell` |
| Script sounds bad        | Adjust LLM prompt, use better TTS provider                    |
| Cost too high            | Switch basic users to Amazon Polly, premium to Google TTS     |
| One provider failing     | Check API keys in .env, test with curl                        |
| Podcast quality bad      | Use Google/Azure neural TTS instead of standard               |
| Users not seeing podcast | Check frontend component loaded, check API working            |
| S3 upload fails          | Check AWS credentials, bucket exists, permissions             |

---

## 📞 WHEN YOU'RE STUCK

1. **"How do I use the LLM?"** → Read `PODCAST_LLM_PROMPT_TEMPLATE.md`
2. **"What's the architecture?"** → Read `PODCAST_ARCHITECTURE_VISUAL.md`
3. **"What's the full spec?"** → Read `DAILY_PODCAST_PLAN.md`
4. **"Show me diagrams"** → Check `PODCAST_ARCHITECTURE_VISUAL.md`
5. **"How much does it cost?"** → Check cost table in this card or PLAN.md

---

## 🎯 SUCCESS CRITERIA (After 1 Week)

- ✅ >95% of daily podcasts generated successfully
- ✅ <5% error rate
- ✅ <$0.60 per user cost
- ✅ >70% of users play their podcast
- ✅ API response time <50ms
- ✅ No single provider failures block generation
- ✅ All user data collected correctly
- ✅ Scripts sound natural (user rating >4/5)

---

**Print this card. Keep it handy during development. Reference docs always available in repo root.**
