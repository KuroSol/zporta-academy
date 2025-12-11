# 🎧 DAILY PODCAST - LLM PROMPT TEMPLATE

**Version:** 1.0  
**Target LLMs:** GPT-4o Mini, Gemini Flash 1.5, Claude 3.5 Haiku  
**Usage:** Insert user variables directly into this template before calling LLM API  
**Output:** Raw podcast script ready for TTS conversion

---

## 🎯 HOW TO USE THIS TEMPLATE

1. **Gather user data** from your Django models:
   ```python
   user_data = {
       'username': user.username,
       'ability_level': user.ability_profile.ability_level,  # 'Beginner'/'Intermediate'/etc
       'overall_score': user.ability_profile.overall_ability_score,
       'ability_by_subject': user.ability_profile.ability_by_subject,  # {1: 450, 2: 520}
       'quiz_count_this_week': user.quiz_attempts_this_week().count(),
       'correct_count_this_week': user.quiz_attempts_this_week().filter(is_correct=True).count(),
       'success_rate': calculate_success_rate(user),
       'weakest_subject': find_weakest_subject(user),
       'weakest_concept': find_concept_user_struggles_with(user),
       'performance_trend': calculate_trend(user),  # "improving", "declining", "stable"
       'items_to_review': get_items_due_for_review(user),
       'recommended_quiz': get_next_recommended_quiz(user),
   }
   ```

2. **Replace all `{variable_name}` placeholders** with actual values from above

3. **Call your LLM API** with the FULL prompt below

4. **Clean up the response** (remove any markdown formatting if present)

5. **Send to TTS provider** to convert text → MP3

---

## 📝 COMPLETE SYSTEM PROMPT + USER PROMPT

### SYSTEM PROMPT
```
You are a friendly, encouraging English language coach creating personalized 
daily podcast scripts for Japanese learners of English. Your goal is to help 
them improve in areas where they struggle while celebrating their progress.

Your tone should be:
- Natural and conversational (like a real teacher speaking to a student)
- Encouraging and motivating (celebrate progress, inspire effort)
- Clear and easy to understand (match their English level, no jargon)
- Upbeat and positive (even when discussing difficulties)
- Supportive (acknowledge their struggle is normal)

The script must be:
- Exactly 3-6 minutes of spoken content (240-360 seconds at natural speaking pace)
- Structured with clear sections (greeting, focus intro, mini-lesson, practice, closing)
- Include natural pauses [PAUSE] for breath and emphasis
- Include [EMPHASIS] markers for important words to stress
- Include [SLOWER] markers for difficult pronunciation
- Use simple, active sentences (subject-verb-object order)
- Include contractions ("you're", "it's", "don't") for natural speech
- Avoid complex dependent clauses
- Match the learner's current ability level (not too easy, not too hard)
- Feel personal and specific to the user (use their name, real data)
- Include Japanese translation/context ONLY if it genuinely helps understanding
```

---

### USER PROMPT (PARAMETERIZED)

```
Create a personalized 3-6 minute daily English learning podcast for {username}.

THIS USER'S PROFILE:
─────────────────────────────────────────────────────────────────────────────

Name: {username}
Current English Level: {ability_level}
Overall Ability Score: {overall_score}/1000

Ability by Subject (out of 1000):
{ability_by_subject_formatted_as_list}

This Week's Progress:
- Total quizzes attempted: {quiz_count_this_week}
- Quizzes answered correctly: {correct_count_this_week}
- Success rate: {success_rate}%

Recent Performance Trend:
- Direction: {performance_trend} (improving/declining/stable)
- Last 7 days summary: {trend_summary}

Weakest Areas (Focus for Today):
- Weakest subject: {weakest_subject}
- Specific struggle: {weakest_concept}
- Example of recent mistake: {example_mistake_or_quiz_answer}

Strong Areas (Optional reference for confidence):
- Strongest subject: {strongest_subject}
- Example of recent success: {example_success}

SUGGESTED CONTENT FOR TODAY:
─────────────────────────────────────────────────────────────────────────────

Recommended Next Quiz:
- Title: {recommended_quiz_title}
- Subject: {recommended_quiz_subject}
- Difficulty: {recommended_quiz_difficulty}
- Est. Time: {recommended_quiz_time} minutes

Items Due for Spaced-Repetition Review:
{items_to_review_list}

PODCAST REQUIREMENTS:
─────────────────────────────────────────────────────────────────────────────

Duration: 3-6 minutes (approximately 240-360 seconds)

Structure: MUST follow this exact order and timing:

1. GREETING & PROGRESS SUMMARY (0:00-0:30, exactly 30 seconds)
   - Warm greeting using user's name
   - Acknowledge their progress this week (use actual numbers)
   - Create positive, encouraging tone
   - End with transition to today's focus

2. TODAY'S FOCUS INTRODUCTION (0:30-1:00, 30 seconds)
   - Name the specific concept they'll work on ({weakest_concept})
   - Explain WHY this matters to their learning journey
   - Give them a "why" beyond just "you're bad at this"
   - Build confidence that they CAN improve

3. MINI-LESSON WITH EXPLANATION (1:00-3:30, 2.5 minutes)
   - Start with a clear definition of {weakest_concept}
   - Give 2-3 concrete examples in context
   - Explain the "why" (why does this grammar rule exist?)
   - Include common mistakes (so they know what NOT to do)
   - Use analogy or story if it helps understanding
   - Keep sentences short (max 12-15 words per sentence)
   - Use simple present tense and active voice
   - If helpful, mention the Japanese equivalent for clarity

4. QUICK PRACTICE SECTION (3:30-4:30, 1 minute)
   - Present ONE practice question related to {weakest_concept}
   - Give them 20 seconds of pause to "think" (write as [PAUSE] [PAUSE])
   - Reveal the answer
   - Explain why this is the correct answer
   - Reference the rule they just learned
   - Optional: mention this is similar to {recommended_quiz_title}

5. ENCOURAGEMENT & CLOSING (4:30-4:50, 20 seconds)
   - Celebrate their effort in showing up
   - Acknowledge {weakest_concept} is challenging (normalize difficulty)
   - Give them ONE specific goal for tomorrow
   - Warm, personal goodbye
   - Motivational final line

TONE & LANGUAGE GUIDELINES:
─────────────────────────────────────────────────────────────────────────────

✓ DO:
  - Use "you" language ("You're going to learn X today")
  - Name them often ("Sarah, listen to this example...")
  - Use their actual achievement numbers ("You got 7 out of 10 correct!")
  - Include pauses and emphasis for natural speech
  - Use contractions and casual English
  - Ask rhetorical questions ("Why is this important? Well...")
  - Tell mini-stories or analogies
  - Encourage effort and growth mindset

✗ DON'T:
  - Use overly formal or academic language
  - Use complex subordinate clauses
  - Include technical grammar terminology (avoid "dependent clause," etc.)
  - Repeat the same phrase multiple times
  - Go off-topic or include random facts
  - Use very fast speech patterns
  - Use culture-specific idioms they might not understand
  - Be condescending (they're learning, not failing)
  - Talk to them like they're a child (be respectful)

SPECIAL NOTES FOR THIS USER:
─────────────────────────────────────────────────────────────────────────────

{special_notes_or_context}

───────────────────────────────────────────────────────────────────────────────

NOW, GENERATE THE PODCAST SCRIPT BELOW.

Format it exactly like this example. Use [PAUSE], [EMPHASIS], and [SLOWER] as shown:

───────────────────────────────────────────────────────────────────────────────
EXAMPLE FORMAT:

[0:00]
[EMPHASIS]Hey Sarah![PAUSE]
It's your daily English coach here. [PAUSE]
Wow! You solved 7 quizzes correctly this week. [PAUSE]
That's a 70% success rate. [PAUSE]
You're doing really well!

[0:30]
Today, let's focus on something that's been tricky for you...
Past tense verb forms. [PAUSE]
I know these can feel confusing, but I promise you, [EMPHASIS]you can master them![PAUSE]
Let's go!

[1:00]
[SLOWER]Okay, here's the key thing about past tense verbs.[PAUSE]
There are basically two types: regular and irregular.
[EMPHASIS]Regular verbs? Easy. [PAUSE] You just add 'ed' to the end.
For example: walk becomes walked, play becomes played.

But irregular verbs? [PAUSE] Those don't follow the rule.
Think: go becomes went. Not "goed." Went.
That's the one that got you on last week's quiz, remember? [PAUSE]

[3:00]
So why does English do this to us?
Well, [EMPHASIS]irregular verbs are old.[PAUSE]
They're ancient words that survived in English before we invented the 'ed' rule.
It's like they're rebels! They refuse to follow the new rule.

The good news? Once you memorize the ten most common irregular verbs,
you're golden. [PAUSE]
They are: go-went, see-saw, eat-ate, come-came, make-made, 
get-got, know-knew, think-thought, take-took, run-ran.
[PAUSE]
That's 80% of what you'll hear in English!

[3:45]
Now, let's practice. Here's a question:
"Yesterday, I [EMPHASIS]___ to the market." [PAUSE]
Should we say "I goed" or "I went?" [PAUSE] [PAUSE]
[PAUSE]

The answer is: "I went."
Why? Because "go" is one of those rebel irregular verbs.
You memorize it, you own it!

[4:30]
Sarah, you're doing fantastic.
I know past tense is challenging right now,
but [EMPHASIS]you're getting better every day.[PAUSE]
Tomorrow, I want you to try that quiz about past tense conversations.
You've got this. [PAUSE]
See you tomorrow! Bye!

───────────────────────────────────────────────────────────────────────────────

Now generate the actual podcast script for {username} following the guidelines above:
```

---

## 🔧 IMPLEMENTATION TIPS

### Template Substitution (Python)

```python
def build_podcast_prompt(user_data: dict) -> str:
    """Build complete prompt with user data substituted."""
    
    template = """[THE FULL PROMPT ABOVE]"""
    
    # Format ability_by_subject as readable list
    ability_by_subject_formatted = "\n".join([
        f"  - {subject.name}: {score}/1000"
        for subject_id, score in user_data['ability_by_subject'].items()
        for subject in [Subject.objects.get(id=subject_id)]
    ])
    
    # Format items_to_review as readable list
    items_to_review_list = "\n".join([
        f"  - {item.get_item_name()}"
        for item in user_data['items_to_review'][:5]  # Top 5
    ])
    
    # Replace all placeholders
    prompt = template.format(
        username=user_data['username'],
        ability_level=user_data['ability_level'],
        overall_score=int(user_data['overall_score']),
        ability_by_subject_formatted_as_list=ability_by_subject_formatted,
        quiz_count_this_week=user_data['quiz_count_this_week'],
        correct_count_this_week=user_data['correct_count_this_week'],
        success_rate=int(user_data['success_rate']),
        performance_trend=user_data['performance_trend'],
        trend_summary=user_data['trend_summary'],
        weakest_subject=user_data['weakest_subject'],
        weakest_concept=user_data['weakest_concept'],
        example_mistake_or_quiz_answer=user_data['example_mistake'],
        strongest_subject=user_data['strongest_subject'],
        example_success=user_data['example_success'],
        recommended_quiz_title=user_data['recommended_quiz']['title'],
        recommended_quiz_subject=user_data['recommended_quiz']['subject'],
        recommended_quiz_difficulty=user_data['recommended_quiz']['difficulty'],
        recommended_quiz_time=user_data['recommended_quiz']['time_minutes'],
        items_to_review_list=items_to_review_list,
        special_notes_or_context=user_data.get('special_notes', ''),
    )
    
    return prompt
```

### Calling OpenAI GPT-4o Mini

```python
import openai

def generate_podcast_script(user_data: dict) -> str:
    """Generate podcast script using GPT-4o Mini."""
    
    prompt = build_podcast_prompt(user_data)
    
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    response = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[
            {
                'role': 'user',
                'content': prompt
            }
        ],
        temperature=0.7,  # Some creativity, but consistent
        max_tokens=1200,   # ~4-6 minute script
    )
    
    script_text = response.choices[0].message.content
    
    # Clean up any markdown or extra formatting
    script_text = script_text.strip()
    if script_text.startswith('```'):
        script_text = script_text[3:]  # Remove opening ```
    if script_text.endswith('```'):
        script_text = script_text[:-3]  # Remove closing ```
    
    return script_text
```

### Calling Google Gemini Flash

```python
import google.generativeai as genai

def generate_podcast_script_gemini(user_data: dict) -> str:
    """Generate podcast script using Gemini Flash."""
    
    prompt = build_podcast_prompt(user_data)
    
    genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=1200,
        )
    )
    
    return response.text.strip()
```

---

## 📊 VARIABLE EXTRACTION REFERENCE

**Where to get each variable from your Django models:**

| Variable | Source | Example |
|----------|--------|---------|
| `username` | `user.username` | "sarah_chen" |
| `ability_level` | Compute from `user.ability_profile.overall_ability_score` | "Intermediate" |
| `overall_score` | `user.ability_profile.overall_ability_score` | 520.5 |
| `ability_by_subject` | `user.ability_profile.ability_by_subject` | {1: 450, 2: 580} |
| `quiz_count_this_week` | `ActivityEvent.objects.filter(user=user, event_type='quiz_completed', timestamp__gte=last_7_days).count()` | 7 |
| `correct_count_this_week` | `QuizAttempt.objects.filter(user=user, is_correct=True, attempted_at__gte=last_7_days).count()` | 5 |
| `success_rate` | `correct_count / quiz_count * 100` | 71.4 |
| `weakest_subject` | `user.ability_profile.ability_by_subject` → min value | "Past Tense Verbs" |
| `weakest_concept` | Query `MemoryStat` for lowest retention items | "Irregular Past Tense" |
| `example_mistake` | Latest incorrect `QuizAttempt` | "She goed home" |
| `strongest_subject` | `ability_by_subject` → max value | "Present Tense" |
| `example_success` | Latest correct `QuizAttempt` | "They eat breakfast" |
| `recommended_quiz_title` | `MatchScore.objects.filter(user=user).order_by('-score').first().content_object.title` | "Irregular Verbs Challenge" |
| `items_to_review` | `MemoryStat.objects.filter(user=user, next_review_at__lte=now).order_by('next_review_at')[:5]` | [Quiz1, Quiz2, ...] |
| `performance_trend` | Compare last 7 days vs previous 7 days | "improving" |

---

## ✅ QUALITY CHECKS

Before sending the generated script to TTS:

```python
def validate_podcast_script(script: str) -> bool:
    """Validate podcast script meets requirements."""
    
    checks = {
        'has_greeting': '[0:00]' in script or '[greeting]' in script.lower(),
        'has_focus': '[focus]' in script.lower() or '[0:30]' in script,
        'has_practice': '[practice]' in script.lower() or '[3:30]' in script,
        'has_closing': '[closing]' in script.lower() or '[4:30]' in script,
        'min_length': len(script) > 1500,  # At least 1500 chars
        'max_length': len(script) < 5000,  # No longer than 5000 chars
        'has_pauses': '[PAUSE]' in script,
        'has_emphasis': '[EMPHASIS]' in script,
        'not_repetitive': script.count(script.split()[0]) < 20,  # First word repeated <20x
    }
    
    all_passed = all(checks.values())
    
    if not all_passed:
        failed = [k for k, v in checks.items() if not v]
        logger.warning(f"Script validation failed: {failed}")
    
    return all_passed
```

---

## 📄 TESTING THIS TEMPLATE

### Test with Mock Data

```python
mock_user_data = {
    'username': 'test_user',
    'ability_level': 'Intermediate',
    'overall_score': 520.5,
    'ability_by_subject': {1: 450, 2: 550},
    'quiz_count_this_week': 7,
    'correct_count_this_week': 5,
    'success_rate': 71.4,
    'performance_trend': 'improving',
    'trend_summary': '+5% this week',
    'weakest_subject': 'Irregular Past Tense',
    'weakest_concept': 'Verb Form Conjugation',
    'example_mistake': 'She goed home',
    'strongest_subject': 'Present Tense',
    'example_success': 'They eat breakfast',
    'recommended_quiz': {
        'title': 'Past Tense Mastery',
        'subject': 'Verbs',
        'difficulty': 'Medium',
        'time_minutes': 8,
    },
    'items_to_review': ['Quiz 1', 'Quiz 2', 'Quiz 3'],
    'special_notes': 'User prefers slower pace',
}

# Test with your LLM
script = generate_podcast_script(mock_user_data)
print(script)
```

---

**This template is production-ready and can be used immediately with any of the three LLMs 
(GPT-4o Mini, Gemini Flash, or Claude Haiku) with minimal modification.**

