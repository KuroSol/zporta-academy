#!/usr/bin/env python
"""Quick test to verify the quizzes API endpoint is working."""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.test import Client

client = Client()
response = client.get('/api/quizzes/?limit=1')

print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    if isinstance(data, list) and len(data) > 0:
        quiz = data[0]
        print(f"✅ API Working! First quiz: {quiz.get('title', 'N/A')[:40]}")
        print(f"   Quiz ID: {quiz.get('id')}")
        print(f"   Attempt Count: {quiz.get('attempt_count')}")
        print(f"   Has difficulty_explanation: {'difficulty_explanation' in quiz}")
    else:
        print("✅ API Working! (Empty results)")
else:
    print(f"❌ Error: {response.content[:200]}")
