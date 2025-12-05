# Registration API Fix - Deployment Guide

## What Was Fixed

### 1. **Race Condition in Profile Creation** (PRIMARY FIX)

- **File:** `users/views.py`, `RegisterView.post()`
- **Change:** Removed redundant `Profile.objects.update_or_create()` call
- **Reason:** Django's `post_save` signal already creates Profile automatically. The explicit call was causing race conditions in Gunicorn with multiple workers.
- **Impact:** Eliminates database race conditions and simplifies code

### 2. **Added Logging and Better Error Handling**

- **File:** `users/views.py`, `RegisterView.post()`
- **Change:**
  - Added Python logger for debugging
  - Explicit null checks on profile creation
  - Better error messages and user cleanup on failure
- **Impact:** Production logging will now capture registration errors

### 3. **Safe Field Access in Profile Updates**

- **Files:**
  - `users/invitation_models.py`, `TeacherInvitation.accept()`
  - `users/guide_application_models.py`, `GuideApplicationRequest.approve()`
- **Change:** Added `hasattr()` checks before accessing `can_invite_teachers` field
- **Impact:** Prevents AttributeErrors if profile field is missing in production DB

---

## Pre-Deployment Checklist

### ✅ Database Verification

```bash
# 1. SSH to production server
ssh ubuntu@18.176.206.74

# 2. Verify Profile.can_invite_teachers field exists
cd /path/to/zporta_academy_backend
source env/bin/activate
python manage.py shell

# In Django shell:
from users.models import Profile
profile = Profile.objects.first()
print(hasattr(profile, 'can_invite_teachers'))  # Should print: True
print(profile._meta.get_field('can_invite_teachers'))  # Should not raise
exit()
```

### ✅ Run Migrations (if needed)

```bash
python manage.py migrate users
```

### ✅ Code Review

```bash
# Verify changes were applied correctly
git diff HEAD~1 users/views.py
git diff HEAD~1 users/invitation_models.py
git diff HEAD~1 users/guide_application_models.py
```

---

## Deployment Steps

### Step 1: Pull Latest Code

```bash
cd /path/to/zporta_academy_backend
git pull origin main
```

### Step 2: Install Any New Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Run Migrations

```bash
python manage.py migrate users
```

### Step 4: Collect Static Files (if needed)

```bash
python manage.py collectstatic --noinput
```

### Step 5: Restart Gunicorn

```bash
# Graceful reload (recommended)
sudo systemctl restart zporta-gunicorn

# Or if using systemd socket activation:
sudo systemctl reload zporta-gunicorn
```

### Step 6: Verify Nginx is Still Running

```bash
sudo systemctl status nginx
```

---

## Post-Deployment Testing

### 🧪 Test 1: Basic Registration (Single User)

```bash
curl -X POST https://zportaacademy.com/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_'$(date +%s)'",
    "email": "test_'$(date +%s)'@example.com",
    "password": "SecurePass123!",
    "role": "explorer",
    "bio": "Testing registration"
  }' | jq

# Expected response: 201 Created
# {
#   "message": "User registered successfully."
# }
```

### 🧪 Test 2: Duplicate Email Detection

```bash
TEST_EMAIL="duplicate_test_$(date +%s)@example.com"

# First registration should succeed
curl -X POST https://zportaacademy.com/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1_'$(date +%s)'",
    "email": "'$TEST_EMAIL'",
    "password": "SecurePass123!",
    "role": "explorer"
  }' | jq

# Second registration with same email should fail with 400
curl -X POST https://zportaacademy.com/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user2_'$(date +%s)'",
    "email": "'$TEST_EMAIL'",
    "password": "SecurePass123!",
    "role": "explorer"
  }' | jq

# Expected: 400 Bad Request
# {
#   "error": "Email already registered."
# }
```

### 🧪 Test 3: Duplicate Username Detection

```bash
TEST_USERNAME="unique_user_$(date +%s)"

# First registration should succeed
curl -X POST https://zportaacademy.com/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$TEST_USERNAME'",
    "email": "email1_'$(date +%s)'@example.com",
    "password": "SecurePass123!",
    "role": "explorer"
  }' | jq

# Second registration with same username should fail
curl -X POST https://zportaacademy.com/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$TEST_USERNAME'",
    "email": "email2_'$(date +%s)'@example.com",
    "password": "SecurePass123!",
    "role": "explorer"
  }' | jq

# Expected: 400 Bad Request
# {
#   "error": "Username already taken."
# }
```

### 🧪 Test 4: Profile Creation Verification

```bash
# After a successful registration, verify profile was created
python manage.py shell << 'EOF'
from django.contrib.auth.models import User
from users.models import Profile

# Get the most recently created user
user = User.objects.latest('date_joined')
print(f"User: {user.username}")
print(f"Has profile: {hasattr(user, 'profile')}")

profile = user.profile
print(f"Profile role: {profile.role}")
print(f"Profile bio: {profile.bio}")
print(f"Has can_invite_teachers: {hasattr(profile, 'can_invite_teachers')}")
print(f"active_guide: {profile.active_guide}")
EOF
```

### 🧪 Test 5: Concurrent Registration (Stress Test)

```bash
# Simulates multiple concurrent requests
# Run this from production server with small load
TEST_EMAIL_BASE=$(date +%s)

for i in {1..10}; do
  curl -X POST https://zportaacademy.com/api/users/register/ \
    -H "Content-Type: application/json" \
    -d '{
      "username": "concurrent_'$i'_'$(date +%s%N)'",
      "email": "concurrent_'$i'_'$TEST_EMAIL_BASE'@example.com",
      "password": "SecurePass123!",
      "role": "explorer"
    }' \
    -w "\nStatus: %{http_code}\n" \
    -o /dev/null \
    -s &
done
wait

# Expected: All requests return either 201 (success) or 400 (duplicate)
# No 500 errors or timeout
```

### 🧪 Test 6: Check Logs for Errors

```bash
# Check Gunicorn logs
sudo tail -f /var/log/zporta/gunicorn.log | grep -i "registration\|profile\|error"

# Check system logs
sudo journalctl -u zporta-gunicorn -n 100 --no-pager

# Look specifically for our new logging
grep "Registration\|Profile not found" /var/log/zporta/gunicorn.log
```

---

## Verification Commands

### 1. Database Integrity Check

```bash
python manage.py dbshell << 'EOF'
-- Check that all Users have associated Profiles
SELECT u.id, u.username, CASE WHEN p.id IS NOT NULL THEN 'OK' ELSE 'MISSING' END as profile_status
FROM auth_user u
LEFT JOIN users_profile p ON u.id = p.user_id
WHERE p.id IS NULL
LIMIT 5;

-- Should return 0 rows if all is well
EOF
```

### 2. Check Recent Registrations

```bash
python manage.py shell << 'EOF'
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

# Check users registered in the last hour
recent_users = User.objects.filter(
    date_joined__gte=timezone.now() - timedelta(hours=1)
).order_by('-date_joined')[:10]

for user in recent_users:
    profile = user.profile
    print(f"{user.username}: role={profile.role}, active_guide={profile.active_guide}")
EOF
```

### 3. Verify No Orphaned Profiles

```bash
python manage.py shell << 'EOF'
from django.contrib.auth.models import User
from users.models import Profile

# Count users without profiles
orphaned = User.objects.filter(profile__isnull=True).count()
print(f"Users without profiles: {orphaned}")

# Count profiles without users
orphaned_profiles = Profile.objects.filter(user__isnull=True).count()
print(f"Profiles without users: {orphaned_profiles}")

# Both should be 0
EOF
```

---

## Rollback Plan

If issues occur, rollback is simple:

```bash
# 1. Revert code to previous version
git revert HEAD

# 2. Restart Gunicorn
sudo systemctl restart zporta-gunicorn

# 3. No database migration needed (only code changes)
```

---

## Monitoring Post-Deployment

### Key Metrics to Monitor (First 24-48 hours)

1. **Registration Success Rate**

   ```bash
   # Count successful registrations
   python manage.py shell << 'EOF'
   from django.contrib.auth.models import User
   from django.utils import timezone
   from datetime import timedelta

   last_hour = User.objects.filter(
       date_joined__gte=timezone.now() - timedelta(hours=1)
   ).count()
   print(f"Registrations in last hour: {last_hour}")
   EOF
   ```

2. **Error Logs**

   ```bash
   sudo tail -f /var/log/zporta/gunicorn.log | grep -i "registration\|error\|exception"
   ```

3. **Database Performance**

   ```bash
   # Check slow query log
   sudo tail -f /var/log/mysql/slow.log
   ```

4. **Gunicorn Worker Status**
   ```bash
   sudo systemctl status zporta-gunicorn
   ps aux | grep gunicorn | grep -v grep
   ```

---

## Success Criteria

✅ All tests pass with 201 (success) or 400 (validation error) responses  
✅ No 500 errors in registration endpoint  
✅ No database errors in logs  
✅ Profile is created for every user  
✅ Concurrent registrations don't cause race conditions  
✅ Duplicate email/username detection works

---

## Support & Debugging

If issues occur:

1. **Check logs first:**

   ```bash
   sudo journalctl -u zporta-gunicorn -n 200 --no-pager | grep -A5 "register"
   ```

2. **Enable debug mode temporarily** (do NOT commit):

   ```python
   # In production.py settings
   DEBUG = True  # ONLY for debugging
   LOGGING = {
       'version': 1,
       'disable_existing_loggers': False,
       'handlers': {
           'console': {
               'class': 'logging.StreamHandler',
           },
       },
       'root': {
           'handlers': ['console'],
           'level': 'DEBUG',
       },
   }
   ```

3. **Verify database connection:**

   ```bash
   python manage.py dbshell
   SELECT 1;
   ```

4. **Check Gunicorn configuration:**
   ```bash
   cat /etc/systemd/system/zporta-gunicorn.service
   ```

---

## Questions?

Refer to `REGISTRATION_BUG_ANALYSIS.md` for detailed technical explanation of the fixes.
