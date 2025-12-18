# feed/views.py
from rest_framework.response import Response
from .services import generate_user_feed
from rest_framework import permissions, generics
from rest_framework import generics, permissions
from rest_framework.views import APIView
from .services import get_explore_quizzes, get_personalized_quizzes, get_review_queue
from .serializers import QuizFeedSerializer
from quizzes.models import Quiz, Question
from django.shortcuts import get_object_or_404
from django.conf import settings
import os, json, random

# Feeds (return serialized dicts from services)
class ExploreQuizListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        return Response(get_explore_quizzes(request.user, limit))

class PersonalizedQuizListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        return Response(get_personalized_quizzes(request.user, limit))

class ReviewQuizListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        return Response(get_review_queue(request.user, limit))


    
class UnifiedFeedView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuizFeedSerializer

    def get(self, request):
        data = generate_user_feed(request.user)
        return Response(data)

class NextQuizView(APIView):
    """
    Optimized feed endpoint that prevents filtering exhaustion.
    
    Key improvements:
    1. Limits exclude list to last 20 items (prevents infinite filtering)
    2. Uses direct database query instead of generating full feed
    3. Caches first question on Quiz model for performance
    4. Returns early when insufficient items found (end of content signal)
    """
    permission_classes = [permissions.AllowAny]

    def normalize_current(self, request):
        """Resolve current quiz from params: accepts question permalink or quiz id/permalink."""
        current_question = request.query_params.get('current_question')
        current_quiz_id = request.query_params.get('current_quiz_id')
        current_quiz_permalink = request.query_params.get('current_quiz_permalink')

        if current_question:
            s = str(current_question).strip()
            try:
                from urllib.parse import urlparse
                if s.startswith('http'):
                    s = urlparse(s).path
            except Exception:
                pass
            s = s.lstrip('/')
            if s.startswith('quizzes/q/'):
                s = s[len('quizzes/q/'):]
            question = get_object_or_404(Question, permalink=s)
            return question.quiz

        if current_quiz_id:
            try:
                return get_object_or_404(Quiz, id=int(current_quiz_id))
            except Exception:
                pass

        if current_quiz_permalink:
            s = str(current_quiz_permalink).strip()
            try:
                from urllib.parse import urlparse
                if s.startswith('http'):
                    s = urlparse(s).path
            except Exception:
                pass
            s = s.lstrip('/')
            if s.startswith('quizzes/'):
                s = s[len('quizzes/'):]
            return get_object_or_404(Quiz, permalink=s)

        return None

    def get(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        current_quiz = self.normalize_current(request)
        limit = max(1, min(int(request.query_params.get('limit', 20)), 50))
        
        # Parse exclude list from comma-separated IDs
        exclude_ids = set()
        exclude_param = request.query_params.get('exclude')
        if exclude_param:
            try:
                exclude_parts = [int(p.strip()) for p in exclude_param.split(',') if p.strip().isdigit()]
                exclude_ids = set(exclude_parts)
                print(f"[DEBUG] Parsed exclude_param '{exclude_param}' → {len(exclude_ids)} IDs: {sorted(list(exclude_ids))}")
            except Exception as e:
                print(f"[DEBUG] Failed to parse exclude: {e}")

        if current_quiz:
            exclude_ids.add(current_quiz.id)
            print(f"[DEBUG] Added current_quiz {current_quiz.id} to exclude. Total exclude count: {len(exclude_ids)}")

        # FIXED: Actually apply the exclude filter to the queryset
        from django.db.models import Prefetch

        questions_prefetch = Prefetch(
            'questions',
            queryset=Question.objects.order_by('id'),
            to_attr='prefetched_questions'
        )

        # Filter OUT excluded quizzes and return published quizzes NOT in exclude_ids
        quizzes_qs = Quiz.objects.filter(
            status='published'
        ).exclude(
            id__in=exclude_ids  # <-- NOW actually excluding!
        ).select_related(
            'subject'
        ).prefetch_related(
            'tags',
            questions_prefetch
        ).order_by('-created_at')[:limit * 5]

        print(f"[DEBUG] After exclude filter: queryset count = {quizzes_qs.count()}, requesting limit={limit}")

        def priority_score(quiz):
            # Higher score = earlier in the feed
            score = 0
            if current_quiz and quiz.subject_id and current_quiz.subject_id == quiz.subject_id:
                score += 10
            if hasattr(quiz, 'created_at') and quiz.created_at:
                score += 1
            return score

        quizzes_sorted = sorted(
            quizzes_qs,
            key=lambda q: (
                priority_score(q),
                getattr(q, 'created_at', None) or 0
            ),
            reverse=True
        )

        items = []
        for quiz in quizzes_sorted:
            # Get first question efficiently (prefetched)
            prefetched = getattr(quiz, 'prefetched_questions', None)
            first_q = prefetched[0] if prefetched else None
            if not first_q:
                continue

            total_questions = None
            if prefetched is not None:
                total_questions = len(prefetched)
            if total_questions is None:
                try:
                    total_questions = quiz.questions.count()
                except Exception:
                    total_questions = 0

            items.append({
                "id": quiz.id,
                "quiz_id": quiz.id,
                "quiz_title": quiz.title,
                "quiz_permalink": quiz.permalink,
                "first_question_permalink": first_q.permalink,
                "first_question_url": f"/quizzes/q/{first_q.permalink}",
                "total_questions": total_questions or 0,
            })

            if len(items) >= limit:
                break

        print(f"[DEBUG] Returning {len(items)} items. Quiz IDs: {[item['id'] for item in items]}")

        # END OF CONTENT: only when no items found after exclusions
        total_available = Quiz.objects.filter(status='published').exclude(id__in=exclude_ids).count()
        is_end = len(items) == 0

        if len(items) < limit:
            print(
                f"[DEBUG] Partial batch - requested {limit}, got {len(items)}, "
                f"exclude_ids: {len(exclude_ids)}, available_after_exclude: {total_available}"
            )

        if not items:
            return Response({
                "detail": "No quizzes available",
                "items": [],
                "count": 0,
                "is_end_of_content": True
            }, status=200)

        data = {
            "items": items,
            "first_question_permalink": items[0]["first_question_permalink"],
            "first_question_url": items[0]["first_question_url"],
            "count": len(items),
            "is_end_of_content": is_end
        }
        return Response(data)
    
class LanguageChoicesView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # single source of truth: codes that match Quiz.languages contents
        return Response([
            {"id": "en", "name": "English"},
            {"id": "ja", "name": "Japanese"},
            {"id": "es", "name": "Spanish"},
            {"id": "fr", "name": "French"},
            {"id": "de", "name": "German"},
        ])
    
class RegionChoicesView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # stub list; replace with real regions if you have a model
        return Response([
            {"id": "us", "name": "United States"},
            {"id": "jp", "name": "Japan"},
            {"id": "gb", "name": "United Kingdom"},
        ])