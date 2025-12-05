# intelligence/feed_enhancement.py
"""
Enhanced feed logic with AI integration.

This module provides functions to enhance the feed system with AI-powered recommendations.
Integrates with the existing feed/services.py module.
"""

import logging
from django.contrib.contenttypes.models import ContentType
from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer
from analytics.models import QuizAttempt

try:
    from intelligence.models import MatchScore, UserAbilityProfile
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False

logger = logging.getLogger(__name__)


def get_ai_personalized_quizzes(user, limit=50):
    """
    Get personalized quiz recommendations using AI match scores.
    
    Returns list of quiz dicts with match scores and explanations.
    Returns None if AI data is not available (caller should fallback to classic logic).
    """
    if not AI_AVAILABLE:
        return None
    
    try:
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        match_scores = MatchScore.objects.filter(
            user=user,
            content_type=quiz_ct
        ).select_related('content_type').order_by('-match_score')[:limit]
        
        if not match_scores.exists():
            logger.info(f"No AI match scores available for user {user.id}")
            return None
        
        # Fetch actual quiz objects
        quiz_ids = [ms.object_id for ms in match_scores]
        quizzes = Quiz.objects.filter(
            id__in=quiz_ids,
            status='published'
        ).select_related('subject').prefetch_related('tags')
        
        quiz_dict = {q.id: q for q in quizzes}
        
        # Build suggestions with AI explanations
        suggestions = []
        for ms in match_scores:
            quiz = quiz_dict.get(ms.object_id)
            if not quiz:
                continue
            
            # Check if user has attempted this quiz
            tried = QuizAttempt.objects.filter(user=user, quiz=quiz).exists()
            
            # Generate explanation
            if not tried:
                why = ms.get_why_explanation()
            else:
                why = "🔄 Review this quiz to reinforce learning"
            
            suggestions.append({
                **QuizSerializer(quiz).data,
                "why": why,
                "source": "personalized_ai",
                "match_score": round(ms.match_score, 1),
                "difficulty_gap": round(ms.difficulty_gap, 1),
            })
        
        logger.info(f"AI personalization returned {len(suggestions)} items for user {user.id}")
        return suggestions
        
    except Exception as e:
        logger.error(f"Error getting AI personalized quizzes for user {user.id}: {e}", exc_info=True)
        return None


def get_ai_challenge_quizzes(user, limit=10):
    """
    Get challenging quizzes (difficulty above user's ability).
    Returns quizzes with positive difficulty gap > 50.
    """
    if not AI_AVAILABLE:
        return []
    
    try:
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        match_scores = MatchScore.objects.filter(
            user=user,
            content_type=quiz_ct,
            difficulty_gap__gte=50  # Challenging content
        ).select_related('content_type').order_by('-match_score')[:limit]
        
        if not match_scores.exists():
            return []
        
        quiz_ids = [ms.object_id for ms in match_scores]
        quizzes = Quiz.objects.filter(
            id__in=quiz_ids,
            status='published'
        ).select_related('subject')
        
        quiz_dict = {q.id: q for q in quizzes}
        
        suggestions = []
        for ms in match_scores:
            quiz = quiz_dict.get(ms.object_id)
            if quiz:
                suggestions.append({
                    **QuizSerializer(quiz).data,
                    "why": "🚀 Challenge yourself with this harder content!",
                    "source": "challenge",
                    "match_score": round(ms.match_score, 1),
                })
        
        return suggestions
        
    except Exception as e:
        logger.error(f"Error getting challenge quizzes for user {user.id}: {e}", exc_info=True)
        return []


def get_ai_confidence_builders(user, limit=10):
    """
    Get easier quizzes for confidence building.
    Returns quizzes with negative difficulty gap < -30.
    """
    if not AI_AVAILABLE:
        return []
    
    try:
        quiz_ct = ContentType.objects.get_for_model(Quiz)
        match_scores = MatchScore.objects.filter(
            user=user,
            content_type=quiz_ct,
            difficulty_gap__lte=-30  # Easier content
        ).select_related('content_type').order_by('-match_score')[:limit]
        
        if not match_scores.exists():
            return []
        
        quiz_ids = [ms.object_id for ms in match_scores]
        quizzes = Quiz.objects.filter(
            id__in=quiz_ids,
            status='published'
        ).select_related('subject')
        
        quiz_dict = {q.id: q for q in quizzes}
        
        suggestions = []
        for ms in match_scores:
            quiz = quiz_dict.get(ms.object_id)
            if quiz:
                suggestions.append({
                    **QuizSerializer(quiz).data,
                    "why": "⚡ Quick win to build confidence!",
                    "source": "confidence",
                    "match_score": round(ms.match_score, 1),
                })
        
        return suggestions
        
    except Exception as e:
        logger.error(f"Error getting confidence builders for user {user.id}: {e}", exc_info=True)
        return []


def get_user_ability_info(user):
    """
    Get user's ability profile information.
    Returns dict with ability score, level, rank, percentile, or None if not available.
    """
    if not AI_AVAILABLE:
        return None
    
    try:
        profile = UserAbilityProfile.objects.get(user=user)
        return {
            'ability_score': round(profile.overall_ability_score, 1),
            'ability_level': profile.get_ability_level(),
            'global_rank': profile.global_rank,
            'percentile': round(profile.percentile, 1) if profile.percentile else None,
            'total_attempts': profile.total_quizzes_attempted,
        }
    except UserAbilityProfile.DoesNotExist:
        return None
