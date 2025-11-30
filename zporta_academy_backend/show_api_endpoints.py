#!/usr/bin/env python
"""Test API endpoints to show available data"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from gamification.models import Activity, ActivityType
from django.contrib.auth import get_user_model

User = get_user_model()
alex = User.objects.get(username='alex')

print('=' * 70)
print('GAMIFICATION API - AVAILABLE ENDPOINTS')
print('=' * 70)

print('\n1️⃣  GET /api/gamification/scores/me/')
print('   Returns: User scores with accuracy, time analytics')
print('   Sample data for Alex:')
from gamification.serializers import UserScoreSerializer
from gamification.models import UserScore
score = UserScore.objects.get(user=alex)
data = UserScoreSerializer(score).data
for key, value in data.items():
    print(f'     {key}: {value}')

print('\n2️⃣  GET /api/gamification/activities/')
print('   Returns: List of all user activities (paginated)')
print(f'   Total activities for Alex: {Activity.objects.filter(user=alex).count()}')
print('   ')
print('   Sample activities:')

# Show each type with sample
for activity_type in ActivityType:
    activities = Activity.objects.filter(user=alex, activity_type=activity_type.value)
    if activities.exists():
        sample = activities.first()
        print(f'\n   {activity_type.label}:')
        print(f'     Count: {activities.count()}')
        print(f'     Points: {sample.points}')
        print(f'     Sample metadata: {list(sample.metadata.keys())}')

print('\n3️⃣  GET /api/gamification/activities/?activity_type=LESSON_COMPLETED')
print('   Returns: Only lesson completion activities')
lesson_activities = Activity.objects.filter(user=alex, activity_type=ActivityType.LESSON_COMPLETED)
print(f'   Found: {lesson_activities.count()} lesson completions')
for activity in lesson_activities[:3]:
    print(f'     - {activity.metadata.get("lesson_title")} ({activity.created_at.date()})')

print('\n4️⃣  GET /api/gamification/activities/?activity_type=ENROLLMENT_FREE')
print('   Returns: Only enrollment activities (as teacher)')
enrollment_activities = Activity.objects.filter(user=alex, activity_type=ActivityType.ENROLLMENT_FREE)
print(f'   Found: {enrollment_activities.count()} enrollments (students enrolled in your courses)')
for activity in enrollment_activities[:3]:
    student_name = activity.metadata.get('student_username')
    course_name = activity.metadata.get('course_title')
    print(f'     - {student_name} enrolled in "{course_name}" ({activity.created_at.date()})')

print('\n5️⃣  GET /api/gamification/activities/?role=student')
print('   Returns: Only student activities (quizzes, lessons, courses)')
student_activities = Activity.objects.filter(
    user=alex,
    activity_type__in=[
        ActivityType.CORRECT_ANSWER,
        ActivityType.LESSON_COMPLETED,
        ActivityType.COURSE_COMPLETED
    ]
)
print(f'   Found: {student_activities.count()} student activities')

print('\n6️⃣  GET /api/gamification/activities/?role=teacher')
print('   Returns: Only teacher activities (enrollments, first attempts)')
teacher_activities = Activity.objects.filter(
    user=alex,
    activity_type__in=[
        ActivityType.ENROLLMENT_FREE,
        ActivityType.ENROLLMENT_PREMIUM,
        ActivityType.QUIZ_FIRST_ATTEMPT,
        ActivityType.STANDALONE_LESSON
    ]
)
print(f'   Found: {teacher_activities.count()} teacher activities')

print('\n7️⃣  GET /api/gamification/analytics/me/')
print('   Returns: Learning patterns and insights')
from gamification.models import UserLearningStats
try:
    stats = UserLearningStats.objects.get(user=alex)
    print(f'   Recent Accuracy: {stats.recent_accuracy_rate:.1f}%')
    print(f'   Improvement Trend: {stats.improvement_trend}')
    print(f'   Most Active: Hour {stats.most_active_hour}, Day {stats.most_active_day}')
except UserLearningStats.DoesNotExist:
    print('   Not yet calculated')

print('\n8️⃣  GET /api/gamification/analytics/mistakes/')
print('   Returns: Detailed mistake analysis by topic')
mistakes = Activity.objects.filter(user=alex, is_mistake=True)
print(f'   Total mistakes: {mistakes.count()}')

print('\n9️⃣  GET /api/gamification/analytics/time_insights/')
print('   Returns: Time analytics for lessons/courses')
from gamification.models import UserScore
score = UserScore.objects.get(user=alex)
print(f'   Average lesson time: {score.average_lesson_time_minutes:.1f} minutes')
print(f'   Fastest lesson: {score.fastest_lesson_minutes:.1f} minutes' if score.fastest_lesson_minutes else '   Fastest lesson: N/A')
print(f'   Total learning time: {score.total_learning_time_hours:.2f} hours')

print('\n' + '=' * 70)
print('ALL DATA IS AVAILABLE - Use these API endpoints in your frontend!')
print('=' * 70)
