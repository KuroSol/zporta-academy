# 👥 User Categories Feature - Complete Guide

## Overview

You can now organize users into **categories/groups** and give each group **different configurations**!

For example:
- **Teachers** group → Premium features, longer podcasts
- **Students** group → Basic features, limited daily generations
- **Trial Users** group → Very limited features, short podcasts
- **VIP Users** group → All features, unlimited generations

---

## How It Works

```
User (e.g., Alex)
    ↓
Is member of: Teachers Category
    ↓
Teachers Category has Config:
    - LLM Provider: GPT-4 (premium)
    - TTS Provider: ElevenLabs (natural)
    - Max Generations: Unlimited
    - Cost: $1.00 per generation
    ↓
When Alex generates a podcast → Uses Teachers config!
```

---

## 📋 Setting Up Categories

### Step 1: Create a Category

Go to Django admin:
```
http://localhost:8000/admin/
```

Click: **Dailycast** → **User Categories** → **Add User Category**

Fill form:
```
Name: Teachers
Description: Premium teacher accounts with full features
Is Active: ✓ Checked
Users: (select teachers)
```

Click: **Save**

### Step 2: Configure the Category

After creating the category, click on it again. You'll see:

```
┌─ Teachers (Admin) ──────────────────┐
│                                     │
│ Name: Teachers                      │
│ Description: Premium teacher...     │
│ Users: (shows selected users)       │
│                                     │
│ ┌─ Configuration ──────────────────┐│
│ │                                  ││
│ │ Enabled: ✓                       ││
│ │ Default Language: English        ││
│ │ Default Output: Text & Audio     ││
│ │                                  ││
│ │ Default LLM: GPT-4o-mini         ││
│ │ OpenAI Model: gpt-4-turbo        ││
│ │                                  ││
│ │ Default TTS: ElevenLabs          ││
│ │ Speaking Rate: 1.0 (normal)      ││
│ │                                  ││
│ │ Script Word Limit: 1000          ││
│ │ Cooldown Hours: 24               ││
│ │ Max Generations/Day: 10          ││
│ │ Cost per Generation: $1.00       ││
│ │                                  ││
│ └──────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

Fill in the configuration fields and click **Save**

---

## 👥 Example Categories to Create

### 1. Teachers
```
Name: Teachers
Description: Premium accounts for active teachers
- Default LLM: GPT-4o-mini
- Default TTS: ElevenLabs
- Max Generations/Day: 20 (unlimited)
- Cooldown: 0 hours (no wait)
- Cost: $2.00 (premium pricing)
```

### 2. Students
```
Name: Students
Description: Student accounts with limited features
- Default LLM: Template (no API cost)
- Default TTS: Google TTS
- Max Generations/Day: 3
- Cooldown: 24 hours
- Cost: $0.10 (discounted)
```

### 3. Trial Users
```
Name: Trial Users
Description: New users on trial
- Default LLM: Template
- Default TTS: Google TTS
- Max Generations/Day: 1
- Cooldown: 48 hours
- Cost: Free ($0.00)
```

### 4. VIP Users
```
Name: VIP Users
Description: Premium VIP customers
- Default LLM: GPT-4 (best)
- Default TTS: ElevenLabs
- Max Generations/Day: Unlimited (0)
- Cooldown: 0 hours
- Cost: $5.00 (premium)
```

---

## 🔧 Using Categories in Code

### Get Config for a User

```python
from dailycast.category_helpers import get_category_config

user = User.objects.get(username='alex')
config = get_category_config(user)

# Access config settings
print(config.default_language)      # e.g., "en"
print(config.default_tts_provider)  # e.g., "elevenlabs"
print(config.cooldown_hours)        # e.g., 24
```

### Get Specific Settings

```python
from dailycast.category_helpers import (
    get_tts_provider_for_user,
    get_llm_provider_for_user,
    get_max_generations_per_day_for_user,
    get_cost_per_generation_for_user,
)

user = User.objects.get(username='alex')

tts = get_tts_provider_for_user(user)           # "elevenlabs"
llm = get_llm_provider_for_user(user)           # "openai"
max_gen = get_max_generations_per_day_for_user(user)  # 10
cost = get_cost_per_generation_for_user(user)   # 1.00
```

### Get User's Categories

```python
from dailycast.category_helpers import get_user_categories_for_display

user = User.objects.get(username='alex')
categories = get_user_categories_for_display(user)
print(categories)  # ['Teachers', 'Premium Users']
```

### Add User to Category

```python
from dailycast.category_helpers import add_user_to_category

user = User.objects.get(username='new_teacher')
add_user_to_category(user, 'Teachers')
# User is now in Teachers category with Teachers config!
```

---

## 📊 Admin Interface

### View User Categories

Go to: **Dailycast** → **User Categories**

You'll see a list:
```
Name            | Users | Config Status | Created
─────────────────────────────────────────────────
Teachers        | 15    | ✅ Configured | 2025-12-10
Students        | 45    | ✅ Configured | 2025-12-10
Trial Users     | 8     | ✅ Configured | 2025-12-10
VIP Users       | 3     | ✅ Configured | 2025-12-10
```

Click any category to edit it and manage users/settings.

### View Category Configs

Go to: **Dailycast** → **User Category Configurations**

You'll see:
```
Category   | Enabled | Language | LLM        | TTS        | Cooldown | Cost
──────────────────────────────────────────────────────────────────────────
Teachers   | ✓       | English  | GPT-4      | ElevenLabs | 24h      | $2.00
Students   | ✓       | English  | Template   | Google TTS | 24h      | $0.10
Trial      | ✓       | English  | Template   | Google TTS | 48h      | Free
VIP        | ✓       | English  | GPT-4      | ElevenLabs | None     | $5.00
```

---

## 🎯 Use Cases

### Case 1: Different Features by User Type
```python
# Teacher gets premium features
teacher_config = get_category_config(teacher_user)
print(teacher_config.default_llm_provider)  # "openai"
print(teacher_config.max_generations_per_day)  # 20

# Student gets limited features
student_config = get_category_config(student_user)
print(student_config.default_llm_provider)  # "template"
print(student_config.max_generations_per_day)  # 3
```

### Case 2: Different Languages per Group
```python
# Japan-based teachers default to Japanese
japan_teachers_config = get_category_config(user)  # Category: Japan Teachers
print(japan_teachers_config.default_language)  # "ja"

# US teachers default to English
us_teachers_config = get_category_config(user)  # Category: US Teachers
print(us_teachers_config.default_language)  # "en"
```

### Case 3: Pricing Based on Category
```python
cost = get_cost_per_generation_for_user(user)
# Teacher: $2.00
# Student: $0.10
# Trial: $0.00
# VIP: $5.00
```

---

## 🚀 Database Schema

### UserCategory Table
```
id | name        | description        | is_active | created_at
────────────────────────────────────────────────────────────────
1  | Teachers    | Premium teachers   | true      | 2025-12-10
2  | Students    | Student accounts   | true      | 2025-12-10
3  | Trial Users | Trial period       | true      | 2025-12-10
```

### UserCategoryConfig Table
```
id | category_id | enabled | llm_provider | tts_provider | cooldown_hours | cost
───────────────────────────────────────────────────────────────────────────────
1  | 1 (Teachers)| true    | openai       | elevenlabs   | 24             | 2.00
2  | 2 (Students)| true    | template     | google       | 24             | 0.10
3  | 3 (Trials)  | true    | template     | google       | 48             | 0.00
```

### UserCategory_users Junction Table
```
usercategory_id | user_id
─────────────────────────
1 (Teachers)    | 5 (Alex)
1 (Teachers)    | 12 (Jane)
2 (Students)    | 20 (Tom)
2 (Students)    | 21 (Sarah)
```

---

## 🔄 How Config is Used in Generation

When a user generates a podcast:

```
1. User requests podcast generation
   ↓
2. System checks: What category is this user in?
   ↓
3. Loads that category's config (or falls back to global config)
   ↓
4. Uses category-specific settings:
   - LLM Provider
   - TTS Provider
   - Script Length
   - Cooldown
   - Cost
   ↓
5. Generates podcast respecting all settings
```

---

## 📝 Available Helper Functions

```python
from dailycast.category_helpers import *

# Get category info
get_user_category(user)
get_user_categories_for_display(user)

# Get config
get_category_config(user)

# Get specific settings
get_tts_provider_for_user(user)
get_llm_provider_for_user(user)
get_language_for_user(user)
get_output_format_for_user(user)
get_word_limit_for_user(user)
get_cooldown_hours_for_user(user)
get_max_generations_per_day_for_user(user)
get_cost_per_generation_for_user(user)

# Manage users
add_user_to_category(user, category_name)
remove_user_from_category(user, category_name)
get_users_by_category(category_name)

# Manage categories
create_category(name, description, users)
create_category_config(category, **fields)
get_all_active_categories()
get_category_stats(category)
```

---

## ✅ Status

| Component | Status |
|-----------|--------|
| UserCategory model | ✅ Created |
| UserCategoryConfig model | ✅ Created |
| Admin interface | ✅ Complete |
| Helper functions | ✅ 20+ helpers |
| Migration | ✅ Applied (0007) |
| Database tables | ✅ Created |

---

## 🎉 Next Steps

1. **Create your categories**: Teachers, Students, VIP, etc.
2. **Configure each category**: Set LLM, TTS, limits, pricing
3. **Add users to categories**: Use admin or `add_user_to_category()`
4. **Wire into generation**: Use `get_category_config(user)` in podcast generation code

That's it! Your users will now get category-specific configurations! 🚀
