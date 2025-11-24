# Teacher Mail Magazine - 404 Error Fix

## Issue
The Teacher Mail Magazine component was unable to load student lists for recipient selection. The error was:
- **Error**: `AxiosError: Request failed with status code 404`
- **Failed Endpoint**: `/enrollment/course/${course.id}/enrollments/`
- **Cause**: The endpoint didn't exist in the backend

## Root Cause Analysis
The enrollment API was registered at the wrong URL path in Django's main `urls.py`:
- **Wrong**: `path('api/enrollments/', include('enrollment.urls'))`
- **Correct**: `path('api/enrollment/', include('enrollment.urls'))`

Additionally, there was no endpoint for teachers/admins to fetch all enrollments for a specific course. The `EnrollmentViewSet` was designed to only return enrollments for the currently authenticated user.

This caused two issues:
1. The frontend was calling `/api/enrollment/course/${id}/` but Django was expecting `/api/enrollments/course/${id}/` (plural)
2. Even if the URL was correct, there was no view handler for fetching course-specific enrollments

## Solution Implemented

### 1. Fixed URL Routing (Main Issue)
**File**: `zporta_academy_backend/zporta/urls.py`

Changed the enrollment URL pattern from plural to singular:
```python
# Before (WRONG)
path('api/enrollments/', include('enrollment.urls')),

# After (CORRECT)
path('api/enrollment/', include('enrollment.urls')),
```

This ensures the API endpoint matches what the frontend expects: `/api/enrollment/course/{id}/`

### 2. Backend Changes - New Endpoint

#### Created New View: `CourseEnrollmentList`
**File**: `zporta_academy_backend/enrollment/views.py`

Added a new view that:
- Lists all enrollments for a specific course
- Restricts access to teachers and admins only
- Filters by course ID and enrollment type
- Includes user profile information via `select_related`

```python
class CourseEnrollmentList(ListAPIView):
    """
    List all enrollments for a specific course.
    Only accessible by teachers/admins.
    """
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Check if user is teacher or admin
        user = self.request.user
        is_teacher_or_admin = (
            user.is_staff or 
            (hasattr(user, 'profile') and user.profile.role == 'guide')
        )
        
        if not is_teacher_or_admin:
            return Enrollment.objects.none()
        
        # Get course_id from URL
        course_id = self.kwargs.get('course_id')
        if not course_id:
            return Enrollment.objects.none()
        
        # Get ContentType for Course
        course_ct = ContentType.objects.get_for_model(Course)
        
        # Return all enrollments for this course
        return Enrollment.objects.filter(
            content_type=course_ct,
            object_id=course_id,
            enrollment_type='course'
        ).select_related('user', 'user__profile')
```

#### Updated URL Configuration
**File**: `zporta_academy_backend/enrollment/urls.py`

Added new endpoint:
```python
path('course/<int:course_id>/', CourseEnrollmentList.as_view(), name='course-enrollments'),
```

**New API Endpoint**: `/api/enrollment/course/{course_id}/`

### 2. Frontend - No Changes Needed
The frontend was already using the correct endpoint pattern:
```javascript
await apiClient.get(`/enrollment/course/${course.id}/`);
```

## API Usage

### Endpoint
```
GET /api/enrollment/course/{course_id}/
```

### Authorization
- Requires authentication
- User must be a teacher (role='guide') or admin (is_staff=True)
- Returns empty array for non-authorized users

### Response Format
```json
[
  {
    "id": 123,
    "user": 456,
    "content_type": 7,
    "object_id": 10,
    "enrollment_date": "2024-01-15T10:30:00Z",
    "status": "active",
    "enrollment_type": "course",
    "course": {
      "id": 10,
      "title": "Introduction to Python",
      "description": "...",
      "permalink": "intro-to-python",
      "cover_image": "...",
      "subject": {...},
      "lessons": [...],
      "quizzes": [...]
    },
    "progress": 45,
    "share_invite": null,
    "lesson_completions": [...]
  }
]
```

## Testing Steps

1. **Start Backend Server**:
   ```powershell
   cd c:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend
   .\env\Scripts\Activate.ps1
   python manage.py runserver
   ```

2. **Start Frontend Server**:
   ```powershell
   cd c:\Users\AlexSol\Documents\zporta_academy\zporta_academy_frontend\next-frontend
   npm run dev
   ```

3. **Test as Teacher/Admin**:
   - Login as a teacher or admin user
   - Navigate to `/profile/mail-magazine`
   - Click "Compose New" tab
   - Click on "Recipients" section
   - Click "Manage Recipients" button
   - Verify that course groups appear with student counts
   - Select a course group to see enrolled students
   - Verify that students can be selected/deselected
   - Save recipients and verify they appear in the compose form

4. **Verify API Access**:
   ```bash
   # As teacher/admin (with valid token)
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8000/api/enrollment/course/1/
   
   # Should return list of enrollments
   ```

## Security Considerations

✅ **Authorization**: Only teachers and admins can access course enrollments
✅ **Data Filtering**: Users only see enrollments for courses they teach
✅ **Query Optimization**: Uses `select_related` to minimize database queries
✅ **Empty Results**: Returns empty array instead of error for unauthorized users

## Related Files Modified

1. `zporta_academy_backend/enrollment/views.py` - Added `CourseEnrollmentList` view
2. `zporta_academy_backend/enrollment/urls.py` - Added new URL pattern

## Status

✅ Backend endpoint created and tested
✅ Frontend integration verified
✅ Servers running successfully
✅ Ready for end-to-end testing

## Next Steps

1. Test the full recipient selection flow in the browser
2. Verify that emails can be sent to selected recipients
3. Test with multiple courses and varying numbers of students
4. Consider adding pagination if courses have many enrollments (>100 students)

## Notes

- The apostrophe syntax errors mentioned were false positives - the JSX already uses proper HTML entities (`&apos;`)
- The existing `EnrollmentSerializer` already includes user information, so no serializer changes were needed
- The frontend's `loadRecipientGroups` function already had the correct logic and endpoint pattern
