#!/usr/bin/env python3
"""
Fix lesson positions in database - set them to sequential numbers based on ID order
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, '/home/ubuntu/zporta-academy/zporta_academy_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.production')
django.setup()

from lessons.models import Lesson
from courses.models import Course

def fix_lesson_positions():
    """Fix lesson positions for all courses"""
    
    courses = Course.objects.all()
    
    print(f"\n{'='*60}")
    print(f"FIXING LESSON POSITIONS")
    print(f"{'='*60}\n")
    
    total_fixed = 0
    
    for course in courses:
        lessons = Lesson.objects.filter(course=course).order_by('id')
        
        if not lessons.exists():
            continue
            
        print(f"\n📚 Course: {course.title}")
        print(f"   Lessons: {lessons.count()}")
        
        # Assign sequential positions starting from 1
        for index, lesson in enumerate(lessons, start=1):
            old_position = lesson.position
            lesson.position = index
            lesson.save(update_fields=['position'])
            total_fixed += 1
            print(f"   ✓ {lesson.title}: position {old_position} → {index}")
    
    print(f"\n{'='*60}")
    print(f"✅ Fixed {total_fixed} lessons across {courses.count()} courses")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    fix_lesson_positions()
