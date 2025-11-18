#!/usr/bin/env python
"""
Script to clear all corrupted annotation data from SessionNote table.
Run this to reset all highlight_data to None.
"""

import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.local')
django.setup()

from enrollment.models import SessionNote

def clear_annotations():
    """Clear all highlight_data from SessionNote records."""
    count = SessionNote.objects.count()
    print(f"Found {count} SessionNote records")
    
    if count == 0:
        print("No annotations to clear.")
        return
    
    response = input(f"Clear highlight_data from all {count} records? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        # Clear highlight_data field
        updated = SessionNote.objects.update(highlight_data=None, note='')
        print(f"✓ Cleared highlight_data from {updated} records")
        print("All annotations have been reset!")
    else:
        print("Operation cancelled.")

if __name__ == '__main__':
    clear_annotations()
