"""URL configuration for AI/Analytics dashboard."""
from django.urls import path
from dailycast.dashboard_views import (
    ai_performance_dashboard,
    user_analytics_detail,
    cache_stats,
    reset_user_limits,
    token_cost_estimator,
)

app_name = 'dailycast_dashboard'

urlpatterns = [
    # Main dashboard
    path('ai-performance/', ai_performance_dashboard, name='ai-performance'),
    
    # User detail analytics (AJAX)
    path('user/<int:user_id>/analytics/', user_analytics_detail, name='user-analytics'),
    
    # Cache stats (AJAX)
    path('cache-stats/', cache_stats, name='cache-stats'),
    
    # Admin actions
    path('reset-limits/<int:user_id>/', reset_user_limits, name='reset-limits'),
    
    # Cost calculator
    path('cost-estimator/', token_cost_estimator, name='cost-estimator'),
]
