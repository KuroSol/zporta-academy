# ⚡ Quick Reference: Teacher Config Dashboard

## Access Dashboard
```
http://localhost:8000/admin/
→ DAILYCAST → Teacher Content Configuration
```

---

## Most Important Settings

| Setting | Default | What It Does |
|---------|---------|--------------|
| **enabled** | true | Turn generation on/off |
| **default_llm_provider** | template | Which AI generates scripts (openai/gemini/template) |
| **openai_model** | gpt-4o-mini | Which OpenAI model (cheaper/faster) |
| **default_tts_provider** | elevenlabs | Which service makes audio (natural/fast) |
| **script_word_limit_normal** | 700 | Target words for normal scripts (~7 min audio) |
| **script_word_limit_short** | 300 | Target words for short scripts (~3 min audio) |
| **cooldown_hours** | 24 | Hours between generations (0=unlimited) |
| **cost_per_generation** | 0.50 | Credit cost per generation (0=free) |

---

## Common Configurations

### Save Money (Free/Low Cost)
```
LLM Provider: template
TTS Provider: google
Cost: 0
```

### Highest Quality
```
LLM Provider: openai
OpenAI Model: gpt-4
TTS Provider: elevenlabs
Cost: 1.00+
```

### Fastest Generation
```
LLM Provider: template
TTS Provider: google
Script Words: 200
```

### Bilingual (EN+JA)
```
Support Bilingual: true
Bilingual Pair: en_ja
Bilingual Audio Stitch: true
TTS Provider: elevenlabs
```

---

## Using in Code

```python
from dailycast.config_helpers import (
    get_tts_provider,           # "elevenlabs"
    get_script_word_limit,      # 700 or 300
    get_openai_model,           # "gpt-4o-mini"
    is_bilingual_supported,     # true/false
    get_cost_per_generation,    # 0.50
)

# Example
provider = get_tts_provider()
limit = get_script_word_limit(is_short=False)
```

---

## Quick Decisions

**Question: Should I use OpenAI or Gemini?**
- Use **OpenAI** if you want proven quality (gpt-4o-mini is cheap)
- Use **Gemini** if you want lower cost with good results
- Use **Template** if you want zero API costs

**Question: ElevenLabs or Google TTS?**
- Use **ElevenLabs** for most natural voice (requires API key)
- Use **Google** for free or cheap option
- Both support all languages

**Question: How long should scripts be?**
- **700 words** = ~7-8 minutes of audio (default)
- **400 words** = ~4-5 minutes of audio
- **200 words** = ~2-3 minutes of audio

**Question: Should I charge credits?**
- If **free**: set `enable_credit_system = false`, `cost = 0`
- If **charged**: set `enable_credit_system = true`, `cost = amount`

---

## Settings That Don't Require Code Changes

These settings apply instantly to next generation:
- ✅ LLM provider choice
- ✅ TTS provider choice  
- ✅ Script word limits
- ✅ Speaking rate/pitch
- ✅ Cooldown hours
- ✅ Cost per generation
- ✅ Questions per script

These require code changes to use:
- 🔄 Prompt templates (need code to read them)
- 🔄 Language settings (need code integration)
- 🔄 Voice map (need code to read it)

---

## Next: Wire Your Code

### In `services_interactive.py`
```python
# Add at top
from dailycast.config_helpers import get_tts_provider

# In synthesize_audio_for_language():
preferred_provider = get_tts_provider()  # ← Instead of hardcoded
```

### In `views_admin_ajax.py`
```python
# Add at top
from dailycast.config_helpers import get_script_word_limit

# In build prompt:
word_limit = get_script_word_limit(is_short=is_short_request)
prompt = f"Create script (~{word_limit} words)..."
```

---

## Testing

**Test that config is being read:**
```python
# In Django shell
python manage.py shell

from dailycast.config_helpers import get_tts_provider
print(get_tts_provider())  # Should print what you set in admin
```

**Test generation with new settings:**
1. Change config in admin
2. Generate teacher content
3. Check logs for `[CONFIG_DEBUG]` messages
4. Verify it used your settings

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't find config in admin | Refresh page (Ctrl+F5), restart Django |
| Changes not taking effect | Enable verbose_logging, check logs |
| Imports failing | Ensure `config_helpers.py` exists and code migrated |
| Database error | Run `python manage.py migrate dailycast` |

---

## File Checklist

- ✅ `models.py` - TeacherContentConfig model
- ✅ `admin.py` - Admin interface
- ✅ `config_helpers.py` - Helper functions
- ✅ `migrations/0005_*.py` - Database migration
- 🔄 `services_interactive.py` - Update to use config
- 🔄 `views_admin_ajax.py` - Update prompts to use config

---

## Remember

- 📊 All settings are in **one place** (the dashboard)
- ⚡ Changes take **effect immediately**
- 🔒 **No code changes** needed for configuration
- 📝 Track **who changed what** (last_modified_by)
- 🚀 **Future-proof**: Add new settings anytime

**Start now:** Visit `http://localhost:8000/admin/`
