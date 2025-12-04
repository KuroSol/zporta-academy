import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("DESCRIBE users_profile")
    columns = cursor.fetchall()
    print("\nExisting columns in users_profile:")
    for col in columns:
        print(f"  {col[0]}")
