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


# ============================================================================
# QUESTION PERMALINK AUTO-GENERATION SIGNALS
# ============================================================================

from django.db.models.signals import post_migrate
from django.utils.text import slugify
from .models import Question
import logging

logger = logging.getLogger(__name__)


def japanese_to_romaji(text):
    """Romanize Japanese/non-Latin text for URL-safe slugs"""
    try:
        from pykakasi import kakasi
        from unidecode import unidecode
        
        kks = kakasi()
        kks.setMode("H", "a")
        kks.setMode("K", "a")
        kks.setMode("J", "a")
        kks.setMode("r", "Hepburn")
        romaji = kks.getConverter().do(text)
        fallback = unidecode(text)
        return romaji if len(romaji) >= len(fallback) else fallback
    except ImportError:
        from unidecode import unidecode
        return unidecode(text)


@receiver(post_save, sender=Question)
def generate_question_permalink(sender, instance, created, **kwargs):
    """
    Auto-generate permalink for newly created questions.
    This ensures new questions always get a permalink.
    """
    if not instance.permalink and instance.quiz_id:
        # Prevent recursion
        if hasattr(instance, '_generating_permalink'):
            return
        
        try:
            instance._generating_permalink = True
            
            # Get question number in quiz
            question_count = Question.objects.filter(
                quiz_id=instance.quiz_id,
                id__lt=instance.id if instance.id else 999999999
            ).count() + 1
            
            # Extract clean text
            clean_text = BeautifulSoup(instance.question_text or "", "html.parser").get_text().strip()
            
            # Generate multilingual slug
            question_slug = slugify(japanese_to_romaji(clean_text))[:60]
            
            if not question_slug:
                question_slug = f"question-{question_count}"
            
            # Build permalink
            quiz_permalink = instance.quiz.permalink if instance.quiz.permalink else f"quiz-{instance.quiz_id}"
            permalink = f"{quiz_permalink}/q-{question_count}-{question_slug}"
            
            # Handle duplicates
            base_permalink = permalink
            counter = 1
            while Question.objects.filter(permalink=permalink).exclude(id=instance.id).exists():
                permalink = f"{base_permalink}-{counter}"
                counter += 1
            
            # Save without triggering signal again
            Question.objects.filter(id=instance.id).update(permalink=permalink)
            logger.info(f"Generated permalink for question {instance.id}: {permalink}")
            
        except Exception as e:
            logger.error(f"Error generating permalink for question {instance.id}: {str(e)}")
        finally:
            if hasattr(instance, '_generating_permalink'):
                delattr(instance, '_generating_permalink')


@receiver(post_migrate)
def populate_missing_permalinks(sender, **kwargs):
    """
    After migrations run, check for questions without permalinks
    and generate them. This is a safety net for old data.
    """
    # Only run for quizzes app
    if sender.name != 'quizzes':
        return
    
    try:
        # Find questions without permalinks
        missing = Question.objects.filter(permalink__isnull=True).select_related('quiz')
        count = missing.count()
        
        if count > 0:
            logger.info(f"🔄 Found {count} questions without permalinks. Generating...")
            
            processed = 0
            for question in missing:
                try:
                    # Trigger the save method which will generate permalink
                    question.save()
                    processed += 1
                except Exception as e:
                    logger.error(f"Error generating permalink for question {question.id}: {str(e)}")
            
            logger.info(f"✅ Generated permalinks for {processed}/{count} questions")
                    
    except Exception as e:
        logger.warning(f"Could not populate missing permalinks: {str(e)}")
