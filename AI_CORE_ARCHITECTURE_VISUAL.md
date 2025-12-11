# AI Core System Architecture - Visual Guide

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZPORTA ACADEMY                            │
│                     (Existing Features)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ALL EXISTING FEATURES INTACT
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────┐            ┌─────────────┐         ┌──────────────┐
│ User    │            │   LLM       │         │   Podcast    │
│Category │            │  Dropdown   │         │  Generation  │
│System   │            │  (AJAX)     │         │   Service    │
└─────────┘            └─────────────┘         └──────────────┘
    │                         │                         │
    │                         │                         │
    │                         ▼                         │
    │                  ┌─────────────┐                 │
    │                  │  AI CORE    │                 │
    │                  │  (NEW!)     │                 │
    │                  │             │                 │
    │                  │  Services:  │◄────────────────┘
    │                  │  - generate_│
    │                  │    text()   │
    │                  │  - generate_│
    │                  │    audio()  │
    │                  └─────────────┘
    │                         │
    │                         │
    │      ┌──────────────────┼──────────────────┐
    │      │                  │                  │
    │      ▼                  ▼                  ▼
    │  ┌──────────┐   ┌────────────┐   ┌────────────┐
    │  │AiMemory  │   │AiProvider  │   │AiUsageLog  │
    │  │(Cache)   │   │  Config    │   │(Tracking)  │
    │  └──────────┘   └────────────┘   └────────────┘
    │      │                  │                  │
    │      │                  │                  │
    └──────┼──────────────────┼──────────────────┘
           │                  │
           │                  ▼
           │          ┌──────────────┐
           │          │  AI Providers│
           │          │  - OpenAI    │
           │          │  - Gemini    │
           │          │  - Claude    │
           │          │  - ElevenLabs│
           │          │  - Local Mdl │
           │          └──────────────┘
           │                  │
           ▼                  ▼
    ┌──────────────────────────────┐
    │      Training Data           │
    │   (Future Fine-Tuning)       │
    └──────────────────────────────┘
```

---

## 🔄 Request Flow (Text Generation)

### Scenario 1: First Request (Cache Miss)

```
1. User requests podcast
   │
   ▼
2. dailycast/services.py
   │
   ├─► OLD PATH (Still works!)
   │   └─► Direct OpenAI call
   │       └─► Generate script
   │           └─► Return to user
   │
   └─► NEW PATH (Optional enhancement)
       │
       ▼
3. ai_core/services.py::generate_text()
   │
   ├─► Check AiMemory (prompt_hash lookup)
   │   └─► NOT FOUND (cache miss)
   │
   ├─► Select AI Model
   │   ├─► Auto mode: Query AiProviderConfig
   │   │   └─► Pick cheapest in 'normal' tier
   │   │       └─► openai/gpt-4o-mini ($0.15/1M)
   │   │
   │   └─► Manual mode: Use user's choice
   │       └─► From UserCategoryConfig dropdown
   │
   ├─► Call AI Provider
   │   └─► OpenAI API
   │       └─► Response: "Welcome to lesson 5..."
   │       └─► Cost: $0.05, Latency: 850ms
   │
   ├─► Save to AiMemory
   │   └─► prompt_hash: abc123def456...
   │   └─► generated_text: "Welcome to..."
   │   └─► provider: openai, model: gpt-4o-mini
   │   └─► cost_estimate: 0.05, tokens: 1234
   │
   ├─► Log to AiUsageLog
   │   └─► cache_hit: False
   │   └─► cost: $0.05
   │   └─► user: alex@example.com
   │
   └─► Return: ("Welcome to...", "openai")
```

### Scenario 2: Second Request (Cache Hit!)

```
1. User requests SAME podcast
   │
   ▼
2. ai_core/services.py::generate_text()
   │
   ├─► Check AiMemory (prompt_hash lookup)
   │   └─► FOUND! (cache hit)
   │       ├─► prompt_hash: abc123def456...
   │       ├─► generated_text: "Welcome to..."
   │       ├─► is_verified_good: True
   │       └─► usage_count: 1 → 2
   │
   ├─► Skip AI API call (cost: $0!)
   │
   ├─► Log to AiUsageLog
   │   └─► cache_hit: True
   │   └─► cost: $0.00
   │   └─► latency_ms: 5 (instant!)
   │
   └─► Return: ("Welcome to...", "openai")
       │
       └─► Total savings: $0.05 per cache hit!
```

**Result**: 
- First request: $0.05 (850ms)
- Second request: $0.00 (5ms)
- **Savings: 100% cost, 99% latency!**

---

## 🎵 Request Flow (Audio Generation)

### Scenario 1: First TTS Request (Cache Miss)

```
1. User requests audio: "Welcome to lesson 5"
   │
   ▼
2. ai_core/services.py::generate_audio()
   │
   ├─► Compute text_hash
   │   └─► hash("Welcome to lesson 5" + "ja" + "Lily")
   │       └─► text_hash: xyz789abc123...
   │
   ├─► Check AiMemory (audio cache)
   │   └─► NOT FOUND (cache miss)
   │
   ├─► Select TTS Provider
   │   ├─► Auto mode: Check for API keys
   │   │   └─► ElevenLabs key exists → Use ElevenLabs
   │   │
   │   └─► Manual mode: From UserCategoryConfig
   │
   ├─► Call TTS Provider
   │   └─► ElevenLabs API
   │       └─► Response: MP3 audio bytes (2.3MB)
   │       └─► Cost: $0.003, Latency: 1500ms
   │
   ├─► Save to AiMemory
   │   └─► prompt_hash: xyz789abc123...
   │   └─► request_type: tts_audio
   │   └─► generated_audio_file: xyz789abc.mp3
   │   └─► audio_metadata: {language: ja, voice: Lily}
   │   └─► provider: elevenlabs
   │
   ├─► Log to AiUsageLog
   │   └─► cache_hit: False
   │   └─► cost: $0.003
   │
   └─► Return: (audio_bytes, "elevenlabs")
```

### Scenario 2: Second TTS Request (Cache Hit!)

```
1. User requests SAME audio
   │
   ▼
2. ai_core/services.py::generate_audio()
   │
   ├─► Compute text_hash: xyz789abc123...
   │
   ├─► Check AiMemory (audio cache)
   │   └─► FOUND! (cache hit)
   │       ├─► generated_audio_file: xyz789abc.mp3
   │       ├─► Read file from disk
   │       └─► usage_count: 1 → 2
   │
   ├─► Skip TTS API call (cost: $0!)
   │
   ├─► Log to AiUsageLog
   │   └─► cache_hit: True
   │   └─► cost: $0.00
   │   └─► latency_ms: 3 (instant!)
   │
   └─► Return: (audio_bytes, "elevenlabs")
```

**Result**:
- First request: $0.003 (1500ms)
- Second request: $0.00 (3ms)
- **Savings: 100% cost, 99.8% latency!**

---

## 📊 Cost Tracking Flow

```
Every AI Request
    │
    ▼
1. generate_text() or generate_audio()
    │
    ├─► Before API call: Check cache
    │   └─► Cache hit? Log and return
    │
    ├─► API call: Track start time
    │   └─► Call provider (OpenAI, Gemini, etc.)
    │       └─► Get response + tokens used
    │
    ├─► Calculate cost
    │   └─► tokens * cost_per_million / 1000000
    │       └─► Example: 1234 * $0.15 / 1M = $0.00019
    │
    ├─► Save to AiMemory
    │   └─► Cache for future reuse
    │
    └─► Log to AiUsageLog
        └─► Fields:
            ├─► request_type: podcast_script
            ├─► endpoint: dailycast.services.create_podcast
            ├─► user: alex@example.com
            ├─► provider: openai
            ├─► model: gpt-4o-mini
            ├─► tokens_used: 1234
            ├─► cost_estimate: 0.00019
            ├─► latency_ms: 850
            ├─► cache_hit: False
            ├─► success: True
            └─► timestamp: 2025-12-10 15:30:45
```

---

## 🎓 Training Data Collection Flow

```
1. Content Generated (via AI Core)
   │
   ▼
2. Saved to AiMemory
   │
   ├─► generated_text: "Welcome to lesson..."
   ├─► is_verified_good: False (default)
   ├─► use_for_training: False (default)
   └─► user_rating: null
   │
   ▼
3. Admin Reviews in Django Admin
   │
   ├─► Opens: /admin/ai_core/aimemory/
   │
   ├─► Filters by:
   │   └─► request_type=podcast_script
   │   └─► usage_count > 10 (popular content)
   │
   ├─► Reads generated content
   │
   └─► If GOOD:
       └─► Action: "✓ Mark as Verified (Training)"
           ├─► Sets: is_verified_good = True
           ├─► Sets: use_for_training = True
           └─► Creates: AiTrainingData entry
   │
   ▼
4. After 1,000+ Verified Examples
   │
   ├─► Export: python manage.py export_training_data
   │   └─► Output: training_data.jsonl
   │       └─► Format: [
   │               {"prompt": "...", "completion": "...", "tags": [...]},
   │               ...
   │           ]
   │
   ├─► Fine-Tune Model
   │   └─► OpenAI: openai api fine_tunes.create \
   │       --training_file training_data.jsonl \
   │       --model gpt-4o-mini
   │   └─► Cost: ~$50-100 one-time
   │   └─► Result: ft:gpt-4o-mini:zporta:abc123
   │
   ├─► Add to AiProviderConfig
   │   └─► provider: local_small_model
   │   └─► model_name: zporta_v1
   │   └─► tier: cheap
   │   └─► is_default: True
   │
   └─► Future Requests
       └─► Auto mode now uses zporta_v1 (near-zero cost!)
       └─► Falls back to external if quality drops
```

---

## 🔀 Auto vs Manual Selection

### Auto Mode (Recommended)

```
User Request
    │
    ▼
generate_text(selection_mode='auto')
    │
    ├─► Determine Content Tier
    │   ├─► Simple quiz → cheap tier
    │   ├─► Podcast script → normal tier
    │   └─► Complex analysis → premium tier
    │
    ├─► Query AiProviderConfig
    │   └─► SELECT * FROM ai_provider_config
    │       WHERE tier = 'normal'
    │       AND is_active = True
    │       ORDER BY cost_per_million_tokens ASC, quality_score DESC
    │       LIMIT 1
    │
    └─► Result: openai/gpt-4o-mini ($0.15/1M, quality: 0.85)
```

### Manual Mode (Power Users)

```
User/Admin selects in dropdown:
    ├─► Provider: OpenAI
    └─► Model: gpt-4o
    │
    ▼
generate_text(
    provider='openai',
    model='gpt-4o',
    selection_mode='manual'
)
    │
    └─► Uses exactly what user specified
        └─► Ignores auto-selection logic
        └─► Still logs cost and caches result
```

---

## 📈 Cost Savings Over Time

```
Month 1: No AI Core
────────────────────────────────────────────
10,000 requests × $0.05 avg = $500
Cache hit rate: 0%
Savings: $0

Month 2: AI Core Enabled (Caching Only)
────────────────────────────────────────────
10,000 requests:
  - 8,000 cache hits (80%) → $0
  - 2,000 API calls → $100
Cache hit rate: 80%
Savings: $400 (80%)

Month 4: + Fine-Tuned Model (zporta_v1)
────────────────────────────────────────────
10,000 requests:
  - 8,000 cache hits (80%) → $0
  - 2,000 API calls:
      - 1,500 use zporta_v1 (75%) → $15
      - 500 use external (25%) → $25
Cache hit rate: 80%
Local model usage: 75% of non-cached
Savings: $460 (92%)

Year 1: Mature System
────────────────────────────────────────────
10,000 requests/month:
  - 9,000 cache hits (90%) → $0
  - 1,000 API calls:
      - 900 use zporta_v1 → $9
      - 100 use external → $5
Total: $14/month (was $500/month)
Savings: $486/month (97%)
Annual savings: $5,832
```

---

## 🎯 Key Decision Points

### When to Use Cache?
- ✅ **Always check** (default behavior)
- ❌ **Skip** (`force_refresh=True`) only when:
  - User explicitly requests "regenerate"
  - Content is time-sensitive (news, updates)
  - Testing new prompts

### When to Use Auto Mode?
- ✅ **Default** for all routine content
- ✅ When cost efficiency matters
- ✅ For most users (they don't care about model)

### When to Use Manual Mode?
- ✅ Power users who know models
- ✅ A/B testing different providers
- ✅ Debugging quality issues
- ✅ Special requirements (e.g., "must use Claude")

### When to Mark for Training?
- ✅ Content rated 4.5+ stars by users
- ✅ Admin manually verified as high quality
- ✅ Representative of "Zporta style"
- ✅ No personal/sensitive data

### When to Fine-Tune?
- ✅ After 1,000+ verified examples
- ✅ Every 3-6 months (incremental)
- ✅ When cost savings justify $50-100 training cost

---

## 🚀 Summary

**Data Flow**: Request → Cache Check → AI Provider → Save Cache → Log Usage

**Cost Flow**: Track every request → Monitor dashboard → Identify savings

**Training Flow**: Generate → Verify → Collect → Fine-Tune → Deploy

**Integration**: Coexists with old code → Gradually replace → No breaking changes

**Result**: 80%+ cost savings + Training data for free + Clean unified API

🎉 **This is how modern AI systems should work!**
