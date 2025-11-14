#!/usr/bin/env python3
"""
Test what the enrollment API returns for user zporta
"""

import os
import sys
import django
import json

# Setup Django environment
sys.path.insert(0, '/home/ubuntu/zporta-academy/zporta_academy_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.production')
django.setup()

from django.contrib.auth import get_user_model
from enrollment.models import Enrollment
from enrollment.serializers import EnrollmentSerializer
from rest_framework.test import APIRequestFactory

User = get_user_model()

def test_enrollment_data():
    """Test what data is returned by enrollment serializer"""
    
    user = User.objects.get(username='zporta')
    enrollment = Enrollment.objects.get(id=102)  # The Business English course
    
    # Create a fake request context with proper SERVER_NAME
    factory = APIRequestFactory()
    request = factory.get('/api/enrollments/102/', SERVER_NAME='eduhab.com')
    request.user = user
    
    # Serialize the enrollment
    serializer = EnrollmentSerializer(enrollment, context={'request': request})
    data = serializer.data
    
    print(f"\n{'='*80}")
    print(f"TESTING ENROLLMENT API DATA FOR USER: {user.username}")
    print(f"{'='*80}\n")
    
    if 'course' in data and 'lessons' in data['course']:
        lessons = data['course']['lessons']
        print(f"Total lessons returned: {len(lessons)}\n")
        
        for i, lesson in enumerate(lessons, 1):
            lesson_id = lesson.get('id')
            title = lesson.get('title', 'NO TITLE')
            content = lesson.get('content', '')
            content_preview = content[:150] if content else 'NO CONTENT'
            
            print(f"{i}. Lesson ID: {lesson_id}")
            print(f"   Title: {title}")
            print(f"   Content preview: {content_preview}...")
            print(f"   Content length: {len(content)} chars")
            print()
        
        # Check if all contents are unique
        content_hashes = [hash(l.get('content', '')) for l in lessons]
        unique_hashes = set(content_hashes)
        
        print(f"\n{'='*80}")
        print(f"UNIQUENESS CHECK:")
        print(f"Total lessons: {len(lessons)}")
        print(f"Unique content hashes: {len(unique_hashes)}")
        
        if len(unique_hashes) < len(lessons):
            print(f"⚠️  WARNING: Some lessons have duplicate content!")
            # Find which ones are duplicates
            from collections import Counter
            hash_counts = Counter(content_hashes)
            for idx, (lesson, content_hash) in enumerate(zip(lessons, content_hashes)):
                if hash_counts[content_hash] > 1:
                    print(f"   Lesson {lesson.get('id')} ({lesson.get('title')}) - DUPLICATE")
        else:
            print(f"✅ All lessons have unique content")
        
        print(f"{'='*80}\n")
    else:
        print("ERROR: No lessons found in enrollment data")

if __name__ == '__main__':
    test_enrollment_data()
