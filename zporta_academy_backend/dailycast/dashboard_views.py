"""
Dashboard Views: Monitor AI performance, token usage, costs, and cache metrics.
Admin-only access to real-time analytics.
"""

import json
from datetime import datetime
from django.shortcuts import render
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.models import User

# Import only the functions we need
try:
    from .rate_limiter import rate_limiter
    from .analytics_tracker import analytics
except ImportError as e:
    rate_limiter = None
    analytics = None
    print(f"Warning: Could not import performance modules: {e}")


def is_staff(user):
    """Check if user is staff."""
    return user.is_staff


@login_required
@user_passes_test(is_staff)
def ai_performance_dashboard(request):
    """
    Main dashboard: Shows token usage, cache hits, costs, user activity.
    """
    # Get metrics for all users (simplified)
    users = User.objects.filter(is_active=True)
    user_metrics = []
    
    total_tokens = 0
    total_cost_usd = 0
    
    for user in users:
        metrics = analytics.get_user_daily_metrics(user.id)
        usage = rate_limiter.get_user_daily_usage(user.id)
        
        user_metrics.append({
            "user_id": user.id,
            "username": user.username,
            "tokens_today": metrics["tokens"]["total"],
            "cost_today": metrics["cost"]["estimated_usd"],
            "cache_hit_rate": metrics["cache_hit_rate"],
            "feedback_used": usage["feedback_used"],
            "audio_used": usage["audio_used"],
            "feedback_remaining": usage["feedback_remaining"],
            "audio_remaining": usage["audio_remaining"],
        })
        
        total_tokens += metrics["tokens"]["total"]
        total_cost_usd += float(metrics["cost"]["estimated_usd"].replace("$", ""))
    
    context = {
        "title": "AI Performance Dashboard",
        "total_users": len(users),
        "total_tokens_today": total_tokens,
        "total_cost_today_usd": f"${total_cost_usd:.4f}",
        "total_cost_today_jpy": f"¥{total_cost_usd * 150:.0f}",
        "user_metrics": user_metrics,
        "cache_stats": {"backend": "django_cache", "note": "See admin panel for detailed stats"},
    }
    
    return render(request, "dailycast/ai_performance_dashboard.html", context)


@login_required
@user_passes_test(is_staff)
@require_http_methods(["GET"])
def user_analytics_detail(request, user_id):
    """
    Detailed analytics for a single user.
    JSON response for AJAX updates.
    """
    user = User.objects.get(id=user_id)
    
    daily_metrics = analytics.get_user_daily_metrics(user_id)
    usage = rate_limiter.get_user_daily_usage(user_id)
    cost_estimate = analytics.get_user_cost_estimate(user_id, days=30)
    
    response = {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_active": user.is_active,
        },
        "today": daily_metrics,
        "usage": usage,
        "cost_estimate_30_days": cost_estimate,
    }
    
    return JsonResponse(response)


@login_required
@user_passes_test(is_staff)
@require_http_methods(["GET"])
def cache_stats(request):
    """
    Cache performance statistics.
    """
    stats = cache_manager.get_cache_stats()
    
    return JsonResponse({
        "cache": stats,
        "timestamp": datetime.utcnow().isoformat(),
    })


@login_required
@user_passes_test(is_staff)
@require_http_methods(["POST"])
def reset_user_limits(request, user_id):
    """
    Admin: Reset a user's daily rate limits (for testing or special cases).
    """
    rate_limiter.reset_user_daily_usage(user_id)
    
    return JsonResponse({
        "status": "success",
        "message": f"Reset daily limits for user {user_id}",
    })


@login_required
@user_passes_test(is_staff)
def token_cost_estimator(request):
    """
    Simple tool to estimate costs based on token usage.
    GET params: tokens, rate_per_1m
    """
    tokens = int(request.GET.get("tokens", 0))
    rate = float(request.GET.get("rate_per_1m", 0.003))  # Default $0.003 per 1M
    
    cost_usd = (tokens / 1_000_000) * rate
    cost_jpy = cost_usd * 150
    
    return JsonResponse({
        "tokens": tokens,
        "rate_per_1m": f"${rate}",
        "cost_usd": f"${cost_usd:.6f}",
        "cost_jpy": f"¥{cost_jpy:.2f}",
    })


# Helper for template rendering
from django.utils import timezone as tz
from datetime import datetime
