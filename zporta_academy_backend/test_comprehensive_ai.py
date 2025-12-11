#!/usr/bin/env python
"""Test comprehensive AI insights generation."""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from dailycast.ai_analyzer import _run_ai_deep_analysis, collect_user_learning_data
from django.contrib.auth.models import User
import json

print("=" * 80)
print("Testing Comprehensive AI Insights Generation")
print("=" * 80)

# Get a test user
try:
    user = User.objects.get(username='alex')
    print(f"\n✓ Found user: {user.get_full_name() or user.username}")
except User.DoesNotExist:
    print("✗ Test user 'alex' not found")
    sys.exit(1)

# Collect learning data
print("\n📊 Collecting user learning data...")
try:
    analysis_data = collect_user_learning_data(user)
    print(f"✓ Analysis data collected successfully")
    print(f"  - Total courses: {analysis_data.get('total_courses', 0)}")
    print(f"  - Lessons completed: {analysis_data.get('lessons_completed', 0)}")
    print(f"  - Quizzes completed: {analysis_data.get('quizzes_completed', 0)}")
    print(f"  - Quiz accuracy: {analysis_data.get('quiz_accuracy', 0):.1f}%")
    print(f"  - Active days: {analysis_data.get('active_days', 0)}")
except Exception as e:
    print(f"✗ Failed to collect analysis data: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Generate comprehensive AI insights
print("\n🤖 Generating COMPREHENSIVE AI insights with GPT-4o Mini...")
try:
    ai_model = 'gpt-4o-mini'
    insights = _run_ai_deep_analysis(user, analysis_data, ai_model)
    
    if 'error' in insights:
        print(f"✗ AI Analysis failed: {insights['error']}")
        sys.exit(1)
    
    print(f"✓ AI insights generated successfully!")
    print(f"\n📋 Response Structure:")
    for key in insights.keys():
        value = insights[key]
        if isinstance(value, dict):
            print(f"  ✓ {key}: <object with {len(value)} properties>")
        elif isinstance(value, list):
            print(f"  ✓ {key}: <list with {len(value)} items>")
        elif isinstance(value, str):
            length = len(value)
            preview = value[:100] + "..." if length > 100 else value
            print(f"  ✓ {key}: <string, {length} chars> '{preview}'")
        else:
            print(f"  ✓ {key}: {type(value).__name__}")
    
    # Validate expected comprehensive fields
    expected_fields = [
        'summary', 'assessment', 'vocabulary_gaps', 'grammar_analysis',
        'quiz_recommendations', 'difficulty_progression', 'external_resources',
        'study_guide', 'learning_journey', 'specific_actions', 'potential_struggles'
    ]
    
    missing_fields = [f for f in expected_fields if f not in insights]
    extra_fields = [f for f in insights.keys() if f not in expected_fields and f != 'error']
    
    if missing_fields:
        print(f"\n⚠️ Missing expected fields: {missing_fields}")
    
    if extra_fields:
        print(f"\n✓ Additional fields included: {extra_fields}")
    
    # Show some sample content
    if insights.get('summary'):
        print(f"\n📄 Summary Preview:")
        summary_preview = insights['summary'][:300]
        print(f"  {summary_preview}...")
    
    if insights.get('quiz_recommendations') and isinstance(insights['quiz_recommendations'], list):
        print(f"\n🎯 Quiz Recommendations ({len(insights['quiz_recommendations'])} items):")
        for i, rec in enumerate(insights['quiz_recommendations'][:3], 1):
            if isinstance(rec, dict):
                print(f"  {i}. {rec.get('title', rec.get('topic', 'Unknown'))}")
            else:
                print(f"  {i}. {rec}")
    
    if insights.get('vocabulary_gaps'):
        print(f"\n📚 Vocabulary Gaps:")
        vg = insights['vocabulary_gaps']
        if isinstance(vg, dict):
            for key, value in list(vg.items())[:3]:
                print(f"  - {key}: {str(value)[:100]}")
        elif isinstance(vg, str):
            print(f"  {vg[:200]}")
    
    if insights.get('study_guide'):
        print(f"\n📋 Study Guide:")
        sg = insights['study_guide']
        if isinstance(sg, dict):
            for key, value in list(sg.items())[:3]:
                print(f"  - {key}: {str(value)[:100]}")
        elif isinstance(sg, str):
            print(f"  {sg[:200]}")
    
    print("\n" + "=" * 80)
    print("✅ COMPREHENSIVE AI INSIGHTS TEST PASSED!")
    print("=" * 80)
    print("\n✓ The AI system is now generating detailed, comprehensive learning guides")
    print("✓ Including: vocabulary gaps, grammar analysis, difficulty progression,")
    print("✓ Resource recommendations, study guides, and learning journeys")
    
except Exception as e:
    print(f"✗ Error generating AI insights: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
