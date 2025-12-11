# 🎯 Secondary Language Field - Exact Location & Details

## Where It Is

### On the Admin Form (After Clicking "Generate Script Text")

```
The customization form appears below the selected items:

┌─────────────────────────────────────────────────────────────┐
│  ✏️ Customize Your Podcast Script                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Selected 2 item(s):                                       │
│  • 📚 English Mastery                                      │
│  • 📖 Grammar Basics                                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 📂 Category / Subject (e.g., "Business English")   │   │
│  │ [____________________________________]             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🎯 Specific Topic (e.g., "Email writing")         │   │
│  │ [____________________________________]             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 👤 Your Profession (e.g., "Sales manager")        │   │
│  │ [____________________________________]             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🗣️ Preferred Language *                            │   │
│  │ [English ▼]                                        │   │
│  │  English (en)                                      │   │
│  │  Spanish (es)                                      │   │
│  │  French (fr)                                       │   │
│  │  German (de)                                       │   │
│  │  Japanese (ja)                                     │   │
│  │  Italian (it)                                      │   │
│  │  Portuguese (pt)                                   │   │
│  │  Russian (ru)                                      │   │
│  │  Korean (ko)                                       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🌐 Secondary Language (optional)          ✨ NEW!  │   │
│  │ (for comparison/bilingual content)                 │   │
│  │ [Spanish ▼]    ← Can select any language          │   │
│  │  None - Single language only                       │   │
│  │  English (en)                                      │   │
│  │  Spanish (es)                                      │   │
│  │  French (fr)                                       │   │
│  │  German (de)                                       │   │
│  │  Japanese (ja)                                     │   │
│  │  Italian (it)                                      │   │
│  │  Portuguese (pt)                                   │   │
│  │  Russian (ru)                                      │   │
│  │  Korean (ko)                                       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 📝 Additional Notes                                │   │
│  │ [____________________________________]             │   │
│  │ [____________________________________]             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [✏️ Generate Script Text]  [Cancel]               │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## The Secondary Language Field Details

### HTML Structure
```html
<div class="form-group">
    <label>🌐 Secondary Language (optional - for comparison/bilingual content)</label>
    <select id="form-language-secondary">
        <option value="">None - Single language only</option>
        <option value="en">English</option>
        <option value="es">Spanish (Español)</option>
        <option value="fr">French (Français)</option>
        <option value="de">German (Deutsch)</option>
        <option value="ja">Japanese (日本語)</option>
        <option value="it">Italian (Italiano)</option>
        <option value="pt">Portuguese (Português)</option>
        <option value="ru">Russian (Русский)</option>
        <option value="ko">Korean (한국어)</option>
    </select>
</div>
```

### Styling (CSS)
```css
.form-group {
    margin-bottom: 12px;
}

.form-group label {
    display: block;
    font-weight: bold;
    margin-bottom: 4px;
    font-size: 12px;
    color: #333;
}

.form-group select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
    font-family: Arial, sans-serif;
    box-sizing: border-box;
}
```

### Field Position
- **Location:** Below "Preferred Language" field
- **Above:** "Additional Notes" field
- **CSS Class:** `form-group`
- **Input ID:** `form-language-secondary`
- **Default Value:** "" (empty string = no secondary language)

---

## How It Works (Step by Step)

### Step 1: User Selects Primary Language
```
User clicks on "Preferred Language" dropdown:
[English ▼]

Selects "English"

Result: language = "en"
```

### Step 2: User Selects Secondary Language (NEW!)
```
User clicks on "Secondary Language" dropdown:
[None - Single language only ▼]

Can choose:
- "None" (default) - English only
- "Spanish" - Bilingual English+Spanish
- "French" - Bilingual English+French
- etc.

User selects "Spanish":
[Spanish ▼]

Result: language_secondary = "es"
```

### Step 3: Form Data Collected
```javascript
const languageSecondary = document.getElementById('form-language-secondary').value;
// Result: "es"

// Sent to backend:
{
  items: [...],
  category: "Business English",
  topic: "Email writing",
  profession: "Sales manager",
  language: "en",
  language_secondary: "es",  ← NEW!
  notes: "..."
}
```

### Step 4: Backend Processes
```python
language_secondary = data.get('language_secondary', '')
# Result: "es"

# Passed to prompt builder:
prompt = _build_multi_item_prompt(
    items=items,
    category=category,
    topic=topic,
    profession=profession,
    language=language,
    language_secondary=language_secondary,  ← NEW!
    notes=notes
)
```

### Step 5: LLM Receives Instructions
```
LLM Prompt includes:
"Language: en"
"Secondary Language: es"
"Include bilingual content in both en and es..."

LLM generates:
ENGLISH: "Follow up on the proposal"
SPANISH: "Hacer seguimiento de la propuesta"
```

---

## Field Behavior

### If Secondary Language = "" (Default)
```
Script generated in PRIMARY LANGUAGE ONLY
Example:
  "Follow up on the proposal"
  "Request action on the agreement"
  "Negotiate the timeline"
  (English only)
```

### If Secondary Language = "es" (Spanish)
```
Script generated in BOTH LANGUAGES
Example:
  "Follow up on the proposal"
  "Hacer seguimiento de la propuesta"
  
  "Request action on the agreement"
  "Solicitar acción en el acuerdo"
  
  "Negotiate the timeline"
  "Negociar el cronograma"
  (English + Spanish)
```

### If Secondary Language = Primary Language
```
Script includes both
(AI smart enough to notice same language selected)

If Primary=English, Secondary=English:
→ Just English content (no duplication)
```

---

## Available Languages

| Code | Language | Native |
|------|----------|--------|
| en | English | English |
| es | Spanish | Español |
| fr | French | Français |
| de | German | Deutsch |
| ja | Japanese | 日本語 |
| it | Italian | Italiano |
| pt | Portuguese | Português |
| ru | Russian | Русский |
| ko | Korean | 한국어 |

### Combinations
- **All 81 combinations supported** (9 × 9)
- Primary + Secondary can be any language
- Or Primary alone (Secondary = "None")

---

## Common Use Cases

### Use Case 1: Language Learning
```
Primary: Spanish (learning)
Secondary: English (native)

Result: 
"Buenos días" (Spanish)
"Good morning" (English translation)
(Helps learn Spanish with English support)
```

### Use Case 2: Bilingual Audience
```
Primary: English
Secondary: Spanish

Result:
"Welcome to the workshop"
"Bienvenido al taller"
(Both Spanish-English speakers understand)
```

### Use Case 3: Translation Reference
```
Primary: French
Secondary: German

Result:
"Bonjour" (French)
"Guten Tag" (German)
(Compare how same concept expressed in 2 languages)
```

### Use Case 4: Single Language (Default)
```
Primary: English
Secondary: None

Result:
"This is a complete script in English only"
(No secondary language content)
```

---

## JavaScript Integration

### Capturing the Value
```javascript
function generateScriptTextFromSelection() {
    const selectedItems = document.querySelectorAll('.course-item.selected, ...');
    const category = document.getElementById('form-category').value;
    const topic = document.getElementById('form-topic').value;
    const profession = document.getElementById('form-profession').value;
    const language = document.getElementById('form-language').value;
    
    // NEW: Capture secondary language
    const languageSecondary = document.getElementById('form-language-secondary').value;
    
    const notes = document.getElementById('form-notes').value;
    
    // Send to backend
    fetch('/api/admin/ajax/generate-script/', {
        method: 'POST',
        headers: {...},
        body: JSON.stringify({
            items: items,
            category: category,
            topic: topic,
            profession: profession,
            language: language,
            language_secondary: languageSecondary,  // NEW!
            notes: notes
        })
    })
}
```

### Event Listener
```javascript
// When form appears, button gets event listener:
document.getElementById('generate-text-btn').addEventListener('click', function() {
    generateScriptTextFromSelection();  // Collects secondary language
});
```

---

## Backend Integration

### Python Function
```python
@login_required
@user_passes_test(is_admin_or_staff)
def generate_script_ajax(request):
    try:
        data = json.loads(request.body)
        
        # Capture all fields INCLUDING secondary language
        language_secondary = data.get('language_secondary', '')
        # Result: "" or "es" or "fr" or any code
        
        # Pass to prompt builder
        prompt = _build_multi_item_prompt(
            items=items,
            category=category,
            topic=topic,
            profession=profession,
            language=language,
            language_secondary=language_secondary,  # NEW!
            notes=notes
        )
        
        # Call LLM with prompt including secondary language info
        script = _generate_script_with_llm(prompt, language)
        
        return JsonResponse({
            'success': True,
            'script': script
        })
```

---

## Testing the Field

### Test 1: Field Exists
```
1. Go to admin form
2. Select user & items
3. Click "Generate Script Text"
4. ✅ Secondary Language dropdown appears
5. ✅ Has 10 options (None + 9 languages)
```

### Test 2: Default Value
```
1. Form appears
2. Check Secondary Language field
3. ✅ Default is "None - Single language only"
```

### Test 3: Can Change
```
1. Click Secondary Language dropdown
2. Select "Spanish"
3. ✅ Value changes to "es"
4. Click Generate
5. ✅ Backend receives "es"
```

### Test 4: Bilingual Generation
```
1. Fill form:
   Primary: English
   Secondary: Spanish ← NEW!
2. Click Generate
3. ✅ Script has English + Spanish content
```

### Test 5: Single Language (Backward Compatible)
```
1. Fill form:
   Primary: English
   Secondary: (leave as "None") ← Default
2. Click Generate
3. ✅ Script is English only
   (no secondary language content)
```

---

## Debugging

### If Secondary Language Not Working

**Check 1: Field Exists**
```
Browser DevTools (F12):
Elements tab → Find id="form-language-secondary"
✅ Should exist
❌ If not, form didn't load properly
```

**Check 2: Value Captured**
```
Browser Console (F12):
> document.getElementById('form-language-secondary').value
✅ Should return: "" or "es" or "fr" etc.
❌ If error, field doesn't exist
```

**Check 3: Sent to Backend**
```
Network tab (F12):
POST /api/admin/ajax/generate-script/
Look at Request body (Payload)
✅ Should have: "language_secondary": "es"
❌ If missing, JavaScript not capturing it
```

**Check 4: Backend Received**
```
Server logs:
Check for: data.get('language_secondary', '')
✅ Should print value
❌ If not in logs, request malformed
```

---

## Summary

The **Secondary Language Field:**
- ✅ Located below "Preferred Language" in form
- ✅ Optional (defaults to "None")
- ✅ 9 languages + "None" option
- ✅ Captured via `form-language-secondary` ID
- ✅ Sent to backend as `language_secondary`
- ✅ Used in LLM prompts for bilingual content
- ✅ 100% backward compatible
- ✅ Ready to use now!

