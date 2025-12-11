# Quick Reference: Testing Admin Features

## Files Modified/Created

### Created
- ✅ `dailycast/views_admin_ajax.py` - AJAX endpoints
- ✅ `dailycast/ajax_urls.py` - URL routing

### Modified  
- ✅ `dailycast/admin.py` - Added `regenerate_audio_from_script` action
- ✅ `zporta/urls.py` - Added AJAX path routing

---

## Testing URLs

### 1. Test AJAX Endpoints

**Get User Courses/Lessons/Quizzes**:
```
GET /api/admin/ajax/user-courses/?user_id=1
```

**Get Course Details**:
```
GET /api/admin/ajax/course-details/?course_id=1
```

### 2. How to Test

**Option A: Browser Test**
1. Start Django dev server: `python manage.py runserver`
2. Login to admin as staff/superuser
3. Visit: `http://localhost:8000/api/admin/ajax/user-courses/?user_id=1`
4. Should see JSON response

**Option B: CURL Test**
```bash
# Get user courses
curl -b "sessionid=YOUR_SESSIONID" \
  "http://localhost:8000/api/admin/ajax/user-courses/?user_id=1"

# Get course details
curl -b "sessionid=YOUR_SESSIONID" \
  "http://localhost:8000/api/admin/ajax/course-details/?course_id=1"
```

**Option C: Django Shell Test**
```python
python manage.py shell

from dailycast.views_admin_ajax import get_user_courses_ajax
from django.test import RequestFactory
from django.contrib.auth.models import User

# Create mock request
factory = RequestFactory()
request = factory.get('/api/admin/ajax/user-courses/?user_id=1')

# Add user to request (needs to be staff)
staff_user = User.objects.get(is_staff=True, id=1)
request.user = staff_user

# Call view
response = get_user_courses_ajax(request)
print(response.content)  # JSON output
```

---

## Admin Actions Testing

### 1. Test "Add Audio to Text-Only Podcasts"

**Setup**:
1. Go to Django Admin → Dailycast → DailyPodcast
2. Create or find a podcast with:
   - `output_format = 'text'`
   - `script_text = 'some content'`
   - `audio_file = empty`

**Test Steps**:
1. Select the podcast(s)
2. Choose action: "🎧 Add audio to selected text-only podcasts"
3. Click "Go"
4. Check for success message
5. Verify `output_format` changed to 'both'
6. Verify `audio_file` now has content

**Expected Output**:
```
✅ Added audio to 1 text-only podcast(s). Errors: 0
```

### 2. Test "Regenerate Audio from Scripts"

**Setup**:
1. Go to Django Admin → Dailycast → DailyPodcast
2. Find a podcast with:
   - `script_text = 'existing script'`
   - `audio_file = existing audio`

**Test Steps**:
1. Select the podcast(s)
2. Choose action: "🔄 Regenerate audio from existing scripts"
3. Click "Go"
4. Check for success message
5. Verify audio file has newer timestamp
6. Optionally: play audio to confirm it's fresh

**Expected Output**:
```
✅ Regenerated audio for 1 podcast(s). Errors: 0
```

### 3. Test Error Handling

**Test with missing script**:
1. Select podcast with no `script_text`
2. Run "Add audio to text-only podcasts"
3. Should skip podcast (not error)
4. Message should show: "Skipped 1 (already has audio or no script)"

**Test with permission denied**:
1. Login as non-staff user
2. Try to access `/api/admin/ajax/user-courses/?user_id=1`
3. Should get 403 Forbidden or redirect to login

---

## Key Files Checklist

### Syntax Validation
- [✅] `views_admin_ajax.py` - No syntax errors
- [✅] `admin.py` - No syntax errors  
- [✅] `ajax_urls.py` - No syntax errors

### Import Validation
- [✅] views_admin_ajax imports: JsonResponse, decorators, models
- [✅] admin.py imports: time, ContentFile, synthesize_single_language_audio
- [✅] ajax_urls.py imports: path, view functions

### URL Routing
- [✅] `zporta/urls.py` includes: `path('api/admin/ajax/', include('dailycast.ajax_urls'))`
- [✅] `ajax_urls.py` maps: 'user-courses/' and 'course-details/'

### Admin Actions
- [✅] `DailyPodcastAdmin.actions` includes both functions
- [✅] `add_audio_to_text_only()` implemented
- [✅] `regenerate_audio_from_script()` implemented

---

## Troubleshooting

### AJAX endpoints return 404
- Check URL in browser (should be exact match)
- Verify URLs included in main zporta/urls.py
- Check Django debug=True to see routing

### Admin actions don't show
- Clear browser cache (Ctrl+Shift+Del)
- Restart Django server
- Check `DailyPodcastAdmin.actions` list in admin.py
- Verify you're viewing DailyPodcast admin list

### Audio generation fails
- Check TTS provider credentials (OpenAI, ElevenLabs, Google)
- Verify internet connectivity
- Check media storage directory exists
- Review Django error logs

### Permission denied errors
- Ensure logged-in user is staff/superuser
- Check Django user permissions
- For AJAX: verify `@user_passes_test` decorator

### Syntax errors during import
- Run linter: `python -m pylint dailycast/*.py`
- Check for indentation issues (Python is whitespace-sensitive)
- Verify all imports are available

---

## Development Notes

### Adding Custom AJAX Endpoints

**Template**:
```python
@require_GET  # or @require_POST
@login_required
@user_passes_test(is_admin_or_staff)
def my_ajax_endpoint(request):
    try:
        user_id = request.GET.get('user_id')
        # ... process ...
        return JsonResponse({
            'success': True,
            'data': result
        })
    except Exception as e:
        logger.error(f"Error: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)
```

### Adding to ajax_urls.py

```python
path('new-endpoint/', my_ajax_endpoint, name='my-endpoint'),
```

### Testing with JavaScript

```javascript
fetch('/api/admin/ajax/user-courses/?user_id=1')
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      console.log('Courses:', data.courses);
    } else {
      console.error('Error:', data.error);
    }
  })
  .catch(err => console.error('Fetch failed:', err));
```

---

## Next Steps

1. **Test AJAX Endpoints**:
   - [ ] Test in browser (requires Django running)
   - [ ] Test with invalid user_id
   - [ ] Test with non-staff user
   - [ ] Verify JSON structure

2. **Test Admin Actions**:
   - [ ] Test "Add audio" with text-only podcast
   - [ ] Test "Regenerate audio" with existing podcast
   - [ ] Test with batch selection (5+ podcasts)
   - [ ] Verify error handling

3. **Test Integration**:
   - [ ] Load Django admin DailyPodcast page
   - [ ] Verify both actions visible in dropdown
   - [ ] Test selecting and running action
   - [ ] Check admin message display

4. **Pre-Generation Questionnaire** (next feature):
   - [ ] Design form fields
   - [ ] Create model
   - [ ] Build API endpoint
   - [ ] Integrate with script generation

---

**Ready for testing!** All code is syntax-valid and properly integrated.
