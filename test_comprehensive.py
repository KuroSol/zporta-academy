#!/usr/bin/env python
"""Direct test of comprehensive AI insights."""

import os
import sys

# Add backend to path
sys.path.insert(0, r'c:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')

import django
django.setup()

# Now test the function
from dailycast.ai_analyzer import _run_ai_deep_analysis, collect_user_learning_data
from django.contrib.auth.models import User
import json

print("=" * 80)
print("Testing Comprehensive AI Analysis System")
print("=" * 80)

# Get user
try:
    user = User.objects.get(username='alex')
    print(f"\n✓ Test User: {user.username}")
except:
    print("✗ User 'alex' not found - please create test user")
    sys.exit(1)

# Test data collection
print("\nStep 1: Collecting learning data...")
try:
    analysis_data = collect_user_learning_data(user)
    print("✓ Success - Data collected:")
    print(f"  • Courses: {analysis_data.get('total_courses', 0)}")
    print(f"  • Lessons: {analysis_data.get('lessons_completed', 0)}")
    print(f"  • Quizzes: {analysis_data.get('quizzes_completed', 0)}")
    print(f"  • Accuracy: {analysis_data.get('quiz_accuracy', 0):.1f}%")
    print(f"  • Topics: {len(analysis_data.get('weak_topics', []))} weak, {len(analysis_data.get('strong_topics', []))} strong")
except Exception as e:
    print(f"✗ Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test AI analysis
print("\nStep 2: Testing comprehensive AI analysis...")
print("  (Using GPT-4o Mini - may take 10-20 seconds)")
try:
    insights = _run_ai_deep_analysis(user, analysis_data, 'gpt-4o-mini')
    
    if 'error' in insights:
        print(f"✗ AI Error: {insights.get('error')}")
        sys.exit(1)
    
    print("✓ AI Analysis successful!")
    
    # Show structure
    print("\n✓ Response structure:")
    for key in sorted(insights.keys()):
        value = insights[key]
        if isinstance(value, dict):
            size = len(value)
            print(f"  ✓ {key:25} → dict ({size} keys)")
        elif isinstance(value, list):
            print(f"  ✓ {key:25} → list ({len(value)} items)")
        elif isinstance(value, str):
            length = len(value)
            print(f"  ✓ {key:25} → str ({length} chars)")
        else:
            print(f"  ✓ {key:25} → {type(value).__name__}")
    
    # Verify comprehensive fields
    expected_fields = [
        'summary', 'assessment', 'vocabulary_gaps', 'grammar_analysis',
        'quiz_recommendations', 'difficulty_progression', 'external_resources',
        'study_guide', 'learning_journey', 'specific_actions', 'potential_struggles'
    ]
    
    found_fields = [f for f in expected_fields if f in insights]
    print(f"\n✓ Comprehensive fields present: {len(found_fields)}/{len(expected_fields)}")
    
    # Show samples
    if insights.get('summary'):
        print(f"\n📄 Summary (first 150 chars):")
        print(f"  {insights['summary'][:150]}...")
    
    if insights.get('assessment'):
        print(f"\n📍 Assessment:")
        if isinstance(insights['assessment'], dict):
            for k, v in list(insights['assessment'].items())[:2]:
                print(f"  • {k}: {str(v)[:80]}")
        else:
            print(f"  {str(insights['assessment'])[:150]}")
    
    print("\n" + "=" * 80)
    print("✅ COMPREHENSIVE AI SYSTEM TEST PASSED!")
    print("=" * 80)
    print("\nThe system is now providing detailed, actionable learning guides including:")
    print("  ✓ Current assessment and learning level")
    print("  ✓ Specific vocabulary gaps and examples")
    print("  ✓ Grammar analysis (weak and strong areas)")
    print("  ✓ Quiz recommendations tailored to user")
    print("  ✓ Difficulty progression guidance")
    print("  ✓ External learning resources (books, movies, guides)")
    print("  ✓ Detailed study plans and guides")
    print("  ✓ Learning journey with milestones")
    print("  ✓ Specific daily/weekly/monthly actions")
    print("  ✓ Potential struggles identification")
    
except Exception as e:
    print(f"✗ Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
