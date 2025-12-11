# Teacher Content Configuration - System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR DJANGO ADMIN                          │
│            (http://localhost:8000/admin/)                       │
│                                                                 │
│  TEACHER CONTENT CONFIGURATION                                 │
│  ├─ 🟢 Enabled                                                 │
│  ├─ 🌐 Basic Settings (language, format)                       │
│  ├─ 🤖 LLM Settings (OpenAI/Gemini/Template)                   │
│  ├─ 🎵 TTS Settings (ElevenLabs/Google/OpenAI)                 │
│  ├─ 📝 Script Generation (word limits, questions)              │
│  ├─ 💰 Pricing (cost per generation)                           │
│  ├─ ⏱️ Cooldown (rate limiting)                                │
│  ├─ 🌍 Bilingual (EN+JA support)                               │
│  └─ 🔍 Logging & Debug                                         │
│                                                                 │
│                    [ SAVE BUTTON ]                             │
│                         ↓                                       │
│                    DATABASE                                     │
│             (TeacherContentConfig table)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                              ↓
      ┌─────────────────────────────────────────────┐
      │   YOUR CODE READS CONFIG                    │
      │   (No hardcoded values!)                    │
      │                                             │
      │  from dailycast.config_helpers import ...  │
      │  provider = get_tts_provider()              │
      │  model = get_openai_model()                 │
      │  limit = get_script_word_limit()            │
      └─────────────────────────────────────────────┘
                              ↓
                              ↓
      ┌─────────────────────────────────────────────┐
      │   TEACHER CONTENT GENERATION                │
      │   Uses your custom settings!                │
      │                                             │
      │  ✓ Your chosen LLM provider                 │
      │  ✓ Your chosen TTS provider                 │
      │  ✓ Your word limits                         │
      │  ✓ Your pricing model                       │
      │  ✓ Your rate limits                         │
      │  ✓ Your bilingual settings                  │
      └─────────────────────────────────────────────┘
```

---

## Data Flow

```
ADMIN CHANGES SETTING
        ↓
SAVES TO DATABASE
        ↓
APPLICATION READS CONFIG
        ↓
USES IN GENERATION
        ↓
INSTANT EFFECT ⚡
```

---

## Configuration Hierarchy

```
TeacherContentConfig (Database)
│
├─ LLM Configuration
│  ├─ Provider (openai/gemini/template)
│  ├─ OpenAI Model (gpt-4, gpt-4o-mini, etc)
│  └─ Gemini Model (gemini-2.0-pro-exp, etc)
│
├─ TTS Configuration
│  ├─ Provider (elevenlabs/google/openai/polly)
│  ├─ Fallback Chain (what to try if primary fails)
│  ├─ Speaking Rate (0.5 = slow, 1.0 = normal, 1.5 = fast)
│  ├─ Pitch (-20 to +20)
│  └─ Volume Gain (-16 to +16)
│
├─ Voice Selection
│  └─ Language → Voice ID Map
│
├─ Script Generation
│  ├─ Word Limit (normal)
│  ├─ Word Limit (short)
│  ├─ Include Questions (yes/no)
│  ├─ Number of Questions
│  └─ Include Quote (yes/no)
│
├─ Prompts
│  ├─ System Role
│  ├─ Script Intro
│  └─ Tone Guide
│
├─ Rate Limiting
│  ├─ Cooldown Hours
│  ├─ Max Per Day
│  └─ Test User Cooldown
│
├─ Pricing
│  ├─ Cost Per Generation
│  └─ Enable Credit System
│
├─ Bilingual
│  ├─ Support Bilingual
│  ├─ Default Pair
│  └─ Audio Stitch
│
└─ Utilities
   ├─ Verbose Logging
   └─ Debug Mode
```

---

## Code Integration Pattern

### Before (Hardcoded)

```python
# services_interactive.py
def synthesize_audio_for_language(script_text, language):
    provider = "elevenlabs"  # ❌ Hardcoded!
    rate = 1.0               # ❌ Hardcoded!

    audio = tts_service.synthesize(
        text=script_text,
        provider=provider,
        speaking_rate=rate
    )
```

### After (Config-Driven)

```python
# services_interactive.py
from dailycast.config_helpers import (
    get_tts_provider,
    get_tts_speaking_rate,
)

def synthesize_audio_for_language(script_text, language):
    provider = get_tts_provider()      # ✅ From config!
    rate = get_tts_speaking_rate()     # ✅ From config!

    audio = tts_service.synthesize(
        text=script_text,
        provider=provider,
        speaking_rate=rate
    )
```

---

## Configuration Change Impact

### Scenario: Change TTS Provider

**In Admin Dashboard:**

1. Change `default_tts_provider` from "elevenlabs" to "google"
2. Click Save

**Immediate Effect:**

- Next generation uses Google TTS
- No code changes
- No server restart needed
- No new deployment

**Code stays the same:**

```python
provider = get_tts_provider()  # Now returns "google" automatically!
```

---

## Helper Functions Library

```
config_helpers.py (30+ functions)
│
├─ LLM Functions
│  ├─ get_llm_provider()
│  ├─ get_openai_model()
│  └─ get_gemini_model()
│
├─ TTS Functions
│  ├─ get_tts_provider()
│  ├─ get_tts_fallback_chain()
│  ├─ get_tts_speaking_rate()
│  ├─ get_tts_pitch()
│  ├─ get_tts_volume_gain()
│  └─ get_voice_for_language(lang)
│
├─ Script Generation Functions
│  ├─ get_script_word_limit(is_short)
│  ├─ should_include_questions()
│  ├─ get_num_questions()
│  └─ should_include_quote()
│
├─ Cooldown Functions
│  ├─ get_cooldown_hours()
│  └─ get_max_generations_per_day()
│
├─ Pricing Functions
│  ├─ get_cost_per_generation()
│  └─ is_credit_system_enabled()
│
├─ Bilingual Functions
│  ├─ is_bilingual_supported()
│  ├─ get_bilingual_default_pair()
│  └─ should_stitch_bilingual_audio()
│
├─ Utility Functions
│  ├─ is_enabled()
│  ├─ is_verbose_logging_enabled()
│  ├─ is_debug_mode_enabled()
│  └─ get_full_config_dict()
│
└─ Internal
   └─ get_config()  # Gets singleton instance
```

---

## Admin Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  Django Administration > Teacher Content Configuration   │
│  (Edit)                                                  │
└──────────────────────────────────────────────────────────┘

┌─────────────────┐
│ 🟢 ENABLED      │
│ ☑ Enabled       │
└─────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🌐 BASIC SETTINGS                                       │
│ Default Language: [en ▼]                                │
│ Default Output Format: [both ▼]                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🤖 LLM PROVIDER SETTINGS                                │
│ Default LLM Provider: [openai ▼]                        │
│ OpenAI Model: [gpt-4o-mini___]                          │
│ Gemini Model: [gemini-2.0-pro-exp___]                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🎵 TTS PROVIDER SETTINGS                                │
│ Default TTS Provider: [elevenlabs ▼]                    │
│ TTS Fallback Chain: ["elevenlabs","google","openai"]    │
│ TTS Speaking Rate: [1.0___]                             │
│ TTS Pitch: [0.0___]                                     │
│ TTS Volume Gain: [0.0___]                               │
└─────────────────────────────────────────────────────────┘

[More sections below... see admin for full UI]

┌──────────────────────────────────────────────────────────┐
│                      [ Save ]  [ Save and add another ]  │
└──────────────────────────────────────────────────────────┘
```

---

## Migration & Database

### Migration Steps

```bash
1. python manage.py makemigrations dailycast
   → Creates 0005_alter_dailypodcast_tts_provider_teachercontentconfig.py

2. python manage.py migrate dailycast
   → Creates TeacherContentConfig table in database
   → ✅ ALREADY DONE

3. Access admin:
   → http://localhost:8000/admin/
   → Create default config entry
```

### Database Schema

```
TeacherContentConfig Table
├─ id (PrimaryKey)
├─ enabled (Boolean)
├─ default_language (CharField)
├─ default_output_format (CharField)
├─ default_llm_provider (CharField)
├─ openai_model (CharField)
├─ gemini_model (CharField)
├─ default_tts_provider (CharField)
├─ tts_fallback_chain (JSONField)
├─ tts_speaking_rate (FloatField)
├─ tts_pitch (FloatField)
├─ tts_volume_gain (FloatField)
├─ voice_map_json (JSONField)
├─ script_word_limit_normal (IntegerField)
├─ script_word_limit_short (IntegerField)
├─ script_include_questions (Boolean)
├─ num_questions_per_script (IntegerField)
├─ include_motivational_quote (Boolean)
├─ prompt_system_role (TextField)
├─ prompt_script_intro (TextField)
├─ prompt_tone_guide (TextField)
├─ cooldown_hours (IntegerField)
├─ test_user_cooldown_enabled (Boolean)
├─ max_generations_per_day (IntegerField)
├─ cost_per_generation (DecimalField)
├─ enable_credit_system (Boolean)
├─ support_bilingual (Boolean)
├─ bilingual_default_pair (CharField)
├─ bilingual_audio_stitch (Boolean)
├─ verbose_logging (Boolean)
├─ debug_mode (Boolean)
├─ created_at (DateTimeField)
├─ updated_at (DateTimeField)
└─ last_modified_by (ForeignKey to User)
```

---

## Workflow Diagram

```
                    START
                      ↓

    ┌─────────────────────────────────┐
    │  User Changes Setting in Admin   │
    │  (e.g., TTS Provider)            │
    └──────────────┬────────────────────┘
                   ↓
    ┌─────────────────────────────────┐
    │  Admin Saves to Database         │
    │  (TeacherContentConfig)          │
    └──────────────┬────────────────────┘
                   ↓
    ┌─────────────────────────────────┐
    │  User Generates Teacher Content  │
    │  (Triggers generation flow)      │
    └──────────────┬────────────────────┘
                   ↓
    ┌─────────────────────────────────┐
    │  Code Reads Config               │
    │  provider = get_tts_provider()   │
    └──────────────┬────────────────────┘
                   ↓
    ┌─────────────────────────────────┐
    │  Generation Uses Config Setting  │
    │  (Uses new TTS provider)         │
    └──────────────┬────────────────────┘
                   ↓
    ┌─────────────────────────────────┐
    │  Teacher Content Generated       │
    │  (With custom settings)          │
    └──────────────┬────────────────────┘
                   ↓
                   END
```

---

## Deployment Checklist

- ✅ Model created (TeacherContentConfig)
- ✅ Admin interface created
- ✅ Helper functions created
- ✅ Migration created and applied
- 🔄 Wire code to use helpers (next)
- 🔄 Test with actual config
- 🚀 Deploy to production
- 🚀 Configure via admin
- 🚀 Start using custom settings!

---

## Key Points

1. **Singleton Pattern**: Only one TeacherContentConfig instance
2. **Admin UI**: Beautiful, organized interface
3. **Helper Functions**: 30+ functions for easy access
4. **Zero Code Changes**: Just configure and save
5. **Instant Effect**: Changes apply immediately
6. **Audit Trail**: Track who changed what
7. **Flexible**: Support any provider/language
8. **Future-Proof**: Easy to add new settings

---

## Visual Summary

```
      ADMIN DASHBOARD
            ↓
         [SAVE]
            ↓
       DATABASE
            ↓
      YOUR CODE
       (reads config)
            ↓
    GENERATION USES
     CUSTOM SETTINGS
            ↓
    INSTANT EFFECT ⚡
```

**No code changes needed!**
