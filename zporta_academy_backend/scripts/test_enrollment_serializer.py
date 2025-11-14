#!/usr/bin/env python3
"""
Test what the EnrollmentSerializer actually returns for lesson content
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.production')
django.setup()

from enrollment.models import Enrollment
from enrollment.serializers import EnrollmentSerializer

def test_enrollment_serializer():
    """Test what data the serializer returns"""
    
    # Get the enrollment (user zporta, course 7)
    try:
        enrollment = Enrollment.objects.get(id=102)
    except Enrollment.DoesNotExist:
        print("❌ Enrollment 102 not found")
        return
    
    print("=" * 80)
    print("TESTING ENROLLMENT SERIALIZER")
    print(f"Enrollment ID: {enrollment.id}")
    print(f"User: {enrollment.user}")
    print("=" * 80)
    print()
    
    # Serialize the enrollment
    serializer = EnrollmentSerializer(enrollment)
    data = serializer.data
    
    # Check course and lessons
    course = data.get('course_snapshot') or data.get('course')
    if not course:
        print("❌ No course data in serializer output")
        return
    
    print(f"Course: {course.get('title')}")
    lessons = course.get('lessons', [])
    print(f"Total lessons in serialized data: {len(lessons)}")
    print()
    
    # Check each lesson's content
    content_hashes = {}
    for i, lesson in enumerate(lessons):
        lesson_id = lesson.get('id')
        title = lesson.get('title', 'Untitled')
        content = lesson.get('content', '')
        
        # Calculate hash
        content_hash = hash(content) if content else None
        
        print(f"{i}. Lesson ID: {lesson_id}")
        print(f"   Title: {title}")
        print(f"   Position: {lesson.get('position')}")
        print(f"   Content length: {len(content)} chars")
        print(f"   Content hash: {content_hash}")
        print(f"   Content preview: {content[:200]}...")
        print()
        
        if content_hash:
            if content_hash in content_hashes:
                print(f"   ⚠️  WARNING: This content hash matches lesson {content_hashes[content_hash]}")
            else:
                content_hashes[content_hash] = lesson_id
    
    print("=" * 80)
    print("SUMMARY:")
    print(f"Total lessons: {len(lessons)}")
    print(f"Unique content hashes: {len(content_hashes)}")
    if len(content_hashes) == len(lessons):
        print("✅ All lessons have unique content in serializer output")
    else:
        print(f"❌ DUPLICATE CONTENT DETECTED! {len(lessons) - len(content_hashes)} duplicates")
    print("=" * 80)

if __name__ == '__main__':
    test_enrollment_serializer()
