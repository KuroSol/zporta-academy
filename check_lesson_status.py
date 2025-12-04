#!/usr/bin/env python
"""
Quick script to check lesson status for debugging
"""
import os
import django

os.chdir('zporta_academy_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from lessons.models import Lesson

permalink = "Alex/english/2025-10-30/terst-layout"

try:
    lesson = Lesson.objects.get(permalink=permalink)
    print(f"✓ Lesson found: {lesson.title}")
    print(f"  Status: {lesson.status}")
    print(f"  Is Premium: {lesson.is_premium}")
    print(f"  Is Locked: {lesson.is_locked}")
    print(f"  Created by: {lesson.created_by.username}")
    print(f"  Course: {lesson.course.title if lesson.course else 'None (standalone)'}")
    print(f"\n  → Should be visible to anonymous users: {lesson.status == 'published' and not lesson.is_premium}")
    
    if lesson.status != 'published':
        print(f"\n  ⚠ WARNING: Lesson is '{lesson.status}', not 'published'")
    if lesson.is_premium:
        print(f"  ⚠ WARNING: Lesson is marked as premium")
        
except Lesson.DoesNotExist:
    print(f"✗ Lesson not found with permalink: {permalink}")
