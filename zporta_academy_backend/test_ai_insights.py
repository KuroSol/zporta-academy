#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.contrib.auth import get_user_model
from dailycast.ai_analyzer import UserLearningAnalyzer, _run_ai_deep_analysis

User = get_user_model()

# Test with user ID 1
try:
    user = User.objects.get(id=1)
    print(f"Testing with user: {user.username}")
    
    # Collect analytics
    analyzer = UserLearningAnalyzer(user)
    analysis_data = analyzer.collect_user_learning_data()
    print(f"✅ Analysis data collected: {list(analysis_data.keys())}")
    
    # Try to generate AI insights
    print("\n🤖 Testing AI insight generation with GPT-4 Turbo...")
    insights = _run_ai_deep_analysis(user, analysis_data, 'gpt-4-turbo', subject='English')
    print(f"✅ AI Insights generated!")
    print(f"Summary: {insights.get('summary')}")
    if insights.get('error'):
        print(f"ERROR: {insights.get('error')}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
