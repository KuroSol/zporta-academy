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
    permission_classes = [permissions.AllowAny]

    def get_first_question(self, quiz: Quiz):
        q = Question.objects.filter(quiz=quiz).order_by('id').first()
        return q

    def normalize_current(self, request):
        """Resolve current quiz from params: accepts question permalink or quiz id/permalink."""
        current_question = request.query_params.get('current_question')
        current_quiz_id = request.query_params.get('current_quiz_id')
        current_quiz_permalink = request.query_params.get('current_quiz_permalink')

        if current_question:
            # Accept full URL/path/permalink; extract slug after 'quizzes/q/' if present
            s = str(current_question).strip()
            try:
                # if URL, keep path
                from urllib.parse import urlparse
                if s.startswith('http'):
                    s = urlparse(s).path
            except Exception:
                pass
            s = s.lstrip('/')
            if s.startswith('quizzes/q/'):
                s = s[len('quizzes/q/'):]
            # Now s should be the question permalink
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
        current_quiz = self.normalize_current(request)
        limit = max(1, min(int(request.query_params.get('limit', 20)), 50))
        exclude_ids = set()
        exclude_param = request.query_params.get('exclude')
        if exclude_param:
            for part in exclude_param.split(','):
                try:
                    exclude_ids.add(int(part))
                except Exception:
                    continue

        # Build a feed (much larger pool to account for exclusions and variety)
        # Request more items to ensure we have enough after filtering
        pool_size = min(500, max(limit * 20, 200))  # At least 200, up to 500
        
        if request.user.is_authenticated:
            # For authenticated users, generate a larger pool and flatten it
            feed = generate_user_feed(request.user, limit=pool_size)
            feed_items = [itm for itm in feed if isinstance(itm, dict) and 'id' in itm]
        else:
            # Anonymous fallback: newest published quizzes (larger window)
            qs = Quiz.objects.filter(status='published').order_by('-created_at')[:pool_size]
            feed_items = [
                {
                    'id': q.id,
                    'detected_location': q.detected_location,
                    'languages': q.languages or [],
                    'subject': q.subject_id,
                    'tags': [{'name': t.name} for t in q.tags.all()],
                }
                for q in qs
            ]

        # Region hint from IP (common headers first)
        region = (
            request.META.get('HTTP_CF_IPCOUNTRY') or
            request.META.get('HTTP_X_APPENGINE_COUNTRY') or
            request.META.get('GEOIP_COUNTRY_CODE') or
            request.META.get('HTTP_X_COUNTRY_CODE') or
            ''
        )
        region = (region or '').strip().lower()

        # Optional interests JSON (path from settings or default project root)
        interests_path = getattr(settings, 'USER_INTERESTS_JSON_PATH', None)
        if not interests_path:
            # try repo root
            interests_path = os.path.join(settings.BASE_DIR, 'user_interests.json')
        user_interests = {}
        try:
            if os.path.exists(interests_path):
                with open(interests_path, 'r', encoding='utf-8') as fh:
                    data = json.load(fh)
                # lookup by username or id
                key = str(request.user.username)
                if key in data:
                    user_interests = data[key]
                else:
                    key = str(request.user.id)
                    user_interests = data.get(key, {})
        except Exception:
            user_interests = {}

        subj_ids = set()
        tag_names = set()
        langs = set()
        # Accept flexible shapes
        if isinstance(user_interests, dict):
            for k in ('subject_ids', 'subjects', 'subjectIds'):
                v = user_interests.get(k)
                if isinstance(v, list):
                    subj_ids.update([int(x) for x in v if str(x).isdigit()])
            for k in ('tags', 'tag_names', 'tagNames'):
                v = user_interests.get(k)
                if isinstance(v, list):
                    tag_names.update([str(x).strip().lower() for x in v if x])
            for k in ('languages', 'langs'):
                v = user_interests.get(k)
                if isinstance(v, list):
                    langs.update([str(x).strip().lower() for x in v if x])

        # Score and reorder feed by interests and region
        def score_item(itm):
            s = 0
            try:
                if region and isinstance(itm.get('detected_location'), str):
                    if region in itm['detected_location'].lower():
                        s += 2
                if subj_ids and itm.get('subject') in subj_ids:
                    s += 3
                if tag_names and isinstance(itm.get('tags'), list):
                    itm_tags = {str(t.get('name', '')).strip().lower() for t in itm['tags']}
                    s += len(tag_names.intersection(itm_tags))
                if langs and isinstance(itm.get('languages'), list):
                    itm_langs = {str(l).strip().lower() for l in itm['languages']}
                    s += len(langs.intersection(itm_langs))
            except Exception:
                pass
            return s

        # Sort by score, but break ties with randomness for variety
        # Use both random float AND request ID to ensure unique orderings across calls
        import time
        seed_value = int(time.time() * 1000) % 10000  # Change every millisecond
        feed_items.sort(key=lambda x: (score_item(x), random.random()), reverse=True)

        # Debug log
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"NextQuizView: Scoring {len(feed_items)} items for user {request.user} (exclude={exclude_ids})")
        logger.debug(f"  Top 5 scores: {[(itm.get('id'), score_item(itm)) for itm in feed_items[:5]]}")

        items = []
        for itm in feed_items:
            if current_quiz and itm['id'] == current_quiz.id:
                continue
            if itm['id'] in exclude_ids:
                continue
            quiz_obj = Quiz.objects.filter(id=itm['id']).first()
            if not quiz_obj:
                continue
            # Skip if quiz is not published
            if quiz_obj.status != 'published':
                continue
            first_q = self.get_first_question(quiz_obj)
            if not first_q:
                continue
            items.append({
                "quiz_id": quiz_obj.id,
                "quiz_title": quiz_obj.title,
                "quiz_permalink": quiz_obj.permalink,
                "first_question_permalink": first_q.permalink,
                "first_question_url": f"/quizzes/q/{first_q.permalink}",
            })
            if len(items) >= limit:
                break

        # If we didn't find enough items, log a warning
        if len(items) < limit:
            logger.warning(f"NextQuizView: Requested {limit} items, only found {len(items)} after filtering")
            logger.warning(f"  Feed pool had {len(feed_items)} items")
            logger.warning(f"  Exclude set: {exclude_ids}")
            logger.warning(f"  Current quiz: {current_quiz.id if current_quiz else 'None'}")

        if not items:
            return Response({"detail": "No next quiz available", "items": []}, status=200)

        data = {
            "items": items,
            "first_question_permalink": items[0]["first_question_permalink"],
            "first_question_url": items[0]["first_question_url"],
            "count": len(items),
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