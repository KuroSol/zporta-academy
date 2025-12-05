# Registration API Bug Analysis - Production vs Local

## Executive Summary

The registration API works locally but fails in production (Ubuntu + Gunicorn + Nginx) due to **potential race condition and missing error handling** in the `RegisterView`. The issue likely stems from asynchronous behavior differences between local development (`runserver`) and production (`gunicorn`).

---

## Root Cause Analysis

### Issue 1: Race Condition in Profile Creation (HIGH SEVERITY)

**Location:** `users/views.py`, `RegisterView.post()`, lines 420-421

```python
user = User.objects.create_user(username=username, email=email, password=password)
# Create or update profile *after* user is created
Profile.objects.update_or_create(user=user, defaults={'role': role, 'bio': bio})
return Response({"message": "User registered successfully."}, status=HTTP_201_CREATED)
```

**Problem:**

1. Django's `post_save` signal on `User` model (in `users/models.py`, line 165) automatically creates a Profile when a User is created.
2. The code then explicitly calls `Profile.objects.update_or_create()` immediately after.
3. **In Gunicorn with multiple workers or in production with concurrent requests**, there's a race condition:
   - Thread/process A: Creates User → Signal fires → Profile auto-created
   - Thread/process B: Tries to access the same Profile simultaneously
   - The explicit `update_or_create()` may fail or behave unexpectedly if the auto-created profile hasn't been committed to the DB yet

**Why it works locally:**

- Django's development server (`runserver`) is single-threaded by default
- Signals are processed synchronously in the same transaction
- No concurrency issues occur

**Why it fails in production:**

- Gunicorn with multiple workers handles concurrent requests
- Database transaction isolation and timing become critical
- Profile may be partially committed when accessed

---

### Issue 2: Missing `can_invite_teachers` Field in Profile (MEDIUM SEVERITY)

**Location:** `users/views.py`, `RegisterView.post()`, and `users/invitation_models.py`, `accept()` method

**Problem:**
The `TeacherInvitation.accept()` method (line 113) tries to set:

```python
profile.can_invite_teachers = False  # Don't allow chain invitations by default
profile.save()
```

This field exists in the Profile model (`users/models.py`, line 39), but:

- It's **only set during invitation acceptance**, not during registration
- If the profile creation fails or is incomplete in production, accessing this attribute may raise an `AttributeError`
- The code doesn't verify the field exists before setting it

---

### Issue 3: Inconsistent Return Statements (MEDIUM SEVERITY)

**Location:** `users/views.py`, `RegisterView.post()`, lines 420-432

**Problem:**
The `try/except` block has multiple code paths with different behaviors:

- Line 420: Returns after user creation (success path)
- Line 429: Returns after IntegrityError (error path)
- Line 432: Returns after generic Exception (error path)
- **Missing:** No explicit return if profile update fails silently

In production, if `Profile.objects.update_or_create()` raises an exception that isn't caught, the function may return `None` instead of a Response, causing:

```
TypeError: The view register did not return an HttpResponse object. It returned None.
```

---

## Production-Specific Failure Scenarios

### Scenario 1: Concurrent Registration with Same Email (Database Race)

```
Request A: Create user 'john' with email 'john@example.com'
Request B: Create user 'jane' with email 'john@example.com' (duplicate)

In local:
- Request A completes fully before Request B is processed
- Request B gets clean 400 error

In production (Gunicorn + workers):
- Both requests may pass initial `User.objects.filter()` checks
- Both hit `User.objects.create_user()` at nearly the same time
- IntegrityError is caught and returns 400 (good)
- **BUT:** Profile creation race condition still unhandled
```

### Scenario 2: Profile Auto-Creation Signal Timing

```
In Gunicorn with multiple workers:
1. create_user() called
2. Signal fires async/in different worker process
3. update_or_create() called before signal completes
4. Result: Duplicate profile attempts or stale data

In production logging, you'd see:
- IntegrityError on Profile creation
- AttributeError when accessing newly-created profile
- Possible database deadlock
```

---

## Recommended Fixes

### Fix 1: Remove Redundant Profile Creation (PRIMARY FIX)

**Reason:** Trust Django's signal to handle Profile creation automatically.

```python
user = User.objects.create_user(username=username, email=email, password=password)
# Profile is auto-created by the post_save signal
# Update it with the provided role and bio
user.profile.role = role
user.profile.bio = bio
user.profile.save()
```

**Benefits:**

- Eliminates race condition between signal and explicit create
- Single source of truth (signal) for profile creation
- Simpler code, fewer database operations

---

### Fix 2: Add Field Existence Check & Better Error Handling

```python
try:
    user = User.objects.create_user(username=username, email=email, password=password)

    # Update the auto-created profile
    if hasattr(user, 'profile') and user.profile:
        user.profile.role = role
        user.profile.bio = bio
        user.profile.save()
    else:
        raise ValueError("Profile was not created with user")

    return Response({"message": "User registered successfully."}, status=HTTP_201_CREATED)

except IntegrityError as e:
    # Handle duplicate username/email
    error_msg = "Registration failed due to a database constraint."
    if 'username' in str(e).lower():
        error_msg = "Username already taken."
    elif 'email' in str(e).lower():
        error_msg = "Email already registered."
    return Response({"error": error_msg}, status=HTTP_400_BAD_REQUEST)

except Exception as e:
    logger.error(f"Registration error: {e}", exc_info=True)
    return Response(
        {"error": "An unexpected error occurred during registration."},
        status=HTTP_500_INTERNAL_SERVER_ERROR
    )
```

---

### Fix 3: Ensure Profile Fields Are Initialized Safely

In `TeacherInvitation.accept()`:

```python
# Safer field access
profile = user.profile
if not hasattr(profile, 'can_invite_teachers'):
    # Field doesn't exist, skip setting it
    logger.warning(f"Profile for user {user.id} missing can_invite_teachers field")
else:
    profile.can_invite_teachers = False
profile.save()
```

---

## Testing Strategy for Production

### Test 1: Concurrent Registration

```bash
# Simulate 50 concurrent registration attempts with the same email
for i in {1..50}; do
  curl -X POST http://localhost:8000/users/register/ \
    -H "Content-Type: application/json" \
    -d '{
      "username": "user_'$i'",
      "email": "shared@example.com",
      "password": "testpass123",
      "role": "explorer"
    }' &
done
```

**Expected:** Exactly one succeeds (201), rest get 400 "Email already registered"

### Test 2: Profile Integrity Check

```python
# After registration, verify profile exists and is accessible
user = User.objects.get(username='newuser')
profile = user.profile  # Should not raise DoesNotExist
assert profile.role == 'explorer'
```

### Test 3: Post-Registration Invitation Acceptance

```python
# Register, then accept invitation in the same flow
# Verify can_invite_teachers is set correctly
```

---

## Database Migration Check

⚠️ **Verify:** The `Profile.can_invite_teachers` field is properly migrated to production database.

```bash
./manage.py migrate users
```

If the field is missing in production, create a migration:

```bash
./manage.py makemigrations users
./manage.py migrate users
```

---

## Summary of Changes

| Issue           | File                         | Lines   | Fix                                                   | Risk |
| --------------- | ---------------------------- | ------- | ----------------------------------------------------- | ---- |
| Race condition  | `users/views.py`             | 420-421 | Remove `update_or_create()`, use signal + direct save | Low  |
| Missing returns | `users/views.py`             | 420-432 | Add explicit returns in all code paths                | Low  |
| Field safety    | `users/invitation_models.py` | 113     | Add `hasattr()` check before setting field            | Low  |

---

## Implementation Checklist

- [ ] Update `RegisterView.post()` to remove redundant profile creation
- [ ] Add logging for registration errors
- [ ] Run concurrent registration tests
- [ ] Verify database migration is applied in production
- [ ] Monitor logs for 24-48 hours post-deployment
- [ ] Add integration test for registration flow
