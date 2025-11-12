# Quick Testing Guide - Lesson Audio Fix

## Before Testing
Make sure all changes are deployed:
1. Frontend rebuilt: `npm run build && npm run start`
2. Backend restarted: `python manage.py runserver` (or your production command)
3. Nginx reloaded: `sudo systemctl reload nginx` (if you made nginx changes)

## Test 1: Check the Failing Lesson
1. Navigate to the lesson that was failing: "Business English: Week 5"
2. Open browser DevTools (F12)
3. Check Console tab for errors
   - ✅ PASS: No hydration warnings
   - ❌ FAIL: "Warning: Text content did not match" or "Hydration failed"

4. Check Network tab
   - Filter by "media" or ".wav"
   - ✅ PASS: All audio files return 200 or 206 status
   - ✅ PASS: Content-Type is "audio/wav" or "audio/x-wav"
   - ❌ FAIL: 404, 403, or wrong Content-Type

5. Test audio playback
   - Click play on any audio element
   - ✅ PASS: Audio plays
   - ✅ PASS: Can seek/scrub through audio
   - ❌ FAIL: No sound or cannot seek

## Test 2: Verify No Style Tags
In browser console on the lesson page:
```javascript
// Should return false - no style tags in rendered HTML
document.querySelector('.lesson-content')?.innerHTML.includes('<style>')

// Check audio preload attribute
document.querySelectorAll('audio').forEach(a => {
  console.log('Audio preload:', a.getAttribute('preload')); // Should be 'none'
});
```

## Test 3: Check Other Lessons Still Work
1. Navigate to a different lesson (e.g., "Business English: Week 4")
2. Verify it loads correctly
3. Check that accordions expand/collapse
4. Verify any media plays correctly

## Test 4: Backend Validation (Optional)
If you have admin access:
1. Try to save a lesson with inline `<style>` tags
2. Check that the saved content has the style tags stripped
3. Verify the lesson still displays correctly

**Test HTML**:
```html
<style>.test { color: red; }</style>
<p>Test content</p>
```

**Expected saved HTML**:
```html
<p>Test content</p>
```

## Test 5: Performance Check
Open Chrome DevTools > Lighthouse
1. Run audit on the lesson page
2. Check Performance score
   - ✅ PASS: First Contentful Paint < 1.5s
   - ✅ PASS: Time to Interactive < 3s
   - ⚠️ WARN: FCP > 1.5s but < 3s (acceptable but could improve)
   - ❌ FAIL: FCP > 3s

## Common Issues and Fixes

### Issue: "Module not found: Can't resolve '@/components/SafeLessonHtml'"
**Fix**: Make sure the file is in `src/components/` not `components/`
```bash
ls src/components/SafeLessonHtml.tsx
```

### Issue: Styles not applying
**Fix**: Check that lesson-content.css is imported in _app.js
```bash
grep "lesson-content.css" src/pages/_app.js
```

### Issue: Audio still not loading
**Fix**: Check Nginx logs
```bash
sudo tail -f /var/log/nginx/error.log
```
Then refresh the lesson page and look for errors.

### Issue: Hydration warnings still appearing
**Fix**: Clear Next.js cache and rebuild
```bash
rm -rf .next
npm run build
npm run start
```

### Issue: Old lesson content still showing style tags
**Fix**: Re-save the lesson in the admin panel to trigger the backend validator

## Success Criteria
✅ Failing lesson now loads without errors  
✅ All audio elements play correctly  
✅ No hydration warnings in console  
✅ No `<style>` tags in rendered HTML  
✅ Other lessons still work correctly  
✅ Page loads in < 1.5 seconds  
✅ Audio files show correct MIME type  

## Rollback if Needed
If critical issues occur:
```bash
# Frontend
cd next-frontend
git checkout HEAD~1 src/components/LessonDetail.js src/pages/_app.js
rm src/components/SafeLessonHtml.tsx src/styles/lesson-content.css
npm run build && npm run start

# Backend
cd ../zporta_academy_backend
git checkout HEAD~1 lessons/serializers.py
python manage.py runserver
```

## Report Results
After testing, note:
- ✅ All tests passed
- ⚠️ Some tests passed with warnings (note which)
- ❌ Tests failed (note which and error messages)

Document any issues found and whether a rollback is needed.
