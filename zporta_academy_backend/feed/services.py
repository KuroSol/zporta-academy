from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from quizzes.models import Quiz               # or wherever your Quiz model lives
from analytics.models import MemoryStat        # for spaced-rep review
from .models import Subject, Language, Region  # feed lookup tables

def get_explore_quizzes(user, limit=10):
    """
    The “Explore” feed: e.g. latest or trending quizzes.
    Here we grab the most recent quizzes (or you could randomize or
    sort by a popularity metric once you have one).
    """
    return Quiz.objects.all()\
        .order_by('-created_at')[:limit]

def get_personalized_quizzes(user, limit=10):
    """
    The “Personalized” feed: based on the user’s Subject/Language/Region
    preferences. We filter quizzes by those lookups.
    """
    prefs = getattr(user, 'preference', None)
    qs = Quiz.objects.none()
    if prefs:
        # assuming your Quiz has fields subject, language, region
        if prefs.subjects.exists():
            qs = qs | Quiz.objects.filter(subject__in=prefs.subjects.all())
        if prefs.languages.exists():
            qs = qs | Quiz.objects.filter(language__in=prefs.languages.all())
        if prefs.regions.exists():
            qs = qs | Quiz.objects.filter(region__in=prefs.regions.all())
    suggestions = []

    for quiz in qs.distinct().order_by('-created_at')[:limit]:
        memory = MemoryStat.objects.filter(
            user=user,
            content_type=ContentType.objects.get_for_model(Quiz),
            object_id=quiz.id
        ).first()

        if memory:
            is_first_time = memory.repetitions == 0
            explanation = "📚 Review recommended" if not is_first_time else "🆕 First time learning this quiz"
        else:
            explanation = "🔍 Based on your interests or subject"

        if memory and memory.ai_insights:
            ai_diff = memory.ai_insights.get("difficulty_prediction", {})
            if isinstance(ai_diff, dict):
                explanation += f" · AI thinks this is a **{ai_diff.get('predicted_class', '?')}** quiz"

        suggestions.append({
            "quiz": quiz,
            "why": explanation,
        })

    return suggestions  # Change serializer or flatten in the vie

def get_review_queue(user, limit=10):
    """
    The “Review” queue: quizzes the user is due to review based on MemoryStat.
    """
    now = timezone.now()
    quiz_ct = ContentType.objects.get_for_model(Quiz)

    # 1) get ALL due stats, ordered by due date
    qs_stats = MemoryStat.objects.filter(
        user=user,
        content_type=quiz_ct,
        next_review_at__lte=now
    ).order_by('next_review_at')

    # 2) slice in Python and pull out IDs
    quiz_ids = list(qs_stats.values_list('object_id', flat=True)[:limit])
    if not quiz_ids:
        return Quiz.objects.none()

    # 3) simple IN query on that list (no subquery LIMIT)
    return Quiz.objects.filter(pk__in=quiz_ids)
