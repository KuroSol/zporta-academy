# DAILYCAST SYSTEM - VISUAL GUIDE FOR NON-TECHNICAL USERS

---

## 🎙️ WHAT IS DAILYCAST?

```
STUDENT                          AI SYSTEM                       OUTPUT
┌──────────────┐               ┌────────────┐              ┌─────────────┐
│ User clicks  │               │  generates │              │ Gets podcast│
│  "Generate   │──────────────>│   podcast  │─────────────>│ (script +   │
│   Podcast"   │               │   script   │              │  audio MP3) │
└──────────────┘               └────────────┘              └─────────────┘
                                     ↓
                            ┌────────────────────┐
                            │ Uses configuration:│
                            │ • AI Model         │
                            │ • Voice provider   │
                            │ • Language         │
                            │ • Script length    │
                            └────────────────────┘
```

---

## 📊 THE TWO-LEVEL CONFIGURATION SYSTEM

### Level 1: GLOBAL (For Everyone)

```
┌─────────────────────────────────────┐
│     GLOBAL PODCAST DEFAULTS         │
│   (Applies to ALL users)            │
├─────────────────────────────────────┤
│                                     │
│  🤖 AI Model: gpt-4o-mini          │
│  💬 Voice: ElevenLabs              │
│  🌍 Language: English              │
│  📝 Script Length: 1000 words      │
│  💰 Cost: $0.50 per podcast        │
│  ⏱️  Cooldown: 24 hours            │
│                                     │
│  ✅ Use this when:                 │
│  → You want same settings for all  │
│  → You're just getting started     │
│  → You don't need groups           │
│                                     │
└─────────────────────────────────────┘
```

### Level 2: GROUP (Specific Users)

```
┌──────────────────────────────────┐
│    STUDENT GROUP OVERRIDES       │
│   (Per group of users)           │
├──────────────────────────────────┤
│                                  │
│ GROUP: "Beginners" (50 users)    │
│ ├─ Cost: $0.25 ← Override!       │
│ ├─ Script: 800 words ← Override! │
│ ├─ Cooldown: (use global)        │
│ └─ AI Model: (use global)        │
│                                  │
│ GROUP: "Advanced" (30 users)     │
│ ├─ AI Model: gpt-4-turbo ← Ovr!  │
│ ├─ Cost: $1.50 ← Override!       │
│ ├─ Cooldown: (use global)        │
│ └─ Script: (use global)          │
│                                  │
│ NO GROUP: (20 users)             │
│ └─ Everything uses global!       │
│                                  │
└──────────────────────────────────┘
```

---

## 🎯 HOW SETTINGS ARE APPLIED

### User in "Beginners" Group

```
What settings does this user get?

For COST:
  ├─ Is there an override? YES ($0.25)
  └─ Result: User pays $0.25 ✅

For COOLDOWN:
  ├─ Is there an override? NO (blank)
  └─ Result: User gets global 24 hours ✅

For AI MODEL:
  ├─ Is there an override? NO (blank)
  └─ Result: User gets global gpt-4o-mini ✅

For SCRIPT LENGTH:
  ├─ Is there an override? YES (800 words)
  └─ Result: User gets 800 words max ✅
```

### User with No Group

```
What settings does this user get?

For EVERY setting:
  ├─ Is there a group override? NO
  └─ Result: Use global default ✅

Cost: $0.50 (global)
Cooldown: 24 hours (global)
AI Model: gpt-4o-mini (global)
Script Length: 1000 words (global)
```

---

## 🏢 REAL COMPANY SETUP EXAMPLE

### Scenario: Language Learning Platform

```
GLOBAL DEFAULTS:
┌─────────────────────────────────┐
│ AI Model: gpt-4o-mini           │
│ Cost: $0.50                     │
│ Cooldown: 24 hours              │
│ Script length: 1000 words       │
│ Voice: ElevenLabs (natural)    │
└─────────────────────────────────┘
         ▲      ▲      ▲
         │      │      └─── Overrides below apply on top
         │      └────────────┐
         │                   │
         ▼                   ▼

    BEGINNER GROUP        ADVANCED GROUP
    (150 students)        (50 students)

    Overrides:            Overrides:
    • Cost: $0.25         • AI Model: gpt-4-turbo
      (cheaper)           (smarter)
    • Cooldown: 48h       • Cost: $1.00
      (less frequent)     (premium price)
    • (rest use global)   • Cooldown: 0h
                           (unlimited)

OTHER STUDENTS (30):
│
└──> No overrides
     └──> Use all global defaults
```

### What Each Group Experiences

```
👨‍🎓 BEGINNER STUDENT (e.g., Maria)
├─ Cost: $0.25 ← Cheaper (group override)
├─ Cooldown: 48 hours ← Less frequent (group override)
├─ AI Model: gpt-4o-mini ← Fast enough (global)
└─ Script length: 1000 words ← Standard (global)

   RESULT: Maria pays less, can generate less often

👨‍💼 ADVANCED STUDENT (e.g., Bob)
├─ Cost: $1.00 ← Expensive (group override)
├─ Cooldown: 0 hours ← Unlimited (group override)
├─ AI Model: gpt-4-turbo ← Smart (group override)
└─ Script length: 1000 words ← Standard (global)

   RESULT: Bob pays more, but gets premium AI and unlimited access

👤 NO GROUP STUDENT (e.g., Anonymous)
├─ Cost: $0.50 ← Standard (global)
├─ Cooldown: 24 hours ← Standard (global)
├─ AI Model: gpt-4o-mini ← Standard (global)
└─ Script length: 1000 words ← Standard (global)

   RESULT: Anonymous user gets default experience
```

---

## 🛠️ HOW TO MAKE CHANGES

### Change 1: Set Cost for a Group

```
BEFORE:
Global: Cost = $0.50
Beginner group: Cost = (blank - uses global)
Beginner users pay: $0.50

ADMIN ACTION:
1. Go to: Student Groups
2. Click: Beginners
3. Change: Cost = $0.25
4. Save

AFTER:
Global: Cost = $0.50
Beginner group: Cost = $0.25 ← Updated!
Beginner users pay: $0.25
Advanced users pay: $0.50 (no override)
```

### Change 2: Use Premium AI for Advanced Group

```
BEFORE:
Global: AI Model = gpt-4o-mini
Advanced group: AI Model = (blank - uses global)
Advanced users use: gpt-4o-mini

ADMIN ACTION:
1. Go to: Student Groups
2. Click: Advanced
3. Change: AI Model = gpt-4-turbo
4. Save

AFTER:
Global: AI Model = gpt-4o-mini
Advanced group: AI Model = gpt-4-turbo ← Updated!
Advanced users use: gpt-4-turbo
Beginner users use: gpt-4o-mini (no override)
```

### Change 3: Make Faster Generation for Power Users

```
BEFORE:
Global: Cooldown = 24 hours
Professional group: Cooldown = (blank - uses global)
Professional users wait: 24 hours

ADMIN ACTION:
1. Go to: Student Groups
2. Click: Professional
3. Change: Cooldown = 0 (unlimited)
4. Save

AFTER:
Global: Cooldown = 24 hours
Professional group: Cooldown = 0 ← Updated!
Professional users wait: 0 (can generate anytime!)
Beginner users wait: 24 hours (or their override)
```

---

## ⚡ QUICK DECISION TREE

```
"I need to change a setting"
         │
         ▼
"Does it affect ALL users?"
    │              │
   YES            NO
    │              │
    ▼              ▼
Go to:         "Which group(s)?"
Global             │
Podcast         ┌──┴──┬──────┬─────┐
Defaults        │     │      │     │
                ▼     ▼      ▼     ▼
             Beg   Int   Adv  Custom

Go to: Student Groups → Click group → Edit
```

---

## 📋 COMMON QUESTIONS

### Q: "Can I use different settings for different users?"

```
A: YES! Use Student Groups.
   ├─ Create "Group A" → Add users → Set overrides
   ├─ Create "Group B" → Add users → Set overrides
   └─ Ungrouped users → Get global defaults

This lets you:
✓ Charge different prices
✓ Use different AI models
✓ Set different rate limits
✓ Control script length per group
```

### Q: "What happens if I leave a field blank?"

```
A: It uses the GLOBAL DEFAULT for that field.

Example:
Global: Cost = $0.50, AI = gpt-4o-mini
Group override: Cost = $0.25, AI = (blank)

Result:
├─ Cost: $0.25 (from override)
└─ AI Model: gpt-4o-mini (from global, because blank)
```

### Q: "Can I change settings for just one user?"

```
A: Not directly, but you can:
   ├─ Create a group with 1 user, set custom overrides
   └─ Or ask developer for custom SQL query

Better: Use broad groups (Beginners, Advanced, etc)
```

### Q: "What if I accidentally set wrong values?"

```
A: Don't worry! Just:
   ├─ Go back to the group/global settings
   ├─ Fix the value
   ├─ Save
   └─ Changes apply immediately

No restart needed, no data loss.
```

### Q: "Can I see which users will be affected?"

```
A: YES!
   1. Go to: Student Groups
   2. Click the group name
   3. Scroll to: Users section
   4. See list of affected users
   5. Scroll to: Settings Override
   6. See which settings are changed
```

---

## 🎯 TYPICAL ADMIN WORKFLOW

### Week 1: Initial Setup

```
1. Go to: Global Podcast Defaults
   └─ Set defaults that make sense
   └─ AI Model: gpt-4o-mini (balanced)
   └─ Cost: $0.50 (baseline)
   └─ Cooldown: 24 hours (fair)

2. Go to: Student Groups
   └─ Create "Beginners"
   └─ Create "Advanced"
   └─ Assign users to groups

3. Go to: Beginners → Settings Override
   └─ Cost: $0.25 (cheaper for learning)
   └─ Script length: 800 words (shorter lessons)

4. Go to: Advanced → Settings Override
   └─ AI Model: gpt-4-turbo (smarter)
   └─ Cooldown: 0 hours (unlimited use)
   └─ Cost: $1.00 (premium pricing)
```

### Week 2+: Monitor & Adjust

```
1. Check: How many podcasts are users generating?
2. Monitor: Are costs what you expected?
3. Gather: User feedback on AI quality
4. Adjust: Tweak settings based on feedback
5. Repeat: Check weekly, adjust as needed
```

---

## 🎓 MENTAL MODEL

Think of it like a restaurant menu:

```
GLOBAL DEFAULTS = "House Special"
├─ Ingredients: X, Y, Z
├─ Price: $10
├─ Portion: Normal
└─ Available to: Everyone

GROUP OVERRIDES = "Customizations"
├─ "Vegetarian plate" = (ingredients changed)
├─ "Small portion" = (size changed)
├─ "Premium add-ons" = (price higher)
└─ Available to: Specific customers

HOW IT WORKS:
├─ Regular customer: Gets house special
├─ Vegetarian customer: Gets house special + vegetarian changes
├─ Premium customer: Gets house special + premium changes
└─ Regular + vegetarian: Could get both changes combined!
```

---

## 🎉 YOU NOW UNDERSTAND!

```
✓ What the two-level system is
✓ How Global Defaults work
✓ How Group Overrides work
✓ How to make changes
✓ What "blank" means (use global)
✓ How to set up groups
✓ Why this design is useful

Next step: Log in to Django admin and try it!
```

**Remember**:

- 🌍 Global = Everyone
- 👥 Groups = Specific users
- ✏️ Overrides = What's different
- ⬜ Blank = Use global
- 🎯 Simple!
