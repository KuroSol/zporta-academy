"""
AI-Powered Learning Analytics and Recommendation System
Uses local Python ML libraries to analyze user data and generate suggestions
Reduces API costs by processing data locally before generating recommendations
"""
import logging
import json
from datetime import timedelta
from typing import Dict, List, Optional
from collections import Counter, defaultdict
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

# Try to import analytics libraries (optional dependencies)
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy not available - advanced analytics disabled")

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    logger.warning("Pandas not available - data analysis limited")


class UserLearningAnalyzer:
    """
    Analyzes user's learning patterns using local Python libraries.
    Generates recommendations without expensive LLM API calls.
    """
    
    def __init__(self, user):
        self.user = user
        self.analysis_data = {}
        
    def collect_user_learning_data(self) -> Dict:
        """
        Collect comprehensive learning data from all app sources.
        """
        from dailycast.services_interactive import collect_user_stats
        
        # Get base stats from existing function
        stats = collect_user_stats(self.user)
        
        # Enhanced data collection
        data = {
            'user_id': self.user.id,
            'username': self.user.username,
            'timestamp': timezone.now().isoformat(),
            
            # Course enrollment data
            'enrolled_courses': stats.get('enrolled_courses', []),
            'total_courses': len(stats.get('enrolled_courses', [])),
            
            # Activity data
            'lessons_completed': stats.get('lessons_completed', 0),
            'notes_count': stats.get('notes_count', 0),
            'quizzes_completed': stats.get('quizzes_completed', 0),
            'total_points': stats.get('total_points', 0),
            
            # Time-based activity
            'recent_activity': self._get_recent_activity_summary(),
            
            # Performance metrics
            'quiz_accuracy': self._calculate_quiz_accuracy(),
            'completion_rate': self._calculate_completion_rate(),
            
            # Learning patterns
            'active_days': self._count_active_days(),
            'study_streak': self._calculate_study_streak(),
            'preferred_time': self._detect_preferred_study_time(),
            
            # Weak areas
            'weak_topics': self._identify_weak_topics(),
            'strong_topics': self._identify_strong_topics(),
            
            # Course progress
            'course_progress': self._get_course_progress_details(),
        }
        
        self.analysis_data = data
        return data
    
    def _get_recent_activity_summary(self) -> Dict:
        """Get activity summary for last 7/30 days."""
        try:
            from analytics.models import ActivityEvent
            
            now = timezone.now()
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)
            
            week_events = ActivityEvent.objects.filter(
                user=self.user,
                timestamp__gte=week_ago
            )
            
            month_events = ActivityEvent.objects.filter(
                user=self.user,
                timestamp__gte=month_ago
            )
            
            return {
                'last_7_days': {
                    'total_events': week_events.count(),
                    'lessons': week_events.filter(event_type='lesson_completed').count(),
                    'quizzes': week_events.filter(event_type='quiz_completed').count(),
                },
                'last_30_days': {
                    'total_events': month_events.count(),
                    'lessons': month_events.filter(event_type='lesson_completed').count(),
                    'quizzes': month_events.filter(event_type='quiz_completed').count(),
                }
            }
        except Exception as e:
            logger.warning(f"Could not get recent activity: {e}")
            return {'last_7_days': {}, 'last_30_days': {}}
    
    def _calculate_quiz_accuracy(self) -> float:
        """Calculate average quiz score (percentage of correct answers)."""
        try:
            from analytics.models import QuizAttempt, QuizSessionProgress
            
            # Try to calculate from QuizSessionProgress (more accurate)
            sessions = QuizSessionProgress.objects.filter(
                user=self.user,
                status='completed'
            )
            
            if sessions.exists():
                accuracies = []
                for session in sessions:
                    if session.total_questions > 0:
                        accuracy = (session.correct_count / session.total_questions) * 100
                        accuracies.append(accuracy)
                
                if accuracies:
                    return sum(accuracies) / len(accuracies)
            
            # Fallback: count correct attempts
            total_attempts = QuizAttempt.objects.filter(user=self.user).count()
            if total_attempts == 0:
                return 0.0
            
            correct_attempts = QuizAttempt.objects.filter(user=self.user, is_correct=True).count()
            return (correct_attempts / total_attempts) * 100 if total_attempts > 0 else 0.0
            
        except Exception as e:
            logger.warning(f"Could not calculate quiz accuracy: {e}")
            return 0.0
    
    def _calculate_completion_rate(self) -> float:
        """Calculate course completion rate."""
        try:
            from enrollment.models import Enrollment
            
            enrollments = Enrollment.objects.filter(user=self.user)
            if not enrollments.exists():
                return 0.0
            
            total = enrollments.count()
            completed = enrollments.filter(status='completed').count()
            
            return (completed / total * 100) if total > 0 else 0.0
            
        except Exception as e:
            logger.warning(f"Could not calculate completion rate: {e}")
            return 0.0
    
    def _count_active_days(self) -> int:
        """Count unique days user was active in last 30 days."""
        try:
            from analytics.models import ActivityEvent
            
            thirty_days_ago = timezone.now() - timedelta(days=30)
            events = ActivityEvent.objects.filter(
                user=self.user,
                timestamp__gte=thirty_days_ago
            )
            
            unique_dates = events.values_list('timestamp__date', flat=True).distinct()
            return len(unique_dates)
            
        except Exception as e:
            logger.warning(f"Could not count active days: {e}")
            return 0
    
    def _calculate_study_streak(self) -> int:
        """Calculate current consecutive days of activity."""
        try:
            from analytics.models import ActivityEvent
            
            now = timezone.now()
            streak = 0
            
            for i in range(365):  # Check up to 1 year back
                check_date = (now - timedelta(days=i)).date()
                has_activity = ActivityEvent.objects.filter(
                    user=self.user,
                    timestamp__date=check_date
                ).exists()
                
                if has_activity:
                    streak += 1
                else:
                    break  # Streak broken
            
            return streak
            
        except Exception as e:
            logger.warning(f"Could not calculate streak: {e}")
            return 0
    
    def _detect_preferred_study_time(self) -> str:
        """Detect when user typically studies."""
        try:
            from analytics.models import ActivityEvent
            
            month_ago = timezone.now() - timedelta(days=30)
            events = ActivityEvent.objects.filter(
                user=self.user,
                timestamp__gte=month_ago
            )
            
            hours = [e.timestamp.hour for e in events]
            if not hours:
                return "unknown"
            
            avg_hour = sum(hours) / len(hours)
            
            if 6 <= avg_hour < 12:
                return "morning"
            elif 12 <= avg_hour < 18:
                return "afternoon"
            elif 18 <= avg_hour < 23:
                return "evening"
            else:
                return "night"
                
        except Exception as e:
            logger.warning(f"Could not detect study time: {e}")
            return "unknown"
    
    def _identify_weak_topics(self) -> List[Dict]:
        """Identify topics where user struggles."""
        try:
            from analytics.models import QuizSessionProgress
            from courses.models import Course
            
            # Get completed quiz sessions
            sessions = QuizSessionProgress.objects.filter(
                user=self.user,
                status='completed'
            ).select_related('quiz')
            
            # Group by course/topic and calculate average scores
            topic_scores = defaultdict(list)
            
            for session in sessions:
                if session.total_questions > 0 and session.quiz:
                    accuracy = (session.correct_count / session.total_questions) * 100
                    # Safely get course title
                    topic_name = 'Unknown'
                    if hasattr(session.quiz, 'course') and session.quiz.course:
                        topic_name = session.quiz.course.title if hasattr(session.quiz.course, 'title') else 'Unknown'
                    topic_scores[topic_name].append(accuracy)
            
            # Find topics with scores below 70%
            weak_topics = []
            for topic, scores in topic_scores.items():
                if scores:
                    avg_score = sum(scores) / len(scores)
                    if avg_score < 70:
                        weak_topics.append({
                            'topic': topic,
                            'avg_score': round(avg_score, 1),
                            'attempts': len(scores)
                        })
            
            # Sort by score (weakest first)
            weak_topics.sort(key=lambda x: x['avg_score'])
            return weak_topics[:5]  # Top 5 weak areas
            
        except Exception as e:
            logger.warning(f"Could not identify weak topics: {e}")
            return []
    
    def _identify_strong_topics(self) -> List[Dict]:
        """Identify topics where user excels."""
        try:
            from analytics.models import QuizSessionProgress
            from courses.models import Course
            
            # Get completed quiz sessions
            sessions = QuizSessionProgress.objects.filter(
                user=self.user,
                status='completed'
            ).select_related('quiz')
            
            topic_scores = defaultdict(list)
            
            for session in sessions:
                if session.total_questions > 0 and session.quiz:
                    accuracy = (session.correct_count / session.total_questions) * 100
                    # Safely get course title
                    topic_name = 'Unknown'
                    if hasattr(session.quiz, 'course') and session.quiz.course:
                        topic_name = session.quiz.course.title if hasattr(session.quiz.course, 'title') else 'Unknown'
                    topic_scores[topic_name].append(accuracy)
            
            # Find topics with scores above 85%
            strong_topics = []
            for topic, scores in topic_scores.items():
                if scores:
                    avg_score = sum(scores) / len(scores)
                    if avg_score >= 85:
                        strong_topics.append({
                            'topic': topic,
                            'avg_score': round(avg_score, 1),
                            'attempts': len(scores)
                        })
            
            # Sort by score (strongest first)
            strong_topics.sort(key=lambda x: x['avg_score'], reverse=True)
            return strong_topics[:5]
            
        except Exception as e:
            logger.warning(f"Could not identify strong topics: {e}")
            return []
    
    def _get_course_progress_details(self) -> List[Dict]:
        """Get detailed progress for each enrolled course."""
        try:
            from enrollment.models import Enrollment
            from lessons.models import LessonCompletion
            
            enrollments = Enrollment.objects.filter(user=self.user)
            
            progress_list = []
            for enrollment in enrollments:
                # Get the course from the generic foreign key
                course = enrollment.content_object
                
                # Only process if this is a course enrollment
                if not hasattr(course, 'lessons'):
                    continue
                
                # Count lessons in course
                total_lessons = course.lessons.count()
                
                # Count completed lessons
                completed_lessons = LessonCompletion.objects.filter(
                    user=self.user,
                    lesson__course=course
                ).count() if total_lessons > 0 else 0
                
                progress_pct = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
                
                progress_list.append({
                    'course_id': course.id,
                    'course_title': getattr(course, 'title', str(course)),
                    'total_lessons': total_lessons,
                    'completed_lessons': completed_lessons,
                    'progress_percent': round(progress_pct, 1),
                    'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None
                })
            
            return progress_list
            
        except Exception as e:
            logger.warning(f"Could not get course progress: {e}")
            return []
    
    def generate_recommendations(self) -> Dict:
        """
        Generate personalized study recommendations using local analytics.
        This minimizes LLM API calls by pre-processing data.
        Creates human-readable, subject-specific suggestions.
        """
        if not self.analysis_data:
            self.collect_user_learning_data()
        
        recommendations = {
            'priority_actions': [],
            'suggested_courses': [],
            'study_tips': [],
            'next_steps': []
        }
        
        # Analyze weak areas with detailed, actionable advice
        weak_topics = self.analysis_data.get('weak_topics', [])
        if weak_topics:
            for topic in weak_topics[:3]:  # Top 3 weak areas
                topic_name = topic['topic']
                score = topic['avg_score']
                
                # Generate subject-specific advice
                advice = self._generate_topic_advice(topic_name, score, 'weak')
                recommendations['priority_actions'].append(advice)
        
        # Celebrate strong areas and suggest advancement
        strong_topics = self.analysis_data.get('strong_topics', [])
        if strong_topics:
            for topic in strong_topics[:2]:  # Top 2 strong areas
                topic_name = topic['topic']
                score = topic['avg_score']
                
                advice = self._generate_topic_advice(topic_name, score, 'strong')
                recommendations['priority_actions'].append(advice)
        
        # Check study consistency
        active_days = self.analysis_data.get('active_days', 0)
        if active_days < 7:
            recommendations['study_tips'].append({
                'type': 'consistency',
                'message': f"You studied {active_days} days this month. Research shows 15+ days leads to 3x better retention!",
                'suggestion': "Set a daily 15-minute study alarm. Even small, consistent practice builds mastery."
            })
        elif active_days >= 15:
            recommendations['study_tips'].append({
                'type': 'consistency',
                'message': f"Amazing! You studied {active_days} days this month. You're in the top 10% of learners!",
                'suggestion': "Keep this momentum going - consistency is your superpower!"
            })
        
        # Check completion rate
        completion_rate = self.analysis_data.get('completion_rate', 0)
        if completion_rate < 30:
            recommendations['study_tips'].append({
                'type': 'completion',
                'message': f"Your course completion rate is {completion_rate:.1f}%. Focus beats variety.",
                'suggestion': "Choose ONE course to finish this month. Completing courses boosts confidence and solidifies learning."
            })
        elif completion_rate >= 70:
            recommendations['study_tips'].append({
                'type': 'completion',
                'message': f"Excellent {completion_rate:.1f}% completion rate! You finish what you start.",
                'suggestion': "You're a finisher! Share your study strategy with others."
            })
        
        # Quiz performance feedback
        quiz_accuracy = self.analysis_data.get('quiz_accuracy', 0)
        if quiz_accuracy > 0:
            if quiz_accuracy < 60:
                recommendations['study_tips'].append({
                    'type': 'quiz_strategy',
                    'message': f"{quiz_accuracy:.1f}% quiz accuracy suggests rushing or need for review.",
                    'suggestion': "Try the 'Learn-Review-Test' method: Study material, review your notes next day, then take quiz."
                })
            elif quiz_accuracy >= 85:
                recommendations['study_tips'].append({
                    'type': 'quiz_strategy',
                    'message': f"Outstanding {quiz_accuracy:.1f}% quiz accuracy! You truly understand the material.",
                    'suggestion': "Ready for advanced challenges? Consider teaching concepts to others to cement mastery."
                })
        
        # Suggest next courses based on strong areas
        if strong_topics:
            recommendations['suggested_courses'] = self._suggest_related_courses(strong_topics)
        
        # Generate next steps based on current progress
        recommendations['next_steps'] = self._generate_next_steps()
        
        return recommendations
    
    def _generate_topic_advice(self, topic_name: str, score: float, strength_type: str) -> str:
        """
        Generate human-readable, subject-specific advice for a topic.
        
        Args:
            topic_name: Name of the subject/topic
            score: Performance score (0-100)
            strength_type: 'weak' or 'strong'
        """
        topic_lower = topic_name.lower()
        
        # Subject-specific recommendations
        if strength_type == 'weak':
            if 'english' in topic_lower or 'language' in topic_lower:
                return f"📚 English ({score}%): Practice daily conversation! Try narrating your day in English, watch English shows with subtitles, and read for 15 mins daily."
            elif 'math' in topic_lower or 'algebra' in topic_lower or 'calculus' in topic_lower:
                return f"🔢 {topic_name} ({score}%): Math needs practice, not just study. Solve 5 problems daily, review mistakes carefully, use Khan Academy for concept gaps."
            elif 'science' in topic_lower or 'biology' in topic_lower or 'chemistry' in topic_lower or 'physics' in topic_lower:
                return f"🔬 {topic_name} ({score}%): Science is about understanding 'why'. Watch visual explanations, do virtual labs, explain concepts out loud to yourself."
            elif 'history' in topic_lower or 'social' in topic_lower:
                return f"📜 {topic_name} ({score}%): Create timelines, connect events to stories, watch documentaries. History is storytelling with facts!"
            elif 'programming' in topic_lower or 'code' in topic_lower or 'computer' in topic_lower:
                return f"💻 {topic_name} ({score}%): Code daily! Build small projects, debug actively, type code (don't copy-paste). Practice makes programmers."
            else:
                return f"⚠️ {topic_name} ({score}%): This needs focused attention. Review fundamentals, practice with examples, take notes in your own words."
        else:  # strong
            if 'english' in topic_lower or 'language' in topic_lower:
                return f"🌟 {topic_name} ({score}%): You're fluent! Challenge yourself with literature, creative writing, or help others learn. Teach to master!"
            elif 'math' in topic_lower or 'algebra' in topic_lower or 'calculus' in topic_lower:
                return f"🌟 {topic_name} ({score}%): Math genius! Try competition problems, explore advanced topics, or tutor peers. Share your logical thinking!"
            elif 'science' in topic_lower:
                return f"🌟 {topic_name} ({score}%): Science superstar! Dive into research papers, conduct experiments, explore specialized fields. You have scientist potential!"
            elif 'programming' in topic_lower or 'code' in topic_lower:
                return f"🌟 {topic_name} ({score}%): Coding pro! Build real projects, contribute to open source, mentor beginners. Transform knowledge to creation!"
            else:
                return f"💪 {topic_name} ({score}%): Excellent mastery! Help others learn this, explore advanced concepts, or apply skills to real projects."
    
    def _suggest_related_courses(self, strong_topics: List[Dict]) -> List[Dict]:
        """Suggest courses related to user's strong areas."""
        try:
            from courses.models import Course
            
            suggestions = []
            
            for strong_topic in strong_topics[:3]:  # Top 3 strong areas
                topic_name = strong_topic['topic']
                
                # Find courses related to this topic (not already enrolled)
                # Get enrolled course IDs first
                from courses.models import Course
                from enrollment.models import Enrollment
                from django.contrib.contenttypes.models import ContentType
                
                course_content_type = ContentType.objects.get_for_model(Course)
                enrolled_course_ids = Enrollment.objects.filter(
                    user=self.user,
                    content_type=course_content_type,
                    enrollment_type='course'
                ).values_list('object_id', flat=True)
                
                related_courses = Course.objects.filter(
                    title__icontains=topic_name.split()[0]  # Match first word
                ).exclude(
                    id__in=enrolled_course_ids
                )[:3]
                
                for course in related_courses:
                    suggestions.append({
                        'course_id': course.id,
                        'course_title': course.title,
                        'reason': f"You excel at {topic_name} ({strong_topic['avg_score']}%)",
                        'difficulty': getattr(course, 'difficulty', 'intermediate')
                    })
            
            return suggestions[:5]  # Top 5 suggestions
            
        except Exception as e:
            logger.warning(f"Could not suggest courses: {e}")
            return []
    
    def _generate_next_steps(self) -> List[str]:
        """Generate actionable next steps."""
        steps = []
        
        course_progress = self.analysis_data.get('course_progress', [])
        
        # Find courses in progress
        in_progress = [c for c in course_progress if 0 < c['progress_percent'] < 100]
        
        if in_progress:
            # Sort by progress (highest first)
            in_progress.sort(key=lambda x: x['progress_percent'], reverse=True)
            top_course = in_progress[0]
            remaining = top_course['total_lessons'] - top_course['completed_lessons']
            
            steps.append(f"Complete {top_course['course_title']} - only {remaining} lessons left!")
        
        # Check for weak areas needing practice
        weak_topics = self.analysis_data.get('weak_topics', [])
        if weak_topics:
            steps.append(f"Practice {weak_topics[0]['topic']} - retake quizzes to improve from {weak_topics[0]['avg_score']}%")
        
        # Encourage consistency
        streak = self.analysis_data.get('study_streak', 0)
        if streak > 0:
            steps.append(f"Maintain your {streak}-day study streak! Study today to keep it going.")
        else:
            steps.append("Start a study streak - study for at least 15 minutes today!")
        
        return steps
    
    def save_analysis_report(self, include_recommendations: bool = True) -> str:
        """
        Save analysis and recommendations to a JSON file for admin review.
        Returns the file path.
        """
        if not self.analysis_data:
            self.collect_user_learning_data()
        
        # Create reports directory
        reports_dir = Path(settings.MEDIA_ROOT) / 'ai_analytics_reports'
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        filename = f"user_{self.user.id}_{self.user.username}_{timestamp}.json"
        filepath = reports_dir / filename
        
        # Prepare report data
        report = {
            'metadata': {
                'user_id': self.user.id,
                'username': self.user.username,
                'email': self.user.email,
                'report_generated_at': timezone.now().isoformat(),
                'analysis_version': '1.0'
            },
            'learning_data': self.analysis_data,
        }
        
        if include_recommendations:
            report['recommendations'] = self.generate_recommendations()
        
        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"📊 Saved AI analysis report for user {self.user.username} to {filepath}")
        
        return str(filepath)


def analyze_user_and_generate_feedback(user, ai_model: str = None) -> Dict:
    """
    Main function to analyze user and generate comprehensive feedback.
    
    Args:
        user: User object to analyze
        ai_model: Optional AI model to use for deeper analysis
                 (e.g., 'gemini-2.0-flash-exp', 'gpt-4o-mini')
    
    Returns both analysis data and recommendations.
    """
    analyzer = UserLearningAnalyzer(user)
    
    # Collect all data (including notes)
    analysis_data = analyzer.collect_user_learning_data()
    
    # Generate recommendations locally (no API calls)
    recommendations = analyzer.generate_recommendations()
    
    # If AI model specified, enhance with AI analysis
    if ai_model:
        try:
            logger.info(f"🤖 Running AI analysis with model: {ai_model}")
            ai_insights = _run_ai_deep_analysis(user, analysis_data, ai_model)
            recommendations['ai_insights'] = ai_insights
            logger.info(f"✅ AI analysis complete")
        except Exception as e:
            logger.exception(f"AI analysis failed: {e}")
            recommendations['ai_insights'] = {
                'error': str(e),
                'message': 'AI analysis unavailable - using local analysis only'
            }
    
    # Save report for admin review
    report_path = analyzer.save_analysis_report(include_recommendations=True)
    
    return {
        'success': True,
        'analysis': analysis_data,
        'recommendations': recommendations,
        'report_path': report_path,
        'message': 'Analysis complete - report saved for admin review'
    }


def _run_ai_deep_analysis(user, analysis_data: Dict, ai_model: str, subject: str = '', target_language: str = 'English') -> Dict:
    """
    Use AI to provide COMPREHENSIVE, DETAILED insights about user's learning patterns.
    
    Analyzes: quiz difficulty distribution, vocabulary gaps, grammar weaknesses,
    specific question types user struggles with, and provides detailed actionable guidance.
    
    Args:
        user: User object to analyze
        analysis_data: Dictionary containing user analytics
        ai_model: AI model to use (e.g., 'gemini-2.0-flash-exp', 'gpt-4o-mini')
        subject: Optional subject to focus analysis on (e.g., 'Math', 'English')
    
    Returns:
        Dictionary with detailed guidance, resources, and quiz recommendations
    """
    import google.generativeai as genai
    from django.conf import settings
    from users.models import UserPreference
    from users.activity_models import UserActivity
    
    logger.info(f"Starting comprehensive AI analysis for user {user.id} with model {ai_model}, subject={subject}, language={target_language}")
    
    # Gather user notes WITH IDs and dates for reference linking
    from notes.models import Note
    user_notes = Note.objects.filter(user=user).order_by('-created_at')[:50]
    
    # Format notes with metadata for AI to reference
    notes_with_metadata = []
    for note in user_notes:
        if note.text:
            notes_with_metadata.append({
                'id': note.id,
                'date': note.created_at.strftime('%Y-%m-%d'),
                'text': note.text[:500]  # Increased for better context
            })
    
    # Build structured notes text for prompt
    notes_text = "\n".join([
        f"[Note ID: {n['id']}, Date: {n['date']}]\n{n['text']}\n"
        for n in notes_with_metadata
    ])
    notes_summary = f"User has written {len(user_notes)} notes" if user_notes else "No notes available"
    
    # Gather quiz difficulty analysis
    try:
        from analytics.models import QuizSessionProgress
        
        difficulty_distribution = defaultdict(list)
        for session in QuizSessionProgress.objects.filter(user=user, status='completed')[:50]:
            if session.total_questions > 0:
                accuracy = (session.correct_count / session.total_questions) * 100
                difficulty = getattr(session.quiz, 'difficulty', 'unknown')
                difficulty_distribution[difficulty].append({
                    'accuracy': accuracy,
                    'total_questions': session.total_questions,
                    'correct_count': session.correct_count
                })
        
        difficulty_analysis = {}
        for level, attempts in difficulty_distribution.items():
            avg_acc = sum([a['accuracy'] for a in attempts]) / len(attempts)
            difficulty_analysis[level] = {
                'attempts': len(attempts),
                'average_accuracy': round(avg_acc, 1),
                'status': 'Strong' if avg_acc >= 80 else 'Developing' if avg_acc >= 60 else 'Needs Work'
            }
    except Exception as e:
        logger.warning(f"Could not analyze difficulty distribution: {e}")
        difficulty_analysis = {}
    
    # Gather user preferences
    interested_subjects_str = ""
    interested_tags_str = ""
    try:
        user_pref = UserPreference.objects.prefetch_related(
            'interested_subjects', 
            'interested_tags'
        ).get(user=user)
        interested_subjects = user_pref.interested_subjects.all()
        interested_tags = user_pref.interested_tags.all()
        
        if interested_subjects.exists():
            interested_subjects_str = ", ".join([s.name for s in interested_subjects])
        if interested_tags.exists():
            interested_tags_str = ", ".join([t.name for t in interested_tags])
    except:
        interested_subjects_str = "Not specified"
        interested_tags_str = "Not specified"
    
    # Gather recent user activity
    activity_summary = ""
    try:
        recent_activities = UserActivity.objects.filter(user=user).order_by('-created_at')[:10]
        if recent_activities.exists():
            activity_lines = []
            for activity in recent_activities:
                activity_label = activity.get_activity_type_display() if hasattr(activity, 'get_activity_type_display') else activity.activity_type
                activity_lines.append(f"- {activity_label} ({activity.created_at.strftime('%Y-%m-%d')})")
            activity_summary = "\n".join(activity_lines)
        else:
            activity_summary = "No recent activity recorded"
    except Exception as e:
        activity_summary = "Activity data unavailable"
    
    # Filter analysis data by subject if specified
    weak_topics = analysis_data.get('weak_topics', [])
    strong_topics = analysis_data.get('strong_topics', [])
    
    if subject:
        weak_topics = [t for t in weak_topics if subject.lower() in t.get('topic', '').lower()]
        strong_topics = [t for t in strong_topics if subject.lower() in t.get('topic', '').lower()]
        subject_focus = f"FOCUS AREA: {subject}"
    else:
        subject_focus = "Analyze all subjects and areas"
    
    # Build COMPREHENSIVE analysis prompt (refined for concrete analytics)
    prompt = f"""You are an expert educational psychologist and learning specialist. Analyze this student's learning profile comprehensively and provide DETAILED, ACTIONABLE guidance with CONCRETE, MEASURABLE analytics and examples.

Communicate ALL explanations and output in the user's preferred main language: {target_language}.

{subject_focus}

=== STUDENT PROFILE ===
Name: {user.get_full_name() or user.username}
Email: {user.email}
Interested Subjects: {interested_subjects_str}
Learning Interests/Tags: {interested_tags_str}

=== LEARNING STATISTICS ===
📊 Overall Performance:
- Total Courses Enrolled: {analysis_data.get('total_courses', 0)}
- Lessons Completed: {analysis_data.get('lessons_completed', 0)}
- Total Quizzes Taken: {analysis_data.get('quizzes_completed', 0)}
- Overall Quiz Accuracy: {analysis_data.get('quiz_accuracy', 0):.1f}%
- Study Streak: {analysis_data.get('study_streak', 0)} consecutive days
- Active Days (Last 30): {analysis_data.get('active_days', 0)} days
- Notes Written: {analysis_data.get('notes_count', 0)} notes
{notes_summary}

=== DIFFICULTY LEVEL ANALYSIS ===
{chr(10).join([f"Level '{level}': {data['attempts']} attempts, {data['average_accuracy']:.1f}% accuracy ({data['status']})" for level, data in difficulty_analysis.items()]) if difficulty_analysis else "No difficulty data available"}

=== WEAK AREAS (NEEDS FOCUS) ===
{chr(10).join([f"- {t['topic']}: {t['avg_score']}% (attempted {t['attempts']} times)" for t in weak_topics[:5]]) if weak_topics else "- No significant weak areas identified"}

=== STRONG AREAS (MASTERY) ===
{chr(10).join([f"- {t['topic']}: {t['avg_score']}% accuracy (attempted {t['attempts']} times)" for t in strong_topics[:5]]) if strong_topics else "- Continue building strong foundations"}

=== RECENT LEARNING ACTIVITY ===
{activity_summary}

=== USER'S ACTUAL NOTES (with IDs for reference) ===
{notes_text if notes_text else "No notes available"}

=== YOUR TASK: PROVIDE DATA-DRIVEN LEARNING GUIDE ===

CRITICAL RULES:
1. BASE ALL ANALYSIS ON USER'S REAL DATA ONLY - Do NOT invent generic examples
2. For grammar_analysis: Extract EXACT mistakes from the notes above. Include note_id and date for each example.
3. For quiz_recommendations: If quiz data exists, recommend specific quiz topics from weak areas. Otherwise say "Insufficient quiz data - complete more quizzes first"
4. For external_resources: Only recommend if you can justify based on their level/interests. If insufficient data, say "Complete more lessons to get personalized recommendations"
5. If notes count is less than 5, say "Write more notes for detailed grammar analysis"

REQUIRED ANALYTICS FROM REAL DATA:

• Grammar from Notes: Scan all notes above. Find repeated grammar mistakes (articles, verb tense, subject-verb agreement, prepositions). For each mistake:
  - Quote the EXACT wrong sentence from a note
  - Provide the note_id and date
  - Show the correction
  - Count how many times this pattern appears
  - If no mistakes found or too few notes, say "Insufficient notes for grammar analysis - write 10+ notes first"

• Quiz-Based Recommendations: From weak_topics and quiz accuracy data:
  - Recommend SPECIFIC quiz topics the user failed (below 70%)
  - Link to actual quiz IDs if available
  - If no quiz data, say "No quiz data available - take quizzes to get recommendations"

• Resource Justification: Only suggest books/movies/websites if you can explain WHY based on their:
  - Current level (from quiz accuracy)
  - Interested subjects
  - Specific weak areas
  - If insufficient data, say "Complete more activities for personalized resources"

Analyze this student deeply and provide a JSON response with ALL of the following sections:

1. **assessment**: Current learning level, strengths/weaknesses summary
2. **vocabulary_gaps**: Specific vocabulary weaknesses (with examples of unknown words they might encounter at their level)
3. **grammar_analysis**: 
   - Weak grammar areas: MUST include note_id, date, original_text, correction for EACH example from real notes
   - If insufficient notes, return: {{"message": "Write 10+ notes for detailed grammar analysis"}}
   - Strong grammar areas (only if you find correct patterns in notes)
4. **quiz_recommendations**: Specific quiz titles/topics they should practice next
5. **difficulty_progression**: What difficulty level they should focus on next and why
6. **external_resources**: 
   - Book recommendations (specific titles, authors, why suitable)
   - Movie/show recommendations (with subtitle watching strategies)
   - Grammar guides and websites (specific resources)
   - Practice websites (specific tools)
7. **study_guide**: 
   - Exact weekly study plan (breakdown by topic)
   - Daily practice recommendations
   - Time needed per week
8. **learning_journey**: 
   - Current stage
   - Next 3 milestones
   - Long-term progression path
9. **exam_level_predictions**: CRITICAL - Predict their current English level
   - CEFR band (A1, A2, B1, B2, C1, C2)
   - TOEIC score range (e.g., "650-750")
   - TOEFL score range (e.g., "75-85")
   - IELTS band (e.g., "6.5")
   - Confidence level in predictions
10. **specific_actions**: 
   - Today's action (15 min)
   - This week's focus (5-7 days)
   - This month's goals
10. **potential_struggles**: What might they NOT know at their current level and why?

CRITICAL: Make this HIGHLY SPECIFIC to this student's profile, subject interests ({interested_subjects_str}), and performance data. Include:
- Exact quiz names/topics to practice
- Specific books/movies that match their level and interests
- Grammar rules with concrete examples from their difficulty level
- Clear progression path with measurable milestones
- Vocabulary you estimate they DON'T know yet at this level

Return ONLY valid JSON in {target_language} with these keys:
{{
  "assessment": {{...}},
  "vocabulary_gaps": {{...}},
  "grammar_analysis": {{
    "weak_areas": [
      {{
        "error_type": "...",
        "frequency": 0,
        "examples": [
          {{
            "note_id": 123,
            "note_date": "2025-12-11",
            "original": "...",
            "corrected": "...",
            "rule": "..."
          }}
        ]
      }}
    ],
    "strong_areas": [...],
    "insufficient_data": false
  }},
  "quiz_recommendations": [
    {{
      "topic": "...",
      "reason": "Based on quiz accuracy: X% on topic Y",
      "quiz_link": "/quizzes/123" OR "insufficient_quiz_data": true
    }}
  ],
  "difficulty_progression": {{...}},
  "external_resources": {{
    "books": [{{"title": "...", "author": "...", "reason": "Based on your level/interests: ..."}}],
    "movies": [{{"title": "...", "strategy": "...", "reason": "..."}}],
    "websites": [{{"name": "...", "url": "...", "reason": "..."}}],
    "insufficient_data": false
  }},
  "study_guide": {{...}},
  "learning_journey": {{...}},
  "exam_level_predictions": {{
    "cefr_band": "B2",
    "toeic_range": "650-750",
    "toefl_range": "75-85",
    "ielts_band": "6.5",
    "confidence": "medium",
    "reasoning": "Based on quiz accuracy of X%, vocabulary size of Y, and grammar proficiency"
  }},
  "specific_actions": {{...}},
  "potential_struggles": {{...}},
    "notes_error_analysis": [
        {{"error": "...", "frequency": 0, "examples": ["wrong → correct"], "rule": "..."}}
    ],
    "quiz_speed_guidance": {{"avg_time_sec": 0, "avg_accuracy": 0.0, "recommendation": "...", "exercise": "..."}},
    "lesson_style_recommendations": {{"style": "...", "suggested_tags": ["..."], "stretch_tags": ["..."]}},
    "vocab_growth_plan": [
        {{"word": "...", "cefr": "B1", "definition": "...", "sentence": "..."}}
    ],
    "error_to_action": [
        {{"error": "...", "micro_drill": "2 min ...", "daily_habit": "10 min ..."}}
    ],
  "summary": "2-3 paragraph executive summary"
}}
"""
    
    # Call AI model
    token_usage = {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}
    try:
        if ai_model.startswith('gemini'):
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(ai_model)
            logger.info(f"Calling Gemini model: {ai_model}")
            response = model.generate_content(prompt)
            result_text = response.text
            
            # Extract actual token usage from Gemini API response
            if hasattr(response, 'usage_metadata'):
                token_usage['input_tokens'] = getattr(response.usage_metadata, 'prompt_token_count', 0)
                token_usage['output_tokens'] = getattr(response.usage_metadata, 'candidates_token_count', 0)
                token_usage['total_tokens'] = getattr(response.usage_metadata, 'total_token_count', 0)
                logger.info(f"Gemini token usage: {token_usage['total_tokens']} total ({token_usage['input_tokens']} input + {token_usage['output_tokens']} output)")
            
        elif ai_model.startswith('gpt'):
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info(f"Calling OpenAI model: {ai_model}")
            response = client.chat.completions.create(
                model=ai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=4000  # Increased for comprehensive response
            )
            result_text = response.choices[0].message.content
            
            # Extract actual token usage from OpenAI API response
            if hasattr(response, 'usage'):
                token_usage['input_tokens'] = response.usage.prompt_tokens
                token_usage['output_tokens'] = response.usage.completion_tokens
                token_usage['total_tokens'] = response.usage.total_tokens
                logger.info(f"OpenAI token usage: {token_usage['total_tokens']} total ({token_usage['input_tokens']} input + {token_usage['output_tokens']} output)")
        else:
            raise ValueError(f"Unsupported AI model: {ai_model}")
        
        logger.info(f"AI response received, length: {len(result_text)} characters")
        
        # Parse JSON response
        import json
        import re
        # Extract JSON from markdown code blocks if present
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', result_text, re.DOTALL)
        if json_match:
            result_text = json_match.group(1)
        
        ai_insights = json.loads(result_text)
        logger.info(f"Successfully parsed comprehensive AI insights with {len(ai_insights)} sections")
        
        # Include token usage in the response
        ai_insights['_token_usage'] = token_usage
        ai_insights['_model_used'] = ai_model
        
        return ai_insights
        
    except Exception as e:
        logger.exception(f"Error during comprehensive AI analysis with model {ai_model}: {e}")
        # Return a safe fallback response
        return {
            'summary': 'Unable to generate detailed AI insights at this time.',
            'assessment': {'error': str(e)},
            'vocabulary_gaps': [],
            'grammar_analysis': {},
            'quiz_recommendations': [],
            'difficulty_progression': {},
            'external_resources': {},
            'study_guide': {},
            'learning_journey': {},
            'specific_actions': {},
            'potential_struggles': [],
            'error': str(e)
        }


def generate_personalized_script_with_ai_context(user, selected_items: List[Dict], form_data: Dict) -> str:
    """
    Generate script that includes:
    1. User's learning context (courses, progress, weak areas)
    2. Selected course materials
    3. AI recommendations integrated naturally
    
    This combines user data analysis with script generation for maximum personalization.
    """
    # Analyze user's learning patterns
    analyzer = UserLearningAnalyzer(user)
    analysis = analyzer.collect_user_learning_data()
    recommendations = analyzer.generate_recommendations()
    
    # Build context-rich prompt
    context = f"""
USER LEARNING PROFILE:
- Total Courses: {analysis['total_courses']}
- Completed Lessons: {analysis['lessons_completed']}
- Quiz Accuracy: {analysis['quiz_accuracy']:.1f}%
- Study Streak: {analysis['study_streak']} days
- Active Days (30d): {analysis['active_days']}

ENROLLED COURSES:
{chr(10).join([f"  • {c['title']}" for c in analysis['enrolled_courses'][:5]])}

SELECTED MATERIALS FOR THIS PODCAST:
{chr(10).join([f"  • {item['type'].capitalize()}: {item['name']}" for item in selected_items])}

WEAK AREAS TO ADDRESS:
{chr(10).join([f"  • {w['topic']} ({w['avg_score']}%)" for w in analysis.get('weak_topics', [])[:3]])}

STRONG AREAS TO BUILD ON:
{chr(10).join([f"  • {s['topic']} ({s['avg_score']}%)" for s in analysis.get('strong_topics', [])[:3]])}

AI RECOMMENDATIONS:
{chr(10).join([f"  • {step}" for step in recommendations.get('next_steps', [])[:3]])}
"""
    
    return context


def get_all_user_reports(user=None) -> List[Dict]:
    """
    Get list of all saved AI analysis reports.
    Useful for admin to review all analyses.
    """
    reports_dir = Path(settings.MEDIA_ROOT) / 'ai_analytics_reports'
    
    if not reports_dir.exists():
        return []
    
    reports = []
    
    for json_file in reports_dir.glob('*.json'):
        try:
            # Parse filename: user_ID_USERNAME_TIMESTAMP.json
            parts = json_file.stem.split('_')
            
            # Load report metadata
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            report_info = {
                'filename': json_file.name,
                'filepath': str(json_file),
                'user_id': data['metadata']['user_id'],
                'username': data['metadata']['username'],
                'generated_at': data['metadata']['report_generated_at'],
                'file_size': json_file.stat().st_size,
            }
            
            # Filter by user if specified
            if user and report_info['user_id'] != user.id:
                continue
            
            reports.append(report_info)
            
        except Exception as e:
            logger.warning(f"Could not parse report {json_file}: {e}")
    
    # Sort by date (newest first)
    reports.sort(key=lambda x: x['generated_at'], reverse=True)
    
    return reports
