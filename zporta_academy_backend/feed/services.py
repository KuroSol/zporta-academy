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
def get_personalized_quizzes(user, limit=50):
    prefs = UserPreference.objects.filter(user=user).first()
    # 1) Must have at least one subject
    if not prefs or not prefs.interested_subjects.exists():
        return []

    # Base queryset: subject match only
    base_qs = Quiz.objects.filter(
        subject__in=prefs.interested_subjects.all()
    )

    # 2) Figure out language buckets
    # Primary “local” language (first in your array), fallback to English
    local_lang = prefs.languages_spoken[0] if prefs.languages_spoken else "en"

    local_qs   = base_qs.filter(languages__contains=[local_lang])
    english_qs = base_qs.filter(languages__contains=["en"])
    other_qs   = base_qs.exclude(id__in=local_qs).exclude(id__in=english_qs)

    # 3) Decide how many from each bucket
    cnt_local   = int(limit * 0.80)
    cnt_english = int(limit * 0.15)
    cnt_random  = limit - cnt_local - cnt_english  # ~5%

    selected = []

    # 4a) Take up to cnt_local from local_qs, BUT push location‐matches first
    if prefs.location:
        loc_match_qs = local_qs.filter(detected_location__icontains=prefs.location)
        selected += list(loc_match_qs.order_by('-created_at')[:cnt_local])

        if len(selected) < cnt_local:
            # fill remaining from the rest of local_qs
            remaining = cnt_local - len(selected)
            non_loc = local_qs.exclude(id__in=[q.id for q in selected])
            selected += list(non_loc.order_by('-created_at')[:remaining])
    else:
        selected += list(local_qs.order_by('-created_at')[:cnt_local])

    # 4b) Pull in English‐fallback (if primary wasn’t English)
    if local_lang != "en" and cnt_english > 0:
        en_candidates = english_qs.exclude(id__in=[q.id for q in selected])
        selected += list(en_candidates.order_by('-created_at')[:cnt_english])

    # 4c) And then sprinkle in cnt_random truly random quizzes
    if cnt_random > 0:
        random_candidates = other_qs.exclude(id__in=[q.id for q in selected]).order_by('?')[:cnt_random]
        selected += list(random_candidates)

    # 5) If we still haven’t hit “limit” (because some buckets were too small),
    #    top up from any remaining subject‐matched quizzes.
    if len(selected) < limit:
        extra = base_qs.exclude(id__in=[q.id for q in selected]).order_by('?')[:(limit - len(selected))]
        selected += list(extra)

    # 6) Finally, serialize & add your “why” / source metadata
    suggestions = []
    for quiz in selected:
        already = QuizAttempt.objects.filter(user=user, quiz=quiz).exists()
        why = "🔍 Based on your interests" if not already else "🔄 Quiz available for review"
        suggestions.append({
            **QuizSerializer(quiz).data,
            "why": why,
            "source": "personalized",
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

    # Avoid showing quizzes recently attempted
    recently_attempted_quiz_ids = set(QuizAttempt.objects.filter(
        user=user,
        attempted_at__gte=timezone.now() - timedelta(minutes=10)
    ).values_list('quiz_id', flat=True))

    # Corrected helper function
    def add_to_feed(quizzes):
        for quiz in quizzes:
            if quiz["id"] not in seen_ids and quiz["id"] not in recently_attempted_quiz_ids:
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

    # 1) Try to pull up to `remaining` quizzes matching their prefs, in random order
    pref_quizzes = list(
        Quiz.objects.filter(cond)
            .exclude(id__in=seen_ids.union(recently_attempted_quiz_ids))
            .order_by('?')[:remaining]
    )

    # 2) If that didn’t fill the quota, top up with truly random quizzes
    if len(pref_quizzes) < remaining:
        exclude_ids = seen_ids.union(recently_attempted_quiz_ids)\
                            .union({q.id for q in pref_quizzes})
        extra = list(
            Quiz.objects.exclude(id__in=exclude_ids)
                .order_by('?')[:(remaining - len(pref_quizzes))]
        )
        pref_quizzes.extend(extra)

    # 3) Log and append them
    for quiz in pref_quizzes:
        log_quiz_feed_exposure(user, quiz, "explore")
        final_feed.append({
            **QuizSerializer(quiz).data,
            "why": "🎲 A random pick based on your profile",
            "source": "explore"
        })

    return final_feed
