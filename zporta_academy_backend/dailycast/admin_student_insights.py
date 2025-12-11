"""
Student Learning Insights Admin Interface
Provides human-readable AI analysis for each student.
"""
import logging
import json
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.utils.safestring import mark_safe
from django.urls import path
from django.shortcuts import render
from django.db.models import Count, Avg, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from datetime import timedelta

from dailycast.ai_analyzer import UserLearningAnalyzer, analyze_user_and_generate_feedback, _run_ai_deep_analysis
from dailycast.models import CachedAIInsight, CachedUserAnalytics, CacheStatistics
from enrollment.models import Enrollment

User = get_user_model()
logger = logging.getLogger(__name__)


from django.db import models

class StudentLearningInsight(models.Model):
    """
    Proxy model for displaying student insights in admin.
    This is not a real database model, just a container for admin display.
    """
    class Meta:
        verbose_name = "Student Learning Insight"
        verbose_name_plural = "📊 Student Learning Insights"
        managed = False  # Don't create database table
        app_label = 'dailycast'


class StudentLearningInsightAdmin(admin.ModelAdmin):
    """
    Custom admin interface for viewing student learning insights.
    """
    
    # Override changelist to show custom dashboard
    def changelist_view(self, request, extra_context=None):
        """Show list of all students with their learning insights."""
        
        # Get all users with learning activity
        from enrollment.models import Enrollment
        from analytics.models import QuizAttempt
        
        users_with_activity = User.objects.annotate(
            course_count=Count('enrollments', distinct=True),
            quiz_count=Count('quizattempt', distinct=True)
        ).filter(
            Q(course_count__gt=0) | Q(quiz_count__gt=0)
        ).order_by('-date_joined')
        
        context = {
            'title': '📊 Student Learning Insights',
            'users': users_with_activity,
            'opts': self.model._meta,
            'has_view_permission': True,
        }
        
        return render(request, 'admin/dailycast/student_insights_list.html', context)
    
    def has_add_permission(self, request):
        """Disable add button."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Disable delete."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Allow viewing."""
        return True
    
    def get_urls(self):
        """Add URL for individual student detail view."""
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:user_id>/detail/',
                self.admin_site.admin_view(self.student_detail_view),
                name='student_insight_detail',
            ),
            path(
                '<int:user_id>/refresh/',
                self.admin_site.admin_view(self.refresh_analysis_view),
                name='refresh_student_analysis',
            ),
            path(
                '<int:user_id>/ai-insights/',
                self.admin_site.admin_view(self.ai_insights_view),
                name='student_ai_insights',
            ),
        ]
        return custom_urls + urls
    
    def student_detail_view(self, request, user_id):
        """Show detailed AI analysis for a specific student."""
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            from django.http import HttpResponseNotFound
            return HttpResponseNotFound("Student not found")
        
        # ALWAYS collect and display analytics data (no AI analysis on page load)
        try:
            analyzer = UserLearningAnalyzer(user)
            analysis_data = analyzer.collect_user_learning_data()
            logger.info(f"✅ Loaded analytics for user {user_id}: {analysis_data.get('total_courses')} courses, {analysis_data.get('lessons_completed')} lessons, {analysis_data.get('quizzes_completed')} quizzes, {analysis_data.get('notes_count')} notes")
        except Exception as e:
            logger.exception(f"Error collecting analytics for user {user_id}: {e}")
            analysis_data = {
                'total_courses': 0,
                'lessons_completed': 0,
                'notes_count': 0,
                'quizzes_completed': 0,
                'quiz_accuracy': 0.0,
                'study_streak': 0,
                'active_days': 0,
                'enrolled_courses': [],
                'weak_topics': [],
                'strong_topics': [],
                'recent_activity': {},
                'error': str(e)
            }
        
        # Generate recommendations based on collected data
        try:
            analyzer = UserLearningAnalyzer(user)
            analyzer.analysis_data = analysis_data
            recommendations = analyzer.generate_recommendations()
        except Exception as e:
            logger.exception(f"Error generating recommendations for user {user_id}: {e}")
            recommendations = {
                'priority_actions': [],
                'study_tips': [],
                'next_steps': [],
                'error': str(e)
            }
        
        # Get comprehensive user preference data
        enrolled_subjects = []
        interested_subjects_list = []  # ALL interested subjects from UserPreference
        interested_tags_list = []      # ALL interested tags from UserPreference
        user_activity_data = []        # User activity data
        primary_subject_name = None
        
        try:
            from django.contrib.contenttypes.models import ContentType
            from courses.models import Course
            from users.models import UserPreference
            from users.activity_models import UserActivity
            
            # Get user's preferences
            try:
                user_pref = UserPreference.objects.prefetch_related(
                    'interested_subjects', 
                    'interested_tags'
                ).get(user=user)
                
                # Get ALL interested subjects (not just first)
                interested_subjects_queryset = user_pref.interested_subjects.all()
                interested_subjects_list = [
                    {'id': subj.id, 'name': subj.name}
                    for subj in interested_subjects_queryset
                ]
                
                # Use first one as primary for display
                if interested_subjects_list:
                    primary_subject_name = interested_subjects_list[0]['name']
                
                # Get ALL interested tags
                interested_tags_queryset = user_pref.interested_tags.all()
                interested_tags_list = [
                    {'id': tag.id, 'name': tag.name}
                    for tag in interested_tags_queryset
                ]
                
                logger.info(f"User {user_id} has {len(interested_subjects_list)} interested subjects and {len(interested_tags_list)} interested tags")
            except UserPreference.DoesNotExist:
                logger.warning(f"No UserPreference found for user {user_id}")
                user_pref = None
            
            # Get user activity data
            try:
                user_activities = UserActivity.objects.filter(user=user).order_by('-created_at')[:10]
                user_activity_data = [
                    {
                        'activity_type': activity.get_activity_type_display() if hasattr(activity, 'get_activity_type_display') else activity.activity_type,
                        'created_at': activity.created_at,
                        'metadata': activity.metadata
                    }
                    for activity in user_activities
                ]
                logger.info(f"User {user_id} has {len(user_activity_data)} recent activities")
            except Exception as e:
                logger.warning(f"Could not get user activity for {user_id}: {e}")
                user_activity_data = []
            
            # Get enrolled subjects from courses
            course_content_type = ContentType.objects.get_for_model(Course)
            enrollments = Enrollment.objects.filter(
                user=user,
                content_type=course_content_type,
                enrollment_type='course'
            )
            
            # Extract unique subjects from enrolled courses
            subjects_set = set()
            for enrollment in enrollments:
                if enrollment.content_object and hasattr(enrollment.content_object, 'subject'):
                    subject = enrollment.content_object.subject
                    if subject and subject.name:
                        subjects_set.add((subject.id, subject.name))
            
            # Sort by name
            enrolled_subjects = sorted(list(subjects_set), key=lambda x: x[1])
        except Exception as e:
            logger.warning(f"Could not get user preferences for user {user_id}: {e}")
            enrolled_subjects = []
            interested_subjects_list = []
            interested_tags_list = []
            user_activity_data = []
        
        context = {
            'title': f'Learning Insights: {user.get_full_name() or user.username}',
            'user': user,
            'analysis': analysis_data,
            'recommendations': recommendations,
            'enrolled_subjects': enrolled_subjects,
            'primary_subject': primary_subject_name,  # Primary interested subject for display
            'interested_subjects_list': interested_subjects_list,  # ALL interested subjects
            'interested_tags_list': interested_tags_list,  # ALL interested tags
            'user_activity_data': user_activity_data,  # User activity history
            'opts': self.model._meta,
            'has_view_permission': True,
        }
        
        return render(request, 'admin/dailycast/student_insight_detail.html', context)
    
    def refresh_analysis_view(self, request, user_id):
        """AJAX endpoint to refresh AI analysis with selected model."""
        import json
        from django.http import JsonResponse
        
        if request.method != 'POST':
            return JsonResponse({'success': False, 'error': 'POST required'}, status=405)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
        
        try:
            # Parse request body
            data = json.loads(request.body)
            ai_model = data.get('ai_model', 'gemini-2.0-flash-exp')
            
            logger.info(f"🤖 Refreshing analysis for user {user_id} with model {ai_model}")
            
            # Run AI analysis with selected model
            result = analyze_user_and_generate_feedback(user, ai_model=ai_model)
            
            return JsonResponse({
                'success': True,
                'message': 'Analysis refreshed successfully',
                'model_used': ai_model
            })
            
        except Exception as e:
            logger.exception(f"Error refreshing analysis for user {user_id}: {e}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    @csrf_exempt
    def ai_insights_view(self, request, user_id):
        """AJAX endpoint to generate AI insights with caching to reduce token usage."""
        import json
        from django.http import JsonResponse
        
        if request.method != 'POST':
            return JsonResponse({'success': False, 'error': 'POST required'}, status=405)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
        
        try:
            # Parse request body
            data = json.loads(request.body)
            subject = data.get('subject', '')  # e.g., 'English', 'Math', or empty for all
            engine = data.get('engine', 'gemini-2.0-flash-exp')  # AI model/engine
            
            logger.info(f"🤖 Generating AI insights for user {user_id}, subject={subject}, engine={engine}")
            
            # ============================================================================
            # STEP 1: CHECK CACHE - If fresh cache exists, use it and save tokens!
            # ============================================================================
            cache_found = False
            cache_hit = False
            
            try:
                cached = CachedAIInsight.objects.get(
                    user=user,
                    subject=subject,
                    engine=engine
                )
                
                # Check if cache is still fresh (not expired)
                if cached.expires_at > timezone.now():
                    cache_hit = True
                    ai_insights = cached.ai_insights
                    cached.hits += 1
                    cached.tokens_saved += 1500  # Estimate: one analysis ~1500 tokens
                    cached.save(update_fields=['hits', 'tokens_saved'])
                    
                    logger.info(f"✅ CACHE HIT: {user.username} - Subject: {subject or 'All'} - Engine: {engine}")
                    logger.info(f"   📊 Hit count: {cached.hits}, Tokens saved: {cached.tokens_saved}")
                    cache_found = True
                    
                    # Update statistics
                    today = timezone.now().date()
                    stats, _ = CacheStatistics.objects.get_or_create(date=today)
                    stats.ai_insights_cached += 1
                    stats.ai_insights_hits += cached.hits
                    stats.ai_tokens_saved += 1500
                    stats.save(update_fields=['ai_insights_cached', 'ai_insights_hits', 'ai_tokens_saved'])
                else:
                    logger.info(f"⏱️  CACHE EXPIRED: {user.username} - Subject: {subject or 'All'}")
                    
            except CachedAIInsight.DoesNotExist:
                logger.info(f"❌ CACHE MISS: {user.username} - Subject: {subject or 'All'}")
            
            # ============================================================================
            # STEP 2: IF NO CACHE, GENERATE NEW ANALYSIS
            # ============================================================================
            if not cache_hit:
                # Collect user data
                analyzer = UserLearningAnalyzer(user)
                analysis_data = analyzer.collect_user_learning_data()
                
                # Run AI analysis with specified engine
                ai_insights = _run_ai_deep_analysis(user, analysis_data, engine, subject=subject)
                
                # ====================================================================
                # STEP 3: SAVE TO CACHE FOR FUTURE USE
                # ====================================================================
                try:
                    expires_at = timezone.now() + timedelta(hours=24)  # 24-hour cache
                    
                    CachedAIInsight.objects.update_or_create(
                        user=user,
                        subject=subject,
                        engine=engine,
                        defaults={
                            'ai_insights': ai_insights,
                            'tokens_used': 1500,  # Approximate tokens used
                            'expires_at': expires_at,
                        }
                    )
                    
                    logger.info(f"💾 CACHED: {user.username} - Subject: {subject or 'All'} - Engine: {engine}")
                    logger.info(f"   ⏰ Cache expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    # Update statistics
                    today = timezone.now().date()
                    stats, _ = CacheStatistics.objects.get_or_create(date=today)
                    stats.ai_insights_generated += 1
                    stats.ai_tokens_used += 1500
                    stats.save(update_fields=['ai_insights_generated', 'ai_tokens_used'])
                    
                except Exception as e:
                    logger.warning(f"Could not cache AI insights: {e}")
            
            # ============================================================================
            # STEP 4: RETURN RESULTS
            # ============================================================================
            return JsonResponse({
                'success': True,
                'insights': ai_insights,
                'subject': subject or 'All Subjects',
                'engine': engine,
                'cached': cache_hit,  # Was this from cache?
                'cache_source': 'database' if cache_hit else 'ai_model',
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.exception(f"Error generating AI insights for user {user_id}: {e}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)

