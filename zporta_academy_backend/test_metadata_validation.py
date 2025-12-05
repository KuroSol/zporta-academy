"""
Test script to verify ActivityEvent metadata validation is working correctly.

This script tests:
1. Valid metadata (dict) - should succeed
2. Invalid metadata (numeric) - should raise ValidationError
3. Null metadata - should succeed
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from analytics.models import ActivityEvent
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

def test_validation():
    print("=" * 80)
    print("ACTIVITYEVENT METADATA VALIDATION TEST")
    print("=" * 80)
    
    user = User.objects.first()
    if not user:
        print("❌ No users found in database. Please create a user first.")
        return
    
    print(f"\nUsing test user: {user.username} (ID: {user.id})")
    
    # Test 1: Valid metadata (dict)
    print("\n[Test 1] Creating event with valid dict metadata...")
    try:
        event1 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata={'test': 'value', 'quiz_id': 123}
        )
        print("✓ SUCCESS: Dict metadata accepted")
        print(f"  Created event ID: {event1.id}")
        print(f"  Metadata: {event1.metadata}")
        event1.delete()  # Cleanup
    except ValidationError as e:
        print(f"❌ FAILED: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    # Test 2: Invalid metadata (integer)
    print("\n[Test 2] Creating event with invalid integer metadata...")
    try:
        event2 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata=42  # This should fail
        )
        print(f"❌ FAILED: Integer metadata was accepted (event ID: {event2.id})")
        print("  ⚠️  Validation is NOT working!")
        event2.delete()  # Cleanup
    except ValidationError as e:
        print("✓ SUCCESS: Integer metadata rejected")
        print(f"  ValidationError: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    # Test 3: Invalid metadata (float)
    print("\n[Test 3] Creating event with invalid float metadata...")
    try:
        event3 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata=3.14  # This should fail
        )
        print(f"❌ FAILED: Float metadata was accepted (event ID: {event3.id})")
        print("  ⚠️  Validation is NOT working!")
        event3.delete()  # Cleanup
    except ValidationError as e:
        print("✓ SUCCESS: Float metadata rejected")
        print(f"  ValidationError: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    # Test 4: Invalid metadata (string)
    print("\n[Test 4] Creating event with invalid string metadata...")
    try:
        event4 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata="just a string"  # This should fail
        )
        print(f"❌ FAILED: String metadata was accepted (event ID: {event4.id})")
        print("  ⚠️  Validation is NOT working!")
        event4.delete()  # Cleanup
    except ValidationError as e:
        print("✓ SUCCESS: String metadata rejected")
        print(f"  ValidationError: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    # Test 5: Null metadata (should be allowed)
    print("\n[Test 5] Creating event with null metadata...")
    try:
        event5 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata=None
        )
        print("✓ SUCCESS: Null metadata accepted")
        print(f"  Created event ID: {event5.id}")
        event5.delete()  # Cleanup
    except ValidationError as e:
        print(f"❌ FAILED: Null metadata rejected: {e}")
        print("  ⚠️  This should be allowed!")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    # Test 6: Empty dict metadata
    print("\n[Test 6] Creating event with empty dict metadata...")
    try:
        event6 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata={}
        )
        print("✓ SUCCESS: Empty dict metadata accepted")
        print(f"  Created event ID: {event6.id}")
        event6.delete()  # Cleanup
    except ValidationError as e:
        print(f"❌ FAILED: Empty dict metadata rejected: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    # Test 7: List metadata (should fail - we only want dicts)
    print("\n[Test 7] Creating event with list metadata...")
    try:
        event7 = ActivityEvent.objects.create(
            user=user,
            event_type='content_viewed',
            metadata=[1, 2, 3]  # This should fail
        )
        print(f"❌ FAILED: List metadata was accepted (event ID: {event7.id})")
        print("  ⚠️  Validation should reject lists!")
        event7.delete()  # Cleanup
    except ValidationError as e:
        print("✓ SUCCESS: List metadata rejected")
        print(f"  ValidationError: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
    
    print("\n" + "=" * 80)
    print("VALIDATION TEST COMPLETE")
    print("=" * 80)
    print("\nExpected results:")
    print("  ✓ Test 1: Dict metadata accepted")
    print("  ✓ Test 2: Integer metadata rejected")
    print("  ✓ Test 3: Float metadata rejected")
    print("  ✓ Test 4: String metadata rejected")
    print("  ✓ Test 5: Null metadata accepted")
    print("  ✓ Test 6: Empty dict accepted")
    print("  ✓ Test 7: List metadata rejected")
    print("\nIf all tests pass, validation is working correctly! ✨")
    print("=" * 80)

if __name__ == '__main__':
    test_validation()
