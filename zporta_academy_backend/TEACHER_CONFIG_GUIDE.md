# Teacher Content Configuration Guide

## Overview

All teacher/content generation settings are now **fully customizable from the Django admin dashboard** without touching code. This allows you to:

- ✅ Change LLM providers (OpenAI, Gemini, Template)
- ✅ Switch TTS providers (ElevenLabs, Google, OpenAI)
- ✅ Adjust script length targets (normal vs short)
- ✅ Configure cooldowns and quotas
- ✅ Set up pricing/credits
- ✅ Customize prompts and tone
- ✅ Enable/disable bilingual support
- ✅ Set up voice preferences per language

## Accessing the Config Dashboard

1. Go to **Django Admin** → `http://your-site/admin/`
2. Find **"Teacher Content Configuration"** in the left sidebar
3. Click it to open the master config panel
4. Modify any settings and click **Save**

Changes apply **instantly** to all future generations.

---

## Configuration Sections

### 🟢 ENABLED
- `enabled`: Toggle teacher content generation on/off globally

### 🌐 BASIC SETTINGS
- `default_language`: Default language (en, ja, es, fr, de, etc)
- `default_output_format`: Output format (text, audio, or both)

### 🤖 LLM PROVIDER SETTINGS

**Choose which AI generates teacher scripts:**

- `default_llm_provider`: Select provider
  - `template`: Use hardcoded templates (no LLM cost)
  - `openai`: Use OpenAI GPT models
  - `gemini`: Use Google Gemini

- `openai_model`: Which OpenAI model to use
  - `gpt-4o-mini` (recommended, cheaper)
  - `gpt-4` (most capable, more expensive)
  - `gpt-3.5-turbo` (fastest, lower quality)

- `gemini_model`: Which Gemini model
  - `gemini-2.0-pro-exp` (latest)
  - `gemini-1.5-pro`

**Example: Use cheaper GPT-4o-mini**
```
default_llm_provider = "openai"
openai_model = "gpt-4o-mini"
```

### 🎵 TTS PROVIDER SETTINGS

**Choose which service generates audio:**

- `default_tts_provider`: Select provider
  - `elevenlabs` (natural, expressive)
  - `google` (standard Google Neural2)
  - `openai` (OpenAI TTS)
  - `polly` (Amazon Polly)
  - `gemini` (Google Journey voices - most natural)
  - `google_chirp` (Google's newest universal model)

- `tts_fallback_chain`: What to try if primary fails
  - Example: `["elevenlabs", "google", "openai"]`
  - Code will try each in order until one works

- `tts_speaking_rate`: How fast to speak
  - `0.5` = very slow
  - `1.0` = normal (recommended)
  - `1.5` = fast

- `tts_pitch`: Voice pitch adjustment
  - `-20.0` to `+20.0` (0 = no change)

- `tts_volume_gain`: Volume adjustment in dB
  - `-16.0` to `+16.0` (0 = no change)

**Example: Use ElevenLabs with natural speaking**
```
default_tts_provider = "elevenlabs"
tts_speaking_rate = 1.0
tts_pitch = 0.0
tts_fallback_chain = ["elevenlabs", "google", "openai"]
```

### 🗣️ VOICE SELECTION

- `voice_map_json`: Map languages to specific voice IDs

**Example JSON:**
```json
{
  "en": "pFZP5JQG7iQjIQuC4Bku",
  "ja": "pFZP5JQG7iQjIQuC4Bku",
  "es": "pFZP5JQG7iQjIQuC4Bku"
}
```

### 📝 SCRIPT GENERATION

**Control how scripts are generated:**

- `script_word_limit_normal`: Target words for normal scripts (default: 700)
- `script_word_limit_short`: Target words for "short" scripts (default: 300)
- `script_include_questions`: Include Q&A format? (yes/no)
- `num_questions_per_script`: How many questions (default: 3)
- `include_motivational_quote`: Add quote at end? (yes/no)

**Example: Shorter scripts**
```
script_word_limit_normal = 400
script_word_limit_short = 150
num_questions_per_script = 2
```

### 💬 PROMPT TEMPLATES

**Customize the instructions sent to LLM:**

- `prompt_system_role`: AI personality/role
  ```
  "You are a warm, enthusiastic, and engaging teacher."
  ```

- `prompt_script_intro`: Main instruction
  ```
  "Create a conversational teacher script for a student."
  ```

- `prompt_tone_guide`: Tone/style guidance
  ```
  "Use natural pauses, show genuine emotion, speak warmly."
  ```

### ⏱️ COOLDOWN & QUOTA

**Limit how often users can generate:**

- `cooldown_hours`: Hours between generations (default: 24)
- `test_user_cooldown_enabled`: Apply cooldown to Alex? (default: no)
- `max_generations_per_day`: Max per day per user (0=unlimited)

**Example: Allow 3 generations per day**
```
cooldown_hours = 0
max_generations_per_day = 3
```

### 💰 PRICING & CREDITS

**Set up a credit system (optional):**

- `enable_credit_system`: Turn on credit charges? (yes/no)
- `cost_per_generation`: Credit cost per generation (default: 0.50)

**Example: Charge 1 credit per generation**
```
enable_credit_system = true
cost_per_generation = 1.00
```

### 🌍 BILINGUAL SETTINGS

**Configure multilingual support:**

- `support_bilingual`: Allow EN+JA, EN+ES, etc? (yes/no)
- `bilingual_default_pair`: Default pair (en_ja, en_es, etc)
- `bilingual_audio_stitch`: Stitch into one file? (yes/no)

**Example: Support EN+JA with single audio file**
```
support_bilingual = true
bilingual_default_pair = "en_ja"
bilingual_audio_stitch = true
```

### 🔍 LOGGING & DEBUG

- `verbose_logging`: Log detailed info? (yes/no)
- `debug_mode`: Enable debug output? (yes/no)
  - ⚠️ Only enable for troubleshooting, disable in production

---

## Using Config in Code

### Option 1: Use Config Helpers (Recommended)

```python
from dailycast.config_helpers import (
    get_tts_provider,
    get_script_word_limit,
    get_openai_model,
    is_bilingual_supported,
)

# Get current TTS provider
provider = get_tts_provider()  # "elevenlabs"

# Get word limit (short or normal)
limit = get_script_word_limit(is_short=True)  # 300

# Check if bilingual is enabled
if is_bilingual_supported():
    # Allow EN+JA generation
    pass
```

### Option 2: Get Entire Config

```python
from dailycast.config_helpers import get_full_config_dict

config = get_full_config_dict()
print(config)
# {
#   'default_tts_provider': 'elevenlabs',
#   'default_llm_provider': 'openai',
#   'cost_per_generation': 0.5,
#   ...
# }
```

### Option 3: Direct Model Access

```python
from dailycast.models import TeacherContentConfig

config = TeacherContentConfig.get_config()
print(config.default_tts_provider)  # "elevenlabs"
print(config.openai_model)  # "gpt-4o-mini"
```

---

## Common Configuration Recipes

### Recipe 1: Budget-Friendly Setup
```
LLM Provider: template (no API costs)
TTS Provider: google (free tier works)
Script Length: 300 words (short, faster)
Cooldown: 24 hours (limit usage)
Cost: 0 (free for users)
```

### Recipe 2: High Quality Setup
```
LLM Provider: openai
OpenAI Model: gpt-4
TTS Provider: elevenlabs
TTS Speaking Rate: 0.95 (slightly slower for clarity)
Script Length: 700 words (full length)
Cost: 1.00 credit per generation
```

### Recipe 3: Bilingual (EN+JA) Setup
```
Support Bilingual: true
Bilingual Pair: en_ja
Bilingual Audio Stitch: true
TTS Provider: elevenlabs (supports all languages)
Script Length: 600 words (balanced)
```

### Recipe 4: Testing/Development
```
LLM Provider: template (fast)
TTS Provider: google (free)
Cooldown Hours: 0 (no rate limit)
Verbose Logging: true (see what's happening)
Debug Mode: true (extra output)
```

---

## How Code Reads Config

Example: `services_interactive.py`

**Before (hardcoded):**
```python
def synthesize_audio_for_language(script_text, language):
    provider = "elevenlabs"  # Hardcoded!
    model = "gpt-4o-mini"    # Hardcoded!
```

**After (reads from config):**
```python
from dailycast.config_helpers import get_tts_provider, get_openai_model

def synthesize_audio_for_language(script_text, language):
    provider = get_tts_provider()  # Reads from dashboard!
    model = get_openai_model()     # Reads from dashboard!
```

---

## Migration Steps

1. **Create and apply migration:**
   ```bash
   python manage.py migrate dailycast
   ```

2. **Access Django admin:**
   ```
   http://your-site/admin/dailycast/teachercontentconfig/
   ```

3. **Configure your settings** (takes 5 minutes)

4. **Test a generation** and verify it uses your settings

5. **Update code** to use `config_helpers` instead of hardcoded values

---

## Troubleshooting

**Q: Where do I access the config?**
A: Django Admin → "Teacher Content Configuration" (left sidebar)

**Q: Can I have multiple configs?**
A: No, only one singleton config exists. You can't add more.

**Q: Changes aren't taking effect?**
A: - Clear Django cache: `python manage.py clear_cache`
   - Restart Django: `python manage.py runserver`
   - Check `verbose_logging` is enabled to see what's happening

**Q: How do I know what settings are being used?**
A: Enable `verbose_logging=true` and check logs for `[CONFIG_DEBUG]` messages

**Q: Can I export/import configs?**
A: You can use Django's `dumpdata`/`loaddata`:
   ```bash
   python manage.py dumpdata dailycast.TeacherContentConfig > config.json
   python manage.py loaddata config.json
   ```

---

## Next Steps

1. ✅ Create the config in Django admin
2. ✅ Set your preferences (LLM, TTS, pricing, etc)
3. 🔄 Update `services_interactive.py` to read from config
4. 🔄 Update prompt generation to use `config_helpers`
5. ✅ Test generation with new settings
6. 🚀 Deploy!

All future changes to generation behavior will be instant - no code modifications needed!
