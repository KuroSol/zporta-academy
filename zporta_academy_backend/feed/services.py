# feed/services.py

from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from datetime import timedelta

from quizzes.models import Quiz
from analytics.models import MemoryStat, FeedExposure
from .models import Subject, Language, Region
from quizzes.serializers import QuizSerializer


def log_quiz_feed_exposure(user, quiz, source):
    FeedExposure.objects.create(user=user, quiz=quiz, source=source)


def get_explore_quizzes(user, limit=10):
    recent_ids = FeedExposure.objects.filter(
        user=user,
        shown_at__gte=timezone.now() - timedelta(days=3),
        source="explore"
    ).values_list('quiz_id', flat=True)

    quizzes = Quiz.objects.exclude(id__in=recent_ids).order_by('-created_at')[:limit]
    suggestions = []
    for quiz in quizzes:
        log_quiz_feed_exposure(user, quiz, "explore")
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": "🌎 Latest quizzes to explore",
            "source": "explore"
        })
    return suggestions


def get_personalized_quizzes(user, limit=10):
    prefs = getattr(user, 'preference', None)
    qs = Quiz.objects.none()
    if prefs:
        if prefs.subjects.exists():
            qs = qs | Quiz.objects.filter(subject__in=prefs.subjects.all())
        if prefs.languages.exists():
            qs = qs | Quiz.objects.filter(language__in=prefs.languages.all())
        if prefs.regions.exists():
            qs = qs | Quiz.objects.filter(region__in=prefs.regions.all())

    recent_ids = FeedExposure.objects.filter(
        user=user,
        shown_at__gte=timezone.now() - timedelta(days=3),
        source="personalized"
    ).values_list('quiz_id', flat=True)

    suggestions = []
    for quiz in qs.distinct().exclude(id__in=recent_ids).order_by('-created_at')[:limit]:
        memory = MemoryStat.objects.filter(
            user=user,
            content_type=ContentType.objects.get_for_model(Quiz),
            object_id=quiz.id
        ).first()

        if memory:
            explanation = "📚 Review recommended" if memory.repetitions else "🆕 First time learning this quiz"
            if memory.ai_insights:
                ai_diff = memory.ai_insights.get("difficulty_prediction", {})
                if isinstance(ai_diff, dict):
                    explanation += f" · AI thinks this is a **{ai_diff.get('predicted_class','?')}** quiz"
        else:
            explanation = "🔍 Based on your interests or subject"

        log_quiz_feed_exposure(user, quiz, "personalized")
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": explanation,
            "source": "personalized"
        })

    return suggestions


def get_review_queue(user, limit=10):
    now = timezone.now()
    quiz_ct = ContentType.objects.get_for_model(Quiz)

    recent_ids = FeedExposure.objects.filter(
        user=user,
        shown_at__gte=now - timedelta(days=3),
        source="review"
    ).values_list('quiz_id', flat=True)

    stats = MemoryStat.objects.filter(
        user=user,
        content_type=quiz_ct,
        next_review_at__lte=now
    ).exclude(object_id__in=recent_ids).order_by('next_review_at')[:limit]

    suggestions = []
    for stat in stats:
        quiz = stat.learnable_item  # GenericForeignKey
        if not quiz:
            continue

        reps = stat.repetitions or 0
        overdue = (now - stat.next_review_at).days
        if reps == 0:
            explanation = "🆕 First time learning this quiz"
        elif overdue > 7:
            explanation = f"🔥 Very overdue! ({reps}x reviewed)"
        else:
            explanation = f"🧠 Due for review ({reps}x reviewed)"

        log_quiz_feed_exposure(user, quiz, "review")
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": explanation,
            "source": "review"
        })

    return suggestions


def generate_user_feed(user, limit=15):
    """
    Unified feed: Review > Personalized > Explore,
    then fallback random picks based on user prefs.
    """
    seen_ids = set()
    final = []

    # 1) Review
    for item in get_review_queue(user, limit=limit):
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            final.append(item)
        if len(final) >= limit:
            return final

    # 2) Personalized
    for item in get_personalized_quizzes(user, limit=limit):
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            final.append(item)
        if len(final) >= limit:
            return final

    # 3) Explore (latest)
    for item in get_explore_quizzes(user, limit=limit):
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            final.append(item)
        if len(final) >= limit:
            return final

    # 4) Random fallback, respecting user prefs
    remaining = limit - len(final)
    if remaining > 0:
        prefs = getattr(user, 'preference', None)
        qs = Quiz.objects.exclude(id__in=seen_ids)
        if prefs:
            cond = Q()
            if prefs.subjects.exists():
                cond |= Q(subject__in=prefs.subjects.all())
            if prefs.languages.exists():
                cond |= Q(language__in=prefs.languages.all())
            if prefs.regions.exists():
                cond |= Q(region__in=prefs.regions.all())
            # If you have a hashtags field on Quiz:
            # if prefs.hashtags.exists():
            #     cond |= Q(hashtags__in=prefs.hashtags.all())

            qs = qs.filter(cond).distinct()

        for quiz in qs.order_by('?')[:remaining]:
            log_quiz_feed_exposure(user, quiz, "explore")
            final.append({
                **QuizSerializer(quiz).data,
                "why": "🎲 A random pick for you",
                "source": "explore"
            })
            if len(final) >= limit:
                break

    return final
