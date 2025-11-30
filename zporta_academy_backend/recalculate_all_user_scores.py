#!/usr/bin/env python
"""Recalculate all UserScore records after adding COURSE_ENROLLED."""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','zporta.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from gamification.models import UserScore
from django.contrib.auth import get_user_model

User = get_user_model()
updated = 0
for user in User.objects.all():
    score, _ = UserScore.objects.get_or_create(user=user)
    score.recalculate()
    updated += 1
print(f"Recalculated scores for {updated} users.")
