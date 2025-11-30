#!/usr/bin/env python
"""Show user analytics"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from gamification.models import UserScore, UserLearningStats
from django.contrib.auth import get_user_model

User = get_user_model()

alex = User.objects.get(username='alex')
score = UserScore.objects.get(user=alex)

print('=' * 50)
print('ALEX LEARNING ANALYTICS')
print('=' * 50)
print(f'\n📊 SCORES & ACTIVITIES:')
print(f'   Total Points: {score.total_points}')
print(f'   Learning Score: {score.learning_score}')
print(f'   Impact Score: {score.impact_score}')
print(f'   Total Activities: {score.total_activities}')

print(f'\n✅ ACCURACY:')
print(f'   Correct Answers: {score.correct_answers}')
print(f'   Total Mistakes: {score.total_mistakes}')
print(f'   Accuracy Rate: {score.accuracy_rate:.1f}%')

print(f'\n⏱️  TIME ANALYTICS:')
print(f'   Total Learning Time: {score.total_learning_time_hours:.2f} hours')
print(f'   Average Lesson Time: {score.average_lesson_time_minutes:.1f} minutes')
if score.fastest_lesson_minutes:
    print(f'   Fastest Lesson: {score.fastest_lesson_minutes:.1f} minutes')
else:
    print(f'   Fastest Lesson: N/A')
if score.longest_lesson_minutes:
    print(f'   Longest Lesson: {score.longest_lesson_minutes:.1f} minutes')
else:
    print(f'   Longest Lesson: N/A')

stats = UserLearningStats.objects.filter(user=alex).first()
if stats:
    print(f'\n📈 LEARNING PATTERNS:')
    print(f'   Recent Accuracy (30 days): {stats.recent_accuracy_rate:.1f}%')
    print(f'   Improvement Trend: {stats.improvement_trend}')
    
    if stats.most_active_hour is not None:
        hour = stats.most_active_hour
        period = 'AM' if hour < 12 else 'PM'
        display_hour = hour if hour <= 12 else hour - 12
        if display_hour == 0:
            display_hour = 12
        print(f'   Most Active Hour: {display_hour}:00 {period}')
    
    if stats.most_active_day is not None:
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        print(f'   Most Active Day: {days[stats.most_active_day]}')
    
    print(f'   Common Mistakes: {len(stats.common_mistakes)} topics identified')
    
    if stats.common_mistakes:
        print(f'\n❌ TOP 3 MISTAKE TOPICS:')
        for i, mistake in enumerate(stats.common_mistakes[:3], 1):
            topic = mistake.get('topic', 'Unknown')
            count = mistake.get('count', 0)
            print(f'   {i}. {topic}: {count} mistakes')

print('\n' + '=' * 50)
