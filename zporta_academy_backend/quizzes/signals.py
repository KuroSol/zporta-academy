import os
from bs4 import BeautifulSoup
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from rake_nltk import Rake
import nltk

from .models import Quiz, Tag

# --- NLTK Setup ---
nltk.download('punkt')
nltk.download('stopwords')

# --- Language Detection: FastText if available ---
USE_FASTTEXT = False
model = None

try:
    if not settings.DEBUG:
        import fasttext
        model_path = os.path.join(settings.BASE_DIR, "lid.176.bin")
        if os.path.exists(model_path):
            model = fasttext.load_model(model_path)
            USE_FASTTEXT = True
        else:
            print("[FastText] Model file not found. Using langdetect fallback.")
            from langdetect import detect_langs
    else:
        from langdetect import detect_langs
except Exception as e:
    print(f"[LangDetect Init Fallback] {e}")
    from langdetect import detect_langs


# --- Helper: Extract full text from quiz object ---
def extract_text_from_quiz(quiz):
    parts = [quiz.title or "", quiz.content or ""]
    for q in quiz.questions.all():
        parts.append(q.question_text or "")
        for opt in (q.option1, q.option2, q.option3, q.option4):
            if opt:
                parts.append(opt)
    text = " ".join(parts)
    return BeautifulSoup(text, "html.parser").get_text().replace("\n", " ").strip()


# --- Signal: Analyze quiz content after save ---
@receiver(post_save, sender=Quiz)
def analyze_quiz_content(sender, instance, created, **kwargs):
    if kwargs.get('raw', False):
        return

    full_text = extract_text_from_quiz(instance)
    if not full_text:
        return

    update_kwargs = {}

    # —— 1) Language Detection ——
    try:
        if USE_FASTTEXT:
            langs = set()
            for sentence in full_text.split("."):
                sentence = sentence.strip()
                if sentence:
                    label, prob = model.predict(sentence)
                    if prob[0] >= 0.4:
                        langs.add(label[0].replace("__label__", ""))
            detected = list(langs)[:3]
        else:
            langs_detect = detect_langs(full_text)
            detected = [lp.lang for lp in langs_detect[:3] if lp.prob >= 0.4]

        if detected and instance.languages != detected:
            update_kwargs['languages'] = detected
    except Exception as e:
        print(f"[Language Detection] failed for Quiz {instance.pk}: {e}")

    # —— 2) Keyword Tagging via RAKE ——
    try:
        rake = Rake()  # uses punkt + English stopwords
        rake.extract_keywords_from_text(full_text)
        phrases = rake.get_ranked_phrases_with_scores()
        existing = set(t.name for t in instance.tags.all())
        new = []
        for score, phrase in phrases:
            if score > 4 and 1 < len(phrase.split()) < 4:
                name = phrase.lower().strip()
                if 2 < len(name) < 50 and name not in existing:
                    tag, _ = Tag.objects.get_or_create(name=name)
                    new.append(tag)
        if new:
            instance.tags.add(*new)
    except Exception as e:
        print(f"[RAKE Tagging] failed for Quiz {instance.pk}: {e}")

    # —— 3) Save Language Updates if Detected ——
    if update_kwargs:
        Quiz.objects.filter(pk=instance.pk).update(**update_kwargs)
