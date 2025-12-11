# Interactive Podcast System - Architecture & Flow Diagrams

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React/Vue)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Podcast      │  │ Q&A Form     │  │ Progress     │           │
│  │ Player       │  │              │  │ Dashboard    │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REST API Layer                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST   /api/podcasts/                                      │ │
│  │ GET    /api/podcasts/{id}/                                 │ │
│  │ GET    /api/podcasts/{id}/accuracy-check/                  │ │
│  │ GET    /api/podcasts/{id}/progress/                        │ │
│  │ PUT    /api/podcasts/{id}/answers/                         │ │
│  │ DELETE /api/podcasts/{id}/                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────┬──────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────────┐
│               ViewSet Layer (DRF)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ DailyPodcastViewSet                                        │ │
│  │  • create()       - New podcast                            │ │
│  │  • list()         - User's podcasts                        │ │
│  │  • retrieve()     - Single podcast                         │ │
│  │  • accuracy_check() - Validate content                     │ │
│  │  • progress()     - Track answers                          │ │
│  │  • answers()      - Submit/retrieve answers                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────┬──────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────────┐
│              Services Layer (Business Logic)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ services_interactive.py                                    │ │
│  │  • get_user_enrolled_courses()                             │ │
│  │  • collect_user_stats()                                    │ │
│  │  • build_interactive_qa_script()                           │ │
│  │  • build_multilingual_prompt()                             │ │
│  │  • generate_podcast_script_with_courses()                  │ │
│  │  • pick_polly_voice()                                      │ │
│  │  • synthesize_audio_for_language()                         │ │
│  │  • create_multilingual_podcast_for_user()  [MAIN]          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────┬──────────────────────────────────────────────────────┘
          ↓
┌─────────┴──────────────┬──────────────────┬─────────────────────┐
│                        │                  │                     │
│                        ↓                  ↓                     ↓
│              ┌──────────────────┐  ┌─────────────┐  ┌─────────────┐
│              │  Enrollment      │  │ LLM APIs    │  │ AWS Polly   │
│              │  Model Query     │  │             │  │ (TTS)       │
│              │                  │  │ • OpenAI    │  │             │
│              │ Gets user's      │  │ • Gemini    │  │ Generates   │
│              │ courses from DB  │  │ • Fallback  │  │ audio files │
│              └──────────────────┘  └─────────────┘  └─────────────┘
│
└─────────────────────────┬──────────────────────────────────────┐
                          ↓                                      ↓
                  ┌──────────────────┐              ┌──────────────────┐
                  │ DailyPodcast     │              │ File Storage     │
                  │ Model (Database) │              │ (Local/S3)       │
                  │                  │              │                  │
                  │ • script_text    │              │ • audio_file     │
                  │ • questions      │              │ • audio_file_    │
                  │ • answers        │              │   secondary      │
                  │ • metadata       │              │                  │
                  └──────────────────┘              └──────────────────┘
                          ↑                                      ↑
                          └──────────────┬───────────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │   Admin Interface               │
                        │ /admin/dailycast/               │
                        │ • User selection                │
                        │ • Language dropdowns            │
                        │ • Format radio buttons          │
                        │ • Audio players                 │
                        │ • Q&A display                   │
                        └─────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

### Creating a Podcast

```
START
  │
  ├─→ Admin fills form
  │    ├─ User: Select from dropdown
  │    ├─ Primary Language: en, ja, es, fr, de, it, pt, ru, ko
  │    ├─ Secondary Language: Optional (max 2 total)
  │    └─ Output Format: text, audio, or both
  │
  ├─→ Form submitted to create_multilingual_podcast_for_user()
  │
  ├─→ [1] Get User's Courses
  │    └─→ Enrollment.objects.filter(user=user)
  │        └─→ Extract titles: ["Django", "Python"]
  │
  ├─→ [2] Collect User Stats
  │    ├─→ Get ability level
  │    ├─→ Get weak subjects
  │    └─→ Get recent quiz scores
  │
  ├─→ [3] Build LLM Prompt
  │    ├─→ Include course names: "Since you study Django..."
  │    ├─→ Include ability level
  │    ├─→ Request Q&A format
  │    ├─→ Request ~6 minute duration
  │    └─→ Request multilingual format if needed
  │
  ├─→ [4] Generate Script
  │    ├─→ Try: OpenAI (gpt-4o-mini, timeout=25s)
  │    ├─→ Fallback: Gemini 2.5 Flash Lite
  │    └─→ Fallback: Template with language variations
  │        └─→ Returns: script_text, llm_provider
  │
  ├─→ [5] Generate Audio (if needed)
  │    ├─→ For Primary Language:
  │    │    ├─→ pick_polly_voice(primary_lang)
  │    │    ├─→ synthesize_audio_for_language(script, lang)
  │    │    └─→ audio_file = saved MP3
  │    │
  │    └─→ For Secondary Language (if selected):
  │         ├─→ Translate/extract secondary script
  │         ├─→ pick_polly_voice(secondary_lang)
  │         ├─→ synthesize_audio_for_language(script, lang)
  │         └─→ audio_file_secondary = saved MP3
  │
  ├─→ [6] Save to Database
  │    ├─→ script_text ✓
  │    ├─→ included_courses = ["Django", "Python"] ✓
  │    ├─→ questions_asked = [q1, q2, q3] ✓
  │    ├─→ student_answers = {} (empty) ✓
  │    ├─→ audio_file = path/to/primary.mp3 ✓
  │    ├─→ audio_file_secondary = path/to/secondary.mp3 ✓
  │    ├─→ duration_seconds = 384 (6:24) ✓
  │    ├─→ duration_seconds_secondary = 378 (6:18) ✓
  │    ├─→ status = 'completed' ✓
  │    └─→ primary_language = 'en' ✓
  │
  ├─→ [7] Send Notification
  │    └─→ Email to user: "Your podcast is ready!"
  │
  └─→ END (Return DailyPodcast instance)
```

### Student Using Podcast

```
START
  │
  ├─→ Student opens dashboard
  │    └─→ GET /api/podcasts/ → List their podcasts
  │
  ├─→ Student clicks on podcast
  │    └─→ GET /api/podcasts/{id}/ → Get details
  │         ├─ Script text displayed
  │         └─ Audio player loaded
  │
  ├─→ Student listens/reads
  │    ├─→ Reads script: "You study Django and Python..."
  │    ├─→ Hears greeting in selected language
  │    └─→ Encounters 3 interactive questions
  │
  ├─→ For Each Question:
  │    ├─→ Q1: "What is Django?"
  │    ├─→ [PAUSE] Student thinks
  │    ├─→ Student enters answer in form
  │    │
  │    ├─→ Q2: "How do models work?"
  │    ├─→ [PAUSE] Student thinks
  │    ├─→ Student enters answer
  │    │
  │    └─→ Q3: "Why use Django ORM?"
  │         ├─→ [PAUSE] Student thinks
  │         └─→ Student enters answer
  │
  ├─→ Student submits answers
  │    └─→ PUT /api/podcasts/{id}/answers/
  │         {
  │           "answers": {
  │             "What is Django?": "A Python web framework",
  │             "How do models work?": "Define database schema"
  │             "Why use Django ORM?": "Prevents SQL injection"
  │           }
  │         }
  │
  ├─→ Check Progress
  │    └─→ GET /api/podcasts/{id}/progress/
  │         Returns:
  │         {
  │           "answered_count": 3,
  │           "completion_percentage": 100,
  │           "questions": [...]
  │         }
  │
  └─→ END (Progress tracked, answers saved)
```

---

## 🔄 Multi-Language Flow

```
User Selects:
├─ Primary: en (English)
├─ Secondary: ja (Japanese)
└─ Format: both (text + audio)

            ↓

build_multilingual_prompt()
├─→ Creates single prompt with both languages
│   "Generate a podcast script in two formats:"
│   "[ENGLISH]"
│   "...content for English..."
│   "[JAPANESE]"
│   "...translated content for Japanese..."
└─→ Sends to OpenAI/Gemini

            ↓

Response contains:
├─ English script (for audio & text)
└─ Japanese script (for audio & text)

            ↓

For each language:
├─ pick_polly_voice(language)
│  └─ en → Joanna
│  └─ ja → Mizuki
│
└─ synthesize_audio_for_language(script, language)
   ├─ Call AWS Polly with language-specific voice
   ├─ Generate MP3 with 44.1kHz sample rate
   └─ Save: audio_file (English), audio_file_secondary (Japanese)

            ↓

Result in Database:
├─ script_text: "English version..." (can render both)
├─ primary_language: "en"
├─ secondary_language: "ja"
├─ audio_file: audio/en_podcast.mp3
├─ audio_file_secondary: audio/ja_podcast.mp3
├─ duration_seconds: 384 (6:24 English)
└─ duration_seconds_secondary: 378 (6:18 Japanese)
```

---

## 🎯 Output Format Variations

```
Format Selection: "text"
├─→ Generate script text only
├─→ NO audio synthesis (saves time & cost)
├─→ Student reads the script
└─→ Status: "completed" in 2-5 seconds

Format Selection: "audio"
├─→ Generate script (needed for synthesis)
├─→ Synthesize audio
├─→ Save audio file
├─→ Delete or don't save script_text
├─→ Student listens to audio only
└─→ Status: "completed" in 5-15 seconds

Format Selection: "both"
├─→ Generate script text
├─→ Synthesize audio
├─→ Save both script_text AND audio_file
├─→ Student can read AND listen
└─→ Status: "completed" in 8-20 seconds
```

---

## 🔐 Permission Flow

```
API Request: POST /api/podcasts/
│
├─→ Authentication Check
│    └─ Is user logged in?
│       ├─ NO → 401 Unauthorized
│       └─ YES → Continue
│
├─→ Authorization Check
│    └─ Is user staff (admin)?
│       ├─ YES → Can create for any user → Continue
│       └─ NO → Can only create for themselves
│             └─ if request.user.id != podcast.user.id → 403 Forbidden
│
├─→ Create Podcast
│    └─ DailyPodcast.objects.create(...)
│
└─→ Return: 201 Created + podcast data

API Request: GET /api/podcasts/{id}/progress/
│
├─→ Authentication Check
│    └─ Is user logged in? → YES
│
├─→ Get Podcast
│    └─ DailyPodcast.objects.get(id=id)
│
├─→ Authorization Check
│    └─ Is podcast.user == request.user OR is_staff?
│       ├─ YES → Return progress data
│       └─ NO → 403 Forbidden
│
└─→ Return: 200 OK + progress data
```

---

## 📈 Async Task Flow

```
Admin clicks Save
    │
    ├─→ Sync: Podcast created (status="pending")
    │
    └─→ Queue: generate_podcast_async.delay(...)
         │
         ├─→ [Celery Worker in Background]
         │    │
         │    ├─→ Create service call
         │    ├─→ Generate script + audio
         │    └─→ Update: status="completed"
         │        OR status="failed" + error_message
         │
         └─→ Send: Email notification
              └─→ "Your podcast is ready!"
```

---

## 🗄️ Database Schema

```
┌─────────────────────────────────────────────────────┐
│              dailycast_dailypodcast                  │
├─────────────────────────────────────────────────────┤
│ id                      INTEGER PRIMARY KEY         │
│ user_id                 INTEGER FK → auth_user     │
│                                                      │
│ PRIMARY PODCAST DATA (OLD - Still supported)        │
│ language                VARCHAR(5)                   │
│ script_text             TEXT                         │
│ audio_file              FILE (path)                  │
│ duration_seconds        INTEGER                      │
│ llm_provider            VARCHAR(20)                  │
│ tts_provider            VARCHAR(20)                  │
│ status                  VARCHAR(20)                  │
│ error_message           TEXT                         │
│                                                      │
│ INTERACTIVE FEATURES (NEW)                          │
│ primary_language        VARCHAR(5)      ← NEW       │
│ secondary_language      VARCHAR(5)      ← NEW       │
│ output_format           VARCHAR(10)     ← NEW       │
│ included_courses        JSON            ← NEW       │
│ questions_asked         JSON            ← NEW       │
│ student_answers         JSON            ← NEW       │
│ audio_file_secondary    FILE            ← NEW       │
│ duration_seconds_secondary INTEGER      ← NEW       │
│                                                      │
│ TIMESTAMPS                                           │
│ created_at              DATETIME                     │
│ updated_at              DATETIME                     │
├─────────────────────────────────────────────────────┤
│ INDEXES                                              │
│ idx_user_date (user_id, created_at)   ← NEW        │
│ idx_status_date (status, created_at)  ← NEW        │
└─────────────────────────────────────────────────────┘
```

---

## 🔗 Integration Points

### Enrollment Model Integration

```
User
  ├─→ has many Enrollments
  │    └─→ Enrollment
  │         ├─ user FK
  │         ├─ content_type (GenericForeignKey)
  │         └─ object_id (GenericForeignKey)
  │
  └─→ has many DailyPodcasts
       └─→ DailyPodcast
            ├─ user FK
            ├─ primary_language
            ├─ secondary_language
            └─ included_courses (JSON list of course titles)
                ↑
                └─ Populated by querying Enrollment.objects.filter(user=user)
```

### Course Selection Flow

```
1. create_multilingual_podcast_for_user(user, ...)
   │
2. get_user_enrolled_courses(user)
   ├─→ SELECT * FROM enrollment_enrollment WHERE user_id = ?
   │
3. For each enrollment:
   ├─→ Get content_object (the Course)
   ├─→ Extract course.title
   └─→ Add to list: ["Django Fundamentals", "Python Advanced"]

4. Mention in LLM prompt:
   └─→ "Since you study Django Fundamentals and Python Advanced, today's podcast covers..."

5. Save to database:
   └─→ podcast.included_courses = ["Django Fundamentals", "Python Advanced"]
```

---

## 🚀 Deployment Architecture

```
Production Setup:

┌──────────────────────────────────────────────────┐
│  Nginx (Reverse Proxy, Load Balancer)           │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ Gunicorn/uWSGI (Application Server x3)  │  │
│  │  • Handles HTTP requests                │  │
│  │  • Calls DailyPodcastViewSet             │  │
│  │  • Returns JSON responses                │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ Celery Worker Nodes (Background Tasks)  │  │
│  │  • generate_podcast_async()              │  │
│  │  • send_podcast_notification_email()     │  │
│  │  • cleanup_old_podcasts()                │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ Celery Beat (Task Scheduler)             │  │
│  │  • Schedules cleanup every night         │  │
│  │  • Schedules daily podcast generation    │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
         │                    │
         ├────────────────────┼─────────────────────┐
         ↓                    ↓                     ↓
    PostgreSQL/         Redis (Broker)      AWS S3 (Files)
    MySQL              Message Queue        Audio Storage
    (Database)         (Task Queue)         (Scalable)
```

---

## 📊 API Response Time Characteristics

```
Endpoint                          | Time    | Operation
─────────────────────────────────┼─────────┼──────────────────────
POST /api/podcasts/              | 10-20s  | Sync generation
GET  /api/podcasts/              | <100ms  | DB query (indexed)
GET  /api/podcasts/{id}/         | <50ms   | Single row fetch
GET  /api/podcasts/{id}/progress/| <100ms  | Calculate percentages
PUT  /api/podcasts/{id}/answers/ | <200ms  | Update JSON field
GET  /api/podcasts/{id}/accuracy-check/| <200ms | Validate fields
```

---

## 🎓 Complete Course Mention Flow

```
User: john_doe
Enrollment:
├─ Django Fundamentals (id: 5)
├─ Python Advanced (id: 12)
└─ Database Design (id: 8)

            ↓

get_user_enrolled_courses(john_doe)

            ↓

Query: SELECT e.*, c.title
       FROM enrollment
       WHERE user_id = john_doe

            ↓

Results:
├─ Enrollment(course="Django Fundamentals", enrolled: 2023-09)
├─ Enrollment(course="Python Advanced", enrolled: 2023-11)
└─ Enrollment(course="Database Design", enrolled: 2023-12)

            ↓

Extract titles: ["Django Fundamentals", "Python Advanced", "Database Design"]

            ↓

Build Prompt:
"Generate a podcast for john_doe who is studying:
- Django Fundamentals
- Python Advanced
- Database Design

Focus on connections between these courses..."

            ↓

OpenAI Response:
"Hello John! You're progressing well in Django Fundamentals.
Today we'll connect your Django knowledge with the Database Design
principles from your other course. In Django Fundamentals, you learned
models work with databases. Let's extend that..."

            ↓

Saved as: podcast.included_courses = ["Django Fundamentals", "Python Advanced", "Database Design"]

            ↓

Student sees:
"Your podcast mentions your courses:
✓ Django Fundamentals
✓ Python Advanced
✓ Database Design"
```

---

## Summary of Diagrams

✅ **System Architecture** - Overall structure
✅ **Data Flow** - Creating & using podcasts  
✅ **Multi-Language** - Bilingual podcast generation
✅ **Output Formats** - Text/audio/both variations
✅ **Permission Flow** - Authentication & authorization
✅ **Async Tasks** - Background processing
✅ **Database Schema** - Table structure
✅ **Integration** - Enrollment model connection
✅ **Deployment** - Production setup
✅ **Performance** - API response times
✅ **Course Mentions** - End-to-end example

All components working together for interactive, personalized, multilingual learning podcasts!
