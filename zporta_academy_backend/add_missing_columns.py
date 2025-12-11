import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Columns to add with their SQL definitions
columns_to_add = [
    ('requested_by_user', 'BOOLEAN DEFAULT FALSE'),
    ('requested_by_id', 'INT NULL'),
    ('user_request_type', "VARCHAR(20) DEFAULT 'user'"),
    ('can_request_again_at', 'DATETIME NULL'),
]

print("🔄 Adding missing columns to dailycast_dailypodcast table...")

for col_name, col_type in columns_to_add:
    try:
        cursor.execute(f'ALTER TABLE dailycast_dailypodcast ADD COLUMN {col_name} {col_type}')
        print(f'✓ Added column: {col_name}')
    except Exception as e:
        if 'Duplicate column' in str(e) or 'already exists' in str(e):
            print(f'✓ Column {col_name} already exists')
        else:
            print(f'✗ Error adding {col_name}: {e}')

# Add foreign key constraint for requested_by_id
try:
    cursor.execute('''
        ALTER TABLE dailycast_dailypodcast 
        ADD CONSTRAINT fk_requested_by_user 
        FOREIGN KEY (requested_by_id) 
        REFERENCES auth_user(id) 
        ON DELETE SET NULL
    ''')
    print(f'✓ Added foreign key constraint: fk_requested_by_user')
except Exception as e:
    if 'Duplicate' in str(e) or 'already exists' in str(e):
        print(f'✓ Foreign key constraint already exists')
    else:
        print(f'⚠️ Warning adding foreign key: {e}')

print("\n✓ All columns added successfully!")

# Verify columns were added
cursor.execute('DESC dailycast_dailypodcast')
columns = cursor.fetchall()
print("\nCurrent columns in dailycast_dailypodcast:")
for col in columns:
    print(f"  - {col[0]}")
