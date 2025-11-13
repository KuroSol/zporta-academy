import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings.local')
django.setup()

from django.db import connection

cursor = connection.cursor()
cursor.execute("SHOW COLUMNS FROM lessons_lesson WHERE Field='position'")
result = cursor.fetchall()
print('Position column exists:', len(result) > 0)

if len(result) == 0:
    print('Adding position column...')
    cursor.execute("ALTER TABLE lessons_lesson ADD COLUMN position INT UNSIGNED NOT NULL DEFAULT 0")
    cursor.execute("CREATE INDEX lessons_les_course__6bd811_idx ON lessons_lesson (course_id, position)")
    print('Position column added successfully')
else:
    print('Position column already exists')

cursor.close()
