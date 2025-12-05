# intelligence/views.py
"""
API views for the AI Intelligence system.

All views return precomputed data - no heavy ML inference happens here.
Response times should be <20ms for typical requests.
"""

import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Avg, Count, Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType

from .models import UserAbilityProfile, ContentDifficultyProfile, MatchScore
from .serializers import (
    UserAbilityProfileSerializer,
    LearningPathItemSerializer,
    ProgressInsightSerializer,
    RecommendedSubjectSerializer
)
from quizzes.models import Quiz
from subjects.models import Subject
from analytics.models import ActivityEvent

logger = logging.getLogger(__name__)


class MyAbilityView(APIView):
    """
    GET /api/intelligence/my-ability/
    
    Returns the authenticated user's ability profile with rankings and breakdowns.
    Fast lookup from UserAbilityProfile (precomputed data).
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            profile = UserAbilityProfile.objects.get(user=request.user)
            serializer = UserAbilityProfileSerializer(profile)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except UserAbilityProfile.DoesNotExist:
            # User hasn't attempted enough content yet for ability profiling
            return Response({
                'message': 'Your ability profile is being computed. Please attempt some quizzes first!',
                'overall_ability_score': None,
                'ability_level': 'Unranked',
                'total_quizzes_attempted': 0,
                'global_rank': None,
                'percentile': None,
            }, status=status.HTTP_200_OK)


class LearningPathView(APIView):
    """
    GET /api/intelligence/learning-path/
    
    Returns optimized sequence of next 20 quizzes for the user.
    Based on MatchScore (precomputed optimal content for this user).
    
    Query params:
    - limit: Number of items to return (default: 20, max: 50)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        limit = min(int(request.query_params.get('limit', 20)), 50)
        
        try:
            # Fetch top match scores for this user
            match_scores = MatchScore.objects.filter(
                user=request.user,
                content_type=ContentType.objects.get_for_model(Quiz)
            ).select_related('content_type').order_by('-match_score')[:limit]
            
            if not match_scores.exists():
                return Response({
                    'message': 'Your personalized learning path is being computed. Check back soon!',
                    'path': []
                }, status=status.HTTP_200_OK)
            
            # Build learning path with quiz details
            path = []
            quiz_ids = [ms.object_id for ms in match_scores]
            quizzes = Quiz.objects.filter(id__in=quiz_ids, status='published').select_related('subject')
            quiz_dict = {q.id: q for q in quizzes}
            
            for ms in match_scores:
                quiz = quiz_dict.get(ms.object_id)
                if not quiz:
                    continue
                
                # Get difficulty profile if available
                try:
                    diff_profile = ContentDifficultyProfile.objects.get(
                        content_type=ContentType.objects.get_for_model(Quiz),
                        object_id=quiz.id
                    )
                    difficulty_score = diff_profile.computed_difficulty_score
                    difficulty_level = diff_profile.get_difficulty_level()
                    est_time = int(diff_profile.avg_time_spent_seconds / 60) if diff_profile.avg_time_spent_seconds else 10
                except ContentDifficultyProfile.DoesNotExist:
                    difficulty_score = quiz.computed_difficulty_score or 400.0
                    difficulty_level = quiz.difficulty_level or 'medium'
                    est_time = 10
                
                path.append({
                    'quiz_id': quiz.id,
                    'title': quiz.title,
                    'subject': quiz.subject.name if quiz.subject else None,
                    'difficulty_score': difficulty_score,
                    'difficulty_level': difficulty_level,
                    'match_score': ms.match_score,
                    'why': ms.get_why_explanation(),
                    'estimated_time_minutes': est_time,
                    'permalink': quiz.permalink,
                })
            
            serializer = LearningPathItemSerializer(path, many=True)
            return Response({
                'path': serializer.data,
                'total_items': len(path)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating learning path for user {request.user.id}: {e}", exc_info=True)
            return Response({
                'error': 'Unable to generate learning path at this time.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProgressInsightsView(APIView):
    """
    GET /api/intelligence/progress-insights/
    
    Returns trend analysis, strengths, weaknesses, and achievements.
    Analyzes UserAbilityProfile history and recent activity.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get ability profile
            try:
                profile = UserAbilityProfile.objects.get(user=request.user)
                trend = profile.recent_performance_trend
                ability_score = profile.overall_ability_score
            except UserAbilityProfile.DoesNotExist:
                return Response({
                    'message': 'Not enough data yet. Complete some quizzes to see insights!',
                    'overall_trend': 'Insufficient data',
                    'strengths': [],
                    'weaknesses': [],
                }, status=status.HTTP_200_OK)
            
            # Determine trend direction
            if trend > 5:
                trend_direction = 'Improving 📈'
                overall_trend = 'Great progress!'
            elif trend < -5:
                trend_direction = 'Declining 📉'
                overall_trend = 'Keep practicing to improve'
            else:
                trend_direction = 'Stable ➡️'
                overall_trend = 'Consistent performance'
            
            # Find strengths (subjects with high ability)
            strengths = []
            if profile.ability_by_subject:
                sorted_subjects = sorted(
                    profile.ability_by_subject.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:3]
                
                for subject_id, score in sorted_subjects:
                    try:
                        subject = Subject.objects.get(id=int(subject_id))
                        strengths.append({
                            'subject': subject.name,
                            'score': round(score, 1),
                            'level': self._score_to_level(score)
                        })
                    except Subject.DoesNotExist:
                        continue
            
            # Find weaknesses (subjects with low ability relative to overall)
            weaknesses = []
            if profile.ability_by_subject:
                sorted_weak = sorted(
                    profile.ability_by_subject.items(),
                    key=lambda x: x[1]
                )[:3]
                
                for subject_id, score in sorted_weak:
                    if score < ability_score - 50:  # Significantly below overall
                        try:
                            subject = Subject.objects.get(id=int(subject_id))
                            weaknesses.append({
                                'subject': subject.name,
                                'score': round(score, 1),
                                'gap': round(ability_score - score, 1)
                            })
                        except Subject.DoesNotExist:
                            continue
            
            # Recommended focus areas
            focus_areas = []
            if weaknesses:
                focus_areas.append(f"Focus on {weaknesses[0]['subject']} to close the gap")
            if trend < 0:
                focus_areas.append("Review recently difficult topics")
            if profile.total_quizzes_attempted < 10:
                focus_areas.append("Attempt more quizzes to build confidence")
            
            # Recent achievements (mock - can be expanded with actual achievement system)
            achievements = []
            if profile.total_quizzes_attempted >= 10:
                achievements.append({
                    'title': 'Quiz Explorer',
                    'description': 'Completed 10+ quizzes',
                    'icon': '🎯'
                })
            if ability_score >= 600:
                achievements.append({
                    'title': 'Advanced Learner',
                    'description': 'Reached Advanced level',
                    'icon': '🚀'
                })
            
            # Next milestones
            milestones = []
            if profile.total_quizzes_attempted < 50:
                milestones.append({
                    'title': 'Quiz Master',
                    'target': 50,
                    'current': profile.total_quizzes_attempted,
                    'description': 'Complete 50 quizzes'
                })
            if ability_score < 700:
                milestones.append({
                    'title': 'Reach Expert Level',
                    'target': 700,
                    'current': int(ability_score),
                    'description': 'Achieve 700+ ability score'
                })
            
            data = {
                'overall_trend': overall_trend,
                'trend_direction': trend_direction,
                'performance_change': round(trend, 1),
                'strengths': strengths,
                'weaknesses': weaknesses,
                'recommended_focus_areas': focus_areas,
                'recent_achievements': achievements,
                'next_milestones': milestones,
            }
            
            serializer = ProgressInsightSerializer(data)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating progress insights for user {request.user.id}: {e}", exc_info=True)
            return Response({
                'error': 'Unable to generate insights at this time.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @staticmethod
    def _score_to_level(score):
        """Convert ability score to level name."""
        if score < 300:
            return "Beginner"
        elif score < 500:
            return "Intermediate"
        elif score < 700:
            return "Advanced"
        else:
            return "Expert"


class RecommendedSubjectsView(APIView):
    """
    GET /api/intelligence/recommended-subjects/
    
    Suggests new subjects to explore based on:
    - Current strengths (related subjects)
    - Popular subjects the user hasn't tried
    - Subjects with good content availability
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get subjects user has already attempted
            attempted_quiz_ids = ActivityEvent.objects.filter(
                user=request.user,
                event_type='quiz_answer_submitted'
            ).values_list('metadata__quiz_id', flat=True).distinct()
            
            attempted_subjects = Quiz.objects.filter(
                id__in=attempted_quiz_ids
            ).values_list('subject_id', flat=True).distinct()
            
            # Find subjects with good content that user hasn't tried
            recommendations = []
            
            # Get all subjects with published quizzes
            subjects_with_content = Subject.objects.annotate(
                quiz_count=Count('quizzes', filter=Q(quizzes__status='published'))
            ).filter(quiz_count__gte=3).exclude(
                id__in=attempted_subjects
            ).order_by('-quiz_count')[:5]
            
            for subject in subjects_with_content:
                recommendations.append({
                    'subject_id': subject.id,
                    'subject_name': subject.name,
                    'relevance_score': 80.0,  # Can be computed based on similarity to current interests
                    'reason': f'{subject.quiz_count} quizzes available to explore',
                    'quiz_count': subject.quiz_count
                })
            
            serializer = RecommendedSubjectSerializer(recommendations, many=True)
            return Response({
                'recommended_subjects': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating recommended subjects for user {request.user.id}: {e}", exc_info=True)
            return Response({
                'error': 'Unable to generate recommendations at this time.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
