# 🎧 DAILY AI PODCAST FEATURE - COMPREHENSIVE PLAN (TL;DR)

**Date:** December 7, 2025  
**Status:** Architecture & Strategy Phase  
**Target:** 3-6 minute personalized daily podcast per active user

---

## 📊 SYSTEM ANALYSIS SUMMARY

### Current Zporta Architecture Findings

**Backend:** Django 5.1 + Celery (async task queue) + Redis  
**Frontend:** Next.js / React  
**AI System:** Existing `intelligence` app with:
- User ability profiling (ELO-style ratings)
- Content difficulty scoring
- Match scores for recommendations
- Feed enhancement system
- Spaced-repetition tracking (MemoryStat)
- Activity analytics (ActivityEvent)

**Key Data Available:**
1. `UserAbilityProfile` - user ability scores by subject
2. `MemoryStat` - spaced repetition + retention estimates (what to review)
3. `ActivityEvent` - quiz attempts (correct/incorrect)
4. `MatchScore` - personalized content matching
5. `UserPreference` - languages, subjects, interests
6. `Feed` system - already recommends next content to study
7. Recent quiz history - accessible via analytics

**Existing Patterns:**
- Heavy computation runs offline via management commands + Celery tasks
- API endpoints return precomputed data only (<20ms response times)
- Graceful fallbacks when AI data unavailable
- Database-first design with nullable fields for backward compatibility

---

## 🎯 TLDР: SIMPLE EXPLANATION

### What is the Daily Podcast?

**User sees:** One daily 3-6 minute audio file in their AI Dashboard.

**What we generate automatically once per day:**
1. **Analyze** user's data (what they're weak at, what they reviewed today, current level)
2. **Write** a 3-6 minute podcast script using cheap AI (GPT-4o mini / Gemini Flash)
3. **Convert** script to natural-sounding audio using TTS (Google/Amazon/Azure)
4. **Store** the MP3 + script text in database
5. **Display** on dashboard with play button

**Quality & Cost Strategy:**
- Use **small LLMs** (cheap, good enough) for script generation
- Use **cheap + high-quality TTS** (Google Cloud TTS / Amazon Polly)
- Different TTS quality for different user plans (basic=cheaper, premium=better)
- Automatic fallback if one service fails (use another TTS provider)
- All generation runs **at night** (not blocking user requests)

---

## 🏗️ ARCHITECTURE: WHAT TO BUILD

### 1. **NEW DJANGO APP: `dailycast`**

**Location:** `zporta_academy_backend/dailycast/`

**New Models:**
```
DailyPodcast
├─ user (ForeignKey)
├─ date (DateField) - unique per user, prevents duplicates
├─ script_text (TextField) - the podcast script
├─ audio_url (URLField) - link to MP3 or file path
├─ duration_seconds (IntegerField) - 180-360 seconds
├─ ai_model_used (CharField) - "gpt-4o-mini" or "gemini-flash"
├─ tts_provider (CharField) - "google" or "amazon" or "azure"
├─ tts_voice_gender (CharField) - "male" or "female"
├─ metadata (JSONField) - generation details, retry info
├─ created_at (DateTimeField)
├─ is_active (BooleanField) - mark as deleted/expired

PodcastGenerationLog (optional, for debugging)
├─ podcast (ForeignKey to DailyPodcast)
├─ status (CharField) - "pending", "script_generated", "audio_generating", "completed", "failed"
├─ error_message (TextField, nullable)
├─ provider_fallback (JSONField) - track which providers were tried
├─ timestamps (JSONField) - track each step's duration
```

**Why this app?**
- Dedicated to podcast feature, easy to maintain
- Can be reused/extended later for weekly/monthly podcasts
- Clean separation from core learning/analytics

---

### 2. **PROVIDER SELECTION STRATEGY**

**Goal:** Best quality at minimum cost, with automatic fallback.

#### **Text Generation (Script Writing)**

| Provider | Model | Cost/Month (1000 users) | Speed | Quality | Use Case |
|----------|-------|------------------------|-------|---------|----------|
| **OpenAI** | GPT-4o Mini | ~$500-800 | Fast | Excellent | Primary choice |
| **Google** | Gemini 1.5 Flash | ~$300-400 | Very Fast | Good | Cheaper alternative |
| **Anthropic** | Claude 3.5 Haiku | ~$600 | Fast | Excellent | Premium fallback |

**Strategy:**
- **Primary:** GPT-4o Mini (best balance of cost + quality)
- **Fallback 1:** Gemini Flash (if OpenAI rate-limited)
- **Fallback 2:** Claude Haiku (if both above fail)
- **Default:** Store pre-written templates if all LLMs fail (quality degrades)

#### **Text-to-Speech (Audio Conversion)**

| Provider | Voice Quality | Cost/Min (1000 users) | Setup | Languages |
|----------|--------------|----------------------|-------|-----------|
| **Google Cloud TTS** | Excellent (neural) | $3-4/month | Easy API | 150+ |
| **Amazon Polly** | Good (standard) | $1-2/month | AWS account | 50+ |
| **Azure Neural TTS** | Excellent | $4-5/month | Azure account | 100+ |
| **ElevenLabs** | Best quality | $25-50/month | Expensive | 30+ |

**Strategy (Provider Matrix):**

```
┌─────────────────────────────────────────────────┐
│ USER PLAN         │ TTS PRIMARY  │ FALLBACK      │
├─────────────────────────────────────────────────┤
│ Free/Basic        │ Amazon Polly │ Google TTS    │
│ Premium           │ Google TTS   │ Azure Neural  │
│ Enterprise        │ Azure Neural │ Google TTS    │
└─────────────────────────────────────────────────┘
```

**Automatic Fallback Logic:**
```
Try TTS Primary Provider
  ├─ Success → Save audio + mark status="completed"
  └─ Fail (timeout/rate limit)
     └─ Try TTS Fallback Provider
        ├─ Success → Save audio + log fallback
        └─ Fail
           └─ Retry next day (mark status="pending_retry")
```

**Cost Estimate (per month, 1000 active users):**
- Script generation: ~$500 (GPT-4o Mini)
- TTS (mix of providers): ~$100-200
- **Total: ~$600-700/month for 1000 users = $0.60-0.70 per user/month**

---

### 3. **GENERATION PIPELINE**

**When:** Daily, once per user, at scheduled time (e.g., 3 AM UTC)

**How:**

```
┌─────────────────────────────────────────────────────────┐
│ CELERY BEAT (daily cron, 3 AM UTC)                      │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Management Command: generate_daily_podcasts              │
│ (Async Celery task, NOT blocking)                        │
└──────────────────────────────────────────────────────────┘
           │
           ├─ Get all active users who don't have today's podcast
           │
           ▼
     For each user:
           │
           ├─ Step 1: Collect user data
           │  ├─ UserAbilityProfile (ability scores)
           │  ├─ MemoryStat (review items)
           │  ├─ Recent ActivityEvent (quiz attempts)
           │  ├─ UserPreference (languages, interests)
           │  └─ MatchScore (recommended items)
           │
           ├─ Step 2: Generate script
           │  ├─ Call LLM (GPT-4o Mini or fallback)
           │  ├─ Insert user data into prompt template
           │  └─ Get back 3-6 min podcast script
           │
           ├─ Step 3: Convert to audio
           │  ├─ Call TTS (Google/Amazon/Azure)
           │  ├─ Pass script text
           │  └─ Get back MP3 bytes
           │
           ├─ Step 4: Store
           │  ├─ Save MP3 to cloud storage (AWS S3 or similar)
           │  ├─ Create DailyPodcast record in DB
           │  ├─ Store script, audio URL, metadata
           │  └─ Log generation details
           │
           └─ Step 5: Error handling
              └─ If any step fails, fallback, log, retry tomorrow
```

**File Storage:**
- Store MP3s on **AWS S3** (or similar cloud storage)
- Naming: `podcasts/{user_id}/{date}_{user_id}_podcast.mp3`
- Also store in database `audio_url` field pointing to S3
- Database stores script text directly (small size)

---

### 4. **PODCAST SCRIPT STRUCTURE**

Generated by LLM, personalized for each user. Example outline:

```
[0:00-0:30] GREETING & SUMMARY
"Hi {username}! I'm your Zporta AI coach. 
Today you're at level {ability_level} in {primary_subject}.
You've solved {correct_count} out of {total_count} quizzes correctly this week. 
Great progress! Let's work on one weakness today."

[0:30-2:00] TODAY'S FOCUS (1.5 minutes)
"Your weakest area is {weak_subject}. 
Let me explain why {weak_concept} is important...
[mini-lesson: explain the concept in natural English with examples]"

[2:00-3:30] PRACTICE SECTION (1.5 minutes)
"Now let's try a quick exercise:
Listen to this question: {quiz_question}
Take 30 seconds to think...
The answer is {answer}. Here's why..."

[3:30-4:00] ENCOURAGEMENT (optional, 30 seconds)
"You're doing amazing! 
Your next goal: reach {next_level} by improving {focus_area}.
Let's do it! See you tomorrow."

Total: 4:00 - 4:30 (most common)
Max: 6:00 for premium users
```

---

### 5. **API ENDPOINT & FRONTEND INTEGRATION**

**Backend API Endpoint:**
```
GET /api/dailycast/today/
├─ Requires authentication
├─ Response:
│  {
│    "podcast": {
│      "date": "2025-12-07",
│      "script_text": "Hi {username}...",
│      "audio_url": "https://s3.../podcast.mp3",
│      "duration_seconds": 240,
│      "ai_model_used": "gpt-4o-mini",
│      "tts_provider": "google",
│      "created_at": "2025-12-07T03:15:00Z"
│    },
│    "status": "completed",
│    "error": null
│  }
└─ If no podcast: return 404 or empty with "will be available tomorrow"
```

**Frontend Component:**
```jsx
// /study/dashboard shows this section:
┌─────────────────────────────────────┐
│ 🎧 YOUR DAILY PODCAST               │
├─────────────────────────────────────┤
│ [Play Button] ⏯️  4 min              │
│ Today's Focus: Past Tense Verbs      │
│ [Transcript toggle] View Script ▼    │
│ Generated: Dec 7, 2025 @ 3:15 AM    │
└─────────────────────────────────────┘
```

---

### 6. **DATABASE SCHEMA**

```python
# dailycast/models.py

class DailyPodcast(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Generation'),
        ('script_generated', 'Script Generated'),
        ('audio_generating', 'Audio Converting'),
        ('completed', 'Completed'),
        ('failed', 'Failed (Retrying Tomorrow)'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='daily_podcasts'
    )
    
    date = models.DateField(
        db_index=True,
        help_text="Date of this podcast (unique per user)"
    )
    
    # Content
    script_text = models.TextField(
        help_text="Generated podcast script (3-6 min duration)"
    )
    
    audio_url = models.URLField(
        max_length=500,
        help_text="S3 or similar cloud storage URL to MP3"
    )
    
    duration_seconds = models.PositiveIntegerField(
        default=240,
        help_text="Length of audio in seconds (180-360)"
    )
    
    # Generation details
    ai_model_used = models.CharField(
        max_length=50,
        choices=[
            ('gpt-4o-mini', 'GPT-4o Mini'),
            ('gemini-flash', 'Gemini Flash'),
            ('claude-haiku', 'Claude Haiku'),
            ('template', 'Template (Fallback)'),
        ],
        default='gpt-4o-mini'
    )
    
    tts_provider = models.CharField(
        max_length=50,
        choices=[
            ('google', 'Google Cloud TTS'),
            ('amazon', 'Amazon Polly'),
            ('azure', 'Azure Neural TTS'),
        ],
        default='google'
    )
    
    tts_voice_gender = models.CharField(
        max_length=20,
        choices=[('male', 'Male'), ('female', 'Female')],
        default='female'
    )
    
    # Metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Stores: weak_subjects, ability_score, quiz_count, providers_tried, retry_count"
    )
    
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="If status='failed', stores error details"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    is_active = models.BooleanField(
        default=True,
        help_text="Mark as inactive if user deletes/dislikes"
    )
    
    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['user', '-created_at']),
        ]
```

---

### 7. **SETTINGS & ENVIRONMENT VARIABLES**

Add to `zporta/settings/base.py`:

```python
# ══════════════════════════════════════════════════════════════
# DAILY PODCAST CONFIGURATION
# ══════════════════════════════════════════════════════════════

DAILYCAST_SETTINGS = {
    # LLM Provider (primary → fallback order)
    'LLM_PROVIDERS': [
        {
            'name': 'openai',
            'model': 'gpt-4o-mini',
            'api_key_env': 'OPENAI_API_KEY',
        },
        {
            'name': 'google',
            'model': 'gemini-1.5-flash',
            'api_key_env': 'GOOGLE_API_KEY',
        },
        {
            'name': 'anthropic',
            'model': 'claude-3-5-haiku',
            'api_key_env': 'ANTHROPIC_API_KEY',
        },
    ],
    
    # TTS Provider Matrix (by user plan)
    'TTS_PROVIDERS': {
        'free': {
            'primary': 'amazon',  # Polly
            'fallback': 'google',
        },
        'premium': {
            'primary': 'google',  # Cloud TTS
            'fallback': 'azure',  # Neural
        },
        'enterprise': {
            'primary': 'azure',   # Neural TTS
            'fallback': 'google',
        },
    },
    
    # Audio settings
    'AUDIO_DURATION_MIN': 180,      # 3 minutes
    'AUDIO_DURATION_MAX': 360,      # 6 minutes
    'TTS_VOICE_GENDER': 'female',   # Or 'male'
    'AUDIO_SAMPLE_RATE': 24000,     # Hz
    
    # Storage
    'STORAGE_BACKEND': 'aws_s3',    # Or 'local', 'gcs'
    'AWS_S3_BUCKET': 'zporta-podcasts',
    'PODCAST_EXPIRATION_DAYS': 30,  # Keep MP3 for 30 days
    
    # Generation
    'GENERATION_SCHEDULE': '3 0 * * *',  # Cron: 3 AM UTC daily
    'BATCH_SIZE': 100,               # Process 100 users per task
    'MAX_RETRIES': 3,               # If generation fails, retry 3x
    'TIMEOUT_SECONDS': 300,         # 5 min per user before timeout
}

# Environment Variables (in .env)
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=...
# ANTHROPIC_API_KEY=...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AZURE_TTS_KEY=...
# AZURE_TTS_REGION=...
```

---

## 📋 PROVIDER SELECTION LOGIC (Pseudocode)

```python
def select_llm_provider():
    """Pick best available LLM provider with fallback."""
    for provider in DAILYCAST_SETTINGS['LLM_PROVIDERS']:
        try:
            # Check if API key exists
            api_key = os.getenv(provider['api_key_env'])
            if not api_key:
                continue
            
            # Try to generate with this provider
            script = call_llm(provider['name'], provider['model'], prompt)
            
            # Log which provider was used
            return script, provider['name']
        
        except Exception as e:
            logger.warning(f"LLM provider {provider['name']} failed: {e}")
            continue
    
    # All LLMs failed
    logger.error("All LLM providers failed, using template fallback")
    return generate_template_podcast(user_data), 'template'


def select_tts_provider(user):
    """Pick best TTS for this user plan, with fallback."""
    user_plan = get_user_plan(user)  # 'free', 'premium', 'enterprise'
    tts_config = DAILYCAST_SETTINGS['TTS_PROVIDERS'][user_plan]
    
    providers_to_try = [
        tts_config['primary'],
        tts_config['fallback'],
    ]
    
    for provider_name in providers_to_try:
        try:
            audio_bytes = call_tts(provider_name, script_text)
            return audio_bytes, provider_name
        except Exception as e:
            logger.warning(f"TTS provider {provider_name} failed: {e}")
            continue
    
    # All TTS failed
    logger.error("All TTS providers failed, marking podcast for retry")
    return None, 'all_failed'
```

---

## 📊 IMPLEMENTATION CHECKLIST

### Phase 1: Models & Setup
- [ ] Create `dailycast` Django app
- [ ] Define `DailyPodcast` model
- [ ] Create migrations
- [ ] Register in admin
- [ ] Add settings to `base.py`

### Phase 2: Core Services
- [ ] LLM provider service (with fallback logic)
- [ ] TTS provider service (with fallback logic)
- [ ] S3 storage service (upload/retrieve MP3)
- [ ] Podcast data collector (gather user stats)
- [ ] Script generator (prompt + LLM call)
- [ ] Audio converter (TTS call)

### Phase 3: Celery Task
- [ ] Management command: `generate_daily_podcasts`
- [ ] Batch processing logic (100 users at a time)
- [ ] Error handling & retry logic
- [ ] Celery Beat schedule setup

### Phase 4: API & Frontend
- [ ] API endpoint: `GET /api/dailycast/today/`
- [ ] Serializers for podcast response
- [ ] Frontend component on dashboard
- [ ] Audio player (HTML5 or custom)
- [ ] Optional transcript display

### Phase 5: Testing & Deployment
- [ ] Unit tests for each provider
- [ ] Integration tests (end-to-end generation)
- [ ] Load testing (1000+ users)
- [ ] Cost validation
- [ ] Production deployment

---

## 🔊 LLM PROMPT TEMPLATE

This template will be used with GPT-4o Mini / Gemini Flash to generate scripts.

```
=============================================================================
SYSTEM PROMPT
=============================================================================

You are a friendly, encouraging English language coach creating personalized 
daily podcast scripts for Japanese learners of English. Your goal is to help 
them improve in areas where they struggle while celebrating their progress.

Your tone should be:
- Natural and conversational (like a real teacher)
- Encouraging and motivating
- Clear and easy to understand (appropriate for ESL learners)
- Upbeat and positive

The script must be:
- Exactly 3-6 minutes of spoken content (240-360 seconds)
- Structured in clear sections (greeting, focus, mini-lesson, practice, closing)
- Include natural pauses and emphasis for audio readability
- Free of complex grammar (match learner's level)
- Include some Japanese context if it helps understanding

=============================================================================
USER PROMPT (Parameterized - insert user data here)
=============================================================================

Create a personalized 3-6 minute daily podcast script for {username}.

USER PROFILE:
- Overall English ability level: {ability_level} (Beginner/Intermediate/Advanced/Expert)
- Specific ability scores by subject:
  {ability_by_subject_json}
- Total quizzes completed this week: {quiz_count_this_week}
- Correct answers this week: {correct_count_this_week}
- Success rate: {success_rate}%
- Pronunciation level: {pronunciation_level}
- Main language spoken: Japanese
- Interested subjects: {interested_subjects}

TODAY'S DATA:
- Weakest subject today: {weakest_subject}
- Weakest concept/grammar: {weakest_concept}
- Recommended quiz from feed: {recommended_quiz_title}
- Recommended quiz level: {recommended_quiz_difficulty}
- Items due for spaced-repetition review: {items_to_review}
- Performance trend this month: {performance_trend} ({trend_direction})

TODAY'S PODCAST FOCUS:
Your podcast should focus on improving {weakest_subject}, specifically on 
{weakest_concept}. Include a mini-lesson explaining this concept in a way 
that {username} can understand (their level: {ability_level}).

OPTIONAL PRACTICE:
You may reference the recommended quiz "{recommended_quiz_title}" as part of 
the practice section to encourage {username} to try it.

=============================================================================
OUTPUT FORMAT
=============================================================================

Create the podcast script below. Format it for natural speech:
- Use [PAUSE] for 2-3 second pauses
- Use [EMPHASIS] for words to stress
- Use [SLOWER] for slow/clear pronunciation
- Each section should have natural breaks

Script should include these sections in order:
1. GREETING & PROGRESS SUMMARY (0:00-0:30)
2. TODAY'S FOCUS INTRO (0:30-1:00)
3. MINI-LESSON with explanations and examples (1:00-3:30)
4. PRACTICE SECTION with question & answer (3:30-4:30)
5. ENCOURAGEMENT & CLOSING (4:30-4:50)

Total duration target: 4 minutes (can go up to 6 for premium users)

=============================================================================
EXAMPLE SCRIPT FORMAT
=============================================================================

[0:00]
[EMPHASIS]Hey {username}! [PAUSE]
It's your daily English coach here. [PAUSE]
Great job this week — you solved [EMPHASIS]{correct_count} questions correctly!
That's a {success_rate}% success rate. [PAUSE] You're doing awesome!

[0:30]
Today, let's focus on something that's giving you trouble: [EMPHASIS]{weakest_concept}.
I know you're at {ability_level}, so I'll explain this in a way that makes sense for you.
Ready? Let's go!

[1:00]
[SLOWER]Let me break down {weakest_concept} for you. [PAUSE]
First, think about... [mini-lesson explanation]

... (more explanation sections)

[3:30]
Now, let's practice. Here's a quick question:
[PAUSE] {quiz_question_snippet} [PAUSE]
Take a moment to think about it...
[PAUSE] [PAUSE]
The answer is: {quiz_answer}. Here's why...

[4:30]
[EMPHASIS]You're doing great! [PAUSE]
Keep working on {weakest_subject} and you'll improve fast.
Come back tomorrow for another lesson. [PAUSE]
See you then! Bye!

=============================================================================
IMPORTANT NOTES
=============================================================================

- Write for spoken audio (conversational, not written English)
- Keep sentences short and clear
- Use contractions ("you're", "it's", "don't")
- Avoid complex vocabulary for intermediate learners
- Include real encouragement (mention their actual progress)
- Be specific to their data (use their actual quiz counts, subjects, etc.)
- If performance is declining, gently motivate them to keep going
- If performance is improving, celebrate it!
- Always end on a positive, motivational note

Now, generate the podcast script:
```

---

## 📈 COST & PERFORMANCE ESTIMATES

### Cost per Month (1000 Active Users)

```
LLM Provider:
  GPT-4o Mini:     1000 users × 1 script/day × 400 tokens × $0.15/1M = $600
  
TTS Provider:
  Google TTS:      700 users × 240 sec × $0.004/min = $112 (premium)
  Amazon Polly:    300 users × 240 sec × $0.0008/min = $24 (basic)
  
Storage (S3):
  1000 podcasts × 4MB × 30 days / 1TB = ~$10/month
  
Total Monthly: ~$750 / 1000 users = $0.75/user/month
```

### Performance Targets

```
Script Generation:    15-30 seconds per user
TTS Conversion:       10-20 seconds per user
Database Storage:     <10 minutes for 1000 users
Total Generation Time: ~25-30 minutes for 1000 users (parallel, batched)

API Response Time:    <50ms (precomputed, cached)
Podcast Download:     <2 seconds (CDN-served from S3)
Audio Quality:        128 kbps MP3 (good balance)
```

---

## 🎯 SUCCESS METRICS

Track these to measure podcast impact:

1. **Generation Success Rate**: % of daily podcasts completed without errors
2. **Audio Quality Score**: User ratings or time-to-skip metrics
3. **User Engagement**: % of users who play podcast daily
4. **Learning Impact**: Do podcast listeners have higher quiz completion rates?
5. **Cost Efficiency**: Actual cost/user vs. budget
6. **Provider Reliability**: Uptime % for each LLM/TTS provider

---

## 🔐 DATA PRIVACY & SAFETY

- **User Data:** Don't send email/username to LLM; use hashed ID
- **Script Storage:** Store in DB encrypted if GDPR-required
- **Audio Storage:** Delete MP3 after 30 days (configurable)
- **API Keys:** Use environment variables, never commit to repo
- **Audit Logging:** Log all LLM/TTS calls for compliance

---

## 📝 NEXT STEPS (After This Plan Approval)

1. **Create Django app + models** (Phase 1)
2. **Implement LLM + TTS services** (Phase 2)
3. **Build Celery task** (Phase 3)
4. **Create API endpoint** (Phase 4)
5. **Add frontend component** (Phase 4)
6. **Test & tune costs** (Phase 5)
7. **Deploy to production** (Phase 5)

---

**This plan is ready for implementation. All components are modular and can be swapped 
out if better providers/models become available.**

