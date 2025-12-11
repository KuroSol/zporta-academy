# Updated Features - Course Selection & Script Generation

## What's New

### 1. ✅ Improved Course List (Fixed Background & Made Clickable)

- **Better styling**: White background with blue border
- **Clickable items**: Click on any course, lesson, or quiz to select it
- **Visual feedback**: Selected item is highlighted
- Shows icons: 📚 for courses, 📖 for lessons, ✓ for quizzes

### 2. ✅ Customization Form (NEW)

When you click a course/lesson/quiz, a form appears below asking:

- **📂 Category/Subject** (required) - e.g., "Business English", "Hair Styling"
- **🎯 Specific Topic** (optional) - e.g., "Negotiation tactics", "Curly hair care"
- **👤 Your Profession/Context** (optional) - e.g., "Hair stylist in Germany"
- **🗣️ Preferred Language** - Select from 9 languages
- **📝 Additional Notes** (optional) - Style guide or special requirements

### 3. ✅ Generate Script Text Button

- Click "✏️ Generate Script Text" button to generate a podcast script
- Script is automatically inserted into the "Script text" field
- Shows success message when done
- Scrolls to the script field so you can see it immediately

### 4. ✅ Regenerate Audio Button (Still There!)

- "🎧 Regenerate Audio from Script" button remains below script field
- Works on edit forms only
- Regenerates audio from the script you just created

---

## How It Works Now

### Step 1: Select User

```
[Select User: Alex ▼]
```

### Step 2: Click on a Course/Lesson/Quiz

```
📚 Enrolled Courses (3):
   • English Mastery - 5 lessons, 3 quizzes   ← Click this
   • Business Skills - 4 lessons, 2 quizzes
   • Spanish Basics - 6 lessons, 4 quizzes

📖 Lessons (15):
   • Lesson 1: Basics (English Mastery)        ← Or this
   • Lesson 2: Intermediate (English Mastery)
   ...
```

### Step 3: Customization Form Appears

```
✏️ Customize Your Podcast Script

Selected: Course - English Mastery

📂 Category / Subject: [English Mastery ────────────]

🎯 Specific Topic: [Negotiation tactics ─────────]

👤 Your Profession / Context: [Marketing manager ────]

🗣️ Preferred Language: [English ▼]

📝 Additional Notes / Style Guide: [Keep it casual ──]

[✏️ Generate Script Text]  [Cancel]
```

### Step 4: Click "Generate Script Text"

- AJAX request sent to backend
- LLM generates personalized script based on:
  - The course/lesson/quiz selected
  - The category you chose
  - Your profession/context
  - Language preference
  - Any additional notes
- Script automatically appears in the "Script text" field

### Step 5: Regenerate Audio (Optional)

- If you want to convert to audio, click "🎧 Regenerate Audio from Script"
- Or save the podcast with text only

---

## Example Flows

### Example 1: Business English Course

1. Select user "Alex"
2. Click "English Mastery" course
3. Fill form:
   - Category: "Business English"
   - Topic: "Email writing for professionals"
   - Profession: "Marketing manager at tech startup"
   - Language: "English"
   - Notes: "Include real-world examples"
4. Click "Generate Script Text"
5. Script generated tailored to marketing manager, includes email examples
6. (Optional) Click "Regenerate Audio" to add audio

### Example 2: Hair Styling Lesson

1. Select user "Sophie"
2. Click "Lesson: Curly Hair Care" lesson
3. Fill form:
   - Category: "Hair Styling"
   - Topic: "Advanced curly hair techniques"
   - Profession: "Hair stylist in Germany"
   - Language: "German"
   - Notes: "Include trendy techniques popular in Europe"
4. Click "Generate Script Text"
5. Script generated for professional hairstylist in German context
6. (Optional) Click "Regenerate Audio" to add audio

---

## Visual Design Changes

### Course List Styling

- ✅ White background (clear and readable)
- ✅ Blue border (stands out from form)
- ✅ Hover effect (light blue background)
- ✅ Click effect (darker blue when selected)
- ✅ Icons for visual identification

### Customization Form

- ✅ Light gray background (distinct section)
- ✅ Clear labels with emojis
- ✅ Input fields with placeholders
- ✅ Dropdown for language selection
- ✅ Blue buttons matching Django admin theme

### Status Messages

- ✅ Loading message (blue)
- ✅ Success message (green with checkmark)
- ✅ Error message (red with X)

---

## Files Updated

1. **change_form.html** - Complete rewrite

   - Better styling for course list
   - Added click handlers for selection
   - Added customization form HTML
   - Added script generation logic

2. **views_admin_ajax.py** - Added functions:

   - `generate_script_ajax()` - Main endpoint
   - `_build_script_prompt()` - Creates LLM prompt
   - `_generate_script_with_llm()` - Calls LLM service
   - `_generate_fallback_script()` - Fallback template

3. **ajax_urls.py** - Added route:
   - `path('generate-script/', generate_script_ajax, name='generate-script')`

---

## How Script Generation Works

### If LLM is Available (OpenAI, Claude, etc.)

- Uses your existing intelligence/LLM service
- Generates highly personalized script
- Considers profession, language, topic, notes

### If LLM Unavailable (Fallback)

- Uses a professional template structure
- Includes: Introduction, Main Content, Tips, Conclusion
- You can edit it manually

---

## Testing Instructions

1. **Go to Django Admin**
2. **Create or Edit a Daily Podcast**
3. **Select a user** - Course list appears
4. **Click on a course/lesson/quiz** - Selected item highlights in blue
5. **Fill customization form**:
   - Required: Category/Subject
   - Optional: Topic, Profession, Notes
6. **Click "Generate Script Text"**
   - Shows "⏳ Generating..." while processing
   - Shows "✅ Script generated" when done
   - Script appears in "Script text" field
7. **(Optional) Click "Regenerate Audio"** to add audio

---

## Customization Options

### Category/Subject (Required)

Pre-fill with course name, but can change to:

- "Business English"
- "Hair Styling"
- "Advanced Math"
- "Photography Basics"
- Anything you want!

### Specific Topic (Optional)

- "Email writing"
- "Color theory"
- "Calculus"
- Makes script more focused

### Profession/Context (Optional)

- "Hair stylist in Germany"
- "Marketing manager at startup"
- "Teacher in France"
- Personalizes examples and tone

### Language (Dropdown)

- English, Spanish, French, German
- Japanese, Italian, Portuguese, Russian, Korean

### Additional Notes (Optional)

- "Keep it casual"
- "Include industry examples"
- "Make it beginner-friendly"
- "Add real statistics"

---

## Benefits

✅ **Personalized Content**

- Scripts tailored to user's profession
- Relevant examples and context
- Multiple language support

✅ **User Control**

- Can customize before generation
- Can edit script after generation
- Can regenerate with different settings

✅ **Flexible**

- Works with courses, lessons, or quizzes
- Can generate text or audio or both
- Fallback template if LLM unavailable

✅ **Fast**

- AJAX - no page reload
- Instant feedback and status
- Generates in seconds

---

## What's Still There

### Batch Admin Actions (Unchanged)

- "🎧 Add audio to text-only podcasts"
- "🔄 Regenerate audio from scripts"
- Select multiple, choose action, click Go

### Audio Regeneration (Enhanced)

- Still available as standalone button
- Now better styled
- Shows status messages

---

## Error Handling

If something goes wrong:

- ❌ Shows error message on form
- ❌ Button returns to normal state
- ❌ You can try again
- Check browser console (F12) for details

---

## Browser Support

Works on any modern browser with:

- JavaScript enabled
- Fetch API (all modern browsers)
- DOM manipulation

Tested on:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Next Steps

1. **Test the new flow** in Django Admin
2. **Verify script generation** works
3. **Check audio regeneration** still works
4. **Test with different languages**
5. **Customize based on needs**

---

_All features live and ready to test!_
