# Multi-Select Implementation - Quick Reference Guide

## 🎯 What Was Built

You can now select **multiple courses, lessons, and quizzes** at the same time and generate podcast scripts that integrate all of them together.

---

## 📋 User Instructions

### Step 1: Open Django Admin Podcast Form

- Go to Django Admin → Dailycast → Daily Podcasts
- Click on a podcast to edit

### Step 2: Select Items (NEW!)

- Scroll to "📚 Select Courses, Lessons & Quizzes" section
- **Click any course/lesson/quiz to select it** (can select multiple!)
- Selected items appear in blue
- A box shows "Selected Items" with count like "2 courses, 3 lessons, 1 quiz"

### Step 3: Click Selected Items Box

- Click the "Selected Items" box that appears
- The customization form will pop up showing all your selections

### Step 4: Fill the Form

- **Category/Subject** (REQUIRED) - e.g., "Business English"
- Topic (optional) - e.g., "Professional Communication"
- Profession (optional) - e.g., "Hair Stylist in Germany"
- Language (optional) - Choose from 12+ languages
- Additional Notes (optional) - Style guide, tone, etc.

### Step 5: Generate Script

- Click **"✏️ Generate Script Text"** button
- The system will:
  1. Collect all your selected items
  2. Send them to the AI
  3. Generate a script that **integrates all topics together**
  4. Insert the script into the main form
- Wait for the "✅ Script generated successfully" message

### Step 6: Review & Save

- Review the generated script
- Edit if needed
- Click "Save" button in the admin form

---

## 🔧 Technical Details

### Frontend Changes

**File**: `dailycast/templates/admin/dailycast/dailypodcast/change_form.html`

**New Features**:

1. Multi-select toggle (click to select/deselect)
2. Selected items display box showing:
   - All selected items with icons
   - Count by type (courses, lessons, quizzes)
   - Removable item tags
3. Customization form that shows all selected items
4. `generateScriptTextFromSelection()` function that:
   - Collects all selected items data
   - Sends to backend as array
   - Inserts generated script into form

### Backend Changes

**File**: `dailycast/views_admin_ajax.py`

**New Features**:

1. Updated `generate_script_ajax()` to handle:
   - **NEW format**: `items` array with multiple items
   - **LEGACY format**: Single item (backward compatible)
2. New `_build_multi_item_prompt()` function that:
   - Creates LLM prompt with all selected items
   - Asks for integrated, cohesive script
   - Requests connections between topics
   - Appropriate length for multiple topics

---

## 📊 Data Structure

### Selected Items Format

```javascript
items = [
  {
    type: "course", // 'course', 'lesson', or 'quiz'
    id: "1", // Item ID in database
    name: "English Mastery", // Display name
    course: "English Mastery", // Course name (for lessons/quizzes)
  },
  {
    type: "lesson",
    id: "5",
    name: "Grammar Basics",
    course: "English Mastery",
  },
  // ... more items
];
```

### Backend Request

```json
{
  "items": [
    /* array as shown above */
  ],
  "category": "Business English",
  "topic": "Professional Communication",
  "profession": "Hair Stylist in Germany",
  "language": "en",
  "notes": "Keep it casual and friendly"
}
```

### LLM Prompt Example

The backend creates a prompt like:

```
Generate a comprehensive podcast script that integrates the following learning content:

**Selected Learning Items** (2 courses, 3 lessons, 1 quiz):
  • Course: English Mastery
  • Lesson: Grammar Basics
  • Lesson: Pronunciation
  • Lesson: Business Vocabulary
  • Quiz: Verb Tenses

**Category/Subject**: Business English
**Specific Topic**: Professional Communication
**Professional Context**: Hair Stylist in Germany
**Language**: en

Requirements:
1. Create a cohesive podcast script that weaves together all the selected items
2. Start with an engaging introduction that sets context for all topics
3. Structure the main content to flow logically between different items
4. Include connections and relationships between the topics covered
5. Keep the total length appropriate (400-700 words) but not too long
... (more requirements)
```

---

## ✅ Verification Checklist

- [x] Can select multiple courses by clicking
- [x] Can select multiple lessons by clicking
- [x] Can select multiple quizzes by clicking
- [x] Mixed selection works (courses + lessons + quizzes)
- [x] Selected items box shows all selections
- [x] Count shows correct number by type
- [x] Can remove individual items from selection
- [x] Customization form shows all selected items
- [x] Form asks for Category (required)
- [x] Form allows Topic, Profession, Language, Notes (optional)
- [x] Generate button sends all items to backend
- [x] Backend receives items as array
- [x] LLM generates integrated script
- [x] Script inserted into main form textarea
- [x] Success message shown after generation
- [x] Error messages shown for validation failures
- [x] Backward compatibility with old single-item API

---

## 🐛 Troubleshooting

### Issue: "Please select at least one course, lesson, or quiz"

**Solution**: Make sure you've clicked on at least one item before clicking the selected items box or generate button.

### Issue: "Please enter a Category/Subject"

**Solution**: Fill in the Category/Subject field in the customization form. This field is required.

### Issue: Script doesn't appear

**Troubleshooting**:

1. Check browser console for errors (F12 → Console)
2. Check that `script_text` textarea exists in the form
3. Wait longer for AI generation (can take 10-30 seconds)
4. Try with fewer items selected
5. Check Django logs for backend errors

### Issue: Old single-item API still works

**This is OK** - The system supports both:

- **New**: Multiple items via `items` array
- **Old**: Single item via `item_type`, `item_id`, etc.

---

## 📈 Analytics Integration (Next Phase)

The framework is ready for these enhancements:

1. **Completion Rate Analysis**

   - Fetch user's completion % for each course
   - Include in script: "You've completed 80% of course X"

2. **Performance Insights**

   - Get quiz scores for selected quizzes
   - Include in script: "Your strongest area: X, needs practice: Y"

3. **Smart Recommendations**

   - Analyze user's weak spots
   - Recommend focus areas based on analytics
   - Reorder selected items by learning importance

4. **Personalized Scripts**
   - Include user's actual performance data
   - Reference specific weak areas
   - Celebrate achievements

---

## 🚀 Deployment Status

**Status**: ✅ READY FOR PRODUCTION

All files have been updated:

- ✅ Frontend template (`change_form.html`)
- ✅ Backend views (`views_admin_ajax.py`)
- ✅ Error handling added
- ✅ Backward compatibility maintained
- ✅ Logging implemented

**To Deploy**:

1. Pull latest code
2. Run Django server: `python manage.py runserver`
3. Go to Django Admin → Dailycast → Daily Podcasts
4. Try the new multi-select feature

---

## 📚 Code References

### Frontend Functions

- `setupAJAXCourseLoader()` - Loads courses when user selected
- `attachCourseSelectionHandlers()` - Handles multi-select clicks
- `updateSelectedItemsDisplay()` - Updates selected items box
- `generateScriptTextFromSelection()` - NEW: Generates script from multiple items
- `showCustomizationForm()` - Shows form with selected items
- `regenerateAudio()` - Generates audio from script

### Backend Functions

- `generate_script_ajax()` - AJAX endpoint (handles both single & multi-item)
- `_build_multi_item_prompt()` - NEW: Creates prompt for multiple items
- `_build_script_prompt()` - Creates prompt for single item (legacy)
- `_generate_script_with_llm()` - Calls LLM service
- `_generate_fallback_script()` - Fallback when LLM unavailable

---

**Version**: 1.0
**Last Updated**: Today
**Status**: 🟢 Production Ready
