"""
Rate Limiter: Enforce daily caps on AI feedback and audio generation.
Tracks usage per user + day to prevent abuse and control costs.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional
from pathlib import Path

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone


class RateLimiter:
    """
    Enforces daily limits: 1 feedback (500 words) + 1 audio (6 min) per user/day.
    
    Fair use policy:
      - 1 AI feedback request per day (max 500 words)
      - 1 audio generation per day (max 6 minutes)
      - Extra requests queue for later billing or soft-block
    """
    
    # Daily limits
    FEEDBACK_LIMIT_PER_DAY = 1
    AUDIO_LIMIT_PER_DAY = 1
    WORDS_LIMIT_PER_FEEDBACK = 500
    AUDIO_LENGTH_LIMIT_SECONDS = 360  # 6 minutes
    
    # Cache prefix
    PREFIX = "ratelimit:"
    
    def __init__(self):
        pass
    
    def _get_key_feedback(self, user_id: int) -> str:
        """Generate key for daily feedback count."""
        today = datetime.utcnow().date().isoformat()
        return f"{self.PREFIX}feedback:{user_id}:{today}"
    
    def _get_key_audio(self, user_id: int) -> str:
        """Generate key for daily audio count."""
        today = datetime.utcnow().date().isoformat()
        return f"{self.PREFIX}audio:{user_id}:{today}"
    
    def can_request_feedback(self, user_id: int, word_count: int) -> Tuple[bool, str]:
        """
        Check if user can request feedback today.
        
        Returns:
            (allowed, reason)
        """
        # Check word count
        if word_count > self.WORDS_LIMIT_PER_FEEDBACK:
            return False, f"Feedback limited to {self.WORDS_LIMIT_PER_FEEDBACK} words. You provided {word_count}. Trim and try again."
        
        # Check daily limit
        key = self._get_key_feedback(user_id)
        count = cache.get(key, 0)
        
        if count >= self.FEEDBACK_LIMIT_PER_DAY:
            return False, f"You've used your daily feedback. Try again tomorrow or upgrade your plan."
        
        return True, "OK"
    
    def can_request_audio(self, user_id: int, duration_seconds: int) -> Tuple[bool, str]:
        """
        Check if user can request audio today.
        
        Returns:
            (allowed, reason)
        """
        # Check duration
        if duration_seconds > self.AUDIO_LENGTH_LIMIT_SECONDS:
            return False, f"Audio limited to {self.AUDIO_LENGTH_LIMIT_SECONDS} seconds. Your request is {duration_seconds}s."
        
        # Check daily limit
        key = self._get_key_audio(user_id)
        count = cache.get(key, 0)
        
        if count >= self.AUDIO_LIMIT_PER_DAY:
            return False, f"You've used your daily audio. Try again tomorrow or upgrade your plan."
        
        return True, "OK"
    
    def consume_feedback(self, user_id: int) -> None:
        """Mark feedback as used (increment counter)."""
        key = self._get_key_feedback(user_id)
        count = cache.get(key, 0)
        cache.set(key, count + 1, timeout=86400)  # 24 hours
    
    def consume_audio(self, user_id: int) -> None:
        """Mark audio as used (increment counter)."""
        key = self._get_key_audio(user_id)
        count = cache.get(key, 0)
        cache.set(key, count + 1, timeout=86400)  # 24 hours
    
    def get_user_daily_usage(self, user_id: int) -> Dict:
        """Return user's daily usage summary."""
        feedback_key = self._get_key_feedback(user_id)
        audio_key = self._get_key_audio(user_id)
        
        feedback_used = cache.get(feedback_key, 0)
        audio_used = cache.get(audio_key, 0)
        
        return {
            "feedback_used": feedback_used,
            "feedback_limit": self.FEEDBACK_LIMIT_PER_DAY,
            "feedback_remaining": max(0, self.FEEDBACK_LIMIT_PER_DAY - feedback_used),
            "audio_used": audio_used,
            "audio_limit": self.AUDIO_LIMIT_PER_DAY,
            "audio_remaining": max(0, self.AUDIO_LIMIT_PER_DAY - audio_used),
            "date": datetime.utcnow().date().isoformat(),
        }
    
    def reset_user_daily_usage(self, user_id: int) -> None:
        """Clear user's daily counters (admin only)."""
        feedback_key = self._get_key_feedback(user_id)
        audio_key = self._get_key_audio(user_id)
        cache.delete(feedback_key)
        cache.delete(audio_key)


# Singleton instance
rate_limiter = RateLimiter()


def check_feedback_allowed(user_id: int, word_count: int) -> Tuple[bool, str]:
    """Public interface."""
    return rate_limiter.can_request_feedback(user_id, word_count)


def check_audio_allowed(user_id: int, duration_seconds: int) -> Tuple[bool, str]:
    """Public interface."""
    return rate_limiter.can_request_audio(user_id, duration_seconds)


def mark_feedback_used(user_id: int) -> None:
    """Public interface."""
    return rate_limiter.consume_feedback(user_id)


def mark_audio_used(user_id: int) -> None:
    """Public interface."""
    return rate_limiter.consume_audio(user_id)


def get_daily_usage(user_id: int) -> Dict:
    """Public interface."""
    return rate_limiter.get_user_daily_usage(user_id)
