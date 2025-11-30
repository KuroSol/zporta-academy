# users/management/commands/check_activity_tracking.py
"""
Diagnostic command to check if activity tracking signals are working.
Usage: python manage.py check_activity_tracking [username]
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from users.activity_models import UserActivity
from analytics.models import QuizSessionProgress
from lessons.models import LessonCompletion
from enrollment.models import CourseCompletion

User = get_user_model()


class Command(BaseCommand):
    help = 'Check activity tracking status for a user'

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            nargs='?',
            type=str,
            help='Username to check (optional, shows all if omitted)'
        )

    def handle(self, *args, **options):
        username = options.get('username')
        
        if username:
            try:
                user = User.objects.get(username=username)
                users = [user]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User "{username}" not found'))
                return
        else:
            users = User.objects.all()[:5]  # Show first 5 users
        
        self.stdout.write(self.style.SUCCESS('\n=== Activity Tracking Diagnostic ===\n'))
        
        for user in users:
            self.stdout.write(self.style.WARNING(f'\n--- User: {user.username} ---'))
            
            # Check recent activities (last 7 days)
            seven_days_ago = timezone.now() - timedelta(days=7)
            recent_activities = UserActivity.objects.filter(
                user=user,
                created_at__gte=seven_days_ago
            ).order_by('-created_at')[:10]
            
            self.stdout.write(f'\nRecent Activities (last 7 days): {recent_activities.count()}')
            for activity in recent_activities:
                self.stdout.write(
                    f'  • {activity.created_at.strftime("%Y-%m-%d %H:%M")} | '
                    f'{activity.role} | {activity.activity_type} | +{activity.points} pts'
                )
            
            # Check completed quiz sessions
            completed_quizzes = QuizSessionProgress.objects.filter(
                user=user,
                status=QuizSessionProgress.COMPLETED,
                completed_at__gte=seven_days_ago
            ).count()
            
            # Check if quiz completions have matching activities
            quiz_sessions = QuizSessionProgress.objects.filter(
                user=user,
                status=QuizSessionProgress.COMPLETED,
                completed_at__gte=seven_days_ago
            )[:5]
            
            self.stdout.write(f'\nCompleted Quiz Sessions (last 7 days): {completed_quizzes}')
            for session in quiz_sessions:
                score = (session.correct_count / session.total_questions * 100) if session.total_questions > 0 else 0
                has_activity = UserActivity.objects.filter(
                    user=user,
                    metadata__session_id=str(session.session_id)
                ).exists()
                status = '✓ Tracked' if has_activity else '✗ NOT TRACKED'
                self.stdout.write(
                    f'  • Session {str(session.session_id)[:8]}... | '
                    f'Score: {score:.0f}% | {status}'
                )
            
            # Check lesson completions
            lesson_completions = LessonCompletion.objects.filter(
                user=user,
                completed_at__gte=seven_days_ago
            ).count()
            
            lesson_activities = UserActivity.objects.filter(
                user=user,
                activity_type='LESSON_COMPLETED',
                created_at__gte=seven_days_ago
            ).count()
            
            self.stdout.write(
                f'\nLesson Completions: {lesson_completions} | '
                f'Activities: {lesson_activities} | '
                f'{"✓ Match" if lesson_completions == lesson_activities else "✗ Mismatch"}'
            )
            
            # Check course completions
            course_completions = CourseCompletion.objects.filter(
                user=user,
                completed_at__gte=seven_days_ago
            ).count()
            
            course_activities = UserActivity.objects.filter(
                user=user,
                activity_type='COURSE_COMPLETED',
                created_at__gte=seven_days_ago
            ).count()
            
            self.stdout.write(
                f'Course Completions: {course_completions} | '
                f'Activities: {course_activities} | '
                f'{"✓ Match" if course_completions == course_activities else "✗ Mismatch"}'
            )
            
            # Calculate total points
            total_points_7d = sum(a.points for a in recent_activities)
            all_time_points = UserActivity.objects.filter(user=user).aggregate(
                total=models.Sum('points')
            )['total'] or 0
            
            from django.db import models
            all_time_points = UserActivity.objects.filter(user=user).aggregate(
                total=models.Sum('points')
            )['total'] or 0
            
            self.stdout.write(
                f'\nPoints: {total_points_7d} (last 7d) | {all_time_points} (all-time)'
            )
        
        self.stdout.write(self.style.SUCCESS('\n\n=== Diagnostic Complete ===\n'))
        self.stdout.write('If quiz sessions show "NOT TRACKED", check:')
        self.stdout.write('  1. Quiz score >= 50% (minimum threshold)')
        self.stdout.write('  2. QuizSessionProgress.status == COMPLETED')
        self.stdout.write('  3. Signal handlers are registered in users/apps.py')
        self.stdout.write('  4. No errors in Django logs during quiz completion\n')
