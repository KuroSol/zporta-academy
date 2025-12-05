# intelligence/utils.py
"""
Utility functions for the intelligence app.

These functions are used by management commands to compute:
- Difficulty scores from quiz attempt data
- User ability scores using ELO-style rating
- Match scores combining multiple factors
"""

import math
import logging
import numpy as np
from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Count, Q, F
from django.contrib.contenttypes.models import ContentType

logger = logging.getLogger(__name__)


def compute_difficulty_score(success_rate, avg_time_seconds, attempt_count, baseline=400.0):
    """
    Compute difficulty score from performance metrics.
    
    Uses a formula that considers:
    - Success rate (lower = harder)
    - Average time (longer = harder, up to a point)
    - Attempt count (for confidence weighting)
    
    Returns score on 0-1000 scale.
    """
    # Base difficulty from success rate (inverted)
    # 100% success = easy (100), 0% success = hard (900)
    success_component = baseline + (100 - success_rate) * 5
    
    # Time component (normalized, capped at 60 seconds)
    # Fast (<10s) = easier, slow (>30s) = harder
    time_seconds = min(avg_time_seconds or 15, 60)
    time_component = (time_seconds - 10) * 5  # Range: -50 to +250
    
    # Combine components
    raw_score = success_component + time_component * 0.3
    
    # Confidence adjustment (fewer attempts = regress toward mean)
    confidence = min(attempt_count / 30.0, 1.0)  # Full confidence at 30+ attempts
    final_score = raw_score * confidence + baseline * (1 - confidence)
    
    # Clamp to valid range
    return max(0.0, min(1000.0, final_score))


def compute_user_ability_elo(user_attempts, initial_rating=400.0, k_factor=32):
    """
    Compute user ability using ELO-style rating system.
    
    Args:
        user_attempts: List of dicts with keys: is_correct, quiz_difficulty, time_spent_ms
        initial_rating: Starting ELO rating
        k_factor: How much each result affects rating (higher = more volatile)
    
    Returns:
        Final ELO rating (float)
    """
    rating = initial_rating
    
    for attempt in user_attempts:
        # Expected score (probability of success) based on rating difference
        difficulty = attempt.get('quiz_difficulty', 400.0)
        expected = 1 / (1 + 10 ** ((difficulty - rating) / 400))
        
        # Actual score (1 for correct, 0 for incorrect)
        actual = 1.0 if attempt['is_correct'] else 0.0
        
        # Adjust rating
        rating += k_factor * (actual - expected)
    
    return max(0.0, min(1000.0, rating))


def compute_zpd_score(difficulty_gap, optimal_range=(-50, 50)):
    """
    Compute Zone of Proximal Development score.
    
    Content that is slightly harder than the user's ability is ideal.
    Returns score 0-1 (higher = better fit).
    
    Args:
        difficulty_gap: content_difficulty - user_ability (negative = too easy, positive = too hard)
        optimal_range: Tuple of (min, max) for optimal difficulty gap
    """
    min_gap, max_gap = optimal_range
    
    if min_gap <= difficulty_gap <= max_gap:
        # Within optimal range: score near 1.0
        # Peak at middle of range
        mid_point = (min_gap + max_gap) / 2
        distance_from_peak = abs(difficulty_gap - mid_point)
        max_distance = (max_gap - min_gap) / 2
        return 1.0 - (distance_from_peak / max_distance) * 0.2  # 0.8 to 1.0
    
    elif difficulty_gap < min_gap:
        # Too easy: decay score as it gets easier
        distance = min_gap - difficulty_gap
        return max(0.3, 0.8 - distance / 100)
    
    else:
        # Too hard: decay score as it gets harder
        distance = difficulty_gap - max_gap
        return max(0.1, 0.8 - distance / 100)


def compute_preference_alignment(quiz, user_preferences):
    """
    Compute how well a quiz aligns with user preferences.
    
    Returns score 0-1 (higher = better alignment).
    
    Considers:
    - Subject match (40%)
    - Tag overlap (30%)
    - Language match (30%)
    """
    score = 0.0
    
    # Subject match (0.4 weight)
    if user_preferences and hasattr(user_preferences, 'interested_subjects'):
        user_subjects = set(user_preferences.interested_subjects.values_list('id', flat=True))
        if quiz.subject_id in user_subjects:
            score += 0.4
    
    # Tag overlap (0.3 weight)
    if user_preferences and hasattr(user_preferences, 'interested_tags'):
        user_tags = set(user_preferences.interested_tags.values_list('name', flat=True))
        quiz_tags = set(quiz.tags.values_list('name', flat=True))
        if user_tags and quiz_tags:
            overlap = len(user_tags & quiz_tags) / len(user_tags)
            score += 0.3 * overlap
    
    # Language match (0.3 weight)
    if user_preferences and hasattr(user_preferences, 'languages_spoken'):
        user_langs = user_preferences.languages_spoken or []
        quiz_langs = quiz.languages or []
        if user_langs and quiz_langs:
            # Check if any user language matches any quiz language
            if any(lang in quiz_langs for lang in user_langs):
                score += 0.3
    
    return min(1.0, score)


def compute_recency_penalty(last_attempt_date, decay_days=7):
    """
    Compute penalty for recently attempted content.
    
    Returns penalty 0-1 (0 = not recent, 1 = very recent).
    Content attempted within decay_days gets increasing penalty.
    """
    if not last_attempt_date:
        return 0.0
    
    days_since = (timezone.now() - last_attempt_date).days
    
    if days_since >= decay_days:
        return 0.0
    
    # Linear decay: penalty = 1.0 at day 0, 0.0 at decay_days
    return 1.0 - (days_since / decay_days)


def compute_match_score(user_ability, quiz_difficulty, preference_score, recency_penalty,
                       zpd_weight=0.5, pref_weight=0.3, recency_weight=0.2):
    """
    Compute overall match score combining multiple factors.
    
    Returns score 0-100 (higher = better match).
    
    Args:
        user_ability: User's ability score (0-1000)
        quiz_difficulty: Quiz difficulty score (0-1000)
        preference_score: Preference alignment (0-1)
        recency_penalty: Recency penalty (0-1)
        zpd_weight: Weight for ZPD score (default: 0.5)
        pref_weight: Weight for preference score (default: 0.3)
        recency_weight: Weight for recency penalty (default: 0.2)
    """
    difficulty_gap = quiz_difficulty - user_ability
    zpd_score = compute_zpd_score(difficulty_gap)
    
    # Combine scores with weights
    weighted_sum = (
        zpd_score * zpd_weight +
        preference_score * pref_weight +
        (1 - recency_penalty) * recency_weight
    )
    
    # Scale to 0-100
    return weighted_sum * 100


def classify_ability_level(score):
    """Return human-readable ability level from score."""
    if score < 300:
        return "Beginner"
    elif score < 500:
        return "Intermediate"
    elif score < 700:
        return "Advanced"
    else:
        return "Expert"


def classify_difficulty_level(score):
    """Return human-readable difficulty level from score."""
    if score < 300:
        return "Easy"
    elif score < 500:
        return "Medium"
    elif score < 700:
        return "Hard"
    else:
        return "Expert"
