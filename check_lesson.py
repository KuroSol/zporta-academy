import os
import sys
import django

# Setup Django
sys.path.insert(0, r'C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from lessons.models import Lesson

permalink = "Alex/english/2025-10-30/terst-layout"

try:
    lesson = Lesson.objects.get(permalink=permalink)
    print(f"✓ Lesson found: {lesson.title}")
    print(f"  ID: {lesson.id}")
    print(f"  Status: '{lesson.status}' (should be 'published')")
    print(f"  Is Premium: {lesson.is_premium} (should be False for free)")
    print(f"  Is Locked: {lesson.is_locked}")
    print(f"  Created by: {lesson.created_by.username}")
    print(f"  Course: {lesson.course.title if lesson.course else 'None (standalone)'}")
    print()
    
    if lesson.status == 'published' and not lesson.is_premium:
        print("✓ This lesson SHOULD be visible to anonymous users!")
    else:
        print("✗ This lesson is NOT visible to anonymous users because:")
        if lesson.status != 'published':
            print(f"  - Status is '{lesson.status}' instead of 'published'")
        if lesson.is_premium:
            print(f"  - Is marked as premium (is_premium=True)")
            
except Lesson.DoesNotExist:
    print(f"✗ Lesson not found with permalink: {permalink}")
    print("\nSearching for similar lessons...")
    lessons = Lesson.objects.filter(created_by__username="Alex").order_by('-created_at')[:5]
    print(f"\nFound {lessons.count()} lessons by Alex:")
    for l in lessons:
        print(f"  - {l.permalink} | Status: {l.status} | Premium: {l.is_premium}")
