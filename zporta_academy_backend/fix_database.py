import pymysql
import sys

# Connect to MySQL
try:
    connection = pymysql.connect(
        host='127.0.0.1',
        port=3307,
        user='root',
        password='rootpass',
        database='zporta_academy',
        charset='utf8mb4'
    )
    
    cursor = connection.cursor()
    
    # Check if column exists
    cursor.execute("""
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'zporta_academy' 
        AND TABLE_NAME = 'lessons_lesson' 
        AND COLUMN_NAME = 'updated_at'
    """)
    
    exists = cursor.fetchone()[0]
    
    if exists:
        print("✓ Column 'updated_at' already exists in lessons_lesson table")
    else:
        print("Adding 'updated_at' column to lessons_lesson table...")
        
        # Add the column
        cursor.execute("""
            ALTER TABLE lessons_lesson 
            ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
        """)
        
        print("✓ Column added successfully")
        
        # Check if index exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = 'zporta_academy' 
            AND TABLE_NAME = 'lessons_lesson' 
            AND INDEX_NAME = 'lessons_les_updated_50d980_idx'
        """)
        
        index_exists = cursor.fetchone()[0]
        
        if not index_exists:
            print("Creating index on updated_at...")
            cursor.execute("""
                CREATE INDEX lessons_les_updated_50d980_idx ON lessons_lesson(updated_at)
            """)
            print("✓ Index created successfully")
        else:
            print("✓ Index already exists")
    
    connection.commit()
    print("\n✅ Database update complete!")
    
except pymysql.Error as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
finally:
    if 'connection' in locals():
        connection.close()
