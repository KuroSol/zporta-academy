#!/usr/bin/env python3
"""
Diagnostic script to investigate lesson completion issues
Run this on the server to check database state for affected users
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, '/home/ubuntu/zporta-academy/zporta_academy_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.production')
django.setup()

from django.contrib.auth import get_user_model
from enrollment.models import Enrollment
from lessons.models import LessonCompletion, Lesson
from courses.models import Course

User = get_user_model()

def diagnose_user_lessons(username_or_email):
    """Diagnose lesson issues for a specific user"""
    try:
        # Find user
        user = User.objects.filter(username=username_or_email).first() or \
               User.objects.filter(email=username_or_email).first()
        
        if not user:
            print(f"❌ User not found: {username_or_email}")
            return
        
        print(f"\n{'='*60}")
        print(f"🔍 DIAGNOSING USER: {user.username} (ID: {user.id})")
        print(f"{'='*60}\n")
        
        # Get all enrollments
        enrollments = Enrollment.objects.filter(user=user)
        
        if not enrollments:
            print("⚠️  No enrollments found for this user")
            return
        
        for enrollment in enrollments:
            course = enrollment.content_object
            if not course:
                print(f"\n⚠️  Enrollment {enrollment.id} has no course attached")
                continue
                
            print(f"\n📚 COURSE: {course.title}")
            print(f"   Enrollment ID: {enrollment.id}")
            print(f"   Enrolled: {enrollment.enrollment_date}")
            print(f"   Status: {enrollment.status}")
            
            # Get lessons for this course
            lessons = Lesson.objects.filter(course=course).order_by('position')
            print(f"   Total Lessons: {lessons.count()}")
            
            # Show ALL lessons with their positions and content preview
            print(f"\n   📖 All Lessons in Course:")
            for lesson in lessons:
                content_preview = lesson.content[:100] if lesson.content else "NO CONTENT"
                print(f"      {lesson.position}. {lesson.title} (ID: {lesson.id})")
                print(f"         Content: {content_preview}...")
            
            # Get lesson progress
            progress_records = LessonCompletion.objects.filter(
                user=enrollment.user,
                lesson__course=enrollment.content_object
            ).select_related('lesson')
            
            print(f"   Completed Lessons: {progress_records.count()}")
            
            if progress_records.exists():
                print(f"\n   📋 Lesson Progress Details:")
                for progress in progress_records:
                    print(f"      ✓ {progress.lesson.title}")
                    print(f"        - Lesson ID: {progress.lesson.id}")
                    print(f"        - Completed At: {progress.completed_at}")
                    print(f"        - Lesson Position: {progress.lesson.position}")
            
            # Check for anomalies
            print(f"\n   🔎 Checking for issues...")
            
            # Issue 1: Duplicate progress records
            duplicate_lessons = []
            for lesson in lessons:
                count = LessonCompletion.objects.filter(
                    user=enrollment.user,
                    lesson=lesson
                ).count()
                if count > 1:
                    duplicate_lessons.append((lesson, count))
            
            if duplicate_lessons:
                print(f"   ⚠️  ISSUE: Found duplicate progress records!")
                for lesson, count in duplicate_lessons:
                    print(f"      - {lesson.title}: {count} records")
            
            # Issue 2: Progress for lessons not in course
            orphan_progress = LessonCompletion.objects.filter(
                user=enrollment.user
            ).exclude(lesson__course=enrollment.content_object)
            
            if orphan_progress.exists():
                print(f"   ⚠️  ISSUE: Found progress for lessons not in this course!")
                for progress in orphan_progress:
                    print(f"      - {progress.lesson.title} (from {progress.lesson.course.title})")
            
            # Issue 3: Missing lessons in sequence
            lesson_positions = list(lessons.values_list('position', flat=True))
            if lesson_positions:
                expected_positions = set(range(1, max(lesson_positions) + 1))
                actual_positions = set(lesson_positions)
                missing = expected_positions - actual_positions
                if missing:
                    print(f"   ⚠️  ISSUE: Missing lesson positions: {sorted(missing)}")
            
            print(f"\n   {'─'*50}\n")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def fix_duplicate_progress(enrollment_id):
    """Remove duplicate LessonCompletion records for an enrollment"""
    try:
        enrollment = Enrollment.objects.get(id=enrollment_id)
        lessons = Lesson.objects.filter(course=enrollment.content_object)
        
        fixed_count = 0
        for lesson in lessons:
            progress_records = LessonCompletion.objects.filter(
                user=enrollment.user,
                lesson=lesson
            ).order_by('completed_at')
            
            if progress_records.count() > 1:
                # Keep the earliest completion, delete the rest
                to_keep = progress_records.first()
                to_delete = progress_records.exclude(id=to_keep.id)
                count = to_delete.count()
                to_delete.delete()
                fixed_count += count
                print(f"   ✓ Removed {count} duplicate(s) for: {lesson.title}")
        
        if fixed_count > 0:
            print(f"\n✅ Fixed {fixed_count} duplicate progress records")
        else:
            print(f"\n✓ No duplicates found")
        
        return fixed_count
    
    except Exception as e:
        print(f"❌ Error fixing duplicates: {e}")
        return 0


def list_recent_completions(limit=20):
    """List recent lesson completions to identify patterns"""
    print(f"{'='*60}")
    print(f"📊 RECENT LESSON COMPLETIONS (Last {limit})")
    print(f"{'='*60}\n")
    
    recent = LessonCompletion.objects.select_related(
        'lesson', 'user'
    ).order_by('-completed_at')[:limit]
    
    for progress in recent:
        print(f"   User: {progress.user.username}")
        print(f"   Course: {progress.lesson.course.title}")
        print(f"   Lesson: {progress.lesson.title} (Position: {progress.lesson.position})")
        print(f"   Completed: {progress.completed_at}")
        print(f"   {'-'*50}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Diagnose user:  python diagnose_lesson_issue.py <username_or_email>")
        print("  Fix duplicates: python diagnose_lesson_issue.py fix <enrollment_id>")
        print("  Recent completions: python diagnose_lesson_issue.py recent [limit]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'fix' and len(sys.argv) > 2:
        enrollment_id = int(sys.argv[2])
        fix_duplicate_progress(enrollment_id)
    elif command == 'recent':
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
        list_recent_completions(limit)
    else:
        diagnose_user_lessons(command)
