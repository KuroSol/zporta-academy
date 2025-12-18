"""
Analytics Tracker: Monitor token usage, cache hits, costs, and performance.
Real-time metrics for the admin dashboard.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone


class AnalyticsTracker:
    """
    Tracks:
    - Token usage per user/day
    - Cache hit/miss rates
    - Cost estimates (tokens × rate)
    - Request counts and speeds
    - Error rates
    """
    
    # Pricing (adjust as needed)
    TOKEN_COST_PER_1M = Decimal("0.003")  # $0.003 per 1M tokens (approximate)
    
    # Cache prefix
    PREFIX = "analytics:"
    
    def __init__(self):
        pass
    
    def _get_key(self, user_id: int, metric: str, scope: str = "day") -> str:
        """Generate analytics key."""
        if scope == "day":
            date = datetime.utcnow().date().isoformat()
            return f"{self.PREFIX}{user_id}:{metric}:{date}"
        else:
            return f"{self.PREFIX}{user_id}:{metric}:overall"
    
    def track_preprocess(self, user_id: int, input_tokens: int, output_tokens: int) -> None:
        """Track preprocessing metrics."""
        key = self._get_key(user_id, "preprocess")
        data = cache.get(key, {"count": 0, "input": 0, "output": 0})
        data["count"] += 1
        data["input"] += input_tokens
        data["output"] += output_tokens
        cache.set(key, data, timeout=86400 * 7)  # 7 days
    
    def track_feedback(self, user_id: int, input_tokens: int, output_tokens: int, cached: bool = False) -> None:
        """Track feedback/LLM call metrics."""
        key = self._get_key(user_id, "feedback")
        data = cache.get(key, {"count": 0, "input": 0, "output": 0, "cached": 0})
        data["count"] += 1
        data["input"] += input_tokens
        data["output"] += output_tokens
        if cached:
            data["cached"] += 1
        cache.set(key, data, timeout=86400 * 7)
    
    def track_audio(self, user_id: int, duration_seconds: int) -> None:
        """Track audio generation metrics."""
        key = self._get_key(user_id, "audio")
        data = cache.get(key, {"count": 0, "total_seconds": 0})
        data["count"] += 1
        data["total_seconds"] += duration_seconds
        cache.set(key, data, timeout=86400 * 7)
    
    def track_error(self, user_id: int, error_type: str) -> None:
        """Track error occurrences."""
        key = self._get_key(user_id, "errors")
        data = cache.get(key, {})
        data[error_type] = data.get(error_type, 0) + 1
        cache.set(key, data, timeout=86400 * 7)
    
    def get_user_daily_metrics(self, user_id: int) -> Dict:
        """Get all metrics for a user today."""
        preprocess_key = self._get_key(user_id, "preprocess")
        feedback_key = self._get_key(user_id, "feedback")
        audio_key = self._get_key(user_id, "audio")
        error_key = self._get_key(user_id, "errors")
        
        preprocess_data = cache.get(preprocess_key, {})
        feedback_data = cache.get(feedback_key, {})
        audio_data = cache.get(audio_key, {})
        error_data = cache.get(error_key, {})
        
        # Calculate totals
        total_input_tokens = preprocess_data.get("input", 0) + feedback_data.get("input", 0)
        total_output_tokens = preprocess_data.get("output", 0) + feedback_data.get("output", 0)
        total_tokens = total_input_tokens + total_output_tokens
        
        # Calculate cost
        cost_usd = float((Decimal(total_tokens) / 1_000_000) * self.TOKEN_COST_PER_1M)
        
        # Cache hit rate
        feedback_count = feedback_data.get("count", 0)
        feedback_cached = feedback_data.get("cached", 0)
        cache_hit_rate = (feedback_cached / feedback_count * 100) if feedback_count > 0 else 0
        
        return {
            "date": datetime.utcnow().date().isoformat(),
            "preprocess": {
                "requests": preprocess_data.get("count", 0),
                "input_tokens": preprocess_data.get("input", 0),
                "output_tokens": preprocess_data.get("output", 0),
            },
            "feedback": {
                "requests": feedback_data.get("count", 0),
                "cached_hits": feedback_data.get("cached", 0),
                "input_tokens": feedback_data.get("input", 0),
                "output_tokens": feedback_data.get("output", 0),
            },
            "audio": {
                "requests": audio_data.get("count", 0),
                "total_seconds": audio_data.get("total_seconds", 0),
            },
            "tokens": {
                "input": total_input_tokens,
                "output": total_output_tokens,
                "total": total_tokens,
            },
            "cost": {
                "estimated_usd": f"${cost_usd:.4f}",
                "estimated_jpy": f"¥{cost_usd * 150:.0f}",  # Rough JPY conversion
            },
            "cache_hit_rate": f"{cache_hit_rate:.1f}%",
            "errors": error_data,
        }
    
    def get_platform_daily_metrics(self) -> Dict:
        """Get aggregate metrics across all users today."""
        # This is a simplified version; in production, aggregate from DB
        return {
            "date": datetime.utcnow().date().isoformat(),
            "note": "Run periodic aggregation job to collect platform-wide stats.",
        }
    
    def get_user_cost_estimate(self, user_id: int, days: int = 30) -> Dict:
        """Estimate monthly cost for a user based on recent usage."""
        # For now, fetch today's metrics and extrapolate
        today_metrics = self.get_user_daily_metrics(user_id)
        cost_today_usd = float(today_metrics["cost"]["estimated_usd"].replace("$", ""))
        estimated_monthly_usd = cost_today_usd * days
        estimated_monthly_jpy = estimated_monthly_usd * 150
        
        return {
            "cost_today_usd": f"${cost_today_usd:.4f}",
            "cost_today_jpy": f"¥{cost_today_usd * 150:.0f}",
            "estimated_monthly_usd": f"${estimated_monthly_usd:.2f}",
            "estimated_monthly_jpy": f"¥{estimated_monthly_jpy:.0f}",
            "days": days,
        }


# Singleton instance
analytics = AnalyticsTracker()


def track_preprocess(user_id: int, input_tokens: int, output_tokens: int) -> None:
    """Public interface."""
    analytics.track_preprocess(user_id, input_tokens, output_tokens)


def track_feedback(user_id: int, input_tokens: int, output_tokens: int, cached: bool = False) -> None:
    """Public interface."""
    analytics.track_feedback(user_id, input_tokens, output_tokens, cached=cached)


def track_audio(user_id: int, duration_seconds: int) -> None:
    """Public interface."""
    analytics.track_audio(user_id, duration_seconds)


def track_error(user_id: int, error_type: str) -> None:
    """Public interface."""
    analytics.track_error(user_id, error_type)


def get_daily_metrics(user_id: int) -> Dict:
    """Public interface."""
    return analytics.get_user_daily_metrics(user_id)


def get_cost_estimate(user_id: int, days: int = 30) -> Dict:
    """Public interface."""
    return analytics.get_user_cost_estimate(user_id, days)
