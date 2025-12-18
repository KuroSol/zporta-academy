"""
User data export views for admin staff.
Comprehensive diagnostic export for accurate CEFR/TOEIC/TOEFL scoring.
"""
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg, Count, Sum, Q, Prefetch, F
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime, timedelta
import json
import uuid

from analytics.models import QuizSessionProgress, ActivityEvent
from gamification.models import Activity, UserScore
from notes.models import Note
from enrollment.models import Enrollment
from quizzes.models import Quiz, Question
from courses.models import Course
from lessons.models import Lesson
from .models import UserLoginEvent, Profile, UserPreference


class UserDataExportView(APIView):
    """
    Admin-only endpoint to export comprehensive user data as JSON.
    GET /api/users/{user_id}/export-json/
    """
    permission_classes = [IsAdminUser]

    def get(self, request, user_id):
        try:
            user = User.objects.select_related('profile', 'score').prefetch_related(
                'login_events',
                'notes',
                Prefetch('activities', queryset=Activity.objects.select_related('content_type')),
                Prefetch('enrollments', queryset=Enrollment.objects.select_related('content_type'))
            ).get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Build comprehensive export
        export_data = {
            'export_metadata': {
                'user_id': user.id,
                'exported_at': timezone.now().isoformat(),
                'export_version': '3.0',
                'scoring_ready': True,
                'diagnostic_ready': True,
                'note': 'Comprehensive diagnostic export for CEFR/TOEIC/TOEFL assessment with writing/speaking samples'
            },
            'user_profile': self._build_user_profile_section(user),
            'writing_samples': self._build_writing_samples_section(user),
            'speaking_samples': self._build_speaking_samples_section(user),
            'listening_reading_diagnostics': self._build_listening_reading_diagnostics_section(user),
            'quiz_attempts': self._build_quiz_attempts_section(user),
            'vocabulary_signals': self._build_vocabulary_signals_section(user),
            'study_behavior': self._build_study_behavior_section(user),
            'listening_speaking': self._build_listening_speaking_section(user),
            'device_location': self._build_device_location_section(user)
        }
        
        # Validate and update metadata
        is_valid, validation_errors, validation_warnings, diagnostic_ready = self._validate_export_data(export_data)
        export_data['export_metadata']['scoring_ready'] = is_valid
        export_data['export_metadata']['diagnostic_ready'] = diagnostic_ready
        export_data['export_metadata']['validation_errors'] = validation_errors
        export_data['export_metadata']['validation_warnings'] = validation_warnings
        export_data['export_metadata']['data_quality'] = 'excellent' if (is_valid and diagnostic_ready) else 'good' if is_valid else 'needs_review'

        # Generate filename
        date_str = timezone.now().strftime('%Y%m%d')
        filename = f'user_export_{user_id}_{date_str}.json'

        # Return as downloadable attachment
        response = HttpResponse(
            json.dumps(export_data, indent=2, ensure_ascii=False),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _validate_export_data(self, export_data):
        """
        Validate export data for impossible values and readiness.
        Returns: (is_valid: bool, errors: list, warnings: list, diagnostic_ready: bool)
        """
        errors = []
        warnings = []
        diagnostic_blockers = []  # Critical issues that block CEFR/TOEIC/TOEFL predictions
        
        # Check ability score
        ability = export_data.get('user_profile', {}).get('ability_score', {})
        if ability and ability.get('overall') and ability.get('overall') >= 1000:
            warnings.append('ability_score_unvalidated: Value of 1000 is default/placeholder. Requires real quiz/assessment data.')
        
        # Check target exam (CRITICAL BLOCKER)
        target_exam = export_data.get('user_profile', {}).get('target_exam')
        if target_exam == 'none' or not target_exam:
            diagnostic_blockers.append('target_exam_missing: Cannot predict TOEIC/TOEFL/IELTS without target exam specification.')
        
        # Validate listening/reading diagnostics
        diag = export_data.get('listening_reading_diagnostics', {})
        if diag.get('avg_listening_accuracy') is not None:
            acc = diag.get('avg_listening_accuracy', 0)
            if acc < 0 or acc > 100:
                errors.append(f'listening_accuracy_invalid: {acc}% is outside [0-100] range')
        
        if diag.get('avg_reading_accuracy') is not None:
            acc = diag.get('avg_reading_accuracy', 0)
            if acc < 0 or acc > 100:
                errors.append(f'reading_accuracy_invalid: {acc}% is outside [0-100] range')
        
        # Validate quiz attempts
        quiz_data = export_data.get('quiz_attempts', {})
        for i, attempt in enumerate(quiz_data.get('attempts', [])):
            if attempt.get('accuracy') is not None:
                acc = attempt.get('accuracy', 0)
                if acc < 0 or acc > 100:
                    errors.append(f'quiz_attempt[{i}]_accuracy_invalid: {acc}% is outside [0-100] range')
            
            # Check sum: correct + incorrect == total
            correct = attempt.get('correct_count', 0)
            incorrect = attempt.get('incorrect_count', 0)
            total = attempt.get('total_questions', 0)
            if total > 0 and (correct + incorrect) != total:
                errors.append(f'quiz_attempt[{i}]_count_mismatch: correct({correct}) + incorrect({incorrect}) != total({total})')
        
        # Validate best_accuracy stats
        if quiz_data.get('best_accuracy') is not None:
            best_acc = quiz_data.get('best_accuracy', 0)
            if best_acc < 0 or best_acc > 100:
                errors.append(f'best_accuracy_invalid: {best_acc}% is outside [0-100] range (THIS WAS THE 310% BUG)')
        
        # Check writing samples requirement (CRITICAL for CEFR)
        writing = export_data.get('writing_samples', {})
        unassisted_count = writing.get('unassisted_count', 0)
        if unassisted_count < 3:
            diagnostic_blockers.append(f'writing_samples_insufficient: Only {unassisted_count} unassisted (need 3+ for reliable CEFR scoring)')
        
        # Check speaking samples requirement (CRITICAL for TOEFL/IELTS)
        speaking = export_data.get('speaking_samples', {})
        speaking_count = speaking.get('total_samples', 0)
        if speaking_count < 3:
            diagnostic_blockers.append(f'speaking_samples_insufficient: Only {speaking_count} samples (need 3+ for TOEFL/IELTS scoring)')
        
        # Check listening/reading diagnostic count (CRITICAL for TOEIC)
        listening_count = diag.get('listening_count', 0)
        reading_count = diag.get('reading_count', 0)
        if listening_count < 1:
            diagnostic_blockers.append('listening_diagnostics_missing: No listening tests found (need 1+ for TOEIC scoring)')
        if reading_count < 1:
            diagnostic_blockers.append('reading_diagnostics_missing: No reading tests found (need 1+ for TOEIC scoring)')
        
        # Data integrity is critical for scoring
        is_valid = len(errors) == 0
        # Diagnostic readiness requires both valid data AND sufficient evidence
        diagnostic_ready = is_valid and len(diagnostic_blockers) == 0
        
        return is_valid, errors, warnings + diagnostic_blockers, diagnostic_ready

    def _build_user_section(self, user):
        """Basic user information."""
        profile = getattr(user, 'profile', None)
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'registration_date': user.date_joined.isoformat() if user.date_joined else None,
            'is_active': user.is_active,
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'profile': {
                'display_name': profile.display_name if profile else '',
                'role': profile.role if profile else None,
                'bio': profile.bio if profile else None,
                'growth_score': profile.growth_score if profile else 0,
                'impact_score': profile.impact_score if profile else 0,
            } if profile else None
        }

    def _build_user_profile_section(self, user):
        """Comprehensive user profile for diagnostic assessment (REQUIRED for scoring)."""
        try:
            profile = Profile.objects.get(user=user)
        except Profile.DoesNotExist:
            profile = None
        
        preference = None
        try:
            preference = UserPreference.objects.get(user=user)
        except (UserPreference.DoesNotExist, Exception):
            # Handle missing preferences or database migration issues
            preference = None
        
        return {
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'registration_date': user.date_joined.isoformat() if user.date_joined else None,
            'native_language': getattr(preference, 'native_language', 'unknown') if preference else 'unknown',
            'report_language': getattr(preference, 'report_language', 'en') if preference else 'en',
            'target_exam': self._get_target_exam(user),  # Try to infer from enrollments
            'goal_score': None,  # Would need to be stored in profile if needed
            'study_context': self._get_study_context(user),
            'timezone': getattr(preference, 'timezone', 'UTC') if preference else 'UTC',
            'interested_subjects': [
                {'id': s.id, 'name': s.name} 
                for s in preference.interested_subjects.all()
            ] if preference else [],
            'interested_tags': [
                {'id': t.id, 'name': t.name}
                for t in preference.interested_tags.all()
            ] if preference else [],
            'ability_score': self._get_user_ability_score(user),
            'growth_metrics': {
                'growth_score': profile.growth_score if profile else 0,
                'impact_score': profile.impact_score if profile else 0,
                'learning_days': (timezone.now() - user.date_joined).days if user.date_joined else 0
            }
        }
    
    def _get_target_exam(self, user):
        """Infer target exam from enrollments/quizzes (best guess)."""
        # Get quizzes from quiz_session_progresses that belong to this user
        quiz_titles = list(Quiz.objects.filter(
            session_progresses__user=user
        ).values_list('title', flat=True).distinct()[:5])
        
        quiz_titles_str = ' '.join(str(t) for t in quiz_titles).lower()
        
        if 'toeic' in quiz_titles_str:
            return 'toeic'
        elif 'toefl' in quiz_titles_str:
            return 'toefl'
        elif 'ielts' in quiz_titles_str:
            return 'ielts'
        return 'none'
    
    def _get_study_context(self, user):
        """Infer study context from enrollments/courses (best guess)."""
        try:
            from enrollment.models import Enrollment
            from django.contrib.contenttypes.models import ContentType
            
            # Get course-type enrollments for this user
            course_ct = ContentType.objects.get_for_model(Course)
            enrollment_ids = list(Enrollment.objects.filter(
                user=user,
                content_type=course_ct,
                enrollment_type='course'
            ).values_list('object_id', flat=True)[:5])
            
            # Get the course titles
            if enrollment_ids:
                course_titles = Course.objects.filter(
                    id__in=enrollment_ids
                ).values_list('title', flat=True)
                course_titles_str = ' '.join(str(t) for t in course_titles).lower()
            else:
                course_titles_str = ''
        except Exception:
            course_titles_str = ''
        
        if 'business' in course_titles_str or 'work' in course_titles_str:
            return 'work'
        elif 'college' in course_titles_str or 'academic' in course_titles_str:
            return 'college'
        elif 'travel' in course_titles_str:
            return 'travel'
        return 'general'
    
    def _get_user_ability_score(self, user):
        """
        Get ability score if available AND backed by evidence.
        Returns null if score is default/unvalidated.
        """
        try:
            from intelligence.models import UserAbilityProfile
            ability_profile = UserAbilityProfile.objects.get(user=user)
            
            # Only return if not the default/placeholder value
            if ability_profile.overall_ability_score and ability_profile.overall_ability_score < 1000:
                return {
                    'overall': ability_profile.overall_ability_score,
                    'level': ability_profile.get_ability_level(),
                    'by_subject': ability_profile.ability_by_subject,
                    'percentile': ability_profile.percentile,
                    'note': 'Based on user activity and quiz performance'
                }
            else:
                return None  # Score is default/placeholder - require real evidence
        except:
            return None


    def _build_quizzes_section(self, user):
        """Quiz attempts with population comparison and detailed question breakdown."""
        sessions = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED
        ).select_related('quiz')

        quiz_data = []
        for session in sessions:
            quiz = session.quiz
            accuracy = (session.correct_count / session.total_questions * 100) if session.total_questions > 0 else 0
            
            # Calculate time per quiz
            time_seconds = None
            if session.started_at and session.completed_at:
                time_seconds = (session.completed_at - session.started_at).total_seconds()
            
            # Population stats (exclude current user)
            cohort_sessions = QuizSessionProgress.objects.filter(
                quiz=quiz,
                status=QuizSessionProgress.COMPLETED
            ).exclude(user=user)
            
            population_stats = cohort_sessions.aggregate(
                avg_accuracy=Avg(
                    F('correct_count') * 100.0 / F('total_questions')
                ),
                total_attempts=Count('id')
            )
            
            # Calculate percentile
            population_avg = population_stats['avg_accuracy'] or 0
            percentile = None
            if population_stats['total_attempts'] > 0:
                better_count = cohort_sessions.filter(
                    correct_count__gt=session.correct_count
                ).count()
                percentile = (1 - (better_count / population_stats['total_attempts'])) * 100

            # Get detailed question breakdown
            question_details = self._get_quiz_question_details(user, quiz, session)

            # Validate calculations
            incorrect_count = session.total_questions - session.correct_count
            calc_accuracy = round((session.correct_count / session.total_questions * 100), 2) if session.total_questions > 0 else 0
            calc_accuracy = min(calc_accuracy, 100.0)
            
            # Validate time
            time_valid = True
            time_warning = None
            if time_seconds:
                if time_seconds > 86400:
                    time_valid = False
                    time_warning = "Duration exceeds 24 hours - may include pauses"
                elif time_seconds < session.total_questions:
                    time_valid = False
                    time_warning = "Duration suspiciously short"
            
            quiz_data.append({
                'quiz_id': quiz.id,
                'quiz_title': quiz.title,
                'quiz_content': quiz.content if hasattr(quiz, 'content') else None,
                'difficulty': getattr(quiz, 'difficulty_level', None),
                'subject': quiz.subject.name if quiz.subject else None,
                'quiz_category': self._get_quiz_category(quiz),
                'completed_at': session.completed_at.isoformat() if session.completed_at else None,
                'started_at': session.started_at.isoformat() if session.started_at else None,
                'session_id': str(session.session_id),
                'total_questions': session.total_questions,
                'correct_count': session.correct_count,
                    'incorrect_count': incorrect_count,
                    'accuracy': calc_accuracy,
                'time_seconds': time_seconds,
                    'time_valid': time_valid,
                    'time_warning': time_warning,
                'avg_time_per_question': round(time_seconds / session.total_questions, 2) if time_seconds and session.total_questions > 0 else None,
                'questions': question_details,
                    'validation': {
                        'sum_check': session.correct_count + incorrect_count == session.total_questions,
                        'accuracy_check': calc_accuracy <= 100.0,
                        'time_check': time_valid
                    },
                'population_stats': {
                    'avg_accuracy': round(population_avg, 2) if population_avg else None,
                    'accuracy_percentile': round(percentile, 2) if percentile is not None else None,
                        'relative_delta': round(calc_accuracy - population_avg, 2) if population_avg else None,
                    'cohort_size': population_stats['total_attempts']
                }
            })

        return quiz_data
    
    def _get_quiz_question_details(self, user, quiz, session):
        """Get detailed breakdown of each question attempt."""
        from quizzes.models import Question
        
        questions = Question.objects.filter(quiz=quiz).order_by('id')
        question_details = []
        
        # Get activity events for this session
        answer_events = ActivityEvent.objects.filter(
            user=user,
            session_id=session.session_id,
            event_type='quiz_answer_submitted'
        ).order_by('timestamp')
        
        for idx, question in enumerate(questions, 1):
            # Find the answer event for this question
            answer_event = answer_events.filter(
                object_id=question.id
            ).first()
            
            user_answer = None
            selected_option = None
            correct_answer = None
            is_correct = False
            time_taken = None
            
            if answer_event and answer_event.metadata:
                user_answer = answer_event.metadata.get('user_answer')
                selected_option = answer_event.metadata.get('selected_option')
                is_correct = answer_event.metadata.get('is_correct', False)
                time_taken = answer_event.metadata.get('time_taken')
            
            # Get correct answer from question
            if question.question_type == 'mcq':
                correct_answer = question.correct_option
                # If no selected_option but user_answer exists, infer it
                if not selected_option and user_answer:
                    selected_option = user_answer
            elif question.question_type == 'multi':
                correct_answer = question.correct_options if hasattr(question, 'correct_options') else None
            elif question.question_type == 'short':
                correct_answer = question.short_answer if hasattr(question, 'short_answer') else None
            elif question.question_type == 'dragdrop':
                correct_answer = question.correct_order if hasattr(question, 'correct_order') else None
            elif question.question_type == 'sort':
                correct_answer = question.correct_sequence if hasattr(question, 'correct_sequence') else None
            
            question_details.append({
                'question_number': idx,
                'question_id': question.id,
                'question_type': question.question_type,
                'question_text': question.question_text,
                'has_audio': bool(question.question_audio) if hasattr(question, 'question_audio') else False,
                'options': {
                    'option1': question.option1,
                    'option2': question.option2,
                    'option3': question.option3,
                    'option4': question.option4,
                } if question.question_type in ['mcq', 'multi'] else None,
                'user_answer': user_answer,
                'selected_option': selected_option,
                'correct_answer': correct_answer,
                'is_correct': is_correct,
                'time_taken_seconds': time_taken,
                'points_earned': 1 if is_correct else 0
            })
        
        return question_details

    def _build_totals_section(self, user):
        """Aggregate totals and records."""
        score = getattr(user, 'score', None)
        
        # Total time from quiz sessions
        quiz_sessions = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED,
            started_at__isnull=False,
            completed_at__isnull=False
        )
        
        total_quiz_time = 0
        for session in quiz_sessions:
            total_quiz_time += (session.completed_at - session.started_at).total_seconds()
        
        # Activities time
        activities_time = Activity.objects.filter(
            user=user,
            time_spent_seconds__isnull=False
        ).aggregate(total=Sum('time_spent_seconds'))['total'] or 0
        
        return {
            'total_score': score.total_points if score else 0,
            'total_time_spent_seconds': total_quiz_time + activities_time,
            'total_quiz_time_seconds': total_quiz_time,
            'total_activities_time_seconds': activities_time,
            'lessons_completed': score.lessons_completed if score else 0,
            'courses_completed': score.courses_completed if score else 0,
            'correct_answers': score.correct_answers if score else 0,
            'personal_records': self._get_personal_records(user)
        }

    def _get_personal_records(self, user):
        """Get user's best performances."""
        best_accuracy = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED,
            total_questions__gt=0
        ).annotate(
            accuracy=F('correct_count') * 100.0 / F('total_questions')
        ).order_by('-accuracy').first()
        
        fastest_quiz = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED,
            started_at__isnull=False,
            completed_at__isnull=False
        ).annotate(
            duration=F('completed_at') - F('started_at')
        ).order_by('duration').first()
        
        records = []
        if best_accuracy:
            records.append({
                'type': 'best_accuracy',
                'quiz_id': best_accuracy.quiz_id,
                'accuracy': round(best_accuracy.correct_count / best_accuracy.total_questions * 100, 2),
                'achieved_at': best_accuracy.completed_at.isoformat() if best_accuracy.completed_at else None
            })
        
        if fastest_quiz:
            duration = (fastest_quiz.completed_at - fastest_quiz.started_at).total_seconds()
            records.append({
                'type': 'fastest_quiz',
                'quiz_id': fastest_quiz.quiz_id,
                'duration_seconds': duration,
                'achieved_at': fastest_quiz.completed_at.isoformat() if fastest_quiz.completed_at else None
            })
        
        return records

    def _build_notes_section(self, user):
        """Notes grouped by month."""
        notes = Note.objects.filter(user=user).order_by('-created_at')
        
        notes_by_month = {}
        for note in notes:
            month_key = note.created_at.strftime('%Y-%m')
            if month_key not in notes_by_month:
                notes_by_month[month_key] = []
            
            notes_by_month[month_key].append({
                'id': note.id,
                'text': note.text,  # Full text, no truncation
                'privacy': note.privacy,
                'created_at': note.created_at.isoformat(),
                'word_count': len(note.text.split())
            })
        
        # Format as list with counts
        monthly_notes = []
        for month, notes_list in sorted(notes_by_month.items(), reverse=True):
            monthly_notes.append({
                'month': month,
                'count': len(notes_list),
                'notes': notes_list
            })
        
        return monthly_notes

    def _build_courses_section(self, user):
        """Courses and learning data."""
        enrollments = Enrollment.objects.filter(
            user=user
        ).select_related('content_type')
        
        courses = []
        lessons = []
        
        for enrollment in enrollments:
            obj = enrollment.content_object
            if isinstance(obj, Course):
                courses.append({
                    'course_id': obj.id,
                    'title': obj.title,
                    'subject': obj.subject.name if obj.subject else None,
                    'enrolled_at': enrollment.enrollment_date.isoformat(),
                    'status': enrollment.status,
                    'course_type': obj.course_type,
                    'tags': list(obj.tags.values_list('name', flat=True)) if hasattr(obj, 'tags') else []
                })
            elif isinstance(obj, Lesson):
                lessons.append({
                    'lesson_id': obj.id,
                    'title': obj.title,
                    'subject': obj.subject.name if obj.subject else None,
                    'enrolled_at': enrollment.enrollment_date.isoformat(),
                    'status': enrollment.status
                })
        
        # Lesson completion timeline from activities
        lesson_activities = Activity.objects.filter(
            user=user,
            activity_type='lesson_completed'
        ).order_by('created_at')
        
        lesson_timeline = []
        for activity in lesson_activities:
            lesson_timeline.append({
                'lesson_id': activity.object_id,
                'completed_at': activity.created_at.isoformat(),
                'time_spent_seconds': activity.time_spent_seconds
            })
        
        return {
            'courses_enrolled': courses,
            'lessons_enrolled': lessons,
            'lesson_completion_timeline': lesson_timeline,
            'total_courses': len(courses),
            'total_lessons': len(lessons)
        }

    def _build_activity_section(self, user):
        """Chronological activity timeline."""
        # Get login events
        logins = UserLoginEvent.objects.filter(user=user).order_by('-login_at')[:50]
        
        # Get activity events
        activity_events = ActivityEvent.objects.filter(user=user).order_by('-timestamp')[:100]
        
        timeline = []
        
        # Add logins
        for login in logins:
            timeline.append({
                'type': 'login',
                'timestamp': login.login_at.isoformat(),
                'user_agent': login.user_agent,
                'session_duration_seconds': login.session_duration_seconds
            })
        
        # Add activity events
        for event in activity_events:
            timeline.append({
                'type': event.event_type,
                'timestamp': event.timestamp.isoformat(),
                'content_type': str(event.content_type) if event.content_type else None,
                'object_id': event.object_id,
                'metadata': event.metadata
            })
        
        # Sort by timestamp descending
        timeline.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return timeline[:100]  # Limit to most recent 100 events

    def _build_device_location_section(self, user):
        """Device and location info (only if stored)."""
        login_events = UserLoginEvent.objects.filter(
            user=user,
            ip_address__isnull=False
        ).order_by('-login_at')[:10]
        
        devices = []
        ips = set()
        
        for event in login_events:
            if event.ip_address:
                ips.add(event.ip_address)
            
            devices.append({
                'user_agent': event.user_agent,
                'ip_address': event.ip_address,
                'login_at': event.login_at.isoformat()
            })
        
        return {
            'recent_devices': devices,
            'unique_ips': list(ips),
            'note': 'IP and location data shown only if previously recorded. No external services called.'
        }
    
    def _build_speaking_samples_section(self, user):
        """Speaking samples with transcripts (REQUIRED for TOEFL prediction)."""
        speaking_samples = []
        
        # Get speaking recorded events
        speaking_events = ActivityEvent.objects.filter(
            user=user,
            event_type__in=['audio_uploaded', 'speaking_recorded', 'voice_message', 'speaking_task']
        ).order_by('-timestamp')[:50]
        
        for event in speaking_events:
            if event.metadata:
                speaking_samples.append({
                    'sample_id': str(event.id),
                    'task_type': event.metadata.get('task_type', 'free-talk'),  # independent/integrated/free-talk
                    'prompt_text': event.metadata.get('prompt_text'),
                    'audio_url': event.metadata.get('file_url'),
                    'transcript_text': event.metadata.get('transcript'),
                    'duration_seconds': event.metadata.get('duration'),
                    'created_at': event.timestamp.isoformat(),
                    'assisted': event.metadata.get('assisted', False),
                    'month': event.timestamp.strftime('%Y-%m'),
                    'transcript_word_count': len(event.metadata.get('transcript', '').split()) if event.metadata.get('transcript') else None
                })
        
        # Group by month
        monthly_speaking = {}
        for sample in speaking_samples:
            month = sample['month']
            if month not in monthly_speaking:
                monthly_speaking[month] = []
            monthly_speaking[month].append(sample)
        
        return {
            'all_samples': speaking_samples,
            'samples_by_month': monthly_speaking,
            'total_samples': len(speaking_samples),
            'unassisted_count': sum(1 for s in speaking_samples if not s['assisted']),
            'validation': {
                'minimum_samples_for_scoring': len(speaking_samples) >= 3,
                'samples_count': len(speaking_samples),
                'has_transcripts': sum(1 for s in speaking_samples if s['transcript_text']) if speaking_samples else 0,
                'recommendation': 'Ready for TOEFL speaking estimate' if len(speaking_samples) >= 3 else f'Need {3 - len(speaking_samples)} more samples'
            },
            'note': 'Speaking samples needed for TOEFL iBT and IELTS speaking assessment'
        }
    
    def _build_listening_reading_diagnostics_section(self, user):
        """Listening and reading test results (REQUIRED for TOEIC/TOEFL prediction)."""
        diagnostics = []
        
        # Find all quizzes with listening or reading focus
        test_sessions = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED
        ).select_related('quiz').order_by('-completed_at')[:100]
        
        for session in test_sessions:
            quiz = session.quiz
            quiz_title_lower = quiz.title.lower()
            
            # Determine if listening or reading
            if 'listening' in quiz_title_lower or 'audio' in quiz_title_lower or 'speaking' in quiz_title_lower:
                test_type = 'listening'
            elif 'reading' in quiz_title_lower or 'reading' in quiz_title_lower:
                test_type = 'reading'
            else:
                test_type = 'mixed'
            
            # Check if official TOEIC/TOEFL
            if 'toeic' in quiz_title_lower:
                source = 'toeic'
            elif 'toefl' in quiz_title_lower:
                source = 'toefl'
            elif 'ielts' in quiz_title_lower:
                source = 'ielts'
            else:
                source = 'mock'
            
            diagnostics.append({
                'test_id': str(session.id),
                'quiz_id': quiz.id,
                'quiz_name': quiz.title,
                'test_type': test_type,
                'source': source,  # official/mock/app
                'date': session.completed_at.isoformat() if session.completed_at else None,
                'raw_score': session.correct_count,
                'total_questions': session.total_questions,
                'accuracy': round((session.correct_count / session.total_questions * 100), 2) if session.total_questions > 0 else 0,
                'time_taken_seconds': (session.completed_at - session.started_at).total_seconds() if session.completed_at and session.started_at else None
            })
        
        # Separate listening and reading
        listening_tests = [d for d in diagnostics if d['test_type'] == 'listening']
        reading_tests = [d for d in diagnostics if d['test_type'] == 'reading']
        
        return {
            'all_diagnostics': diagnostics,
            'listening_tests': listening_tests,
            'reading_tests': reading_tests,
            'listening_count': len(listening_tests),
            'reading_count': len(reading_tests),
            'avg_listening_accuracy': round(sum(t['accuracy'] for t in listening_tests) / len(listening_tests), 2) if listening_tests else 0,
            'avg_reading_accuracy': round(sum(t['accuracy'] for t in reading_tests) / len(reading_tests), 2) if reading_tests else 0,
            'validation': {
                'has_listening': len(listening_tests) > 0,
                'has_reading': len(reading_tests) > 0,
                'minimum_for_toeic_prediction': len(listening_tests) >= 1 and len(reading_tests) >= 1,
                'recommendation': 'Ready for TOEIC/TOEFL prediction' if (len(listening_tests) >= 1 and len(reading_tests) >= 1) else 'Complete at least 1 listening and 1 reading diagnostic'
            },
            'note': 'Use listening + reading averages to estimate TOEIC score'
        }
    
    def _build_quiz_attempts_section(self, user):
        """Validated quiz attempts with per-question details (REQUIRED for accurate scoring)."""
        sessions = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED
        ).select_related('quiz').order_by('-completed_at')[:100]
        
        attempts = []
        validation_errors = []
        
        for session in sessions:
            quiz = session.quiz
            
            # Calculate accurate metrics
            time_delta = session.completed_at - session.started_at if (session.completed_at and session.started_at) else None
            active_time_seconds = time_delta.total_seconds() if time_delta else None
            
            incorrect_count = session.total_questions - session.correct_count
            calc_accuracy = round((session.correct_count / session.total_questions * 100), 2) if session.total_questions > 0 else 0
            calc_accuracy = min(calc_accuracy, 100.0)
            
            # Get questions with per-question details
            question_details = self._get_quiz_question_details(user, quiz, session)
            
            # Validation checks
            validation = {
                'accuracy_check': 0 <= calc_accuracy <= 100,
                'sum_check': session.correct_count + incorrect_count == session.total_questions,
                'time_check': active_time_seconds is not None,
                'questions_match': len(question_details) == session.total_questions
            }
            
            if not all(validation.values()):
                validation_errors.append({
                    'quiz_id': quiz.id,
                    'quiz_title': quiz.title,
                    'session_id': str(session.id),
                    'failures': [k for k, v in validation.items() if not v]
                })
            
            attempts.append({
                'attempt_id': str(session.session_id) or str(session.id),
                'quiz_id': quiz.id,
                'quiz_title': quiz.title,
                'subject': quiz.subject.name if quiz.subject else None,
                'difficulty_label': getattr(quiz, 'difficulty_level', None),
                'started_at': session.started_at.isoformat() if session.started_at else None,
                'ended_at': session.completed_at.isoformat() if session.completed_at else None,
                'active_time_seconds': int(active_time_seconds) if active_time_seconds else None,
                'total_questions': session.total_questions,
                'correct_count': session.correct_count,
                'incorrect_count': incorrect_count,
                'skipped_count': 0,  # Would need to track in metadata
                'accuracy': calc_accuracy,
                'questions': question_details,
                'validation': validation
            })
        
        return {
            'attempts': attempts,
            'total_attempts': len(attempts),
            'validation_errors': validation_errors,
            'validation_summary': {
                'all_valid': len(validation_errors) == 0,
                'error_count': len(validation_errors),
                'recommendation': 'All data valid for scoring' if len(validation_errors) == 0 else f'{len(validation_errors)} attempts with data issues'
            },
            'note': 'Each question includes selected_answer, time_spent_ms, and is_correct for detailed analysis'
        }
    
    def _build_vocabulary_signals_section(self, user):
        """Vocabulary level estimates and unknown word logs."""
        vocab_signals = {
            'vocab_test_results': [],
            'unknown_word_logs': [],
            'frequency_profile': {}
        }
        
        # Analyze written notes for vocabulary
        notes = Note.objects.filter(user=user).order_by('-created_at')[:50]
        
        all_words = []
        for note in notes:
            words = note.text.lower().split()
            all_words.extend(words)
        
        # Simple frequency analysis
        from collections import Counter
        if all_words:
            word_freq = Counter(all_words)
            vocab_signals['frequency_profile'] = {
                'total_unique_words': len(word_freq),
                'total_words': len(all_words),
                'lexical_diversity': round(len(word_freq) / len(all_words), 3) if all_words else 0,
                'top_10_words': [{'word': w, 'count': c} for w, c in word_freq.most_common(10)]
            }
        
        # Log unknown words from activity events (if captured)
        unknown_word_events = ActivityEvent.objects.filter(
            user=user,
            event_type__in=['word_clicked', 'word_translated', 'unknown_word_logged']
        ).order_by('-timestamp')[:100]
        
        for event in unknown_word_events:
            if event.metadata:
                vocab_signals['unknown_word_logs'].append({
                    'word': event.metadata.get('word'),
                    'context': event.metadata.get('context'),
                    'logged_at': event.timestamp.isoformat(),
                    'timestamp': event.timestamp
                })
        
        return {
            **vocab_signals,
            'assessment': 'Analyze top_10_words and unknown_word_logs to identify vocabulary gaps',
            'note': 'Lexical diversity > 0.5 indicates good vocabulary range'
        }
    
    def _build_study_behavior_section(self, user):
        """Study sessions, streaks, and learning patterns."""
        # Get activity timeline (limit to 500 most recent)
        activity_events = list(ActivityEvent.objects.filter(user=user).order_by('-timestamp')[:500])
        
        # Group by day for session calculation
        sessions_by_day = {}
        for event in activity_events:
            day = event.timestamp.date()
            if day not in sessions_by_day:
                sessions_by_day[day] = []
            sessions_by_day[day].append(event)
        
        # Calculate streaks and daily stats
        study_days = sorted(sessions_by_day.keys(), reverse=True)
        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        
        for i, day in enumerate(study_days):
            if i == 0:
                current_streak = 1
                temp_streak = 1
            else:
                prev_day = study_days[i - 1]
                if (prev_day - day).days == 1:
                    temp_streak += 1
                    if temp_streak > longest_streak:
                        longest_streak = temp_streak
                else:
                    temp_streak = 1
        
        # Last 30 days activity
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_events = [e for e in activity_events if e.timestamp >= thirty_days_ago]
        active_days_30 = len(set((e.timestamp.date() for e in recent_events)))
        
        return {
            'total_study_days': len(study_days),
            'current_streak_days': current_streak,
            'longest_streak_days': longest_streak,
            'active_days_last_30': active_days_30,
            'avg_daily_activity': round(len(recent_events) / max(active_days_30, 1), 2),
            'sessions': [
                {
                    'date': str(day),
                    'event_count': len(sessions_by_day[day]),
                    'event_types': list(set(e.event_type for e in sessions_by_day[day]))
                }
                for day in sorted(sessions_by_day.keys(), reverse=True)[:30]
            ],
            'note': 'Study consistency correlates with learning outcomes'
        }

        """Determine if quiz is listening, reading, or mixed."""
        questions = quiz.questions.all()
        has_audio = any(q.question_audio for q in questions if hasattr(q, 'question_audio'))
        has_text = any(q.question_text for q in questions)
        
        if has_audio and not has_text:
            return 'listening'
        elif has_text and not has_audio:
            return 'reading'
        elif has_audio and has_text:
            return 'mixed'
        return 'unknown'
    
    def _build_listening_speaking_section(self, user):
        """Listening and speaking evidence for accurate scoring."""
        listening_quizzes = []
        all_sessions = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED
        ).select_related('quiz')
        
        for session in all_sessions:
            quiz = session.quiz
            questions = quiz.questions.all()
            audio_count = sum(1 for q in questions if hasattr(q, 'question_audio') and q.question_audio)
            
            if audio_count > 0:
                listening_quizzes.append({
                    'quiz_id': quiz.id,
                    'quiz_title': quiz.title,
                    'audio_questions': audio_count,
                    'total_questions': session.total_questions,
                    'accuracy': round((session.correct_count / session.total_questions * 100), 2) if session.total_questions > 0 else 0,
                    'completed_at': session.completed_at.isoformat() if session.completed_at else None,
                    'time_seconds': (session.completed_at - session.started_at).total_seconds() if session.completed_at and session.started_at else None
                })
        
        speaking_samples = []
        speaking_events = ActivityEvent.objects.filter(
            user=user,
            event_type__in=['audio_uploaded', 'speaking_recorded', 'voice_message']
        ).order_by('-timestamp')[:50]
        
        for event in speaking_events:
            if event.metadata:
                speaking_samples.append({
                    'recorded_at': event.timestamp.isoformat(),
                    'duration_seconds': event.metadata.get('duration'),
                    'file_url': event.metadata.get('file_url'),
                    'transcript': event.metadata.get('transcript'),
                    'word_count': len(event.metadata.get('transcript', '').split()) if event.metadata.get('transcript') else None,
                    'month': event.timestamp.strftime('%Y-%m')
                })
        
        monthly_speaking = {}
        for sample in speaking_samples:
            month = sample['month']
            if month not in monthly_speaking:
                monthly_speaking[month] = []
            monthly_speaking[month].append(sample)
        
        return {
            'listening_quizzes': listening_quizzes,
            'listening_quiz_count': len(listening_quizzes),
            'avg_listening_accuracy': round(sum(q['accuracy'] for q in listening_quizzes) / len(listening_quizzes), 2) if listening_quizzes else 0,
            'speaking_samples': speaking_samples,
            'speaking_samples_by_month': monthly_speaking,
            'total_speaking_samples': len(speaking_samples),
            'note': 'Listening = quizzes with audio questions; Speaking = recorded audio samples'
        }
    
    def _build_writing_samples_section(self, user):
        """Timed writing samples with AI-assistance flags (REQUIRED for accurate level)."""
        notes = Note.objects.filter(user=user).order_by('-created_at')
        
        writing_samples = []
        for note in notes:
            metadata = note.metadata if hasattr(note, 'metadata') else {}
            
            word_count = len(note.text.split())
            char_count = len(note.text)
            
            writing_samples.append({
                'sample_id': str(note.id),
                'prompt_id': metadata.get('prompt_id'),
                'prompt_text': metadata.get('prompt_text', 'Free writing'),
                'response_text': note.text,
                'created_at': note.created_at.isoformat(),
                'time_limit_seconds': metadata.get('time_limit'),
                'actual_time_seconds': metadata.get('actual_time'),
                'word_count': word_count,
                'char_count': char_count,
                'assisted': metadata.get('ai_assisted', False),  # ← CRITICAL
                'topic_tag': metadata.get('topic_tag'),  # work, daily_life, opinion, etc.
                'difficulty': metadata.get('difficulty'),
                'month': note.created_at.strftime('%Y-%m')
            })
        
        # Sort by date descending, take top 10
        writing_samples.sort(key=lambda x: x['created_at'], reverse=True)
        writing_samples = writing_samples[:50]  # Include more for better assessment
        
        # Separate unassisted for scoring
        unassisted_samples = [s for s in writing_samples if not s['assisted']]
        
        return {
            'all_samples': writing_samples,
            'unassisted_samples': unassisted_samples,
            'unassisted_count': len(unassisted_samples),
            'ai_assisted_count': len([s for s in writing_samples if s['assisted']]),
            'avg_word_count_unassisted': round(sum(s['word_count'] for s in unassisted_samples) / len(unassisted_samples), 1) if unassisted_samples else 0,
            'total_samples': len(writing_samples),
            'note': 'Use unassisted_samples ONLY for level estimation. AI-assisted writing inflates proficiency signals.',
            'validation': {
                'minimum_samples_for_scoring': len(unassisted_samples) >= 3,
                'samples_count': len(unassisted_samples),
                'recommendation': 'Ready for CEFR level estimate' if len(unassisted_samples) >= 3 else f'Need {3 - len(unassisted_samples)} more unassisted samples'
            }
        }
    
    def _build_practice_tests_section(self, user):
        """Sectioned practice test results (TOEIC/TOEFL format)."""
        practice_tests = []
        
        test_sessions = QuizSessionProgress.objects.filter(
            user=user,
            status=QuizSessionProgress.COMPLETED
        ).filter(
            Q(quiz__title__icontains='TOEIC') | 
            Q(quiz__title__icontains='TOEFL') | 
            Q(quiz__title__icontains='Practice Test')
        ).select_related('quiz').distinct()
        
        for session in test_sessions:
            quiz = session.quiz
            questions = quiz.questions.all()
            
            listening_qs = [q for q in questions if hasattr(q, 'question_audio') and q.question_audio]
            reading_qs = [q for q in questions if not (hasattr(q, 'question_audio') and q.question_audio) and q.question_text]
            
            answer_events = ActivityEvent.objects.filter(
                user=user,
                session_id=session.session_id,
                event_type='quiz_answer_submitted'
            )
            
            listening_correct = sum(1 for e in answer_events if e.object_id in [q.id for q in listening_qs] and e.metadata.get('is_correct'))
            reading_correct = sum(1 for e in answer_events if e.object_id in [q.id for q in reading_qs] and e.metadata.get('is_correct'))
            
            practice_tests.append({
                'test_id': quiz.id,
                'test_name': quiz.title,
                'test_type': 'TOEIC' if 'TOEIC' in quiz.title else ('TOEFL' if 'TOEFL' in quiz.title else 'General'),
                'completed_at': session.completed_at.isoformat() if session.completed_at else None,
                'sections': {
                    'listening': {
                        'questions': len(listening_qs),
                        'correct': listening_correct,
                        'accuracy': round((listening_correct / len(listening_qs) * 100), 2) if listening_qs else 0
                    },
                    'reading': {
                        'questions': len(reading_qs),
                        'correct': reading_correct,
                        'accuracy': round((reading_correct / len(reading_qs) * 100), 2) if reading_qs else 0
                    }
                },
                'total_score': session.correct_count,
                'total_questions': session.total_questions,
                'overall_accuracy': round((session.correct_count / session.total_questions * 100), 2) if session.total_questions > 0 else 0,
                'time_seconds': (session.completed_at - session.started_at).total_seconds() if session.completed_at and session.started_at else None
            })
        
        return {
            'practice_tests': practice_tests,
            'total_tests': len(practice_tests),
            'note': 'Sectioned results for TOEIC (Listening/Reading) and TOEFL-style tests'
        }
