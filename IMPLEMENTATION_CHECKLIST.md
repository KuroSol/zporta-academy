# ✅ Teacher Content Configuration - Implementation Checklist

## Phase 1: Foundation (✅ COMPLETE)

- ✅ Created `TeacherContentConfig` Django model
  - Location: `dailycast/models.py`
  - 25+ configurable fields
  - Singleton pattern with `get_config()` method

- ✅ Created Django Admin Interface
  - Location: `dailycast/admin.py`
  - 10 organized fieldsets
  - Help text for every field
  - Direct access to config

- ✅ Created Config Helper Functions
  - Location: `dailycast/config_helpers.py`
  - 30+ helper functions
  - Consistent API
  - Safe defaults

- ✅ Created Database Migration
  - Location: `dailycast/migrations/0005_*.py`
  - Applied to database ✅
  - TeacherContentConfig table ready

- ✅ Created Documentation
  - `TEACHER_CONFIG_GUIDE.md` - Comprehensive guide
  - `SETUP_COMPLETE_CONFIG_DASHBOARD.md` - Setup instructions
  - `QUICK_REFERENCE_CONFIG.md` - Quick reference
  - `CONFIG_SYSTEM_SUMMARY.md` - System overview
  - `CONFIG_ARCHITECTURE.md` - Architecture diagrams

---

## Phase 2: Code Integration (🔄 TODO)

### Task 1: Update `services_interactive.py`

**Goal:** Use config for TTS provider and settings

**What to do:**
```python
# Add at top of file
from dailycast.config_helpers import (
    get_tts_provider,
    get_tts_speaking_rate,
    get_tts_pitch,
    get_tts_volume_gain,
)

# In synthesize_audio_for_language():
# Replace:  provider = "elevenlabs"
# With:     provider = get_tts_provider()

# Replace:  speaking_rate = 1.0
# With:     speaking_rate = get_tts_speaking_rate()

# Similar for pitch and volume
```

**Files to modify:**
- [ ] `dailycast/services_interactive.py`
  - Function: `synthesize_audio_for_language()`
  - Function: `synthesize_single_language_audio()`
  - Function: `synthesize_bilingual_audio()`

**Testing:**
- [ ] Generate content and verify it uses configured TTS provider
- [ ] Check logs for `[CONFIG_DEBUG]` messages
- [ ] Try different TTS providers in admin, test each

---

### Task 2: Update `views_admin_ajax.py`

**Goal:** Use config for prompt word limits and generation settings

**What to do:**
```python
# Add at top
from dailycast.config_helpers import (
    get_script_word_limit,
    should_include_questions,
    get_num_questions,
)

# In prompt building:
# Replace:  word_limit = 700
# With:     word_limit = get_script_word_limit(is_short=is_short_request)

# Replace:  num_questions = 3
# With:     num_questions = get_num_questions()
```

**Files to modify:**
- [ ] `dailycast/views_admin_ajax.py`
  - Function: `build_prompt_for_script_generation()`
  - Any place with hardcoded word limits or question counts

**Testing:**
- [ ] Generate script with "short" note
- [ ] Verify it uses `script_word_limit_short` from config
- [ ] Generate normal script
- [ ] Verify it uses `script_word_limit_normal` from config
- [ ] Change config values and verify scripts adjust

---

### Task 3: Update `services.py`

**Goal:** Use config for LLM provider and model selection

**What to do:**
```python
# Add at top
from dailycast.config_helpers import (
    get_llm_provider,
    get_openai_model,
    get_gemini_model,
)

# In script generation:
# Replace:  model = "gpt-4o-mini"
# With:     model = get_openai_model()

# Replace:  provider = "openai"
# With:     provider = get_llm_provider()
```

**Files to modify:**
- [ ] `dailycast/services.py`
  - Any place with hardcoded LLM models or providers

**Testing:**
- [ ] Change `default_llm_provider` in admin
- [ ] Generate content and verify correct provider used
- [ ] Try different models (gpt-4, gpt-4o-mini, etc)

---

### Task 4: Update Prompt Templates

**Goal:** Use custom prompts from config instead of hardcoded ones

**What to do:**
```python
# Add at top
from dailycast.config_helpers import (
    get_prompt_system_role,
    get_prompt_script_intro,
    get_prompt_tone_guide,
)

# In prompt building:
# Replace hardcoded prompts:
#   "You are a warm, enthusiastic teacher..."
# With:
#   get_prompt_system_role()

# Similar for intro and tone
```

**Files to modify:**
- [ ] `dailycast/views_admin_ajax.py` or similar
  - Any functions building LLM prompts

**Testing:**
- [ ] Modify prompts in admin
- [ ] Generate content and verify new prompts used
- [ ] Verify tone/style changes affect output

---

### Task 5: Update Rate Limiting / Cooldown

**Goal:** Use config for cooldown and quota checking

**What to do:**
```python
# Add at top
from dailycast.config_helpers import (
    get_cooldown_hours,
    get_max_generations_per_day,
)

# In can_generate_podcast():
# Replace:  cooldown_hours = 24
# With:     cooldown_hours = get_cooldown_hours()

# Replace:  max_per_day = 0 (unlimited)
# With:     max_per_day = get_max_generations_per_day()
```

**Files to modify:**
- [ ] `dailycast/services_interactive.py`
  - Function: `can_generate_podcast()`

**Testing:**
- [ ] Set cooldown to 0 (unlimited) and test rapid generation
- [ ] Set cooldown to 24 hours and test rate limiting
- [ ] Set max_per_day to 3 and verify limit enforced

---

### Task 6: Update Pricing/Credits

**Goal:** Use config for cost per generation

**What to do:**
```python
# Add at top
from dailycast.config_helpers import (
    get_cost_per_generation,
    is_credit_system_enabled,
)

# In generation checkout:
# Replace:  cost = 0.50
# With:     cost = get_cost_per_generation()

# Replace:  if enable_credits:
# With:     if is_credit_system_enabled():
```

**Files to modify:**
- [ ] Any place handling credits/payment
- [ ] Generation cost calculation

**Testing:**
- [ ] Enable credit system with cost 1.00
- [ ] Verify generation deducts 1.00 credits
- [ ] Change cost in admin, verify new cost used

---

### Task 7: Update Bilingual Support

**Goal:** Use config for bilingual settings

**What to do:**
```python
# Add at top
from dailycast.config_helpers import (
    is_bilingual_supported,
    get_bilingual_default_pair,
    should_stitch_bilingual_audio,
)

# In generation logic:
# Replace:  if bilingual_enabled:
# With:     if is_bilingual_supported():

# Replace:  default_pair = "en_ja"
# With:     default_pair = get_bilingual_default_pair()
```

**Files to modify:**
- [ ] `dailycast/services_interactive.py`
  - Bilingual generation logic

**Testing:**
- [ ] Enable bilingual with EN+JA pair
- [ ] Generate bilingual content
- [ ] Try different pairs in config
- [ ] Test audio stitching toggle

---

## Phase 3: Testing (🔄 TODO)

- [ ] Test 1: Verify config reads from database
  ```bash
  python manage.py shell
  from dailycast.config_helpers import get_tts_provider
  print(get_tts_provider())  # Should print admin setting
  ```

- [ ] Test 2: Change one setting in admin
  - Change `default_tts_provider` to "google"
  - Generate content
  - Verify it uses Google TTS
  - Check logs for confirmation

- [ ] Test 3: Change script word limit
  - Set `script_word_limit_normal` to 200
  - Generate content
  - Verify script is ~200 words
  - Set back to 700, verify longer script

- [ ] Test 4: Change LLM provider
  - Set `default_llm_provider` to "gemini"
  - Generate content
  - Verify it uses Gemini
  - Try switching between providers

- [ ] Test 5: Test all helpers
  - Run each helper function
  - Verify they return expected values
  - Test with different config settings

- [ ] Test 6: Comprehensive end-to-end
  - Change 5 different settings
  - Generate content
  - Verify all settings used correctly

---

## Phase 4: Documentation (✅ COMPLETE)

- ✅ `TEACHER_CONFIG_GUIDE.md` - Full feature guide
- ✅ `SETUP_COMPLETE_CONFIG_DASHBOARD.md` - Setup walkthrough
- ✅ `QUICK_REFERENCE_CONFIG.md` - Quick lookup
- ✅ `CONFIG_SYSTEM_SUMMARY.md` - System overview
- ✅ `CONFIG_ARCHITECTURE.md` - Architecture diagrams
- ✅ This checklist - Implementation steps

---

## Phase 5: Deployment (🔄 TODO)

- [ ] Code review of changes
- [ ] Merge all code changes to main
- [ ] Run full test suite
- [ ] Create release notes
- [ ] Deploy to staging
- [ ] Test on staging (5-10 minutes)
- [ ] Deploy to production
- [ ] Configure in production admin
- [ ] Monitor logs for issues
- [ ] Announce to team

---

## Quick Status

```
┌─────────────────────────────────┐
│ PHASE 1: Foundation             │
│ Status: ✅ COMPLETE             │
│ - Model created                 │
│ - Admin interface built          │
│ - Helpers written               │
│ - Migration applied             │
│ - Docs complete                 │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ PHASE 2: Code Integration       │
│ Status: 🔄 IN PROGRESS (TODO)   │
│ - [ ] services_interactive.py   │
│ - [ ] views_admin_ajax.py       │
│ - [ ] services.py               │
│ - [ ] Prompts & templates       │
│ - [ ] Rate limiting             │
│ - [ ] Pricing                   │
│ - [ ] Bilingual                 │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ PHASE 3: Testing                │
│ Status: 🔄 TODO                 │
│ - [ ] Database tests            │
│ - [ ] Helper function tests     │
│ - [ ] End-to-end tests          │
│ - [ ] Configuration changes     │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ PHASE 4: Documentation          │
│ Status: ✅ COMPLETE             │
│ - ✅ Guides written             │
│ - ✅ Architecture docs          │
│ - ✅ Quick reference            │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ PHASE 5: Deployment             │
│ Status: 🔄 TODO                 │
│ - [ ] Staging tests             │
│ - [ ] Production deploy         │
│ - [ ] Configuration             │
│ - [ ] Monitoring                │
└─────────────────────────────────┘
```

---

## Next Immediate Steps

1. **Choose a file to update first**
   - I recommend starting with `services_interactive.py`
   - Most straightforward changes
   - Most impact on functionality

2. **Make changes**
   - Add imports for config helpers
   - Replace hardcoded values with helper function calls
   - Test the specific function

3. **Move to next file**
   - Follow the same pattern
   - Test as you go
   - Commit regularly

4. **Run end-to-end test**
   - Generate content with new config
   - Verify custom settings are used
   - Try changing settings in admin

5. **Deploy**
   - Push to production
   - Configure in admin
   - Celebrate! 🎉

---

## Estimated Time per Phase

| Phase | Estimated Time | Status |
|-------|----------------|--------|
| Phase 1: Foundation | 30 min | ✅ DONE |
| Phase 2: Integration | 2-3 hours | 🔄 TODO |
| Phase 3: Testing | 1-2 hours | 🔄 TODO |
| Phase 4: Docs | 1 hour | ✅ DONE |
| Phase 5: Deploy | 30 min | 🔄 TODO |
| **TOTAL** | **~5-7 hours** | |

---

## Success Criteria

- ✅ Configuration accessible from admin dashboard
- ✅ Settings affect generation behavior
- ✅ No hardcoded values in code
- ✅ Changes apply instantly
- ✅ All team members can customize without coding
- ✅ Easy to add new settings in future

---

## Questions?

Refer to:
- `TEACHER_CONFIG_GUIDE.md` - Detailed feature guide
- `QUICK_REFERENCE_CONFIG.md` - Quick answers
- `CONFIG_ARCHITECTURE.md` - How it works
- `SETUP_COMPLETE_CONFIG_DASHBOARD.md` - Setup help

---

**Ready to implement Phase 2?** 🚀
