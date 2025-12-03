"""
Check activity counts for a specific user
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.contrib.auth import get_user_model
from gamification.models import Activity, ActivityType

User = get_user_model()

# Get user by ID 1 (usually the first admin user)
try:
    user = User.objects.get(id=1)
    print(f"\n=== Checking user: {user.username} (ID: {user.id}) ===\n")
    
    # Get all activity types in database for this user
    activity_types_in_db = list(Activity.objects.filter(user=user).values_list('activity_type', flat=True).distinct())
    print(f"Activity types stored in DB for this user:")
    for at in activity_types_in_db:
        count = Activity.objects.filter(user=user, activity_type=at).count()
        print(f"  '{at}': {count}")
    
    print(f"\n--- Checking with ActivityType constants ---")
    print(f"ActivityType.CORRECT_ANSWER = '{ActivityType.CORRECT_ANSWER}'")
    print(f"ActivityType.LESSON_COMPLETED = '{ActivityType.LESSON_COMPLETED}'")
    print(f"ActivityType.COURSE_ENROLLED = '{ActivityType.COURSE_ENROLLED}'")
    print(f"ActivityType.COURSE_COMPLETED = '{ActivityType.COURSE_COMPLETED}'")
    
    print(f"\n--- Count using constants ---")
    quiz_count = Activity.objects.filter(user=user, activity_type=ActivityType.CORRECT_ANSWER).count()
    lesson_count = Activity.objects.filter(user=user, activity_type=ActivityType.LESSON_COMPLETED).count()
    course_enrolled_count = Activity.objects.filter(user=user, activity_type=ActivityType.COURSE_ENROLLED).count()
    course_completed_count = Activity.objects.filter(user=user, activity_type=ActivityType.COURSE_COMPLETED).count()
    
    print(f"Quizzes (CORRECT_ANSWER): {quiz_count}")
    print(f"Lessons (LESSON_COMPLETED): {lesson_count}")
    print(f"Courses Enrolled (COURSE_ENROLLED): {course_enrolled_count}")
    print(f"Courses Completed (COURSE_COMPLETED): {course_completed_count}")
    
    print(f"\n--- Total ---")
    total = Activity.objects.filter(user=user).count()
    total_points = Activity.objects.filter(user=user).aggregate(models.Sum('points'))['points__sum'] or 0
    print(f"Total activities: {total}")
    print(f"Total points: {total_points}")
    
    # Sample activities
    print(f"\n--- Sample Activities (first 5) ---")
    from django.db import models
    for a in Activity.objects.filter(user=user).order_by('-created_at')[:5]:
        print(f"  {a.created_at.strftime('%Y-%m-%d')}: {a.activity_type} (+{a.points} pts)")
    
except User.DoesNotExist:
    print("User with ID 1 not found. List of users:")
    for u in User.objects.all()[:10]:
        print(f"  ID {u.id}: {u.username}")
