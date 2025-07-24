# feed/services.py

from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from datetime import timedelta

from quizzes.models import Quiz
from analytics.models import MemoryStat, FeedExposure, QuizAttempt
from quizzes.serializers import QuizSerializer
from users.models import UserPreference

# Utility to track quiz exposure for the user
def log_quiz_feed_exposure(user, quiz, source):
    FeedExposure.objects.create(user=user, quiz=quiz, source=source)

# Fetch latest quizzes (explore)
def get_explore_quizzes(user, limit=5):
    quizzes = Quiz.objects.order_by('-created_at')[:limit]

    suggestions = []
    for quiz in quizzes:
        already_attempted = QuizAttempt.objects.filter(user=user, quiz=quiz).exists()
        explanation = "🌎 Latest quizzes to explore" if not already_attempted else "🔄 Quiz available for review"
        
        log_quiz_feed_exposure(user, quiz, "explore")
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": explanation,
            "source": "explore"
        })
    return suggestions

# Fetch personalized quizzes
def get_personalized_quizzes(user, limit=10):
    prefs = UserPreference.objects.filter(user=user).first()
    if not prefs:
        return []

    conditions = Q()
    if prefs.interested_subjects.exists():
        conditions |= Q(subject__in=prefs.interested_subjects.all())
    for lang in prefs.languages_spoken:
        conditions |= Q(languages__contains=[lang])
    if prefs.location:
        conditions |= Q(detected_location__icontains=prefs.location)
    if prefs.interested_tags.exists():
        conditions |= Q(tags__in=prefs.interested_tags.all())

    quizzes = Quiz.objects.filter(conditions).distinct().order_by('-created_at')[:limit]

    suggestions = []
    for quiz in quizzes:
        already_attempted = QuizAttempt.objects.filter(user=user, quiz=quiz).exists()
        memory = MemoryStat.objects.filter(
            user=user,
            content_type=ContentType.objects.get_for_model(Quiz),
            object_id=quiz.id
        ).first()

        if already_attempted:
            explanation = "🔄 Quiz available for review"
        else:
            explanation = "🔍 Based on your interests"

        if memory:
            explanation += " · 📚 Review recommended"

        log_quiz_feed_exposure(user, quiz, "personalized")
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": explanation,
            "source": "personalized"
        })

    return suggestions

# Fetch review queue for spaced repetition
def get_review_queue(user, limit=50):
    now = timezone.now()
    quiz_ct = ContentType.objects.get_for_model(Quiz)

    recent_ids = FeedExposure.objects.filter(
        user=user,
        shown_at__gte=now - timedelta(days=1),
        source="review"
    ).values_list('quiz_id', flat=True)

    stats = MemoryStat.objects.filter(
        user=user,
        content_type=quiz_ct,
        next_review_at__lte=now
    ).exclude(object_id__in=recent_ids).order_by('next_review_at')[:limit]

    suggestions = []
    for stat in stats:
        quiz = stat.learnable_item
        if not quiz:
            continue

        overdue_days = (now - stat.next_review_at).days
        explanation = (
            "🆕 First-time review" if stat.repetitions == 0 else
            f"🔥 Very overdue! ({overdue_days} days late)" if overdue_days > 7 else
            f"🧠 Review now ({overdue_days} days overdue)"
        )

        log_quiz_feed_exposure(user, quiz, "review")
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": explanation,
            "source": "review"
        })

    return suggestions

# Main unified feed generator
def generate_user_feed(user, limit=55):
    final_feed = []
    seen_ids = set()

    # Helper function to avoid duplicates
    def add_to_feed(quizzes):
        for quiz in quizzes:
            if quiz["id"] not in seen_ids:
                final_feed.append(quiz)
                seen_ids.add(quiz["id"])
                if len(final_feed) >= limit:
                    return True
        return False

    # Priority 1: Review quizzes
    review_quizzes = get_review_queue(user, limit)
    if add_to_feed(review_quizzes):
        return final_feed

    # Priority 2: Personalized quizzes
    personalized_quizzes = get_personalized_quizzes(user, limit)
    if add_to_feed(personalized_quizzes):
        return final_feed

    # Priority 3: Explore quizzes
    explore_quizzes = get_explore_quizzes(user, limit)
    if add_to_feed(explore_quizzes):
        return final_feed

    # Priority 4: Random fallback based on preferences
    remaining = limit - len(final_feed)
    prefs = UserPreference.objects.filter(user=user).first()
    cond = Q()

    if prefs:
        if prefs.interested_subjects.exists():
            cond |= Q(subject__in=prefs.interested_subjects.all())

        for lang in prefs.languages_spoken:
            cond |= Q(languages__contains=[lang])

        if prefs.location:
            cond |= Q(detected_location__icontains=prefs.location)

        if prefs.interested_tags.exists():
            cond |= Q(tags__in=prefs.interested_tags.all())

    fallback_quizzes = Quiz.objects.filter(cond).exclude(id__in=seen_ids).order_by('?')[:remaining]

    for quiz in fallback_quizzes:
        log_quiz_feed_exposure(user, quiz, "explore")
        final_feed.append({
            **QuizSerializer(quiz).data,
            "why": "🎲 A random pick based on your profile",
            "source": "explore"
        })

    return final_feed
