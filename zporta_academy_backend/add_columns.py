#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Check if columns already exist
cursor.execute("""
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users_userpreference' 
    AND COLUMN_NAME IN ('native_language', 'report_language')
""")
existing = [row[0] for row in cursor.fetchall()]

# Add missing columns
if 'native_language' not in existing:
    try:
        cursor.execute("""
            ALTER TABLE users_userpreference 
            ADD COLUMN native_language VARCHAR(12) NOT NULL DEFAULT 'en'
        """)
        print("✓ Added native_language column")
    except Exception as e:
        print(f"✗ Error adding native_language: {e}")

if 'report_language' not in existing:
    try:
        cursor.execute("""
            ALTER TABLE users_userpreference 
            ADD COLUMN report_language VARCHAR(12) NOT NULL DEFAULT 'en'
        """)
        print("✓ Added report_language column")
    except Exception as e:
        print(f"✗ Error adding report_language: {e}")

# Verify
cursor.execute('DESCRIBE users_userpreference')
cols = [row[0] for row in cursor.fetchall()]
print(f"\nUserPreference columns: {sorted(cols)}")
print(f"native_language exists: {'native_language' in cols}")
print(f"report_language exists: {'report_language' in cols}")
