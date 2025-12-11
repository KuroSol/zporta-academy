"""
Student Learning Insights Admin Interface
Provides human-readable AI analysis for each student.
"""
import logging
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.utils.safestring import mark_safe
from django.urls import path
from django.shortcuts import render
from django.db.models import Count, Avg, Q
from datetime import timedelta
from django.utils import timezone

from dailycast.ai_analyzer import UserLearningAnalyzer, analyze_user_and_generate_feedback

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
        ]
        return custom_urls + urls
    
    def student_detail_view(self, request, user_id):
        """Show detailed AI analysis for a specific student."""
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            from django.http import HttpResponseNotFound
            return HttpResponseNotFound("Student not found")
        
        # Run AI analysis
        try:
            result = analyze_user_and_generate_feedback(user)
            analysis = result['analysis']
            recommendations = result['recommendations']
            success = True
            error = None
        except Exception as e:
            logger.exception(f"Error analyzing user {user_id}: {e}")
            analysis = None
            recommendations = None
            success = False
            error = str(e)
        
        context = {
            'title': f'Learning Insights: {user.get_full_name() or user.username}',
            'user': user,
            'analysis': analysis,
            'recommendations': recommendations,
            'success': success,
            'error': error,
            'opts': self.model._meta,
            'has_view_permission': True,
        }
        
        return render(request, 'admin/dailycast/student_insight_detail.html', context)
