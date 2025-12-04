"""
Backfill missing Activity records from existing Enrollments.
Run this once to create Activity records for enrollments that existed before signals were connected.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.contrib.contenttypes.models import ContentType
from enrollment.models import Enrollment
from courses.models import Course
from gamification.models import Activity, ActivityType
from django.contrib.auth import get_user_model

User = get_user_model()

def backfill_enrollments():
    """Create COURSE_ENROLLED activities for existing enrollments"""
    course_ct = ContentType.objects.get_for_model(Course)
    
    enrollments = Enrollment.objects.filter(
        content_type=course_ct,
        enrollment_type='course'
    ).select_related('user')
    
    created_count = 0
    skipped_count = 0
    
    for enrollment in enrollments:
        course = enrollment.content_object
        if not isinstance(course, Course):
            continue
        
        student = enrollment.user
        unique_key = f"enrollment_student_{student.id}_c_{course.id}"
        
        # Check if activity already exists
        if Activity.objects.filter(unique_key=unique_key).exists():
            skipped_count += 1
            continue
        
        # Determine if premium
        is_premium = getattr(enrollment, 'payment_status', None) == 'completed'
        
        # Create student enrollment activity
        Activity.objects.create(
            user=student,
            activity_type=ActivityType.COURSE_ENROLLED,
            points=Activity.get_points_for_activity(ActivityType.COURSE_ENROLLED),
            content_type=course_ct,
            object_id=course.id,
            unique_key=unique_key,
            metadata={
                'course_id': course.id,
                'course_title': course.title,
                'course_permalink': course.permalink,
                'course_username': course.created_by.username if course.created_by else None,
                'course_subject': course.subject.name if course.subject else None,
                'course_date': course.created_at.strftime('%Y-%m-%d') if course.created_at else None,
                'enrollment_type': 'premium' if is_premium else 'free',
                'is_premium': is_premium,
            },
            created_at=enrollment.enrollment_date
        )
        
        created_count += 1
        print(f"✓ Created COURSE_ENROLLED activity for {student.username} → {course.title}")
        
        # Update user score
        try:
            from gamification.models import UserScore
            score, _ = UserScore.objects.get_or_create(user=student)
            score.recalculate()
        except Exception as e:
            print(f"  Warning: Could not update score for {student.username}: {e}")
    
    print(f"\n✅ Backfill complete:")
    print(f"   Created: {created_count} activities")
    print(f"   Skipped: {skipped_count} (already existed)")
    return created_count, skipped_count

if __name__ == '__main__':
    print("Starting activity backfill...")
    print("-" * 50)
    created, skipped = backfill_enrollments()
    print("-" * 50)
    print(f"Done! {created} new activities created.")
