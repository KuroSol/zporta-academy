# users/activity_views.py
"""
Views for user activity and progress tracking.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.utils.dateparse import parse_date

from .activity_models import UserActivity
from .activity_serializers import (
    UserActivitySerializer, 
    ProgressOverviewSerializer,
    LearningScoreSerializer,
    ImpactScoreSerializer
)
from .scoring_service import ScoringService
from .learning_score_service import (
    compute_learning_score, 
    compute_impact_score,
    compute_learning_analytics,
    compute_impact_analytics
)


class LearningScoreView(APIView):
    """
    GET /api/learning-score/
    Returns learning score breakdown with quiz questions, lessons, and enrolled courses.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        score_data = compute_learning_score(user)
        
        serializer = LearningScoreSerializer(score_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ImpactScoreView(APIView):
    """
    GET /api/impact-score/
    Returns impact score breakdown with student enrollments and quiz attempts.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        score_data = compute_impact_score(user)
        
        serializer = ImpactScoreSerializer(score_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProgressOverviewView(APIView):
    """
    GET /api/progress/overview/
    Returns learning score, impact score, rankings, and activity breakdown.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        overview_data = ScoringService.get_progress_overview(user)
        
        serializer = ProgressOverviewSerializer(overview_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ActivityHistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ActivityHistoryView(APIView):
    """
    GET /api/progress/history/
    Returns paginated list of recent user activities.
    Supports filtering: ?role=student&activity_type=LESSON_COMPLETED&search=math
    Date range filters (ISO date): ?start_date=2025-11-01&end_date=2025-11-30
    """
    permission_classes = [IsAuthenticated]
    pagination_class = ActivityHistoryPagination
    
    def get(self, request):
        user = request.user
        activities = UserActivity.objects.filter(user=user).select_related(
            'content_type'
        ).order_by('-created_at')
        
        # Filter by role if provided
        role = request.query_params.get('role', None)
        if role in ['student', 'teacher']:
            activities = activities.filter(role=role)
        
        # Filter by activity_type if provided
        activity_type = request.query_params.get('activity_type', None)
        if activity_type:
            activities = activities.filter(activity_type=activity_type)
        
        # Search in metadata (JSON field) - simple text search
        search = request.query_params.get('search', None)
        if search:
            # Search in metadata JSON as text (basic approach)
            from django.db.models import Q
            activities = activities.filter(
                Q(metadata__icontains=search) |
                Q(activity_type__icontains=search)
            )

        # Date range filters
        start_date = request.query_params.get('start_date') or request.query_params.get('from')
        end_date = request.query_params.get('end_date') or request.query_params.get('to')
        if start_date:
            d = parse_date(start_date)
            if d:
                activities = activities.filter(created_at__date__gte=d)
        if end_date:
            d = parse_date(end_date)
            if d:
                activities = activities.filter(created_at__date__lte=d)
        
        # Add pagination
        paginator = ActivityHistoryPagination()
        paginated_activities = paginator.paginate_queryset(activities, request)
        
        serializer = UserActivitySerializer(paginated_activities, many=True)
        return paginator.get_paginated_response(serializer.data)


class LearningAnalyticsView(APIView):
    """
    GET /api/learning-analytics/
    Returns detailed learning analytics with insights and recommendations.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        analytics_data = compute_learning_analytics(user)
        return Response(analytics_data, status=status.HTTP_200_OK)


class ImpactAnalyticsView(APIView):
    """
    GET /api/impact-analytics/
    Returns detailed impact analytics with content performance insights.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        analytics_data = compute_impact_analytics(user)
        return Response(analytics_data, status=status.HTTP_200_OK)
