# Multi-Select Feature - Visual Diagrams & Architecture

## 1. User Interface Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   Django Admin Podcast Form                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📝 Form Fields:                                                │
│  - User (dropdown)  ← Triggers AJAX load                        │
│  - Title           ← Pre-filled or user enters                  │
│  - Description     ← User enters                                │
│  - script_text     ← GENERATED HERE                             │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  📚 Select Courses, Lessons & Quizzes:                          │
│                                                                 │
│  ┌─ Courses ────────────────────────────────────────────────┐  │
│  │ □ English Mastery          ← Click to select             │  │
│  │ □ Business Communication                                 │  │
│  │ ☑ French Basics            ← Selected (blue, checked)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Lessons ────────────────────────────────────────────────┐  │
│  │ □ Grammar Basics                                         │  │
│  │ ☑ Pronunciation Tips       ← Selected                    │  │
│  │ □ Verb Conjugation                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Quizzes ────────────────────────────────────────────────┐  │
│  │ ☑ Vocabulary Test          ← Selected                    │  │
│  │ □ Grammar Check                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ ✓ Selected Items (3 items selected) ────────────────────┐  │
│  │ [📚 French Basics ✕] [📖 Pronunciation Tips ✕] [✏️ V.Test] │  │
│  │                                                           │  │
│  │ Analytics Summary:                                        │  │
│  │ 📚 Courses: 1  |  📖 Lessons: 1  |  ✏️ Quizzes: 1        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  📋 Customize Your Script:  [Popup Form]                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Selected Items (3):                                      │   │
│  │ • 📚 French Basics                                       │   │
│  │ • 📖 Pronunciation Tips                                  │   │
│  │ • ✏️ Vocabulary Test                                     │   │
│  │                                                          │   │
│  │ Category/Subject: [Business French ________] *           │   │
│  │ Topic: [Workplace Communication ________]               │   │
│  │ Profession: [Hair Stylist in Paris ________]            │   │
│  │ Language: [English ▼]                                   │   │
│  │ Notes: [Keep it professional ___________]              │   │
│  │                                                          │   │
│  │ [✏️ Generate Script Text]  [Cancel]                     │   │
│  │                                                          │   │
│  │ ⏳ Generating script for 3 item(s)...                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  📝 Script Text: [Textarea with generated script]              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [PODCAST SCRIPT - French in Business                     │   │
│  │                                                          │   │
│  │ INTRODUCTION:                                            │   │
│  │ Welcome to today's podcast on French for business...    │   │
│  │                                                          │   │
│  │ MAIN CONTENT:                                            │   │
│  │ Today we're exploring three interconnected topics:      │   │
│  │ - French basics in the workplace                        │   │
│  │ - Professional pronunciation                            │   │
│  │ - Essential business vocabulary                         │   │
│  │                                                          │   │
│  │ Let's start with the fundamentals...                    │   │
│  │                                                          │   │
│  │ CONCLUSION:                                              │   │
│  │ By mastering these three areas together...              │   │
│  │ ...and you can now tackle any business conversation     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Save]  [Delete]  [Regenerate Audio]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Architecture

```
                    USER INTERFACE (Frontend)
                            │
                            ▼
                   ┌─────────────────┐
                   │  User Selects   │
                   │ Items (click)   │
                   └────────┬────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │ attachCourseSelection     │
                │ Handlers()                │
                │ - Toggle .selected class │
                │ - Update display         │
                └────────┬────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ updateSelectedItemsDisplay()       │
         │ - Count items by type             │
         │ - Show analytics box              │
         │ - Display selected item tags      │
         └──────────┬──────────────────────┘
                    │
                    ▼
          ┌──────────────────────┐
          │ User Clicks Form     │
          │ or Customization Btn │
          └──────────┬───────────┘
                     │
                     ▼
         ┌─────────────────────────────┐
         │ showCustomizationForm()      │
         │ - List all selected items   │
         │ - Show form fields          │
         │ - Show [Generate] button    │
         └──────────┬──────────────────┘
                    │
                    ▼
          ┌──────────────────────────────┐
          │ User Fills Customization     │
          │ - Category (required)        │
          │ - Topic (optional)           │
          │ - Profession (optional)      │
          │ - Language (optional)        │
          │ - Notes (optional)           │
          └──────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │ generateScriptTextFromSelection()  │
        │ 1. Validate selection exists       │
        │ 2. Validate category filled       │
        │ 3. Collect form data              │
        │ 4. Build items array              │
        │ 5. Show loading status            │
        └────────────┬─────────────────────┘
                     │
                     ▼
            NETWORK REQUEST
            ──────────────────
            POST /api/admin/ajax/generate-script/

            Headers:
            - Content-Type: application/json
            - X-CSRFToken: <token>

            Body:
            {
              "items": [
                {type, id, name, course},
                {type, id, name, course},
                ...
              ],
              "category": "...",
              "topic": "...",
              "profession": "...",
              "language": "...",
              "notes": "..."
            }
                     │
                     ▼
                BACKEND (Django)
            ──────────────────────────
            generate_script_ajax(request)
            │
            ├─ Parse JSON
            │
            ├─ Check format
            │  └─→ Has items array? → Multi-select format
            │      └─→ _build_multi_item_prompt()
            │  └─→ Single item? → Legacy format
            │      └─→ _build_script_prompt()
            │
            ├─ Build LLM prompt
            │  └─→ Includes all items
            │  └─→ Asks for integration
            │  └─→ Requests connections
            │  └─→ Enforces length
            │
            ├─ Call _generate_script_with_llm()
            │  │
            │  ├─→ Try LLM service
            │  │   └─→ intelligence.services.get_llm_response()
            │  │
            │  └─→ Fallback if LLM fails
            │      └─→ _generate_fallback_script()
            │
            └─ Return JSON response
                {
                  "success": true,
                  "script": "Generated script text...",
                  "message": "✅ Script generated..."
                }
                     │
                     ▼
            NETWORK RESPONSE
            ──────────────────
                     │
                     ▼
            Frontend receives response
            │
            ├─→ If success:
            │   ├─ Get textarea[name="script_text"]
            │   ├─ Insert script text
            │   ├─ Show success message
            │   └─ Scroll to script field
            │
            └─→ If error:
                ├─ Parse error message
                ├─ Show error message
                └─ Reset button state
                     │
                     ▼
            USER SEES RESULT
            ────────────────
            Script populated in form
            Ready to review/edit/save
```

---

## 3. Request/Response Format

```
REQUEST (Frontend → Backend)
═════════════════════════════════

{
  "items": [                          ← Key difference from legacy API
    {
      "type": "course",               ← 'course', 'lesson', or 'quiz'
      "id": "1",
      "name": "English Mastery",
      "course": "English Mastery"
    },
    {
      "type": "lesson",
      "id": "5",
      "name": "Grammar Basics",
      "course": "English Mastery"
    },
    {
      "type": "quiz",
      "id": "3",
      "name": "Verb Tenses",
      "course": "English Mastery"
    }
  ],
  "category": "Business English",     ← REQUIRED
  "topic": "Professional Comms",      ← Optional
  "profession": "Hair Stylist",       ← Optional
  "language": "en",                   ← Optional (default: en)
  "notes": "Keep it casual"           ← Optional
}


RESPONSE (Backend → Frontend)
═════════════════════════════

Success Response:
{
  "success": true,
  "script": "PODCAST SCRIPT - Business English\n\nINTRODUCTION:\nWelcome to...",
  "message": "✅ Script generated successfully for Business English"
}

Error Response:
{
  "success": false,
  "error": "Category/Subject is required"
}


LEGACY REQUEST (Still Supported)
════════════════════════════════

{
  "item_type": "course",              ← Old format (single item)
  "item_id": "1",
  "item_name": "English Mastery",
  "course_name": "English Mastery",
  "category": "Business English",
  "topic": "...",
  "profession": "...",
  "language": "en",
  "notes": "..."
}

Backend automatically detects format and uses appropriate handler.
```

---

## 4. Component Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   FRONTEND COMPONENTS                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Course/Lesson/Quiz List                                 │
│     ├─ Rendered by displayCourseInfo()                       │
│     ├─ Each item has data attributes:                        │
│     │  - data-type: 'course' | 'lesson' | 'quiz'            │
│     │  - data-id: Item ID                                    │
│     │  - data-name: Item name                                │
│     │  - data-course: Course name                            │
│     └─ Has click handler via attachCourseSelectionHandlers() │
│                                                              │
│  2. Selection State                                         │
│     ├─ Tracked via .selected class                          │
│     ├─ No database needed (purely UI state)                 │
│     ├─ Persists while form is open                          │
│     └─ Cleared on Cancel or Page Reload                     │
│                                                              │
│  3. Selected Items Display Box                              │
│     ├─ Created by updateSelectedItemsDisplay()              │
│     ├─ Shows all selected items with icons                  │
│     ├─ Shows count by type (analytics)                      │
│     ├─ Allows removing individual items                     │
│     ├─ Clickable to open customization form                 │
│     └─ Updates real-time as selections change               │
│                                                              │
│  4. Customization Form                                      │
│     ├─ Created by showCustomizationForm()                   │
│     ├─ Appears as popup/overlay                             │
│     ├─ Shows all selected items                             │
│     ├─ Has form fields:                                      │
│     │  - Category (required)                                 │
│     │  - Topic (optional)                                    │
│     │  - Profession (optional)                               │
│     │  - Language dropdown (optional)                        │
│     │  - Notes textarea (optional)                           │
│     └─ Has buttons: Generate | Cancel                        │
│                                                              │
│  5. Status Messages                                         │
│     ├─ showStatus() displays messages                        │
│     ├─ Color-coded: loading (⏳), success (✅), error (❌)  │
│     ├─ Auto-hide on success                                 │
│     └─ Persist on error until dismissed                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   BACKEND COMPONENTS                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. generate_script_ajax(request)                            │
│     ├─ Entry point for all script generation                │
│     ├─ Validates request format (JSON)                       │
│     ├─ Extracts customization parameters                     │
│     ├─ Detects format (multi-select vs legacy)              │
│     ├─ Routes to appropriate prompt builder                  │
│     ├─ Handles errors gracefully                            │
│     └─ Returns JSON response                                │
│                                                              │
│  2. _build_multi_item_prompt()                              │
│     ├─ Creates prompt for multiple items                    │
│     ├─ Counts items by type                                 │
│     ├─ Lists all items                                      │
│     ├─ Includes customization parameters                    │
│     ├─ Asks for integration, not concatenation              │
│     ├─ Enforces appropriate length                          │
│     └─ Returns formatted prompt string                      │
│                                                              │
│  3. _build_script_prompt()                                  │
│     ├─ Creates prompt for single item (legacy)              │
│     ├─ Included for backward compatibility                  │
│     ├─ Works with old API format                            │
│     └─ Returns formatted prompt string                      │
│                                                              │
│  4. _generate_script_with_llm()                             │
│     ├─ Calls intelligence service                           │
│     ├─ Passes prompt and language                           │
│     ├─ Gets response from LLM                               │
│     ├─ Falls back if LLM unavailable                        │
│     └─ Returns script text                                  │
│                                                              │
│  5. _generate_fallback_script()                             │
│     ├─ Generates template script                            │
│     ├─ Used when LLM service unavailable                    │
│     ├─ Professional structure                               │
│     └─ Returns template script text                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. State Machine

```
┌─────────────────┐
│   INITIAL STATE │
│   No selection  │
└────────┬────────┘
         │
         │ User clicks item
         ▼
┌──────────────────────┐
│   SELECTED (1 item)  │
│ Selected Items Box   │
│ appears + Analytics  │
└────────┬─────────────┘
         │
         │ User clicks another item
         ▼
┌──────────────────────┐
│   SELECTED (N items) │
│ Count updates in box │
│ Analytics refreshes  │
└────────┬─────────────┘
         │
         │ User clicks Selected Items Box
         ▼
┌─────────────────────────┐
│  CUSTOMIZATION FORM     │
│  User fills form fields │
│  (Category required)    │
└────────┬────────────────┘
         │
         │ User clicks "Generate Script Text"
         ▼
┌──────────────────────┐
│   GENERATING (...)   │
│ ⏳ Loading message   │
│ Button disabled      │
└────────┬─────────────┘
         │
         ├─→ Success
         │   ▼
         │   ┌──────────────────────┐
         │   │   SCRIPT GENERATED   │
         │   │ ✅ Success message   │
         │   │ Script in textarea   │
         │   └────────┬─────────────┘
         │            │
         │            │ User saves form
         │            ▼
         │            ┌──────────┐
         │            │  SAVED   │
         │            └──────────┘
         │
         └─→ Error
             ▼
         ┌──────────────────────┐
         │   ERROR SHOWN (❌)   │
         │ Button re-enabled    │
         │ User can retry       │
         └──────────────────────┘
```

---

## 6. CSS Class Architecture

```
Course/Lesson/Quiz Item Container
│
├─ .course-item | .lesson-item | .quiz-item
│  ├─ data-type
│  ├─ data-id
│  ├─ data-name
│  ├─ data-course
│  │
│  └─ States:
│     ├─ Default: White background, blue text
│     ├─ Hover: Light blue background
│     └─ .selected: Blue background, white text, ✓ icon


Selected Items Box
│
├─ .selected-items-box
│  ├─ Background: #f0f7ff (light blue)
│  ├─ Border: 2px solid #1e90ff (blue)
│  ├─ Padding: 15px
│  ├─ Rounded corners: 8px
│  │
│  └─ Contains:
│     ├─ .item-tag (for each selected item)
│     │  ├─ White background
│     │  ├─ Blue border
│     │  ├─ Inline-block
│     │  ├─ Removable via [✕] button
│     │  └─ Margin: 5px
│     │
│     └─ .analytics-info
│        ├─ Font-size: 0.9em
│        ├─ Color: #666
│        ├─ Top border-line
│        └─ Lists counts by type


Customization Form
│
├─ .customization-form
│  ├─ Position: absolute/fixed overlay
│  ├─ Background: white
│  ├─ Shadow: 0 2px 8px rgba(0,0,0,0.15)
│  ├─ Max-width: 500px
│  │
│  └─ Contains:
│     ├─ Selected items list
│     ├─ Form groups
│     │  ├─ .form-group
│     │  │  ├─ label
│     │  │  └─ input | select | textarea
│     │  └─ Category is required
│     │
│     └─ Button group
│        ├─ .action-btn.generate-text-btn
│        │  └─ Color: #27ae60 (green)
│        └─ .action-btn.cancel-btn
│           └─ Color: #95a5a6 (gray)


Status Messages
│
├─ #generate-status | .status-message
│  │
│  └─ States (via CSS classes):
│     ├─ .status-loading
│     │  ├─ Background: #e3f2fd (light blue)
│     │  ├─ Border: 1px solid #bbdefb
│     │  └─ Text: ⏳ ...
│     │
│     ├─ .status-success
│     │  ├─ Background: #e8f5e9 (light green)
│     │  ├─ Border: 1px solid #c8e6c9
│     │  └─ Text: ✅ ...
│     │
│     └─ .status-error
│        ├─ Background: #ffebee (light red)
│        ├─ Border: 1px solid #ffcdd2
│        └─ Text: ❌ ...
```

---

## 7. Error Handling Flow

```
┌─────────────────────────────────────┐
│   User Action (Click Generate)      │
└────────────┬────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  Validation Layer (Frontend)         │
├──────────────────────────────────────┤
│  ✓ Items selected?                   │
│    └─→ No: Show "Please select..."   │
│        Error & return                │
│                                      │
│  ✓ Category filled?                  │
│    └─→ No: Show "Please enter..."    │
│        Error & return                │
│                                      │
│  ✓ All checks pass                   │
│    └─→ Proceed to API call           │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│     Network Request                  │
├──────────────────────────────────────┤
│  POST /api/admin/ajax/generate-script/
│                                      │
│  Error Handling:                     │
│  ├─→ Network error (no response)     │
│  │   └─→ Show "Network error"        │
│  │       console logs it             │
│  │                                   │
│  ├─→ Status 400 (Bad request)        │
│  │   └─→ Parse error message         │
│  │   └─→ Show error                  │
│  │                                   │
│  ├─→ Status 500 (Server error)       │
│  │   └─→ Show server error message   │
│  │   └─→ Log error                   │
│  │                                   │
│  └─→ Status 200 (Success)            │
│      └─→ Parse response JSON         │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Backend Validation (generate_      │
│   script_ajax)                       │
├──────────────────────────────────────┤
│  ✓ Valid JSON?                       │
│    └─→ No: Return 400                │
│        {success: false,              │
│         error: "Invalid JSON"}       │
│                                      │
│  ✓ Category provided?                │
│    └─→ No: Return 400                │
│        {success: false,              │
│         error: "Category required"}  │
│                                      │
│  ✓ LLM generation successful?        │
│    └─→ No: Return 500                │
│        {success: false,              │
│         error: "LLM failed"}         │
│        Use fallback if available     │
│                                      │
│  ✓ All validations pass              │
│    └─→ Return 200                    │
│        {success: true, script: ".."}│
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Frontend Response Handler          │
├──────────────────────────────────────┤
│  if (data.success):                  │
│    ├─→ Insert script in textarea     │
│    ├─→ Show success message          │
│    ├─→ Scroll to script              │
│    └─→ Reset button state            │
│                                      │
│  else:                               │
│    ├─→ Parse error message           │
│    ├─→ Show error message            │
│    ├─→ Reset button state            │
│    └─→ Keep form open               │
│        (user can retry)              │
└──────────────────────────────────────┘
```

---

## 8. Message Flow Example

```
┌──────────────────────────────────────────────────────────────────┐
│  User selects 3 items and generates script - Step by Step       │
└──────────────────────────────────────────────────────────────────┘

Step 1: User clicks 3 courses
├─ attachCourseSelectionHandlers() fires
├─ Item 1: .selected class added
├─ Item 2: .selected class added
├─ Item 3: .selected class added
├─ updateSelectedItemsDisplay() called
└─ Shows box: "3 courses selected"
   Analytics: Courses: 3

Step 2: User clicks Selected Items box
├─ showCustomizationForm() called
├─ Form appears with:
│  ├─ Lists all 3 items
│  ├─ Category field (empty)
│  ├─ Topic field (empty)
│  └─ Buttons: [Generate] [Cancel]
└─ Form visible to user

Step 3: User fills Category = "Business English"
├─ Form data collected
├─ Other fields optional
└─ User clicks [Generate Script Text]

Step 4: generateScriptTextFromSelection() runs
├─ Validates 3 items selected ✓
├─ Validates category filled ✓
├─ Builds items array:
│  [{type: 'course', id: 1, name: 'Item1', course: 'Item1'},
│   {type: 'course', id: 2, name: 'Item2', course: 'Item2'},
│   {type: 'course', id: 3, name: 'Item3', course: 'Item3'}]
├─ Disables button
├─ Shows status: "⏳ Generating script for 3 item(s)..."
└─ Sends POST request

Step 5: Backend receives request
├─ generate_script_ajax(request)
├─ Parses JSON ✓
├─ Validates category ✓
├─ Detects items array (multi-select format)
├─ Calls _build_multi_item_prompt(items, category, ...)
├─ Creates prompt mentioning all 3 items
└─ Calls _generate_script_with_llm(prompt)

Step 6: LLM generates script
├─ Receives prompt with 3 items
├─ Generates 500-word integrated script
├─ Script mentions connections between items
├─ Returns script text to backend
└─ Backend validates script exists

Step 7: Backend returns response
├─ Returns 200 OK with:
│  {
│    "success": true,
│    "script": "[PODCAST SCRIPT...]",
│    "message": "✅ Script generated..."
│  }
└─ Sent to frontend

Step 8: Frontend receives response
├─ Parses JSON
├─ data.success = true ✓
├─ Finds textarea[name="script_text"]
├─ Inserts script text
├─ Re-enables button
├─ Shows: "✅ Script generated successfully for Business English"
├─ Scrolls to script field (smooth animation)
└─ User sees script in form

Step 9: User reviews script
├─ Script shows:
│  - Introduction mentioning all 3 courses
│  - Content integrated from all 3 courses
│  - Connections between topics
│  - Professional conclusion
├─ User can edit if needed
└─ User clicks [Save] in admin form

Step 10: Django saves podcast
├─ Form submitted normally
├─ script_text saved to database
├─ Other fields saved normally
├─ Success message shown
└─ Podcast created/updated

═════════════════════════════════════════════════════════════════════
✅ COMPLETE: User has generated and saved multi-item podcast script
═════════════════════════════════════════════════════════════════════
```

---

**Diagrams explain the architecture and user flow for multi-select podcast script generation.**
