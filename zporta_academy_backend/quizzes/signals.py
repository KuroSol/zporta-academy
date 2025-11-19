import os
import re
from bs4 import BeautifulSoup
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Quiz, Tag
from django.core.cache import cache

from langdetect import detect_langs, LangDetectException

# --- Script-based Regex Patterns ---
# Persian unique letters: peh (067E), tcheh (0686), jeh (0698), gaf (06AF), keheh (06A9), farsi yeh (06CC)
PERSIAN_REGEX = re.compile(r'[\u067E\u0686\u0698\u06AF\u06A9\u06CC]')
KANA_REGEX    = re.compile(r'[\u3040-\u30FF]')
THAI_REGEX    = re.compile(r'[\u0E00-\u0E7F]')
CJK_REGEX     = re.compile(r'[\u4E00-\u9FFF]')
ARABIC_REGEX  = re.compile(r'[\u0600-\u06FF]')

# --- Fallback languages for statistical detection ---
ALLOWED_LANGUAGES = {'en', 'fr', 'it', 'es', 'de', 'pt', 'ru', 'hi', 'bn', 'ko'}


def extract_text_from_quiz(quiz):
    parts = [quiz.title or "", quiz.content or ""]
    for q in quiz.questions.all():
        parts.append(q.question_text or "")
        for opt in (q.option1, q.option2, q.option3, q.option4):
            if opt:
                parts.append(opt)
    raw = " ".join(parts)
    return BeautifulSoup(raw, "html.parser").get_text(separator=" ").strip()


def fallback_detect(text):
    try:
        langs = detect_langs(text)
    except LangDetectException:
        return []
    detected = []
    for lp in langs:
        if lp.lang in ALLOWED_LANGUAGES and lp.prob >= 0.2:
            detected.append(lp.lang)
    if not detected and langs:
        detected.append(langs[0].lang)
    return detected[:3]


@receiver(post_save, sender=Quiz)
def analyze_quiz_content(sender, instance, created, **kwargs):
    # Skip raw fixture loads
    if kwargs.get('raw', False):
        return

    full_text = extract_text_from_quiz(instance)
    if not full_text:
        return

    # 1) Script-based overrides
    if PERSIAN_REGEX.search(full_text):
        detected = ['fa']
    elif KANA_REGEX.search(full_text):
        detected = ['ja']
    elif THAI_REGEX.search(full_text):
        detected = ['th']
    elif CJK_REGEX.search(full_text):
        detected = ['zh']
    elif ARABIC_REGEX.search(full_text):
        detected = ['ar']
    else:
        # 2) Statistical fallback for Latin-based languages
        detected = fallback_detect(full_text)

    # Prepare update if languages have changed
    update_kwargs = {}
    if detected and instance.languages != detected:
        update_kwargs['languages'] = detected

    # 3) Keyword tagging via RAKE (unchanged)
    new_tags = []
    try:
        from rake_nltk import Rake
        rake = Rake()
        rake.extract_keywords_from_text(full_text)
        for score, phrase in rake.get_ranked_phrases_with_scores():
            phrase = phrase.lower().strip()
            if score > 4 and 1 < len(phrase.split()) < 4 and 2 < len(phrase) < 50:
                if not instance.tags.filter(name=phrase).exists():
                    tag, _ = Tag.objects.get_or_create(name=phrase)
                    new_tags.append(tag)
        if new_tags:
            instance.tags.add(*new_tags)
    except Exception as e:
        print(f"[RAKE Tagging] failed for Quiz {instance.pk}: {e}")

    # 4) Apply language updates
    if update_kwargs:
        Quiz.objects.filter(pk=instance.pk).update(**update_kwargs)

    # Invalidate related course cache if quiz belongs to a course
    if getattr(instance, 'course_id', None):
        cache.delete(f"course_lessons_quizzes_{instance.course_id}")

@receiver(post_save, sender=Quiz)
def invalidate_quiz_course_cache_on_save(sender, instance, **kwargs):
    if getattr(instance, 'course_id', None):
        cache.delete(f"course_lessons_quizzes_{instance.course_id}")

@receiver(post_save, sender=Tag)
def invalidate_quiz_course_cache_on_tag_change(sender, instance, **kwargs):
    # Tag changes don't directly map to a single course; skip heavy invalidation.
    pass
