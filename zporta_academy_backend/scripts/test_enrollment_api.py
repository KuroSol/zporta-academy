#!/usr/bin/env python3
"""
Test lesson content directly from database
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

def test_lesson_content():
    """Check if lessons have unique content in database"""
    
    # Get the Business English course
    course = Course.objects.get(id=7)  # Adjust if needed
    lessons = Lesson.objects.filter(course=course).order_by('position')
    
    print(f"\n{'='*80}")
    print(f"TESTING LESSON CONTENT IN DATABASE")
    print(f"Course: {course.title}")
    print(f"{'='*80}\n")
    
    print(f"Total lessons: {lessons.count()}\n")
    
    content_map = {}
    
    for lesson in lessons:
        content = lesson.content or ''
        content_preview = content[:150] if content else 'NO CONTENT'
        content_hash = hash(content)
        
        print(f"{lesson.position}. Lesson ID: {lesson.id}")
        print(f"   Title: {lesson.title}")
        print(f"   Content preview: {content_preview}...")
        print(f"   Content length: {len(content)} chars")
        print(f"   Content hash: {content_hash}")
        print()
        
        if content_hash in content_map:
            print(f"   ⚠️  DUPLICATE! Same content as Lesson ID: {content_map[content_hash]}")
            print()
        else:
            content_map[content_hash] = lesson.id
    
    print(f"\n{'='*80}")
    print(f"SUMMARY:")
    print(f"Total lessons: {lessons.count()}")
    print(f"Unique content hashes: {len(content_map)}")
    
    if len(content_map) < lessons.count():
        print(f"⚠️  WARNING: {lessons.count() - len(content_map)} lesson(s) have duplicate content!")
    else:
        print(f"✅ All lessons have unique content")
    
    print(f"{'='*80}\n")

if __name__ == '__main__':
    test_lesson_content()

