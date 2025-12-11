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
        """Calculate average quiz score."""
        try:
            from quizzes.models import QuizAttempt
            
            attempts = QuizAttempt.objects.filter(user=self.user)
            if not attempts.exists():
                return 0.0
            
            scores = [a.score_percentage for a in attempts if hasattr(a, 'score_percentage')]
            return sum(scores) / len(scores) if scores else 0.0
            
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
            completed = enrollments.filter(completed=True).count()
            
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
            from quizzes.models import QuizAttempt
            
            attempts = QuizAttempt.objects.filter(user=self.user).select_related('quiz')
            
            # Group by course/topic and calculate average scores
            topic_scores = defaultdict(list)
            
            for attempt in attempts:
                if hasattr(attempt, 'score_percentage'):
                    topic = attempt.quiz.course.title if hasattr(attempt.quiz, 'course') else 'Unknown'
                    topic_scores[topic].append(attempt.score_percentage)
            
            # Find topics with scores below 70%
            weak_topics = []
            for topic, scores in topic_scores.items():
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
            from quizzes.models import QuizAttempt
            
            attempts = QuizAttempt.objects.filter(user=self.user).select_related('quiz')
            
            topic_scores = defaultdict(list)
            
            for attempt in attempts:
                if hasattr(attempt, 'score_percentage'):
                    topic = attempt.quiz.course.title if hasattr(attempt.quiz, 'course') else 'Unknown'
                    topic_scores[topic].append(attempt.score_percentage)
            
            # Find topics with scores above 85%
            strong_topics = []
            for topic, scores in topic_scores.items():
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
            from lessons.models import LessonProgress
            
            enrollments = Enrollment.objects.filter(user=self.user).select_related('course')
            
            progress_list = []
            for enrollment in enrollments:
                course = enrollment.course
                
                # Count lessons in course
                total_lessons = course.lessons.count() if hasattr(course, 'lessons') else 0
                
                # Count completed lessons
                completed_lessons = LessonProgress.objects.filter(
                    user=self.user,
                    lesson__course=course,
                    completed=True
                ).count() if total_lessons > 0 else 0
                
                progress_pct = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
                
                progress_list.append({
                    'course_id': course.id,
                    'course_title': course.title,
                    'total_lessons': total_lessons,
                    'completed_lessons': completed_lessons,
                    'progress_percent': round(progress_pct, 1),
                    'enrollment_date': enrollment.enrolled_at.isoformat() if hasattr(enrollment, 'enrolled_at') else None
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
                related_courses = Course.objects.filter(
                    title__icontains=topic_name.split()[0]  # Match first word
                ).exclude(
                    enrollments__user=self.user
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


def analyze_user_and_generate_feedback(user) -> Dict:
    """
    Main function to analyze user and generate comprehensive feedback.
    Returns both analysis data and recommendations.
    """
    analyzer = UserLearningAnalyzer(user)
    
    # Collect all data
    analysis_data = analyzer.collect_user_learning_data()
    
    # Generate recommendations locally (no API calls)
    recommendations = analyzer.generate_recommendations()
    
    # Save report for admin review
    report_path = analyzer.save_analysis_report(include_recommendations=True)
    
    return {
        'success': True,
        'analysis': analysis_data,
        'recommendations': recommendations,
        'report_path': report_path,
        'message': 'Analysis complete - report saved for admin review'
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
