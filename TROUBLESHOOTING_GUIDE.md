# Registration Fix - Troubleshooting & Verification Guide

## Quick Diagnostics

### Frontend Issue Fixed ✅

**Error that occurred:**

```
ReferenceError: Cannot access 'k' before initialization
    at g (Register.js:46:24)
```

**What was wrong:**

- `useEffect` tried to use `fetchInvitationDetails` before it was defined
- JavaScript hoisting issue - function called before declaration

**What was fixed:**

- Moved `fetchInvitationDetails` definition BEFORE the `useEffect` that uses it
- File: `Register.js` lines 35-65

**How to verify it's fixed:**

1. Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Open DevTools: Press `F12`
3. Go to Console tab
4. Navigate to `/register` page
5. Should see NO errors, page should load normally

---

## Step-by-Step Verification

### 1. Clear Cache & Reload

**Why:** Browser may be serving cached broken version

```bash
# Option A: Hard Refresh
Press: Ctrl+Shift+R (Windows/Linux)
Press: Cmd+Shift+R (Mac)

# Option B: Clear Cache Completely
1. Press F12 to open DevTools
2. Press Ctrl+Shift+Delete (or Cmd+Shift+Delete)
3. Select "All time" in time range
4. Check "Cookies and other site data"
5. Check "Cached images and files"
6. Click Clear data
7. Refresh page
```

### 2. Check for Console Errors

```
1. Open DevTools (F12)
2. Click "Console" tab
3. Navigate to https://zportaacademy.com/register
4. Look for red error messages
5. Expected: NO ReferenceError or client-side exceptions
```

### 3. Test Basic Registration

```
1. Navigate to https://zportaacademy.com/register
2. Fill in form:
   Username: testuser_[timestamp]
   Email: test_[timestamp]@example.com
   Password: SecurePassword123!
   Role: Explorer
3. Click "Register" button
4. Expected result:
   ✅ No console error
   ✅ Success message appears
   ✅ Redirects to /login
```

### 4. Test with Invitation URL

```
If you have a valid invitation token:
1. Go to: https://zportaacademy.com/register?token=YOUR_TOKEN_HERE
2. Expected:
   ✅ "You've been invited by [teacher name] to become a teacher!" message
   ✅ Email field pre-filled with invited email
   ✅ Role set to "guide"
3. Complete registration
4. Expected: User becomes approved teacher
```

---

## Common Issues & Fixes

### Issue: Still Getting ReferenceError After Fix

**Causes:**

1. Browser cached old version
2. Next.js build not reloaded
3. Wrong file modified

**Solutions:**

```bash
# 1. Clear ALL browser cache
Ctrl+Shift+Delete (Windows)
Cmd+Shift+Delete (Mac)

# 2. Hard refresh
Ctrl+Shift+R (Windows)
Cmd+Shift+R (Mac)

# 3. For developers: Clear Next.js build cache
rm -rf .next/
npm run build
npm run start

# 4. Verify the file was actually changed
grep -n "const fetchInvitationDetails = useCallback" \
  src/components/Register.js
# Should show line 42-43 (before useEffect)
```

### Issue: "401 Unauthorized" Error on Profile Page

**Reason:** This is UNRELATED to the registration fix - it means user is not logged in

**Solution:** This is normal - users need to login after registration

```
Registration flow:
1. Register (POST /users/register/)
2. Redirect to /login
3. User logs in
4. THEN can access /profile (requires auth)
```

### Issue: "Application error: a client-side exception"

**Check:**

1. Browser console for actual error message
2. Check for ReferenceError - if fixed, look for other errors
3. Verify all imports are correct
4. Check `apiClient` is properly configured

**Solution:**

```bash
# Run Next.js development server to see full errors
npm run dev
# Navigate to http://localhost:3000/register
# Check console for detailed error message
```

---

## Backend Verification (Optional)

If you also deployed backend fixes:

### 1. Test Registration Creates Profile

```bash
python manage.py shell << 'EOF'
from django.contrib.auth.models import User
from users.models import Profile

# Get most recently created user
user = User.objects.latest('date_joined')
print(f"Username: {user.username}")
print(f"Has profile: {hasattr(user, 'profile')}")
print(f"Profile role: {user.profile.role}")
print(f"Profile bio: {user.profile.bio}")
EOF
```

**Expected output:**

```
Username: testuser_123456
Has profile: True
Profile role: explorer
Profile bio:
```

### 2. Test Database Integrity

```bash
python manage.py shell << 'EOF'
from django.contrib.auth.models import User
from users.models import Profile

# Check for orphaned data
orphaned_users = User.objects.filter(profile__isnull=True).count()
orphaned_profiles = Profile.objects.filter(user__isnull=True).count()

print(f"Users without profiles: {orphaned_users}")
print(f"Profiles without users: {orphaned_profiles}")
EOF
```

**Expected output:**

```
Users without profiles: 0
Profiles without users: 0
```

### 3. Test Concurrent Registrations

```bash
# Simulate 5 concurrent registrations
for i in {1..5}; do
  curl -s -X POST https://zportaacademy.com/api/users/register/ \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"concurrent_$i\",
      \"email\": \"concurrent_$i@example.com\",
      \"password\": \"SecurePass123!\"
    }" \
    -w "Request $i: HTTP %{http_code}\n" &
done
wait
```

**Expected output:**

```
Request 1: HTTP 201
Request 2: HTTP 201
Request 3: HTTP 201
Request 4: HTTP 201
Request 5: HTTP 201
```

(All should be 201 or 400 for duplicates, NO 500 errors)

---

## Debugging Commands

### Check Frontend Build

```bash
cd zporta_academy_frontend/next-frontend

# Rebuild Next.js
rm -rf .next/
npm run build

# Check for build errors
npm run build 2>&1 | grep -i "error\|warning"
```

### Check Backend Logs

```bash
# If using systemd
sudo journalctl -u zporta-gunicorn -n 50 --no-pager

# If using Docker
docker logs zporta-gunicorn -n 50

# Check application logs
sudo tail -f /var/log/zporta/gunicorn.log
```

### Test API Endpoints

```bash
# Test registration endpoint
curl -X POST http://localhost:8000/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123"
  }' | jq

# Test invitation acceptance
curl -X GET http://localhost:8000/api/users/invitations/accept/?token=UUID_HERE | jq
```

---

## What Changed

### Files Modified (4 total)

**Frontend:**

- ✅ `zporta_academy_frontend/next-frontend/src/components/Register.js`
  - Lines 35-65: Reordered function definitions
  - Fixed hoisting issue

**Backend:**

- ✅ `zporta_academy_backend/users/views.py`
  - Lines 395-470: RegisterView improvements
- ✅ `zporta_academy_backend/users/invitation_models.py`
  - Lines 100-130: Safe field access
- ✅ `zporta_academy_backend/users/guide_application_models.py`
  - Lines 77-102: Safe field access

### What Did NOT Change

- ❌ Database schema
- ❌ API endpoints
- ❌ Request/response format
- ❌ User authentication flow
- ❌ Any user data

---

## Success Checklist

After deploying fixes, verify:

- [ ] Register page loads without console errors
- [ ] Can register new user successfully
- [ ] Success message appears after registration
- [ ] User redirected to login page
- [ ] Duplicate email rejected with proper error
- [ ] Duplicate username rejected with proper error
- [ ] Invitation token pre-fills email correctly
- [ ] Manual invitation code verification works
- [ ] Teacher application submission works
- [ ] Google Sign-In still works
- [ ] No 500 errors in backend logs
- [ ] No ReferenceError in browser console

**Total checks: 12**  
✅ All 12 passing = Fix is successful

---

## Quick Fix Summary

| Issue                      | Symptom                       | Fix                            | File                                              |
| -------------------------- | ----------------------------- | ------------------------------ | ------------------------------------------------- |
| **Frontend Hoisting**      | ReferenceError: k before init | Move function before useEffect | Register.js:35-65                                 |
| **Backend Race Condition** | 500 errors in production      | Remove update_or_create()      | views.py:395-470                                  |
| **Field Safety**           | AttributeError                | Add hasattr() checks           | invitation_models.py, guide_application_models.py |

---

## Need Help?

1. **Frontend Issue:** Check browser console (F12)
2. **Backend Issue:** Check `/var/log/zporta/gunicorn.log`
3. **Database Issue:** Run `python manage.py migrate users`
4. **Build Issue:** Run `npm run build` and check output
5. **Cache Issue:** Hard refresh `Ctrl+Shift+R`
