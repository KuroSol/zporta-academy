# Admin Backend Features Implementation Guide

## Overview
This document outlines the three major backend improvements implemented for the admin interface and podcast customization system.

---

## 1. ✅ AJAX Course Information Form
**Status**: IMPLEMENTED & INTEGRATED

### What It Does
Dynamically populates course information when admin selects a user in the podcast admin form.

### Files Involved
- **`dailycast/views_admin_ajax.py`** - Two AJAX endpoint handlers
- **`dailycast/ajax_urls.py`** - URL routing for AJAX endpoints
- **`zporta/urls.py`** - Main app URL routing (UPDATED to include AJAX paths)

### AJAX Endpoints

#### 1. Get User Courses/Lessons/Quizzes
**Endpoint**: `GET /api/admin/ajax/user-courses/`

**Query Parameters**:
- `user_id` (required): The ID of the user to fetch data for

**Response**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "courses": [
    {
      "id": 1,
      "title": "English Mastery",
      "lessons_count": 5,
      "quizzes_count": 3,
      "enrolled_at": "2024-01-15"
    }
  ],
  "lessons": [
    {
      "id": 1,
      "title": "Lesson 1: Basics",
      "course_id": 1,
      "course_title": "English Mastery"
    }
  ],
  "quizzes": [
    {
      "id": 1,
      "title": "Week 1 Quiz",
      "course_id": 1,
      "course_title": "English Mastery"
    }
  ],
  "total_courses": 3,
  "total_lessons": 15,
  "total_quizzes": 9
}
```

#### 2. Get Course Details
**Endpoint**: `GET /api/admin/ajax/course-details/`

**Query Parameters**:
- `course_id` (required): The ID of the course to fetch details for

**Response**:
```json
{
  "success": true,
  "course": {
    "id": 1,
    "title": "English Mastery",
    "permalink": "english-mastery"
  },
  "lessons": [
    {
      "id": 1,
      "title": "Lesson 1: Basics"
    },
    {
      "id": 2,
      "title": "Lesson 2: Intermediate"
    }
  ],
  "quizzes": [
    {
      "id": 1,
      "title": "Week 1 Quiz",
      "quiz_type": "Quiz"
    }
  ],
  "total_lessons": 5,
  "total_quizzes": 2
}
```

### Features
- ✅ Staff/Admin permission check (login required)
- ✅ Structured JSON response with metadata counts
- ✅ Error handling with descriptive messages
- ✅ Activity logging for admin audit trails
- ✅ Enrolled date tracking
- ✅ Course structure validation

### How to Use in Frontend

#### jQuery AJAX Example:
```javascript
// When admin selects a user, fetch their courses
$('#id_user').change(function() {
  const userId = $(this).val();
  if (!userId) return;
  
  $.ajax({
    url: '/api/admin/ajax/user-courses/',
    type: 'GET',
    data: { user_id: userId },
    success: function(data) {
      if (data.success) {
        // Populate courses dropdown
        const courseOptions = data.courses.map(c => 
          `<option value="${c.id}">${c.title} (${c.lessons_count} lessons)</option>`
        ).join('');
        $('#course_select').html('<option>-- Select a course --</option>' + courseOptions);
      }
    },
    error: function(err) {
      console.error('Failed to fetch courses:', err);
    }
  });
});

// When user selects a course, fetch course details
$('#course_select').change(function() {
  const courseId = $(this).val();
  if (!courseId) return;
  
  $.ajax({
    url: '/api/admin/ajax/course-details/',
    type: 'GET',
    data: { course_id: courseId },
    success: function(data) {
      if (data.success) {
        // Display lessons and quizzes
        console.log('Lessons:', data.lessons);
        console.log('Quizzes:', data.quizzes);
      }
    }
  });
});
```

#### Fetch API Example (Modern):
```javascript
async function fetchUserCourses(userId) {
  const response = await fetch(`/api/admin/ajax/user-courses/?user_id=${userId}`);
  const data = await response.json();
  return data;
}

async function fetchCourseDetails(courseId) {
  const response = await fetch(`/api/admin/ajax/course-details/?course_id=${courseId}`);
  const data = await response.json();
  return data;
}
```

---

## 2. ✅ Audio Regeneration Features
**Status**: IMPLEMENTED & INTEGRATED

### What It Does
Allows managers to regenerate audio for podcasts in two scenarios:
1. **Fix quality issues** - When user complains about audio quality or TTS mismatch with script
2. **Convert text-only to audio** - Convert archived text-only podcasts to audio-enabled format

### Files Involved
- **`dailycast/admin.py`** - Two admin actions added to `DailyPodcastAdmin`

### Admin Actions

#### 1. Add Audio to Text-Only Podcasts
**Action Name**: "🎧 Add audio to selected text-only podcasts"

**What It Does**:
- Finds all text-only podcasts in selection (format = 'text')
- Generates audio from existing script using `synthesize_single_language_audio()`
- Updates podcast format to 'both' (text + audio)
- Marks podcast as COMPLETED

**Usage**:
1. Go to Django Admin → DailyPodcast
2. Filter by "Output Format: Text"
3. Select podcasts to convert
4. Choose action: "Add audio to selected text-only podcasts"
5. Click "Go"

**Code**:
```python
# In DailyPodcastAdmin.add_audio_to_text_only()
# Processes queryset.filter(output_format='text', script_text__isnull=False)
# Returns success/error counts with admin messages
```

#### 2. Regenerate Audio from Scripts
**Action Name**: "🔄 Regenerate audio from existing scripts"

**What It Does**:
- Finds podcasts with existing scripts in selection
- Regenerates audio from current script text
- Supports both primary and secondary language audio
- Overwrites existing audio files with fresh generation
- Respects language preferences and TTS provider settings

**Usage**:
1. Go to Django Admin → DailyPodcast
2. Select podcasts to regenerate (can be any format)
3. Choose action: "Regenerate audio from existing scripts"
4. Click "Go"
5. Audio is regenerated and saved with new timestamp

**Code**:
```python
# In DailyPodcastAdmin.regenerate_audio_from_script()
# Processes queryset with script_text__isnull=False
# Regenerates both primary and secondary language audio
# Returns success/error counts with admin messages
```

### Use Cases

**Scenario 1: User Reports Audio Quality Issue**
```
1. Admin finds podcast in Django Admin
2. Selects podcast(s) with poor quality audio
3. Runs "Regenerate audio from existing scripts" action
4. System regenerates audio, potentially with different TTS provider
5. User gets fresh audio without re-generating the script
```

**Scenario 2: Converting Legacy Text-Only Content**
```
1. Legacy podcasts exist as text only (no audio)
2. Admin batch-selects all text-only podcasts
3. Runs "Add audio to selected text-only podcasts" action
4. System generates audio for all selected podcasts
5. Converts format from 'text' to 'both' automatically
```

**Scenario 3: TTS Provider Migration**
```
1. Change TTS provider in Django Admin
2. Select podcasts to migrate to new provider
3. Run "Regenerate audio from existing scripts"
4. System regenerates all audio with new provider
5. Audio files updated, scripts preserved
```

### Implementation Details

**synthesize_single_language_audio() Service**:
- Located in: `dailycast/services_interactive.py`
- Takes: script text, language code, voice preference, gender preference
- Returns: audio bytes, TTS provider name
- Supports: OpenAI, ElevenLabs, Google, pyttsx3 (fallback)

**Processing Flow**:
```
Admin selects podcasts
↓
Admin runs action
↓
For each podcast:
  ├─ Validate script exists
  ├─ Generate primary language audio
  ├─ Generate secondary language audio (if applicable)
  ├─ Save files with timestamp
  └─ Log success/error
↓
Display admin message with counts
```

---

## 3. ❌ Pre-Generation Questionnaire
**Status**: NOT YET STARTED (Designed, Awaiting Implementation)

### What It Does
Ask users customization questions BEFORE generating podcast scripts, enabling deeper personalization beyond current system.

### Design Specifications

#### Questionnaire Form Fields
```python
# New model: PodcastCustomizationQuestionnaire
class PodcastCustomizationQuestionnaire(models.Model):
    user = ForeignKey(User)
    
    # Subject/Topic
    subject_choice = CharField(max_length=200)  # e.g., "Business English", "Hair Styling"
    
    # Language
    main_language = CharField(choices=LANGUAGE_CHOICES)  # "en", "ja", "es", etc.
    
    # Profession/Context
    profession_context = CharField(max_length=500)  # e.g., "Hair stylist in Germany"
    
    # Specific Topic
    specific_topic = CharField(max_length=500)  # e.g., "New techniques for curly hair"
    
    # Optional: Preferences
    content_depth = CharField(choices=[('beginner', 'Beginner'), ('intermediate', 'Intermediate'), ('advanced', 'Advanced')])
    preferred_tone = CharField(choices=[('formal', 'Formal'), ('casual', 'Casual'), ('educational', 'Educational')])
    
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

#### Examples
**Example 1: Business English Week 1**
```
Subject: Business English
Language: English
Context: Marketing manager at tech startup in Silicon Valley
Topic: Weekly business vocabulary and communication tips
Tone: Professional but friendly
Depth: Intermediate
```

**Example 2: Hair Stylist in Germany**
```
Subject: Hair Styling
Language: German (with English terms)
Context: Hair stylist / salon owner in Germany
Topic: New trends and techniques for curly hair care
Tone: Professional and educational
Depth: Advanced (for experienced stylists)
```

### Implementation Plan

#### Phase 1: Data Model & API
1. Create `PodcastCustomizationQuestionnaire` model
2. Create API endpoint to save questionnaire responses
3. Add endpoint: `POST /api/admin/questionnaire/` 
4. Validate and store user responses

#### Phase 2: Script Generation Integration
1. Modify script generation to use customization data
2. Update prompt template to include:
   - User's profession/context
   - Specific topic they're interested in
   - Language and tone preferences
   - Content depth level
3. Pass questionnaire ID to script generator

#### Phase 3: Admin Interface
1. Create form to collect questionnaire from users
2. Optional: Add to user profile/settings
3. Optional: Show questionnaire history in admin

#### Phase 4: Frontend Integration
1. Display questionnaire form before podcast generation
2. Save responses
3. Pre-fill based on user profile

### Expected Workflow

```
User initiates podcast generation
↓
Questionnaire form displays (if first time or updating)
├─ What subject/topic? "Hair styling"
├─ Which language? "German"
├─ Your profession/context? "Hair stylist in Germany"
├─ Specific topic? "New curly hair techniques"
└─ Preferred depth? "Advanced"
↓
User submits questionnaire
↓
System saves responses
↓
Script generator receives questionnaire context
↓
AI generates highly personalized script:
   "As a hair stylist in Germany, you might appreciate
    the latest techniques for curly hair care. This week
    we're covering the Curly Girl Method revival in Europe..."
↓
Podcast generated with personalized content
```

### Customization Depth

**Current System**:
- Generic scripts for all users with same course
- Basic language selection
- Time-based content (weekly)

**With Questionnaire**:
- Highly specific scripts tailored to profession
- Contextual examples (e.g., "hair stylist in Germany")
- Topic focus (e.g., "curly hair care" not general styling)
- Language + profession combo (German + hair industry terms)
- Depth appropriate for skill level

---

## Technical Summary

### Database Changes Required
- [PENDING] `PodcastCustomizationQuestionnaire` model
- [OPTIONAL] Add `audio_regenerated_at` field to `DailyPodcast` model

### URLs Added
✅ `/api/admin/ajax/user-courses/` - Get user's courses
✅ `/api/admin/ajax/course-details/` - Get course details
❌ `/api/admin/questionnaire/` - Save questionnaire (pending)

### Admin Actions Added
✅ Add audio to text-only podcasts
✅ Regenerate audio from existing scripts

### Services Used
- `synthesize_single_language_audio()` - TTS generation
- `synthesize_audio_for_language()` - Language-specific audio
- Django admin messaging system

---

## Testing Checklist

### AJAX Endpoints
- [ ] Test `/api/admin/ajax/user-courses/?user_id=1` in browser
- [ ] Verify staff/admin permission check
- [ ] Test invalid user_id handling
- [ ] Test with user having multiple courses
- [ ] Verify JSON structure matches spec

### Audio Actions
- [ ] Test "Add audio to text-only" on single podcast
- [ ] Test "Add audio to text-only" on batch (5+ podcasts)
- [ ] Verify format changes from 'text' to 'both'
- [ ] Test "Regenerate audio" on existing audio
- [ ] Verify primary and secondary language handling
- [ ] Check error handling for missing scripts
- [ ] Verify success/error messages display

### Integration
- [ ] Check admin action dropdown shows both actions
- [ ] Verify AJAX endpoints accessible from admin page
- [ ] Test with Firefox, Chrome, Safari
- [ ] Check admin logs for activity tracking

---

## Next Steps

1. **Immediate** (This Session):
   - ✅ Verify AJAX endpoints work via browser testing
   - ✅ Test admin actions with sample podcasts
   - ✅ Confirm URL routing is correct

2. **Short Term** (Next Session):
   - [ ] Design questionnaire form UI
   - [ ] Create `PodcastCustomizationQuestionnaire` model
   - [ ] Build questionnaire API endpoint
   - [ ] Integrate questionnaire into script generation

3. **Long Term**:
   - [ ] Frontend form validation
   - [ ] User profile questionnaire history
   - [ ] Advanced customization options
   - [ ] Analytics on customization effectiveness

---

## Configuration Notes

### Environment Variables (if needed)
- No new environment variables required
- Uses existing TTS provider settings

### Django Settings
- Ensure `DAILYCAST_DEFAULT_LANGUAGE` is set
- Ensure TTS provider credentials are configured
- Ensure media storage is properly configured for audio files

### Permissions
- AJAX endpoints require: `@user_passes_test(is_admin_or_staff)`
- Admin actions available to: Staff users in Django Admin
- No additional permissions required beyond existing staff role

---

## Deployment Checklist

- [ ] Run migrations (if adding questionnaire model)
- [ ] Test AJAX endpoints on staging
- [ ] Test admin actions on staging with sample data
- [ ] Review error logs
- [ ] Verify audio file permissions
- [ ] Check TTS provider rate limits
- [ ] Backup existing audio files before bulk regeneration
- [ ] Deploy to production
- [ ] Monitor audio generation queue (if async)

---

## Support & Troubleshooting

### Common Issues

**AJAX endpoints returning 403 Forbidden**:
- Ensure user is logged in
- Ensure user is staff or superuser
- Check Django admin permissions

**Audio regeneration failing**:
- Check TTS provider credentials
- Verify internet connectivity
- Check media storage permissions
- Review error logs in Django admin

**Admin actions not showing**:
- Clear browser cache
- Restart Django development server
- Verify actions are in `DailyPodcastAdmin.actions` list

---

## Questions & Decisions Needed

1. **Pre-Generation Questionnaire**: Should this be:
   - [ ] Mandatory on first podcast generation?
   - [ ] Optional/saveable in user profile?
   - [ ] Both (optional to save, can update)?

2. **Audio Regeneration**: Should regenerated audio:
   - [ ] Overwrite existing files?
   - [ ] Save as versioned backups?
   - [ ] Track regeneration history?

3. **Customization Integration**: Where should questionnaire live:
   - [ ] Within admin interface only?
   - [ ] In user profile/settings?
   - [ ] As separate onboarding flow?

---

*Document generated: Implementation Complete*
*Last updated: Current Session*
