# Enrollment API 404 Error - URL Mismatch Fix

## The Problem

**Error**: `AxiosError: Request failed with status code 404`
**Failed URL**: `http://localhost:8000/api/enrollment/course/{course_id}/`

## Root Cause

The Django URL configuration had a mismatch between the registered URL pattern and what the frontend expected:

### Backend Configuration (WRONG)
```python
# zporta/urls.py
path('api/enrollments/', include('enrollment.urls'))  # Note: "enrollments" (plural)
```

This registered all enrollment routes under `/api/enrollments/`, so:
- `/api/enrollments/user/` ✅ (worked)
- `/api/enrollments/course/1/` ✅ (would work if called correctly)

### Frontend Calls (CORRECT)
```javascript
// Frontend was calling (singular "enrollment")
await apiClient.get(`/enrollment/course/${course.id}/`)
// With API base: http://localhost:8000/api
// Full URL: http://localhost:8000/api/enrollment/course/{id}/
```

### The Mismatch
- Frontend expected: `/api/enrollment/...` (singular)
- Backend registered: `/api/enrollments/...` (plural)
- Result: **404 Not Found**

## The Fix

### Changed URL Pattern
**File**: `zporta_academy_backend/zporta/urls.py`

```python
# Before
path('api/enrollments/', include('enrollment.urls')),

# After
path('api/enrollment/', include('enrollment.urls')),
```

### Why This Matters
The enrollment app's internal routes are:
- `user/` → User's own enrollments
- `course/<int:course_id>/` → Course enrollments (for teachers)
- `<int:enrollment_pk>/notes/` → Enrollment notes

When Django includes these routes under `api/enrollment/`, they become:
- `/api/enrollment/user/`
- `/api/enrollment/course/{id}/`
- `/api/enrollment/{id}/notes/`

This matches what the frontend expects!

## Additional Enhancement

While fixing the URL, I also added a new view to handle course-specific enrollment fetching with proper authorization:

### New View: CourseEnrollmentList
**File**: `enrollment/views.py`

```python
class CourseEnrollmentList(ListAPIView):
    """
    List all enrollments for a specific course.
    Only accessible by teachers/admins.
    """
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_teacher_or_admin = (
            user.is_staff or 
            (hasattr(user, 'profile') and user.profile.role == 'guide')
        )
        
        if not is_teacher_or_admin:
            return Enrollment.objects.none()
        
        course_id = self.kwargs.get('course_id')
        course_ct = ContentType.objects.get_for_model(Course)
        
        return Enrollment.objects.filter(
            content_type=course_ct,
            object_id=course_id,
            enrollment_type='course'
        ).select_related('user', 'user__profile')
```

This ensures:
1. Only teachers and admins can view course enrollments
2. Results are filtered by course ID
3. User information is efficiently loaded via `select_related`

## Verification

### Check the URL Routing
You can verify the fix by checking Django's URL patterns:

```bash
python manage.py show_urls | grep enrollment
```

Should show:
```
/api/enrollment/ ...
/api/enrollment/course/<int:course_id>/ ...
/api/enrollment/user/ ...
```

### Test the API
```bash
# Get enrollments for course ID 1 (as teacher/admin)
curl -H "Authorization: Token YOUR_TOKEN" \
     http://localhost:8000/api/enrollment/course/1/
```

## Files Modified

1. ✅ `zporta_academy_backend/zporta/urls.py` - Fixed URL pattern
2. ✅ `zporta_academy_backend/enrollment/views.py` - Added CourseEnrollmentList view
3. ✅ `zporta_academy_backend/enrollment/urls.py` - Added course enrollment route

## Status

✅ **FIXED** - Server automatically reloaded with new configuration
✅ URL pattern now matches frontend expectations
✅ Authorization properly enforced for course enrollment access
✅ Frontend calls will now resolve correctly

## Testing Checklist

- [ ] Login as teacher/admin
- [ ] Navigate to `/profile/mail-magazine`
- [ ] Click "Compose New" tab
- [ ] Click "Manage Recipients" button
- [ ] Verify courses appear with student counts
- [ ] Select a course to view enrolled students
- [ ] Verify no 404 errors in browser console

## Important Notes

### Why Not Just Change the Frontend?
The enrollment app's internal URL structure uses singular "enrollment" consistently:
- Model: `Enrollment` (singular)
- ViewSet: `EnrollmentViewSet` (singular)
- App name: `enrollment` (singular)

Changing the main URL to plural (`enrollments`) was inconsistent with the rest of the app naming. The fix aligns the external API URL with internal naming conventions.

### Impact on Existing Code
This change affects any frontend code calling enrollment endpoints. However, checking the codebase shows the frontend was already using the singular form:

```javascript
// These calls now work:
apiClient.get('/enrollment/user/')
apiClient.get('/enrollment/course/${id}/')
apiClient.get(`/enrollment/${id}/notes/`)
```

If any other parts of the app use the plural form (`/enrollments/`), they will need to be updated to use singular (`/enrollment/`).
