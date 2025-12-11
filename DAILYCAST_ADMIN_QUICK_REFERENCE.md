# DAILY PODCAST SETTINGS - QUICK REFERENCE GUIDE

**For non-technical admins to understand the system**

---

## 🎯 THE CORE IDEA

There are **2 levels of settings**:

```
┌─────────────────────────────────┐
│ 1. GLOBAL PODCAST DEFAULTS      │
│    (Applies to EVERYONE)        │
│                                 │
│ • AI Model: gpt-4o-mini         │
│ • Cost: $0.50 per podcast       │
│ • Cooldown: 24 hours            │
│ • Script length: 1000 words      │
└─────────────────────────────────┘
           ↓
    (Unless overridden by...)
           ↓
┌─────────────────────────────────┐
│ 2. STUDENT GROUP OVERRIDES      │
│    (Per group of users)         │
│                                 │
│ BEGINNERS:                      │
│ • AI Model: gpt-4o-mini ✓       │
│ • Cost: $0.25 ← Override        │
│ • Cooldown: 24 hours (use def)  │
│ • Script length: 1000 words (use)│
│                                 │
│ ADVANCED:                       │
│ • AI Model: gpt-4-turbo ✓       │
│ • Cost: $0.75 ← Override        │
│ • Cooldown: 0 hours ← Override  │
│ • Script length: 1000 words (use)│
└─────────────────────────────────┘
```

---

## 📍 WHERE TO FIND SETTINGS

### Global Defaults (For Everyone)

```
Django Admin → Dailycast → Global Podcast Defaults
└─ This is the fallback for all users
```

**What to do here**: Set defaults that make sense for most users

**Example settings**:

- AI Provider: OpenAI (gpt-4o-mini)
- Cost per podcast: $0.50
- Cooldown: 24 hours
- Script length: 1000 words

---

### Student Group Overrides (Per Group)

```
Django Admin → Dailycast → Student Groups
└─ Click a group → Edit overrides
```

**What to do here**: Override ONLY what you want different for this group

**Example**:

```
GROUP: "Beginners" (150 users)
└─ Cost: $0.25 (cheaper for beginners!)
   AI Model: (blank - use global)
   Cooldown: 24 hours (blank - use global)
   Script length: 800 words (override - shorter for beginners)
```

---

## 💡 KEY RULES

### Rule 1: Blank = Use Global Default

```
If you leave a field BLANK in Student Group overrides:
→ That setting uses the Global Default

Example:
Global: Cost = $0.50
Beginner group: Cost = (blank)
↓
Beginner users pay: $0.50 (uses global)
```

### Rule 2: Filled In = Override Global

```
If you FILL IN a field in Student Group overrides:
→ That setting overrides the global default

Example:
Global: Cost = $0.50
Beginner group: Cost = $0.25 ← Filled in
↓
Beginner users pay: $0.25 (override)
```

### Rule 3: No Group = Always Global

```
If a user is NOT in any Student Group:
→ They get ALL global defaults

Example:
User "Alex" has no student group
↓
Sees: Global settings for everything
```

---

## 🎓 REAL WORLD EXAMPLE

### Setup

```
GLOBAL DEFAULTS:
├─ AI Model: gpt-4o-mini (cheap)
├─ Cost: $0.50
├─ Cooldown: 24 hours
└─ Script length: 1000 words

STUDENT GROUPS:
├─ "Beginners" (50 users)
│   ├─ Cost: $0.25 (cheaper) ✓
│   ├─ Cooldown: 48 hours (less frequent) ✓
│   └─ (everything else uses global)
│
├─ "Advanced" (30 users)
│   ├─ AI Model: gpt-4-turbo (better) ✓
│   ├─ Cost: $1.00 (expensive, but premium model) ✓
│   └─ (everything else uses global)
│
└─ "Miscellaneous" (20 users, no overrides)
    └─ (all use global defaults)
```

### What Each User Sees

```
Beginner user "Sarah":
├─ AI Model: gpt-4o-mini (global)
├─ Cost: $0.25 (Beginner override!)
├─ Cooldown: 48 hours (Beginner override!)
└─ Script length: 1000 words (global)

Advanced user "Bob":
├─ AI Model: gpt-4-turbo (Advanced override!)
├─ Cost: $1.00 (Advanced override!)
├─ Cooldown: 24 hours (global)
└─ Script length: 1000 words (global)

No-group user "Anonymous":
├─ AI Model: gpt-4o-mini (global)
├─ Cost: $0.50 (global)
├─ Cooldown: 24 hours (global)
└─ Script length: 1000 words (global)
```

---

## 🔧 COMMON TASKS

### Task 1: Make podcasts cheaper for beginners

```
1. Go to: Django Admin → Student Groups → Beginners
2. Scroll to: SETTINGS OVERRIDE
3. Change: Cost per generation = $0.25
4. Leave blank: AI Model (uses global)
5. Leave blank: Cooldown (uses global)
6. Leave blank: Script length (uses global)
7. Click: SAVE
```

### Task 2: Give advanced users premium AI

```
1. Go to: Django Admin → Student Groups → Advanced
2. Scroll to: SETTINGS OVERRIDE
3. Change: AI Model = gpt-4-turbo
4. Change: Cost per generation = $1.50
5. Leave blank: Cooldown (uses global)
6. Leave blank: Script length (uses global)
7. Click: SAVE
```

### Task 3: Limit how often beginners can generate

```
1. Go to: Django Admin → Student Groups → Beginners
2. Scroll to: SETTINGS OVERRIDE
3. Change: Cooldown hours = 48 (wait 2 days between)
4. Click: SAVE
```

### Task 4: Set global defaults everyone should use

```
1. Go to: Django Admin → Global Podcast Defaults
2. Edit: Default AI Provider = gemini-1.5-pro (fast & cheap)
3. Edit: Cost per generation = $0.50
4. Edit: Cooldown hours = 24
5. Click: SAVE
```

---

## ⚙️ SETTINGS EXPLAINED

### AI Model

```
What: Which artificial intelligence generates the script
Options: OpenAI (GPT), Google Gemini, Claude, Template

Cost from cheapest to expensive:
Template (free) < Gemini-Flash < GPT-4o-mini < Claude-Haiku
< Gemini-Pro < Claude-Sonnet < GPT-4-Turbo < Claude-Opus

Recommendation:
├─ Beginners: gpt-4o-mini (fast, good quality, cheap)
├─ Intermediate: gpt-4 or gemini-1.5-pro
└─ Advanced: gpt-4-turbo or claude-3-opus
```

### Cost per Podcast

```
What: How much users pay to generate one podcast
Example: $0.50 = 50 cents per generation

Recommendation:
├─ Beginners: $0.25-0.50 (cheaper to encourage use)
├─ Intermediate: $0.50-0.75
└─ Advanced: $0.75-1.50 (premium feature)
```

### Cooldown Hours

```
What: How long to wait between generations
Example: 24 = must wait 24 hours between podcasts

Recommendation:
├─ Beginners: 24-48 hours (limited access)
├─ Intermediate: 12-24 hours
└─ Advanced: 0-12 hours (frequent use)

Special: 0 = no limit (can generate anytime)
```

### Script Word Limit

```
What: Maximum length of podcast script (longer = more AI tokens)
Example: 1000 = up to 1000 words per podcast

Recommendation:
├─ Beginners: 500-800 words (short, focused)
├─ Intermediate: 800-1000 words
└─ Advanced: 1000-1500 words (detailed)
```

### TTS Provider (Voice)

```
What: Which service generates the audio voice
Options: ElevenLabs (best), Google TTS, OpenAI

Recommendation:
├─ Most groups: ElevenLabs (natural, human-like)
├─ Budget-conscious: Google TTS (free tier)
└─ Simple needs: OpenAI TTS
```

---

## 🚨 COMMON MISTAKES

### ❌ Mistake 1: Filling in ALL fields in group override

```
WRONG:
Beginners group:
├─ AI Model: gpt-4o-mini
├─ Cost: $0.25
├─ Cooldown: 24
├─ Script length: 1000
└─ TTS Provider: elevenlabs

WHY IT'S WRONG: You've duplicated global settings
Better: Leave most blank, only override what's different
```

### ❌ Mistake 2: Editing the wrong admin page

```
WRONG:
Going to: Category Overrides list
Trying to edit there

CORRECT:
1. Go to: Student Groups
2. Click the group name
3. Scroll to: SETTINGS OVERRIDE section
4. Edit there
```

### ❌ Mistake 3: Forgetting what settings mean

```
WRONG:
Setting Cooldown = 0 thinking "unlimited AI calls"
Actually: 0 = no waiting between generations (users can spam)

CORRECT:
Cooldown = hours to wait between generations
0 = no waiting (use with caution!)
```

---

## ✅ CHECKLIST: Setting Up Student Groups

### Step 1: Create a Student Group

```
[ ] Go to: Django Admin → Student Groups
[ ] Click: Add Student Group
[ ] Fill in: Name (e.g., "Beginners")
[ ] Fill in: Description (optional)
[ ] Check: Is active = YES
[ ] Assign: Select users for this group
[ ] Click: SAVE
```

### Step 2: Configure Overrides

```
[ ] Scroll to: SETTINGS OVERRIDE section
[ ] Fill in: Only the fields you want DIFFERENT from global
[ ] Leave blank: Everything else (uses global defaults)
[ ] Click: SAVE
```

### Step 3: Verify It Works

```
[ ] Log in as a test user in this group
[ ] Generate a podcast
[ ] Verify: Cost matches override (not global)
[ ] Verify: Cooldown works as configured
[ ] Verify: AI model is correct
```

### Step 4: Monitor & Adjust

```
[ ] Check: Are users happy with these settings?
[ ] Track: Cost, usage, feedback
[ ] Adjust: Override values if needed
[ ] Document: Why each override exists
```

---

## 📞 NEED HELP?

### "I want to change cost for only Beginners"

```
→ Go to: Student Groups → Beginners
→ Set: Cost per generation = $0.25
→ Leave: Everything else blank
→ Save
```

### "I want all groups to use the same AI model"

```
→ Go to: Global Podcast Defaults
→ Set: Default LLM provider = gpt-4o-mini
→ Leave: Group overrides blank for AI Model
→ Save
```

### "I'm confused which setting applies to which user"

```
→ Rule: FILLED IN = override that group
→ Rule: BLANK = uses global default
→ Rule: NO GROUP = all global defaults
```

### "I need different settings for a new group"

```
→ Go to: Student Groups → Add new
→ Create: Group name, add users
→ Configure: SETTINGS OVERRIDE section
→ Save
```

---

## 🎯 BOTTOM LINE

**Two levels:**

1. **Global** = Default for everyone
2. **Groups** = Override for specific users

**Simple rule:**

- Blank = Use global
- Filled = Override global
- No group = All global

**That's it!** 🎉
