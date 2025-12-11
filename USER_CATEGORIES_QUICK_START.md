# ⚡ User Categories - Quick Start (5 Minutes)

## What It Does

You can now create **groups of users** where each group has **different settings**.

For example:

- **Teachers** → Unlimited generations, GPT-4, ElevenLabs TTS
- **Students** → 3 generations/day, Template LLM, Google TTS, no cost
- **Trial** → 1 generation, template, free

---

## Quick Setup (5 Steps)

### Step 1: Go to Admin

```
http://localhost:8000/admin/
```

### Step 2: Create a Category

```
Dailycast → User Categories → Add User Category

Name: Teachers
Description: Premium teacher accounts
Is Active: ✓
Users: (select users)
```

Click **Save**

### Step 3: Configure the Category

```
You'll see a form with "Configuration" section:

✓ Enabled
Default Language: English
Default Output: Text & Audio
Default LLM: GPT-4o-mini
Default TTS: ElevenLabs
Speaking Rate: 1.0
Script Word Limit: 1000
Cooldown Hours: 24
Max Generations/Day: 20
Cost per Generation: $2.00
```

Fill it and click **Save**

### Step 4: Add More Users

```
Click category again → Users section → Add more users
```

### Step 5: Done!

```
Now all Teachers will use:
- GPT-4 LLM
- ElevenLabs TTS
- Unlimited (20 per day)
- $2 per generation
```

---

## 📊 Example Groups to Create

### Teachers

- LLM: gpt-4o-mini (best)
- TTS: elevenlabs (natural)
- Limit: 20/day
- Cost: $2.00
- Cooldown: 24h

### Students

- LLM: template (no cost)
- TTS: google (fast)
- Limit: 3/day
- Cost: $0.10
- Cooldown: 24h

### Trial Users

- LLM: template
- TTS: google
- Limit: 1/day
- Cost: Free
- Cooldown: 48h

---

## 🎯 In Code

### Get user's config:

```python
from dailycast.category_helpers import get_category_config

user = User.objects.get(username='alex')
config = get_category_config(user)

# Use it
llm = config.default_llm_provider  # "openai"
tts = config.default_tts_provider  # "elevenlabs"
limit = config.max_generations_per_day  # 20
cost = config.cost_per_generation  # 2.00
```

### Get specific settings:

```python
from dailycast.category_helpers import (
    get_tts_provider_for_user,
    get_llm_provider_for_user,
    get_max_generations_per_day_for_user,
)

tts = get_tts_provider_for_user(user)  # "elevenlabs"
llm = get_llm_provider_for_user(user)  # "openai"
limit = get_max_generations_per_day_for_user(user)  # 20
```

### Add user to category:

```python
from dailycast.category_helpers import add_user_to_category

add_user_to_category(user, 'Teachers')
# Done! User now uses Teachers config
```

---

## 🎉 Status

✅ Complete and ready to use!

**Features:**

- Create unlimited categories
- Assign users to categories
- Different config per category
- 20+ helper functions
- Full admin interface

---

## 📚 Full Guide

See: `USER_CATEGORIES_GUIDE.md` for detailed info

---

## Start Now!

1. Go to: `http://localhost:8000/admin/`
2. Click: **Dailycast** → **User Categories**
3. Click: **Add User Category**
4. Create your first group!

🚀 **You're done!**
