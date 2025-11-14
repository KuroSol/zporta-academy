# Lesson Issue Diagnostic & Fix Guide

## Issue Description
Users experiencing:
- Lesson content showing incorrectly (all showing Week 1 content)
- Lessons disappearing after marking one complete
- Server going into loop when completing specific lessons

## Root Causes Found & Fixed

### 1. ✅ React.memo Bug (FIXED in commit 21e3eb4f)
- `LessonSection` component was using `React.memo`
- Caused React to reuse cached components with wrong data
- **Fix:** Removed `React.memo` from LessonSection

### 2. ✅ Multiple Toolbars (FIXED in commit 21e3eb4f)  
- Each lesson created its own annotation toolbar
- **Fix:** Consolidated to single shared toolbar

### 3. ✅ Accidental Completion (FIXED in commit b28918e4)
- Users could accidentally mark lessons complete
- **Fix:** Added confirmation dialog

### 4. ⚠️  Potential Database Issues (NEEDS INVESTIGATION)
Possible causes:
- Duplicate LessonProgress records
- Progress records for wrong lessons
- Corrupted lesson data

## Investigation Steps

### Step 1: Access Your Server
```bash
# From PowerShell, use the PEM file
ssh -i "C:\Users\AlexSol\Downloads\LightsailDefaultKey-ap-northeast-1 (9).pem" ubuntu@18.176.206.74
```

### Step 2: Deploy Latest Code
```bash
cd /home/ubuntu/zporta-academy

# Pull latest fixes
git pull origin main

# Backend (if needed)
cd zporta_academy_backend
source ../env/bin/activate  # or however you activate virtualenv
python manage.py migrate

# Frontend  
cd ../zporta_academy_frontend/next-frontend
npm ci
rm -rf .next
npm run build
pm2 restart zporta-next
```

### Step 3: Run Diagnostic Script
```bash
cd /home/ubuntu/zporta-academy/zporta_academy_backend

# Make script executable
chmod +x scripts/diagnose_lesson_issue.py

# Check specific user (replace with actual username/email)
python scripts/diagnose_lesson_issue.py alexsol

# OR check recent completions to spot patterns
python scripts/diagnose_lesson_issue.py recent 30
```

### Step 4: Fix Database Issues (if found)

#### Fix Duplicate Progress Records
```bash
# Replace 123 with actual enrollment ID from diagnostic output
python scripts/diagnose_lesson_issue.py fix 123
```

#### Manual Database Queries

Connect to database:
```bash
mysql -u zporta_user -p'Xg7^Kt!32Vb#9zLp$eQm' zporta_db
```

Check for duplicates:
```sql
-- Find enrollments with duplicate lesson progress
SELECT 
    e.id as enrollment_id,
    e.user_id,
    c.title as course,
    l.title as lesson,
    COUNT(*) as duplicates
FROM learning_lessonprogress lp
JOIN enrollment_enrollment e ON lp.enrollment_id = e.id
JOIN courses_course c ON e.course_id = c.id
JOIN lessons_lesson l ON lp.lesson_id = l.id
GROUP BY e.id, l.id
HAVING COUNT(*) > 1;
```

Check for orphaned progress (lessons from wrong course):
```sql
SELECT 
    lp.id,
    u.username,
    ec.title as enrolled_course,
    lc.title as lesson_course,
    l.title as lesson
FROM learning_lessonprogress lp
JOIN enrollment_enrollment e ON lp.enrollment_id = e.id
JOIN users_customuser u ON e.user_id = u.id
JOIN courses_course ec ON e.course_id = ec.id
JOIN lessons_lesson l ON lp.lesson_id = l.id
JOIN courses_course lc ON l.course_id = lc.id
WHERE ec.id != lc.id;
```

Check lesson order issues:
```sql
SELECT 
    c.title as course,
    l.id,
    l.title,
    l.position
FROM lessons_lesson l
JOIN courses_course c ON l.course_id = c.id
WHERE c.id = 1  -- Replace with actual course ID
ORDER BY l.position;
```

## Common Fixes

### Fix 1: Delete Duplicate Progress
```sql
-- CAUTION: Backup first!
-- This keeps the earliest completion for each lesson

-- Create temp table with IDs to keep
CREATE TEMPORARY TABLE keep_progress AS
SELECT MIN(id) as id
FROM learning_lessonprogress
GROUP BY enrollment_id, lesson_id;

-- Delete duplicates (not in keep list)
DELETE FROM learning_lessonprogress
WHERE id NOT IN (SELECT id FROM keep_progress);

-- Clean up temp table
DROP TEMPORARY TABLE keep_progress;
```

### Fix 2: Delete Orphaned Progress Records
```sql
-- Remove progress for lessons not in the enrolled course
DELETE lp FROM learning_lessonprogress lp
JOIN enrollment_enrollment e ON lp.enrollment_id = e.id
JOIN lessons_lesson l ON lp.lesson_id = l.id
WHERE l.course_id != e.course_id;
```

### Fix 3: Reset User's Course Progress (Last Resort)
```sql
-- Only if a specific enrollment is corrupted beyond repair
-- Replace 123 with actual enrollment_id

-- Delete all lesson progress
DELETE FROM learning_lessonprogress WHERE enrollment_id = 123;

-- Reset enrollment
UPDATE enrollment_enrollment 
SET completed = FALSE, 
    progress_percentage = 0,
    completion_date = NULL
WHERE id = 123;
```

## Undo Lesson Completion (For Users)

Currently there's NO undo button (by design). Options:

### Option 1: Add Undo Feature (NOT RECOMMENDED)
- Could confuse course analytics
- Users might game completion rates
- Affects progress tracking

### Option 2: Admin Manual Reset (CURRENT APPROACH)
```sql
-- Admin can manually reset a lesson completion
-- Replace IDs with actual values
DELETE FROM learning_lessonprogress 
WHERE enrollment_id = 123 AND lesson_id = 456;

-- Recalculate progress
UPDATE enrollment_enrollment e
SET progress_percentage = (
    SELECT ROUND(COUNT(*) * 100.0 / total_lessons.count, 2)
    FROM learning_lessonprogress lp
    JOIN (
        SELECT COUNT(*) as count 
        FROM lessons_lesson 
        WHERE course_id = e.course_id
    ) total_lessons
    WHERE lp.enrollment_id = e.id
)
WHERE e.id = 123;
```

### Option 3: Confirmation Dialog (IMPLEMENTED ✅)
- Added in commit b28918e4
- Prevents accidental clicks
- Best UX balance

## Server Loop Investigation

If server goes into loop when marking lesson complete:

### Check PM2 Logs
```bash
pm2 logs zporta-next --lines 100
```

### Check Gunicorn Logs
```bash
tail -f /var/log/gunicorn/error.log
tail -f /var/log/nginx/error.log
```

### Check for Infinite Redirects
```bash
# Test the completion endpoint
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  https://zportaacademy.com/api/lessons/LESSON_ID/complete/ \
  -v
```

## Prevention

1. ✅ Frontend fixes deployed (React.memo removed, toolbar consolidated)
2. ✅ Confirmation dialog added
3. ⚠️  Database cleanup (run diagnostic script)
4. 📝 Monitor logs for patterns
5. 📝 Consider adding database constraints to prevent duplicates

## Support

If issues persist after:
1. Deploying latest code
2. Running diagnostic script
3. Fixing database duplicates

Then share:
- Diagnostic script output
- PM2 logs
- Specific user/course having issues
- Database query results

---

**Last Updated:** November 14, 2025  
**Commits:**
- 21e3eb4f - Fix React.memo bug & consolidate toolbar
- b28918e4 - Add confirmation dialog
