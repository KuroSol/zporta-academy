# users/scoring_service.py
"""
Service for calculating learning scores and impact scores with percentile rankings.
"""
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Q, Min, Max, Case, When, IntegerField
from django.contrib.auth import get_user_model
from .activity_models import UserActivity
from users.models import UserLoginEvent
from lessons.models import LessonCompletion
from enrollment.models import CourseCompletion
try:
    from gamification.models import UserScore, Activity, ActivityType
    GAMIFICATION_AVAILABLE = True
except Exception:
    # Fallback to internal activity tracking when gamification app is not installed
    from users.activity_models import UserActivity as Activity
    GAMIFICATION_AVAILABLE = False
    # Lightweight placeholder to avoid import errors where UserScore is referenced
    class _UserScorePlaceholder:
        def __init__(self, user=None):
            self.learning_score = 0
            self.impact_score = 0
    UserScore = _UserScorePlaceholder
    # Placeholder ActivityType
    class ActivityType:
        CORRECT_ANSWER = "correct_answer"
        LESSON_COMPLETED = "lesson_completed"
        COURSE_COMPLETED = "course_completed"
        COURSE_ENROLLED = "course_enrolled"
from analytics.models import QuizAttempt
from enrollment.models import Enrollment


User = get_user_model()


class ScoringService:
    """Calculate learning and impact scores for users"""
    
    # Define which activities belong to which role
    STUDENT_ACTIVITIES = [
        'CORRECT_ANSWER',
        'LESSON_COMPLETED',
        'COURSE_COMPLETED',
        'COURSE_ENROLLED',
    ]
    
    TEACHER_ACTIVITIES = [
        'ENROLLMENT_FREE',
        'ENROLLMENT_PREMIUM',
        'QUIZ_FIRST_ATTEMPT',
        'STANDALONE_LESSON',
    ]
    
    @staticmethod
    def get_user_major(user):
        """Get user's major from profile"""
        try:
            # Assuming major is stored in profile or through subject preference
            profile = user.profile
            # Try to get first interested subject as major
            pref = user.userpreference
            major = pref.interested_subjects.first()
            return major
        except:
            return None
    
    @staticmethod
    def calculate_30d_points(user, role):
        """Calculate total points in last 30 days for given role"""
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        # Get activity types for this role
        if role == 'student':
            activity_types = ScoringService.STUDENT_ACTIVITIES
        else:
            activity_types = ScoringService.TEACHER_ACTIVITIES
        
        total = Activity.objects.filter(
            user=user,
            activity_type__in=activity_types,
            created_at__gte=thirty_days_ago
        ).aggregate(total=Sum('points'))['total'] or 0
        
        return total
    
    @staticmethod
    def calculate_all_time_points(user, role):
        """Calculate all-time points for given role"""
        # Get activity types for this role
        if role == 'student':
            activity_types = ScoringService.STUDENT_ACTIVITIES
        else:
            activity_types = ScoringService.TEACHER_ACTIVITIES
        
        total = Activity.objects.filter(
            user=user,
            activity_type__in=activity_types
        ).aggregate(total=Sum('points'))['total'] or 0
        
        return total
    
    @staticmethod
    def get_breakdown_by_activity_type(user, role):
        """Get breakdown of points by activity type for last 30 days"""
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        # Get activity types for this role
        if role == 'student':
            activity_types = ScoringService.STUDENT_ACTIVITIES
        else:
            activity_types = ScoringService.TEACHER_ACTIVITIES
        
        activities = Activity.objects.filter(
            user=user,
            activity_type__in=activity_types,
            created_at__gte=thirty_days_ago
        ).values('activity_type').annotate(
            total_points=Sum('points'),
            count=Count('id')
        )
        
        breakdown = {}
        for activity in activities:
            activity_type = activity['activity_type']
            breakdown[activity_type] = {
                'points': activity['total_points'],
                'count': activity['count']
            }
        
        return breakdown
    
    @staticmethod
    def get_daily_points_last_30d(user, role):
        """Get daily points for last 30 days"""
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        # Get activity types for this role
        if role == 'student':
            activity_types = ScoringService.STUDENT_ACTIVITIES
        else:
            activity_types = ScoringService.TEACHER_ACTIVITIES
        
        activities = Activity.objects.filter(
            user=user,
            activity_type__in=activity_types,
            created_at__gte=thirty_days_ago
        ).extra(
            select={'day': 'DATE(created_at)'}
        ).values('day').annotate(
            points=Sum('points')
        ).order_by('day')
        
        # Convert to list of dicts with date and points
        daily_data = []
        for activity in activities:
            daily_data.append({
                'date': activity['day'].isoformat() if hasattr(activity['day'], 'isoformat') else str(activity['day']),
                'points': activity['points']
            })
        
        return daily_data
    
    @staticmethod
    def calculate_percentile_and_rank(user, role, total_points_30d):
        """
        Calculate percentile rank among users with same major.
        Returns: (percentile, rank, total_users_in_major)
        """
        major = ScoringService.get_user_major(user)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        # Get activity types for this role
        if role == 'student':
            activity_types = ScoringService.STUDENT_ACTIVITIES
        else:
            activity_types = ScoringService.TEACHER_ACTIVITIES
        
        if not major:
            # No major, compare against all users
            users_with_points = User.objects.annotate(
                points_30d=Sum(
                    'activities__points',
                    filter=Q(
                        activities__activity_type__in=activity_types,
                        activities__created_at__gte=thirty_days_ago
                    )
                )
            ).filter(points_30d__isnull=False)
        else:
            # Compare against users in same major
            users_with_points = User.objects.filter(
                userpreference__interested_subjects=major
            ).annotate(
                points_30d=Sum(
                    'activities__points',
                    filter=Q(
                        activities__activity_type__in=activity_types,
                        activities__created_at__gte=thirty_days_ago
                    )
                )
            ).filter(points_30d__isnull=False)
        
        total_users = users_with_points.count()
        
        if total_users == 0:
            return 0, 0, 0
        
        # Count users with lower or equal points
        users_below = users_with_points.filter(points_30d__lt=total_points_30d).count()
        
        # Calculate rank (1-indexed)
        rank = total_users - users_below
        
        # Calculate percentile (0-100)
        if total_users == 1:
            percentile = 100
        else:
            percentile = int((users_below / total_users) * 100)
        
        return percentile, rank, total_users
    
    @staticmethod
    def normalize_score(percentile):
        """
        Normalize percentile to 0-100 score.
        Currently just returns percentile, but can be adjusted for different scaling.
        """
        return min(100, max(0, percentile))
    
    @staticmethod
    def get_learning_score(user):
        """Get learning score for student (all-time total points)"""
        total_points = ScoringService.calculate_all_time_points(user, 'student')
        return total_points
    
    @staticmethod
    def get_impact_score(user):
        """Get impact score for teacher (all-time total points)"""
        total_points = ScoringService.calculate_all_time_points(user, 'teacher')
        return total_points
    
    @staticmethod
    def get_progress_overview(user):
        """
        Get complete progress overview for user.
        Returns all-time scores (not percentile-based).
        Uses gamification app data.
        """
        try:
            profile = user.profile
            is_teacher = profile.role in ['guide', 'both']
            is_student = profile.role in ['explorer', 'both']
        except Exception:
            # Default to student if profile doesn't exist
            is_teacher = False
            is_student = True
        
        result = {}
        
        # Get UserScore data from gamification app
        try:
            user_score = UserScore.objects.get(user=user) if GAMIFICATION_AVAILABLE else None
        except Exception:
            user_score = None
        
        if is_student:
            # All-time points from gamification
            if user_score:
                all_time_points_student = user_score.total_points
                result['learning_score'] = all_time_points_student
                result['all_time_points_student'] = all_time_points_student
            else:
                result['learning_score'] = 0
                result['all_time_points_student'] = 0
            
            result['total_points_30d_student'] = ScoringService.calculate_30d_points(user, 'student')
            result['breakdown_by_activity_type_student'] = ScoringService.get_breakdown_by_activity_type(user, 'student')
            result['daily_points_last_30d_student'] = ScoringService.get_daily_points_last_30d(user, 'student')
            
            # Additional student metrics from gamification Activity table
            result['total_quizzes_answered'] = Activity.objects.filter(
                user=user, 
                activity_type=ActivityType.CORRECT_ANSWER
            ).count()
            result['total_lessons_completed'] = Activity.objects.filter(
                user=user, 
                activity_type=ActivityType.LESSON_COMPLETED
            ).count()
            result['total_courses_completed'] = Activity.objects.filter(
                user=user,
                activity_type=ActivityType.COURSE_COMPLETED
            ).count()
            result['total_courses_enrolled'] = Activity.objects.filter(
                user=user,
                activity_type=ActivityType.COURSE_ENROLLED
            ).count()
            result['recent_lessons'] = list(
                LessonCompletion.objects.filter(user=user)
                .select_related('lesson', 'lesson__course')
                .order_by('-completed_at')[:5]
                .values(
                    'lesson_id', 'completed_at', 'lesson__title', 'lesson__course__title'
                )
            )
            result['recent_courses'] = list(
                CourseCompletion.objects.filter(user=user)
                .select_related('course')
                .order_by('-completed_at')[:5]
                .values('course_id', 'completed_at', 'course__title')
            )
            result['learning_streak_days'] = ScoringService.get_activity_streak(user, 'student')
            
            # Detailed lesson completions with points and links
            lesson_activities = Activity.objects.filter(
                user=user,
                activity_type='LESSON_COMPLETED'
            ).order_by('-created_at')
            
            result['lesson_completions_detail'] = [
                {
                    'id': act.id,
                    'lesson_id': act.metadata.get('lesson_id'),
                    'lesson_title': act.metadata.get('lesson_title', 'Unknown Lesson'),
                    'course_title': act.metadata.get('course_title'),
                    'points': act.points,
                    'completed_at': act.created_at.isoformat(),
                    'link': (
                        f"/courses/{act.metadata.get('course_username')}/{act.metadata.get('course_date')}/"
                        f"{act.metadata.get('course_subject')}/{act.metadata.get('course_permalink')}/lessons/{act.metadata.get('lesson_permalink')}/"
                        if all([
                            act.metadata.get('course_username'),
                            act.metadata.get('course_date'),
                            act.metadata.get('course_subject'),
                            act.metadata.get('course_permalink'),
                            act.metadata.get('lesson_permalink')
                        ]) else (
                            f"/lessons/{act.metadata.get('lesson_id')}" if act.metadata.get('lesson_id') else None
                        )
                    ),
                }
                for act in lesson_activities
            ]

            # Recent correct answers (quiz details)
            correct_answer_activities = Activity.objects.filter(
                user=user,
                activity_type='CORRECT_ANSWER'
            ).order_by('-created_at')[:200]
            result['recent_correct_answers'] = [
                {
                    'id': act.id,
                    'quiz_id': act.metadata.get('quiz_id'),
                    'quiz_title': act.metadata.get('quiz_title', 'Quiz'),
                    'question_id': act.metadata.get('question_id'),
                    'subject': act.metadata.get('subject'),
                    'topic': act.metadata.get('topic'),
                    'points': act.points,
                    'answered_at': act.created_at.isoformat(),
                    'link': (f"/quizzes/{act.metadata.get('quiz_permalink')}" if act.metadata.get('quiz_permalink') else (
                        f"/quizzes/{act.metadata.get('quiz_id')}" if act.metadata.get('quiz_id') else None
                    )),
                }
                for act in correct_answer_activities
            ]

            # Quizzes taken summary (grouped by quiz)
            # Build a set of quiz IDs with first-attempt bonus
            first_attempt_quiz_ids = set(
                Activity.objects.filter(
                    user=user,
                    activity_type='QUIZ_FIRST_ATTEMPT'
                ).values_list('metadata__quiz_id', flat=True)
            )

            quiz_attempt_agg = QuizAttempt.objects.filter(user=user).values('quiz_id', 'quiz__title', 'quiz__permalink').annotate(
                attempts_count=Count('id'),
                correct_count=Sum(Case(When(is_correct=True, then=1), default=0, output_field=IntegerField())),
                first_attempt_at=Min('attempted_at'),
                last_attempt_at=Max('attempted_at'),
            ).order_by('-last_attempt_at')[:200]

            quizzes_taken_detail = []
            for row in quiz_attempt_agg:
                qid = row['quiz_id']
                first_attempt_bonus = 1 if qid in first_attempt_quiz_ids else 0
                total_points = (row['correct_count'] or 0) + first_attempt_bonus
                quizzes_taken_detail.append({
                    'quiz_id': qid,
                    'quiz_title': row['quiz__title'] or 'Quiz',
                    'attempts_count': row['attempts_count'] or 0,
                    'correct_count': row['correct_count'] or 0,
                    'first_attempt_bonus': first_attempt_bonus,
                    'points_total': total_points,
                    'first_attempt_at': row['first_attempt_at'].isoformat() if row['first_attempt_at'] else None,
                    'last_attempt_at': row['last_attempt_at'].isoformat() if row['last_attempt_at'] else None,
                    'link': (f"/quizzes/{row.get('quiz__permalink')}" if row.get('quiz__permalink') else (
                        f"/quizzes/{qid}" if qid else None
                    )),
                })

            result['quizzes_taken_detail'] = quizzes_taken_detail
            
            # Detailed course completions with points and links
            course_activities = Activity.objects.filter(
                user=user,
                activity_type='COURSE_COMPLETED'
            ).order_by('-created_at')
            # Detailed course enrollments (student) with points and links
            enrolled_course_activities = Activity.objects.filter(
                user=user,
                activity_type='COURSE_ENROLLED'
            ).order_by('-created_at')
            result['courses_enrolled_detail'] = [
                {
                    'id': act.id,
                    'course_id': act.metadata.get('course_id'),
                    'course_title': act.metadata.get('course_title', 'Unknown Course'),
                    'points': act.points,
                    'enrolled_at': act.created_at.isoformat(),
                    'link': (
                        f"/courses/{act.metadata.get('course_username')}/{act.metadata.get('course_date')}/"
                        f"{act.metadata.get('course_subject')}/{act.metadata.get('course_permalink')}/"
                        if all([
                            act.metadata.get('course_username'),
                            act.metadata.get('course_date'),
                            act.metadata.get('course_subject'),
                            act.metadata.get('course_permalink')
                        ]) else (
                            f"/courses/{act.metadata.get('course_id')}" if act.metadata.get('course_id') else None
                        )
                    ),
                    'enrollment_type': 'Premium' if act.metadata.get('is_premium') else 'Free',
                }
                for act in enrolled_course_activities
            ]
            
            result['course_completions_detail'] = [
                {
                    'id': act.id,
                    'course_id': act.metadata.get('course_id'),
                    'course_title': act.metadata.get('course_title', 'Unknown Course'),
                    'points': act.points,
                    'completed_at': act.created_at.isoformat(),
                    'link': (
                        f"/courses/{act.metadata.get('course_username')}/{act.metadata.get('course_date')}/"
                        f"{act.metadata.get('course_subject')}/{act.metadata.get('course_permalink')}/"
                        if all([
                            act.metadata.get('course_username'),
                            act.metadata.get('course_date'),
                            act.metadata.get('course_subject'),
                            act.metadata.get('course_permalink')
                        ]) else (
                            f"/courses/{act.metadata.get('course_id')}" if act.metadata.get('course_id') else None
                        )
                    ),
                    'time_spent_days': act.metadata.get('time_spent_days'),
                }
                for act in course_activities
            ]
        
        if is_teacher:
            # All-time points from gamification - teacher activities
            # Calculate teacher points from teacher activities only
            teacher_points = Activity.objects.filter(
                user=user,
                activity_type__in=ScoringService.TEACHER_ACTIVITIES
            ).aggregate(total=Sum('points'))['total'] or 0
            
            result['impact_score'] = teacher_points
            result['all_time_points_teacher'] = teacher_points
            
            result['total_points_30d_teacher'] = ScoringService.calculate_30d_points(user, 'teacher')
            result['breakdown_by_activity_type_teacher'] = ScoringService.get_breakdown_by_activity_type(user, 'teacher')
            result['daily_points_last_30d_teacher'] = ScoringService.get_daily_points_last_30d(user, 'teacher')
            
            # Additional teacher metrics from gamification Activity table
            result['total_teacher_quiz_engagements'] = Activity.objects.filter(
                user=user, 
                activity_type='QUIZ_FIRST_ATTEMPT'
            ).count()
            result['total_enrollments_free'] = Activity.objects.filter(
                user=user, 
                activity_type='ENROLLMENT_FREE'
            ).count()
            result['total_enrollments_premium'] = Activity.objects.filter(
                user=user, 
                activity_type='ENROLLMENT_PREMIUM'
            ).count()
            result['total_standalone_lessons'] = Activity.objects.filter(
                user=user, 
                activity_type='STANDALONE_LESSON'
            ).count()
            result['impact_streak_days'] = ScoringService.get_activity_streak(user, 'teacher')
            
            # Detailed enrollment activities with points and links
            enrollment_activities = Activity.objects.filter(
                user=user,
                activity_type__in=['ENROLLMENT_FREE', 'ENROLLMENT_PREMIUM']
            ).order_by('-created_at')
            
            result['enrollments_detail'] = [
                {
                    'id': act.id,
                    'course_id': act.metadata.get('course_id'),
                    'course_title': act.metadata.get('course_title', 'Unknown Course'),
                    'student_id': act.metadata.get('student_id'),
                    'student_username': act.metadata.get('student_username'),
                    'student_profile_link': f"/profile/{act.metadata.get('student_username')}" if act.metadata.get('student_username') else None,
                    'is_premium': act.metadata.get('is_premium', False),
                    'points': act.points,
                    'enrolled_at': act.created_at.isoformat(),
                    'link': (
                        f"/courses/{act.metadata.get('course_username')}/{act.metadata.get('course_date')}/"
                        f"{act.metadata.get('course_subject', '').lower()}/{act.metadata.get('course_permalink')}"
                        if all([
                            act.metadata.get('course_username'),
                            act.metadata.get('course_date'),
                            act.metadata.get('course_subject'),
                            act.metadata.get('course_permalink')
                        ]) else (
                            f"/courses/{act.metadata.get('course_id')}" if act.metadata.get('course_id') else None
                        )
                    ),
                }
                for act in enrollment_activities
            ]
            
            # Detailed quiz first attempts with points
            quiz_activities = Activity.objects.filter(
                user=user,
                activity_type='QUIZ_FIRST_ATTEMPT'
            ).order_by('-created_at')
            
            result['quiz_first_attempts_detail'] = [
                {
                    'id': act.id,
                    'quiz_id': act.metadata.get('quiz_id'),
                    'quiz_title': act.metadata.get('quiz_title', 'Quiz'),
                    'student_id': act.metadata.get('student_id'),
                    'student_username': act.metadata.get('student_username'),
                    'student_profile_link': f"/profile/{act.metadata.get('student_username')}" if act.metadata.get('student_username') else None,
                    'points': act.points,
                    'attempted_at': act.created_at.isoformat(),
                    'link': (f"/quizzes/{act.metadata.get('quiz_permalink')}" if act.metadata.get('quiz_permalink') else (
                        f"/quizzes/{act.metadata.get('quiz_id')}" if act.metadata.get('quiz_id') else None
                    )),
                }
                for act in quiz_activities
            ]

        # Help / explanation blocks
        result['score_help'] = {
            'learning_score': 'Each correct answer: +1 point. Complete lesson: +1 point. Complete course: +3 points.',
            'impact_score': 'Free enrollment: +2 points. Premium enrollment: +3 points. First quiz attempt per student: +1 point.'
        }
        result['activity_help'] = {
            'streak_definition': 'Consecutive days with at least one activity (lesson, quiz, or course completion) for the given role.',
            'recent_lists': 'Most recent completed lessons and courses to help you resume where you left off.'
        }

        # Login / study time analytics (last 7 days)
        seven_days_ago = timezone.now() - timedelta(days=7)
        login_events = UserLoginEvent.objects.filter(user=user, login_at__gte=seven_days_ago)
        total_seconds = 0
        daily_map = {}
        for ev in login_events:
            # If heartbeat exists and logout not set, cap session at last heartbeat + grace (5 min)
            inactivity_grace = timedelta(minutes=5)
            if ev.logout_at:
                end = ev.logout_at
            else:
                if ev.last_heartbeat_at:
                    # Auto-close long inactive sessions
                    candidate_end = ev.last_heartbeat_at + inactivity_grace
                    now = timezone.now()
                    end = candidate_end if candidate_end < now else now
                else:
                    end = timezone.now()
            duration = (end - ev.login_at).total_seconds()
            total_seconds += max(0, duration)
            day = ev.login_at.date()
            daily_map.setdefault(day, 0)
            daily_map[day] += max(0, duration)
        # Build daily series for 7 days (ensure zeros for missing days)
        daily_series = []
        for i in range(7):
            day = (timezone.now().date() - timedelta(days=6 - i))
            seconds = daily_map.get(day, 0)
            daily_series.append({
                'date': day.isoformat(),
                'minutes': round(seconds / 60, 1)
            })
        avg_minutes = round((total_seconds / 60) / 7, 1) if total_seconds else 0
        result['total_login_minutes_7d'] = round(total_seconds / 60, 1)
        result['average_login_minutes_per_day_7d'] = avg_minutes
        result['login_daily_minutes'] = daily_series
        # Simple goal evaluation (e.g., 300 minutes / week)
        goal_minutes = 300
        result['login_goal_weekly_minutes'] = goal_minutes
        result['login_goal_progress_percent'] = int(min(100, (result['total_login_minutes_7d'] / goal_minutes) * 100)) if goal_minutes else 0
        
        return result

    # ────────────────────────────────────────────────────────────────
    # Additional helper methods
    # ────────────────────────────────────────────────────────────────
    @staticmethod
    def get_activity_streak(user, role):
        """Calculate current streak of consecutive days with any activity for the given role."""
        # Get activity types for this role
        if role == 'student':
            activity_types = ScoringService.STUDENT_ACTIVITIES
        else:
            activity_types = ScoringService.TEACHER_ACTIVITIES
        
        qs = Activity.objects.filter(
            user=user, 
            activity_type__in=activity_types
        ).order_by('-created_at').values_list('created_at', flat=True)
        
        if not qs:
            return 0
        # Normalize to date set
        days = []
        seen = set()
        for dt in qs:
            d = dt.date()
            if d not in seen:
                seen.add(d)
                days.append(d)
        days.sort(reverse=True)
        streak = 0
        current = timezone.now().date()
        for d in days:
            if d == current - timedelta(days=streak):
                streak += 1
            else:
                break
        return streak
