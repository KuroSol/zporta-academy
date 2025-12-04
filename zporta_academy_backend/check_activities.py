"""
Check user activities for debugging
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.contrib.auth import get_user_model
from enrollment.models import Enrollment
from gamification.models import Activity, UserScore

User = get_user_model()

print("\n=== Recent Users (last 5) ===")
for u in User.objects.order_by('-date_joined')[:5]:
    print(f"{u.id}: {u.username} - {u.email}")

print("\n=== Recent Enrollments (last 5) ===")
for e in Enrollment.objects.select_related('user').order_by('-enrollment_date')[:5]:
    course = e.content_object
    title = course.title if hasattr(course, 'title') else 'N/A'
    print(f"User {e.user.username} enrolled in '{title}' on {e.enrollment_date}")

print("\n=== Recent Activities (last 10) ===")
for a in Activity.objects.select_related('user').order_by('-created_at')[:10]:
    print(f"{a.user.username}: {a.activity_type} - {a.points} pts on {a.created_at}")

print("\n=== Enter username to check their stats ===")
username = input("Username: ").strip()

if username:
    try:
        user = User.objects.get(username=username)
        print(f"\n--- Stats for {username} ---")
        
        # Check UserScore
        try:
            score = UserScore.objects.get(user=user)
            print(f"Total Points: {score.total_points}")
            print(f"Learning Score: {score.learning_score}")
            print(f"Impact Score: {score.impact_score}")
        except UserScore.DoesNotExist:
            print("No UserScore found")
        
        # Count activities
        enrollments = Activity.objects.filter(user=user, activity_type='COURSE_ENROLLED').count()
        lessons = Activity.objects.filter(user=user, activity_type='LESSON_COMPLETED').count()
        quizzes = Activity.objects.filter(user=user, activity_type='CORRECT_ANSWER').count()
        
        print(f"\nActivity Counts:")
        print(f"  Courses Enrolled: {enrollments}")
        print(f"  Lessons Completed: {lessons}")
        print(f"  Quiz Questions Answered: {quizzes}")
        
        # Show recent activities
        print(f"\nRecent Activities:")
        for a in Activity.objects.filter(user=user).order_by('-created_at')[:5]:
            print(f"  {a.created_at}: {a.activity_type} (+{a.points} pts)")
            
    except User.DoesNotExist:
        print(f"User '{username}' not found")
