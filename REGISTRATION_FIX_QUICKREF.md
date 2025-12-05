# Registration API Fix - Quick Reference

## Problem Statement

User registration works locally (Django `runserver`) but fails in production (Gunicorn + Nginx) with errors related to:

- Missing/undefined variables
- Inconsistent return statements
- Database race conditions

## Root Cause

Redundant `Profile.objects.update_or_create()` call racing with Django's automatic `post_save` signal that creates Profile.

In local single-threaded environment: Works fine (sequential execution)  
In production multi-worker Gunicorn: Race condition causes failures

## Solution

Remove redundant profile creation and trust Django's signal + direct attribute update.

---

## Files Changed (3 files)

### 1. `users/views.py` - RegisterView.post()

```python
# BEFORE (Wrong)
user = User.objects.create_user(...)
Profile.objects.update_or_create(user=user, defaults={...})

# AFTER (Correct)
user = User.objects.create_user(...)
if hasattr(user, 'profile') and user.profile:
    user.profile.role = role
    user.profile.bio = bio
    user.profile.save()
```

### 2. `users/invitation_models.py` - TeacherInvitation.accept()

```python
# BEFORE (Unsafe)
profile.can_invite_teachers = False

# AFTER (Safe)
if hasattr(profile, 'can_invite_teachers'):
    profile.can_invite_teachers = False
else:
    logger.warning(f"Profile for user {user.id} missing field")
```

### 3. `users/guide_application_models.py` - GuideApplicationRequest.approve()

```python
# BEFORE (Unsafe)
profile.can_invite_teachers = False

# AFTER (Safe)
if hasattr(profile, 'can_invite_teachers'):
    profile.can_invite_teachers = False
else:
    logger.warning(f"Profile for user {user.id} missing field")
```

---

## Testing (6 Quick Tests)

### Test 1: Basic Registration

```bash
curl -X POST https://zportaacademy.com/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test1","email":"test1@example.com","password":"SecurePass123!"}'
# Expected: 201 Created
```

### Test 2: Duplicate Email

```bash
# Register first user with email@example.com
# Try registering second user with same email
# Expected: 400 Bad Request - "Email already registered."
```

### Test 3: Duplicate Username

```bash
# Register first user with username "john"
# Try registering second user with username "john"
# Expected: 400 Bad Request - "Username already taken."
```

### Test 4: Verify Profile Created

```bash
python manage.py shell << 'EOF'
from django.contrib.auth.models import User
user = User.objects.latest('date_joined')
print(f"Has profile: {hasattr(user, 'profile')}")
print(f"Profile role: {user.profile.role}")
EOF
```

### Test 5: Concurrent Registrations (10 simultaneous)

```bash
for i in {1..10}; do
  curl -X POST https://zportaacademy.com/api/users/register/ \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"concurrent_$i\",\"email\":\"concurrent_$i@example.com\",\"password\":\"Pass123!\"}" &
done
# Expected: Mix of 201 (success) and 400 (duplicate), no 500 errors
```

### Test 6: Check Logs

```bash
sudo tail -f /var/log/zporta/gunicorn.log | grep -i "registration\|profile"
# Expected: No error messages, maybe some info logs
```

---

## Deployment Command

```bash
cd /path/to/backend
git pull origin main
python manage.py migrate users
sudo systemctl restart zporta-gunicorn
```

---

## Verification Checklist

After deployment:

- [ ] Basic registration returns 201
- [ ] Duplicate email rejected with 400
- [ ] Duplicate username rejected with 400
- [ ] All users have profiles
- [ ] No 500 errors in logs
- [ ] No AttributeError exceptions
- [ ] Concurrent requests work

---

## Key Changes Summary

| Aspect            | Before                           | After                                  |
| ----------------- | -------------------------------- | -------------------------------------- |
| Profile creation  | `update_or_create()` (redundant) | Direct attribute update (trust signal) |
| Logging           | `print()` function               | `logging.getLogger()`                  |
| Field access      | Assumes field exists             | `hasattr()` check before access        |
| Error cleanup     | None                             | Orphaned users deleted                 |
| Return statements | Inconsistent                     | All explicit                           |

---

## If Something Goes Wrong

### Option 1: Check Logs

```bash
sudo tail -f /var/log/zporta/gunicorn.log | grep -A5 "register"
```

### Option 2: Verify Database

```bash
python manage.py shell
from django.contrib.auth.models import User
User.objects.latest('date_joined').profile  # Should work
```

### Option 3: Rollback (No data loss)

```bash
git revert HEAD
sudo systemctl restart zporta-gunicorn
# No database changes, so no migration rollback needed
```

---

## Support Documents

See these files for detailed information:

1. **REGISTRATION_BUG_ANALYSIS.md** - Technical deep dive
2. **REGISTRATION_FIX_DEPLOYMENT.md** - Step-by-step deployment guide
3. **REGISTRATION_FIX_SUMMARY.md** - Before/after code comparison
4. **REGISTRATION_FIX_VERIFICATION.md** - Full verification report

---

## API Contract (Unchanged)

✅ No breaking changes

- Request format: Same
- Response format: Same
- Status codes: Same (201, 400, 500)
- No new fields added/removed

---

## Time to Deploy

- Prep: 1 hour (review + backup)
- Deploy: 15 minutes (code pull + restart)
- Test: 30 minutes (run test suite)
- **Total: ~2 hours**
