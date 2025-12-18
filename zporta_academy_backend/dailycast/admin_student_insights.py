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
                # Use .defer() to skip problematic columns that don't exist in database
                user_pref = UserPreference.objects.defer('native_language', 'report_language').get(user=user)
                
                # Get ALL interested subjects (not just first)
                try:
                    interested_subjects_queryset = user_pref.interested_subjects.all()
                    interested_subjects_list = [
                        {'id': subj.id, 'name': subj.name}
                        for subj in interested_subjects_queryset
                    ]
                except Exception as e:
                    logger.warning(f"Could not get interested subjects for user {user_id}: {e}")
                    interested_subjects_list = []
                
                # Use first one as primary for display
                if interested_subjects_list:
                    primary_subject_name = interested_subjects_list[0]['name']
                
                # Get ALL interested tags
                try:
                    interested_tags_queryset = user_pref.interested_tags.all()
                    interested_tags_list = [
                        {'id': tag.id, 'name': tag.name}
                        for tag in interested_tags_queryset
                    ]
                except Exception as e:
                    logger.warning(f"Could not get interested tags for user {user_id}: {e}")
                    interested_tags_list = []
                
                logger.info(f"User {user_id} has {len(interested_subjects_list)} interested subjects and {len(interested_tags_list)} interested tags")
            except UserPreference.DoesNotExist:
                logger.warning(f"No UserPreference found for user {user_id}")
                user_pref = None
            except Exception as e:
                logger.warning(f"Could not query UserPreference for user {user_id}: {e}")
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
        
        # Get all historical AI insights for this user
        old_insights = []
        old_insights_json = '[]'
        try:
            from dailycast.models import CachedAIInsight
            cached_insights = CachedAIInsight.objects.filter(user=user).order_by('-created_at')
            for cached in cached_insights:
                old_insights.append({
                    'id': cached.id,
                    'subject': cached.subject or 'All Subjects',
                    'engine': cached.get_engine_display(),
                    'insights': cached.ai_insights,
                    'created_at': cached.created_at.isoformat() if cached.created_at else '',
                    'hits': cached.hits,
                })
            # Serialize to JSON for JavaScript
            old_insights_json = json.dumps(old_insights)
            logger.info(f"Found {len(old_insights)} historical AI insights for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not get historical insights for user {user_id}: {e}")
        
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
            'old_insights': old_insights,  # Historical AI insights (for template display)
            'old_insights_json': mark_safe(old_insights_json),  # JSON for JavaScript
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
        
        def _sanitize_ai_insights(insights: dict) -> dict:
            """Validate and clean AI insights to improve accuracy before display.
            - Ensures grammar examples have meaningful corrections
            - Reclassifies obvious proper-noun spelling issues
            - Deduplicates examples
            - Adds a minimal fallback for exam predictions if missing
            """
            try:
                ga = insights.get('grammar_analysis') or {}
                weak = ga.get('weak_areas') or []
                cleaned_weak = []
                for area in weak:
                    error_type = area.get('error_type') or area.get('type') or 'Grammar Issue'
                    examples = area.get('examples') or []
                    uniq = []
                    seen = set()
                    reclassified_type = error_type
                    for ex in examples:
                        original = (ex.get('original') or '').strip()
                        corrected = (ex.get('corrected') or '').strip()
                        key = (ex.get('note_id'), original, corrected)
                        if key in seen:
                            continue
                        seen.add(key)
                        # Flag identical pairs to avoid confusion
                        if original == corrected:
                            ex['no_change'] = True
                        # Reclassify to proper-noun spelling if only a capitalized token changed slightly
                        try:
                            if error_type.lower() in ['article usage', 'articles'] and original and corrected:
                                o_tokens = original.split()
                                c_tokens = corrected.split()
                                if len(o_tokens) == len(c_tokens):
                                    diffs = [i for i,(o,c) in enumerate(zip(o_tokens, c_tokens)) if o != c]
                                    if len(diffs) == 1:
                                        i = diffs[0]
                                        o_tok, c_tok = o_tokens[i], c_tokens[i]
                                        if o_tok[:1].isupper() and c_tok[:1].isupper():
                                            # Small edit distance heuristic
                                            if abs(len(o_tok) - len(c_tok)) <= 2:
                                                reclassified_type = 'Proper noun spelling'
                        except Exception:
                            pass
                        uniq.append(ex)
                    cleaned_weak.append({
                        'error_type': reclassified_type,
                        'frequency': area.get('frequency', len(uniq)),
                        'examples': uniq
                    })
                if weak:
                    ga['weak_areas'] = cleaned_weak
                    insights['grammar_analysis'] = ga
                # Minimal fallback for exam predictions
                if not insights.get('exam_level_predictions'):
                    # Try to infer a level from assessment or vocabulary
                    level = 'B1'
                    assess = insights.get('assessment') or {}
                    if isinstance(assess, dict):
                        level = assess.get('current_level') or assess.get('level') or level
                    vocab = insights.get('vocabulary_gaps') or {}
                    cefr = vocab.get('estimated_level') or level
                    mapping = {
                        'A1': {'toeic_range': 'Below 250','toefl_range': 'Below 30','ielts_band': 'Below 3.0'},
                        'A2': {'toeic_range': '250-550','toefl_range': '30-42','ielts_band': '3.0-4.0'},
                        'B1': {'toeic_range': '550-780','toefl_range': '42-71','ielts_band': '4.5-5.5'},
                        'B2': {'toeic_range': '780-900','toefl_range': '72-94','ielts_band': '6.0-7.0'},
                        'C1': {'toeic_range': '900-990','toefl_range': '95-120','ielts_band': '7.5-8.5'},
                        'C2': {'toeic_range': '990','toefl_range': '120','ielts_band': '9.0'},
                    }
                    m = mapping.get(cefr, mapping['B1'])
                    insights['exam_level_predictions'] = {
                        'cefr_band': cefr,
                        'toeic_range': m['toeic_range'],
                        'toefl_range': m['toefl_range'],
                        'ielts_band': m['ielts_band'],
                        'confidence': 'low',
                        'reasoning': 'Fallback estimate based on available analysis.'
                    }
            except Exception as _:
                # If sanitization fails, return original insights
                return insights
            return insights
        
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
            target_language = data.get('language', 'English')  # Output language for explanations
            
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
                    ai_insights = _sanitize_ai_insights(cached.ai_insights)
                    cached.hits += 1
                    
                    # Use actual tokens from original API call
                    tokens_saved = cached.tokens_used or 1500
                    cached.tokens_saved += tokens_saved
                    cached.save(update_fields=['hits', 'tokens_saved'])
                    
                    logger.info(f"✅ CACHE HIT: {user.username} - Subject: {subject or 'All'} - Engine: {engine}")
                    logger.info(f"   📊 Hit count: {cached.hits}, Tokens saved: {cached.tokens_saved}")
                    cache_found = True
                    
                    # Update statistics with cost calculation
                    today = timezone.now().date()
                    stats, _ = CacheStatistics.objects.get_or_create(date=today)
                    stats.ai_insights_cached += 1
                    stats.ai_insights_hits += cached.hits
                    stats.ai_tokens_saved += tokens_saved
                    
                    # Calculate cost saved by using cache
                    cost_saved_cents = CacheStatistics.estimate_cost(tokens_saved, engine)
                    stats.cost_saved_cents += cost_saved_cents
                    
                    stats.save(update_fields=['ai_insights_cached', 'ai_insights_hits', 'ai_tokens_saved', 'cost_saved_cents'])
                    logger.info(f"   💚 Cost saved: ${cost_saved_cents/100:.4f}")
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
                ai_insights = _run_ai_deep_analysis(user, analysis_data, engine, subject=subject, target_language=target_language)
                ai_insights = _sanitize_ai_insights(ai_insights)
                
                # Extract actual token usage from API response
                token_usage = ai_insights.get('_token_usage', {})
                actual_tokens = token_usage.get('total_tokens', 0)
                input_tokens = token_usage.get('input_tokens', 0)
                output_tokens = token_usage.get('output_tokens', 0)
                
                # Fallback to estimate if API didn't return usage
                if actual_tokens == 0:
                    actual_tokens = 1500
                    logger.warning(f"⚠️  No token usage from API, using estimate: {actual_tokens}")
                else:
                    logger.info(f"📊 Actual API usage: {actual_tokens} tokens ({input_tokens} input + {output_tokens} output)")
                
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
                            'tokens_used': actual_tokens,  # Real tokens from API
                            'expires_at': expires_at,
                        }
                    )
                    
                    logger.info(f"💾 CACHED: {user.username} - Subject: {subject or 'All'} - Engine: {engine}")
                    logger.info(f"   ⏰ Cache expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    # Update statistics with actual usage and cost
                    today = timezone.now().date()
                    stats, _ = CacheStatistics.objects.get_or_create(date=today)
                    stats.ai_insights_generated += 1
                    stats.ai_tokens_used += actual_tokens
                    
                    # Calculate actual cost using real input/output token breakdown
                    if input_tokens > 0 and output_tokens > 0:
                        cost_cents = CacheStatistics.estimate_cost(
                            actual_tokens, engine, 
                            input_tokens=input_tokens, 
                            output_tokens=output_tokens
                        )
                        logger.info(f"   💰 Cost: ${cost_cents/100:.4f} ({input_tokens} in + {output_tokens} out = {actual_tokens} tokens, {engine})")
                    else:
                        cost_cents = CacheStatistics.estimate_cost(actual_tokens, engine)
                        logger.info(f"   💰 Cost: ${cost_cents/100:.4f} for {actual_tokens} tokens using {engine}")
                    
                    stats.cost_usd_cents += cost_cents
                    stats.save(update_fields=['ai_insights_generated', 'ai_tokens_used', 'cost_usd_cents'])
                    
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

