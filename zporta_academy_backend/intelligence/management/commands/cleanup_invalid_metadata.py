"""
Management command to identify and fix corrupted metadata in analytics_activityevent table.

This command:
1. Identifies rows where metadata is not a JSON object (e.g., numeric values)
2. Reports statistics about corrupted data
3. Optionally fixes corrupted rows by setting metadata to NULL

Usage:
    python manage.py cleanup_invalid_metadata --dry-run  # Preview only
    python manage.py cleanup_invalid_metadata             # Actually fix
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Identify and fix corrupted metadata in analytics_activityevent table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview corrupted rows without making changes',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum rows to display in preview (default: 100)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("METADATA CORRUPTION DIAGNOSTIC"))
        self.stdout.write("=" * 80)
        
        # Step 1: Check overall statistics
        self.stdout.write("\n[1/5] Analyzing metadata column statistics...")
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    JSON_TYPE(metadata) as metadata_type,
                    COUNT(*) as count
                FROM analytics_activityevent
                GROUP BY JSON_TYPE(metadata)
                ORDER BY count DESC
            """)
            results = cursor.fetchall()
            
            self.stdout.write("\nMetadata type distribution:")
            total_rows = 0
            corrupted_count = 0
            for metadata_type, count in results:
                total_rows += count
                if metadata_type not in ('OBJECT', None):
                    corrupted_count += count
                    symbol = self.style.ERROR("✗")
                elif metadata_type is None:
                    symbol = self.style.WARNING("○")
                else:
                    symbol = self.style.SUCCESS("✓")
                    
                type_display = metadata_type if metadata_type else "NULL"
                self.stdout.write(f"  {symbol} {type_display:15} {count:8,} rows")
            
            self.stdout.write(f"\nTotal rows: {total_rows:,}")
            if corrupted_count > 0:
                self.stdout.write(self.style.ERROR(f"Corrupted rows: {corrupted_count:,}"))
            else:
                self.stdout.write(self.style.SUCCESS("No corrupted metadata found!"))

        # Step 2: Find corrupted rows by event type
        if corrupted_count > 0:
            self.stdout.write("\n[2/5] Analyzing corrupted rows by event type...")
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        event_type,
                        JSON_TYPE(metadata) as metadata_type,
                        COUNT(*) as count
                    FROM analytics_activityevent
                    WHERE metadata IS NOT NULL 
                      AND JSON_TYPE(metadata) != 'OBJECT'
                    GROUP BY event_type, JSON_TYPE(metadata)
                    ORDER BY count DESC
                """)
                results = cursor.fetchall()
                
                self.stdout.write("\nCorrupted metadata by event type:")
                for event_type, metadata_type, count in results:
                    self.stdout.write(f"  • {event_type:30} {metadata_type:10} {count:6,} rows")

            # Step 3: Show sample corrupted rows
            self.stdout.write(f"\n[3/5] Sample of corrupted rows (first {limit})...")
            with connection.cursor() as cursor:
                cursor.execute(f"""
                    SELECT 
                        id,
                        user_id,
                        event_type,
                        object_id,
                        metadata,
                        JSON_TYPE(metadata) as type,
                        timestamp
                    FROM analytics_activityevent
                    WHERE metadata IS NOT NULL 
                      AND JSON_TYPE(metadata) != 'OBJECT'
                    ORDER BY id ASC
                    LIMIT {limit}
                """)
                results = cursor.fetchall()
                
                if results:
                    self.stdout.write("\nCorrupted rows preview:")
                    self.stdout.write(f"{'ID':>8} {'User':>6} {'Event Type':25} {'Type':10} {'Metadata':30} {'Timestamp':20}")
                    self.stdout.write("-" * 110)
                    
                    for row in results:
                        row_id, user_id, event_type, object_id, metadata, meta_type, timestamp = row
                        metadata_str = str(metadata)[:30] if metadata else ""
                        timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S") if timestamp else ""
                        self.stdout.write(
                            f"{row_id:>8} {user_id or 0:>6} {event_type:25} {meta_type:10} {metadata_str:30} {timestamp_str:20}"
                        )

            # Step 4: Check if any critical data would be lost
            self.stdout.write("\n[4/5] Assessing data loss impact...")
            with connection.cursor() as cursor:
                # Check if any of the corrupted rows have important event types
                cursor.execute("""
                    SELECT 
                        event_type,
                        COUNT(*) as count
                    FROM analytics_activityevent
                    WHERE metadata IS NOT NULL 
                      AND JSON_TYPE(metadata) != 'OBJECT'
                      AND event_type IN (
                          'quiz_answer_submitted', 
                          'quiz_completed', 
                          'quiz_started',
                          'lesson_completed',
                          'course_completed'
                      )
                    GROUP BY event_type
                """)
                critical_results = cursor.fetchall()
                
                if critical_results:
                    self.stdout.write(self.style.WARNING("\n⚠️  WARNING: Critical event types affected:"))
                    for event_type, count in critical_results:
                        self.stdout.write(f"  • {event_type:25} {count:6,} rows")
                    self.stdout.write(self.style.WARNING(
                        "\n  Setting metadata to NULL may lose tracking data for these events."
                    ))
                else:
                    self.stdout.write(self.style.SUCCESS("\n✓ No critical event types affected."))

            # Step 5: Fix or preview fix
            self.stdout.write("\n[5/5] Cleanup operation...")
            
            if dry_run:
                self.stdout.write(self.style.WARNING("\n🔍 DRY RUN MODE - No changes will be made."))
                self.stdout.write(f"\nWould set metadata=NULL for {corrupted_count:,} corrupted rows.")
                self.stdout.write("\nTo actually fix these rows, run:")
                self.stdout.write(self.style.SUCCESS("  python manage.py cleanup_invalid_metadata"))
            else:
                self.stdout.write(self.style.WARNING(f"\n⚠️  About to set metadata=NULL for {corrupted_count:,} rows."))
                confirm = input("Type 'yes' to proceed: ")
                
                if confirm.lower() == 'yes':
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            UPDATE analytics_activityevent
                            SET metadata = NULL
                            WHERE metadata IS NOT NULL 
                              AND JSON_TYPE(metadata) != 'OBJECT'
                        """)
                        affected_rows = cursor.rowcount
                    
                    self.stdout.write(self.style.SUCCESS(f"\n✓ Successfully cleaned {affected_rows:,} rows."))
                    self.stdout.write("\nRecommendation: Run compute_content_difficulty to verify the fix:")
                    self.stdout.write(self.style.SUCCESS("  python manage.py compute_content_difficulty"))
                else:
                    self.stdout.write(self.style.WARNING("\nOperation cancelled."))
        else:
            self.stdout.write("\n[2-5] Skipped - no corrupted data found.")

        # Final summary
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("DIAGNOSTIC COMPLETE"))
        self.stdout.write("=" * 80)
        
        if corrupted_count == 0:
            self.stdout.write(self.style.SUCCESS("\n✓ Database is healthy. No metadata corruption detected."))
        elif dry_run:
            self.stdout.write(self.style.WARNING(f"\n⚠️  Found {corrupted_count:,} corrupted rows. Run without --dry-run to fix."))
        
        self.stdout.write("")
