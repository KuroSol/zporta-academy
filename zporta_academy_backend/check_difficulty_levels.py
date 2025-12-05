#!/usr/bin/env python
"""Check the actual level_5 values from quizzes."""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer

quizzes = Quiz.objects.all()[:5]
for q in quizzes:
    data = QuizSerializer(q).data
    exp = data.get('difficulty_explanation', {})
    level_5 = exp.get('level_5', 'N/A')
    emoji = exp.get('emoji', '')
    
    # Convert to data attribute format
    data_attr = level_5.lower().replace(' → ', '---').replace(' ', '-')
    
    print(f"Quiz: {q.title[:30]:<30}")
    print(f"  Level_5: {level_5}")
    print(f"  Emoji: {emoji}")
    print(f"  Data-attr: {data_attr}")
    print()
