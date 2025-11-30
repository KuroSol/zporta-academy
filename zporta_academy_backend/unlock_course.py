"""
Unlock a course to allow editing
Run: python unlock_course.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from courses.models import Course

# Unlock the test-2 course
permalink = "Alex/2025-11-16/english/test-2"

try:
    c = Course.all_objects.get(permalink=permalink)
    print(f"\nCourse: {c.title}")
    print(f"Currently locked: {c.is_locked}")
    
    if c.is_locked:
        c.is_locked = False
        c.save(update_fields=['is_locked'])
        print(f"✓ Course unlocked successfully!")
    else:
        print("Course is already unlocked")
        
except Course.DoesNotExist:
    print(f"✗ Course not found: {permalink}")
