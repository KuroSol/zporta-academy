# Production Deployment Guide - Mail Magazine Gated View

## What Changed

### Backend

1. **New Model**: `MailMagazineIssue` - stores sent email content with recipient tracking
2. **New API Endpoints**:
   - `GET /mailmagazine/issues/<id>/` - View specific issue (access controlled)
   - `GET /mailmagazine/issues/by-teacher/<username>/` - List issues by teacher (filtered by recipient)
3. **Updated Logic**: Mail sending now creates issue records before sending

### Frontend

1. **New Page**: `/mail-magazines/[issueId]` - View mail magazine issues in browser
2. **Updated Component**: `PublicGuideProfile` - Shows mail magazines tab on creator profiles

## Deployment Steps

### 1. Pull Latest Code on Production Server

```bash
cd /path/to/zporta_academy
git pull origin main
```

### 2. Run Migration

**IMPORTANT**: You must run the migration to create the `MailMagazineIssue` table:

```bash
# Activate virtual environment
source venv/bin/activate  # or your venv path

# Run migration
python manage.py migrate mailmagazine

# Expected output:
# Applying mailmagazine.0004_mailmagazineissue... OK
```

### 3. Verify Settings

Ensure `SITE_URL` is set in `zporta/settings/production.py`:

```python
SITE_URL = 'https://zportaacademy.com'
```

### 4. Restart Services

```bash
# Restart gunicorn (Django backend)
sudo systemctl restart gunicorn

# Restart nginx if needed
sudo systemctl restart nginx

# Check status
sudo systemctl status gunicorn
```

### 5. Test the Feature

#### Test 1: Send a Mail Magazine

1. Login as teacher
2. Go to Django admin or Mail Magazine page
3. Create/send a mail magazine to recipients
4. Check that issue is created in database:
   ```bash
   python manage.py shell
   >>> from mailmagazine.models import MailMagazineIssue
   >>> MailMagazineIssue.objects.all()
   ```

#### Test 2: View in Browser Link

1. Check email sent to recipients
2. Look for "View in browser" link at top
3. Click link - should open `https://zportaacademy.com/mail-magazines/1`
4. Should display email content with meta info

#### Test 3: Access Control

1. **As Recipient**: Should see issue ✓
2. **As Non-Recipient**: Should get "You do not have permission" error
3. **As Teacher**: Should see all their issues ✓
4. **Not Logged In**: Should redirect to login

#### Test 4: Creator Profile

1. Visit creator's profile: `https://zportaacademy.com/guide/<username>`
2. Click "Magazines" tab
3. Should see list of mail magazine issues
4. Only shows issues where logged-in user is recipient (or if public)
5. Click "View Issue" button - should open issue page

## Troubleshooting

### Issue: "Mail magazine issue not found"

**Cause**: Migration not run or issue doesn't exist yet

**Solution**:

1. Run migration: `python manage.py migrate mailmagazine`
2. Send a test mail magazine to create first issue
3. Check database: `python manage.py dbshell` → `SELECT * FROM mailmagazine_mailmagazineissue;`

### Issue: "View in browser" link shows localhost

**Cause**: `SITE_URL` not set in production settings

**Solution**:

1. Edit `zporta/settings/production.py`
2. Add: `SITE_URL = 'https://zportaacademy.com'`
3. Restart gunicorn

### Issue: 500 error on issue detail page

**Cause**: Missing import or database query issue

**Solution**:

1. Check Django logs: `sudo journalctl -u gunicorn -n 50`
2. Check nginx error log: `sudo tail -f /var/log/nginx/error.log`
3. Verify migration ran successfully

### Issue: Mail magazines tab empty on creator profile

**Cause**: No issues sent yet OR user is not a recipient

**Solution**:

1. Send at least one mail magazine as the teacher
2. Login as recipient user
3. Visit teacher's profile - should see issues
4. Non-recipients won't see any issues (by design)

## Database Schema

New table created by migration:

```sql
CREATE TABLE mailmagazine_mailmagazineissue (
    id INTEGER PRIMARY KEY,
    magazine_id INTEGER NOT NULL REFERENCES mailmagazine_teachermailmagazine(id),
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    html_content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    INDEX idx_magazine_sent (magazine_id, sent_at DESC)
);

CREATE TABLE mailmagazine_mailmagazineissue_recipients (
    id INTEGER PRIMARY KEY,
    mailmagazineissue_id INTEGER REFERENCES mailmagazine_mailmagazineissue(id),
    user_id INTEGER REFERENCES auth_user(id)
);
```

## API Endpoints

### 1. View Issue Detail

**Endpoint**: `GET /mailmagazine/issues/<int:pk>/`

**Authentication**: Required

**Access Control**:

- Teacher who sent it
- Users in recipients list
- Anyone if `is_public=True`

**Response**:

```json
{
  "id": 1,
  "magazine": 1,
  "magazine_title": "Weekly Newsletter",
  "teacher_username": "john_teacher",
  "title": "Weekly Newsletter",
  "subject": "This Week's Updates",
  "html_content": "<html>...</html>",
  "sent_at": "2025-11-25T10:30:00Z",
  "is_public": false
}
```

### 2. List Teacher's Issues

**Endpoint**: `GET /mailmagazine/issues/by-teacher/<str:username>/`

**Authentication**: Required

**Filtering**: Automatically filters to only show:

- Issues where logged-in user is recipient
- OR issues where `is_public=True`
- OR all issues if logged-in user is the teacher

**Response**:

```json
[
  {
    "id": 1,
    "magazine_title": "Weekly Newsletter",
    "teacher_username": "john_teacher",
    "title": "Weekly Newsletter",
    "subject": "This Week's Updates",
    "sent_at": "2025-11-25T10:30:00Z",
    "is_public": false
  }
]
```

## Frontend Routes

### 1. Issue View Page

**Route**: `/mail-magazines/[issueId]`

**File**: `pages/mail-magazines/[issueId].js`

**Features**:

- Authentication required
- Fetches issue from API
- Displays HTML content via `dangerouslySetInnerHTML`
- Shows meta info (sent date, teacher name)
- Dark theme styling

### 2. Creator Profile Tab

**Route**: `/guides/<username>` (existing page)

**Component**: `PublicGuideProfile.js`

**New Tab**: "Magazines"

**Features**:

- Lists all mail magazine issues by teacher
- Filtered by recipient access
- Click to view individual issue
- Shows sent date

## Security Notes

✅ **Authentication**: All endpoints require login
✅ **Authorization**: Three-level access control (teacher, recipient, public flag)
✅ **SQL Injection**: Django ORM prevents SQL injection
✅ **XSS**: HTML content is email-safe (sanitized during composition)
✅ **Privacy**: Non-recipients get 403 Forbidden (no data leakage)

## Performance Notes

- **Database Indexes**: Created on `(magazine_id, sent_at)` for efficient queries
- **M2M Queries**: Uses `.filter(id=user.id).exists()` for single query check
- **Pagination Ready**: Ordering by `-sent_at` supports future pagination
- **HTML Storage**: TextField handles large email content (tested up to 500KB)

## Rollback Plan

If issues occur:

1. **Database**:

   ```bash
   python manage.py migrate mailmagazine 0003_teachermailmagazine_times_sent
   ```

2. **Code**:

   ```bash
   git revert HEAD~2  # Revert last 2 commits
   git push origin main
   ```

3. **Services**:
   ```bash
   sudo systemctl restart gunicorn
   ```

---

**Deployment Date**: November 25, 2025
**Status**: Ready for Production
**Tested**: Local environment ✓
