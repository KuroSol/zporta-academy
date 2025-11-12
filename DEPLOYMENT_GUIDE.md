# Deployment Instructions - Lesson Audio Fix

## Overview
This fix addresses SSR hydration issues with audio elements in lesson content. Deploy in the following order to minimize downtime.

## Prerequisites
- SSH access to production server
- Git repository access
- Permissions to restart services

---

## Step 1: Backend Deployment (5 minutes)

### 1.1 Pull Latest Code
```bash
cd ~/zporta-academy/zporta_academy_backend
git pull origin main
```

### 1.2 Verify Changes
Check that the serializer was updated:
```bash
grep "validate_content" lessons/serializers.py
```
Expected: Should see the new `validate_content` method.

### 1.3 Restart Backend Service
```bash
# If using systemd
sudo systemctl restart zporta-backend

# OR if using gunicorn directly
pkill gunicorn
gunicorn zporta.wsgi:application --bind 0.0.0.0:8000 --daemon

# OR if using Django dev server
python manage.py runserver 0.0.0.0:8000
```

### 1.4 Test Backend
```bash
curl -I http://localhost:8000/api/lessons/
```
Expected: Should return 200 OK.

**Rollback if needed**:
```bash
git checkout HEAD~1 lessons/serializers.py
sudo systemctl restart zporta-backend
```

---

## Step 2: Nginx Configuration (3 minutes)

### 2.1 Backup Current Config
```bash
sudo cp /etc/nginx/mime.types /etc/nginx/mime.types.backup
sudo cp /etc/nginx/sites-available/zporta /etc/nginx/sites-available/zporta.backup
```

### 2.2 Update MIME Types
```bash
sudo nano /etc/nginx/mime.types
```

Find the audio section (around line 30-40) and add:
```nginx
audio/wav                              wav;
audio/x-wav                            wav;
```

Save and exit (Ctrl+X, Y, Enter).

### 2.3 Update Site Configuration
```bash
sudo nano /etc/nginx/sites-available/zporta
```

Find the `location /media/` block and update it to:
```nginx
location /media/ {
    alias /path/to/your/media/folder/;  # Keep your existing path
    add_header Accept-Ranges bytes;
    types { 
        audio/wav wav; 
        audio/x-wav wav; 
    }
}
```

Save and exit.

### 2.4 Test Configuration
```bash
sudo nginx -t
```
Expected: "test is successful"

If test fails, check syntax errors and fix them.

### 2.5 Reload Nginx
```bash
sudo systemctl reload nginx
```

### 2.6 Verify Media Headers
```bash
curl -I https://zportaacademy.com/media/user_Alex/lesson/Alex-lesson-20251112-4555.wav
```
Expected to see:
```
Content-Type: audio/wav
Accept-Ranges: bytes
```

**Rollback if needed**:
```bash
sudo cp /etc/nginx/mime.types.backup /etc/nginx/mime.types
sudo cp /etc/nginx/sites-available/zporta.backup /etc/nginx/sites-available/zporta
sudo systemctl reload nginx
```

---

## Step 3: Frontend Deployment (10 minutes)

### 3.1 Pull Latest Code
```bash
cd ~/zporta-academy/zporta_academy_frontend/next-frontend
git pull origin main
```

### 3.2 Verify New Files
```bash
ls -la src/components/SafeLessonHtml.tsx
ls -la src/styles/lesson-content.css
```
Both files should exist.

### 3.3 Check Updated Files
```bash
grep "SafeLessonHtml" src/components/LessonDetail.js
grep "lesson-content.css" src/pages/_app.js
```
Both should show the new imports.

### 3.4 Install Dependencies (if any new ones)
```bash
npm install
```

### 3.5 Build Production Bundle
```bash
npm run build
```

Watch for build errors. If build fails, check the error message.

### 3.6 Restart Frontend Service
```bash
# If using PM2
pm2 restart zporta-frontend

# OR if using systemd
sudo systemctl restart zporta-frontend

# OR if running manually
npm run start
```

### 3.7 Verify Frontend is Running
```bash
curl -I http://localhost:3000
```
Expected: Should return 200 OK.

**Rollback if needed**:
```bash
git checkout HEAD~3  # Go back 3 commits (SafeLessonHtml, lesson-content.css, LessonDetail updates)
npm run build
pm2 restart zporta-frontend
```

---

## Step 4: Post-Deployment Testing (10 minutes)

### 4.1 Test the Failing Lesson
1. Open browser to: https://zportaacademy.com/lessons/Alex/business-english/2025-11-12/week-5
2. Open DevTools (F12)
3. Check Console for errors
4. Verify audio plays
5. Check Network tab for audio file responses

### 4.2 Test Other Lessons
Navigate to a different lesson and verify it still works:
- https://zportaacademy.com/lessons/Alex/business-english/2025-11-12/week-4

### 4.3 Check HTML Source
In browser console:
```javascript
// Should return false
document.querySelector('.lesson-content')?.innerHTML.includes('<style>')

// Should show 'none'
document.querySelectorAll('audio').forEach(a => console.log(a.preload))
```

### 4.4 Performance Check
Run Lighthouse audit:
1. Open DevTools > Lighthouse
2. Run Performance audit
3. Verify FCP < 1.5s

### 4.5 Monitor Logs
```bash
# Backend logs
tail -f ~/zporta-academy/zporta_academy_backend/logs/django.log

# Frontend logs (PM2)
pm2 logs zporta-frontend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

Watch for any errors over the next 5-10 minutes.

---

## Step 5: Update Existing Lessons (Optional)

If you want to strip `<style>` tags from existing lessons:

### 5.1 Create Management Command (Backend)
```bash
cd ~/zporta-academy/zporta_academy_backend
```

Create file: `lessons/management/commands/strip_lesson_styles.py`
```python
from django.core.management.base import BaseCommand
from lessons.models import Lesson
import re

class Command(BaseCommand):
    help = 'Strip <style> tags from all lesson content'

    def handle(self, *args, **kwargs):
        lessons = Lesson.objects.all()
        updated = 0
        
        for lesson in lessons:
            if lesson.content and '<style' in lesson.content.lower():
                original = lesson.content
                cleaned = re.sub(r'<style[\s\S]*?>[\s\S]*?</style>', '', original, flags=re.IGNORECASE)
                
                if cleaned != original:
                    lesson.content = cleaned
                    lesson.save(update_fields=['content'])
                    updated += 1
                    self.stdout.write(f'Updated lesson {lesson.id}: {lesson.title}')
        
        self.stdout.write(self.style.SUCCESS(f'Updated {updated} lessons'))
```

### 5.2 Run Command
```bash
python manage.py strip_lesson_styles
```

This will update all existing lessons to remove inline styles.

---

## Rollback Plan (Full)

If critical issues occur after deployment:

```bash
# 1. Backend
cd ~/zporta-academy/zporta_academy_backend
git checkout HEAD~1 lessons/serializers.py
sudo systemctl restart zporta-backend

# 2. Nginx
sudo cp /etc/nginx/mime.types.backup /etc/nginx/mime.types
sudo cp /etc/nginx/sites-available/zporta.backup /etc/nginx/sites-available/zporta
sudo systemctl reload nginx

# 3. Frontend
cd ~/zporta-academy/zporta_academy_frontend/next-frontend
git checkout HEAD~3
npm run build
pm2 restart zporta-frontend

# 4. Verify rollback worked
curl -I https://zportaacademy.com
```

---

## Success Checklist

After deployment, confirm:

- [ ] Backend is running (curl http://localhost:8000/api/)
- [ ] Nginx is running (systemctl status nginx)
- [ ] Frontend is running (curl http://localhost:3000)
- [ ] Failing lesson now loads (manual test)
- [ ] Audio plays correctly (manual test)
- [ ] Other lessons still work (spot check 2-3)
- [ ] No errors in logs (check all three)
- [ ] No hydration warnings (browser console)
- [ ] Audio MIME type correct (curl headers)
- [ ] Page load time acceptable (<1.5s)

---

## Post-Deployment Monitoring

### Metrics to Watch (First 24 Hours)
1. **Error Rate**: Should stay at 0% for lesson pages
2. **Page Load Time**: Should be ≤1.5s (check Google Analytics or your monitoring tool)
3. **Audio Playback Success**: Monitor for user reports of audio issues
4. **Server Load**: Should not increase (check CPU/memory)

### Where to Check
- **Application Logs**: `tail -f ~/zporta-academy/zporta_academy_backend/logs/django.log`
- **Nginx Logs**: `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log`
- **Frontend Logs**: `pm2 logs zporta-frontend`
- **Browser Console**: Manual spot checks on production site

---

## Contact Points

If issues arise:
1. Check logs first (backend, frontend, nginx)
2. Review TESTING_GUIDE.md for debugging steps
3. If critical, execute rollback plan
4. Document any issues found for post-mortem

---

## Timeline Summary

| Step | Duration | Can Run In Parallel? |
|------|----------|---------------------|
| Backend | 5 min | No |
| Nginx | 3 min | After Backend |
| Frontend | 10 min | After Backend |
| Testing | 10 min | After Frontend |
| **Total** | **~30 min** | |

**Recommended Deployment Time**: During low-traffic hours (e.g., 2-4 AM local time) or maintenance window.

---

## Final Notes

- This is a **low-risk** deployment (adds client-side rendering, doesn't break existing functionality)
- **No database migrations** required
- **No data loss** risk
- **User sessions** not affected
- Can be **rolled back** quickly if needed

Good luck with the deployment! 🚀
