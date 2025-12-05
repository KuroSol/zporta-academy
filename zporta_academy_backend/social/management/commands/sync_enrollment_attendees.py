# social/management/commands/sync_enrollment_attendees.py
"""
Backfill attendees (GuideRequest records) from existing course enrollments.

This one-off command ensures that all students enrolled in a teacher's course
have corresponding accepted GuideRequest records, allowing teachers to send
emails to these attendees.

The command:
1. Iterates over all active course enrollments
2. Creates GuideRequest records (as "accepted") for student->teacher relationships
3. Respects user email preferences (skip users who disabled email)
4. Is idempotent (safe to run multiple times)
"""
from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from enrollment.models import Enrollment
from courses.models import Course
from social.models import GuideRequest


class Command(BaseCommand):
    help = 'Backfill GuideRequest records from existing course enrollments'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            dest='dry_run',
            help='Show what would be created without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        
        self.stdout.write("=" * 70)
        self.stdout.write("Syncing Enrollment Attendees (GuideRequest Records)")
        self.stdout.write("=" * 70)
        
        # Get ContentType for Course
        course_content_type = ContentType.objects.get_for_model(Course)
        
        # Find all active course enrollments
        active_enrollments = Enrollment.objects.filter(
            enrollment_type='course',
            status='active',
            content_type=course_content_type
        ).select_related('user', 'content_object').select_related('user__profile')
        
        total_processed = 0
        new_attendees = 0
        skipped_existing = 0
        skipped_email_disabled = 0
        
        self.stdout.write(f"\nFound {active_enrollments.count()} active course enrollments.\n")
        
        for enrollment in active_enrollments:
            student = enrollment.user
            course = enrollment.content_object
            teacher = course.created_by
            
            # Skip if student and teacher are the same
            if student == teacher:
                total_processed += 1
                continue
            
            total_processed += 1
            
            # Check if student has disabled email
            student_profile = getattr(student, 'profile', None)
            if student_profile and not student_profile.mail_magazine_enabled:
                self.stdout.write(
                    self.style.WARNING(
                        f"⊘ Skipping {student.username} → {teacher.username} "
                        f"(email disabled)"
                    )
                )
                skipped_email_disabled += 1
                continue
            
            # Check if GuideRequest already exists
            existing_gr = GuideRequest.objects.filter(
                explorer=student,
                guide=teacher
            ).first()
            
            if existing_gr:
                if existing_gr.status == 'accepted':
                    # Already have accepted attendee record
                    skipped_existing += 1
                elif existing_gr.status in ('pending', 'declined'):
                    # Update existing non-accepted record to accepted
                    existing_gr.status = 'accepted'
                    if not dry_run:
                        existing_gr.save()
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"✓ Updated {student.username} → {teacher.username} "
                            f"({existing_gr.get_status_display()} → Accepted)"
                        )
                    )
                    new_attendees += 1
            else:
                # Create new GuideRequest record with 'accepted' status
                if not dry_run:
                    GuideRequest.objects.create(
                        explorer=student,
                        guide=teacher,
                        status='accepted'
                    )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ Created {student.username} → {teacher.username}"
                    )
                )
                new_attendees += 1
        
        # Print summary
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write("SUMMARY")
        self.stdout.write("=" * 70)
        self.stdout.write(f"Total enrollments processed:     {total_processed}")
        self.stdout.write(
            self.style.SUCCESS(f"New attendees created:          {new_attendees}")
        )
        self.stdout.write(f"Existing attendees skipped:     {skipped_existing}")
        self.stdout.write(
            self.style.WARNING(
                f"Enrollments skipped (email disabled): {skipped_email_disabled}"
            )
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\n⚠ DRY RUN MODE - No changes were made. "
                    "Remove --dry-run to apply changes."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("\n✓ Sync complete!")
            )
