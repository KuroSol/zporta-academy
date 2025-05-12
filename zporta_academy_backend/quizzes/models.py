# quizzes/models.py
import os
import random
from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify
from django.utils import timezone
from bs4 import BeautifulSoup
from pykakasi import kakasi
from subjects.models import Subject
from subjects.models import Subject
from tags.models    import Tag
# --- japanese_to_romaji function ---
def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")
    kks.setMode("K", "a")
    kks.setMode("J", "a")
    kks.setMode("r", "Hepburn")
    return kks.getConverter().do(text)

# --- Media Path Functions ---
def quiz_question_media_path(instance, filename):
    ext       = filename.split('.')[-1]
    date_str  = timezone.now().strftime('%Y%m%d')
    rand      = random.randint(1000, 9999)
    user_slug = slugify(instance.quiz.created_by.username)
    subject   = slugify(instance.quiz.subject.name) if instance.quiz.subject else 'no-subject'
    quiz_slug = slugify(instance.quiz.title)[:30]
    qid       = instance.id or 'new'
    name      = f"{quiz_slug}-q{qid}-{date_str}-{rand}.{ext}"
    return os.path.join(f"user_{user_slug}", "quizzes", subject, name)

def quiz_option_media_path(instance, filename, opt_index, media_type):
    ext       = filename.split('.')[-1]
    date_str  = timezone.now().strftime('%Y%m%d')
    rand      = random.randint(1000, 9999)
    user_slug = slugify(instance.quiz.created_by.username)
    subject   = slugify(instance.quiz.subject.name) if instance.quiz.subject else 'no-subject'
    quiz_slug = slugify(instance.quiz.title)[:30]
    qid       = instance.id or 'new'
    name      = f"{quiz_slug}-q{qid}-opt{opt_index}-{media_type}-{date_str}-{rand}.{ext}"
    return os.path.join(f"user_{user_slug}", "quizzes", subject, name)

# --- Wrappers for migrations ---
def option1_image_path(inst, fn): return quiz_option_media_path(inst, fn, 1, 'img')
def option1_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 1, 'aud')
def option2_image_path(inst, fn): return quiz_option_media_path(inst, fn, 2, 'img')
def option2_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 2, 'aud')
def option3_image_path(inst, fn): return quiz_option_media_path(inst, fn, 3, 'img')
def option3_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 3, 'aud')
def option4_image_path(inst, fn): return quiz_option_media_path(inst, fn, 4, 'img')
def option4_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 4, 'aud')

# --- Quiz Model ---
class Quiz(models.Model):
    TYPE_CHOICES = [('free','Free'),('premium','Premium')]

    title           = models.CharField(max_length=200)
    content         = models.TextField(blank=True, help_text="Main explanation or content about the quiz.")
    is_locked       = models.BooleanField(default=False, help_text="Prevent editing after enrollment.")

    lesson          = models.ForeignKey('lessons.Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    subject         = models.ForeignKey('subjects.Subject', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    course          = models.ForeignKey('courses.Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    created_by      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_quizzes')
    created_at      = models.DateTimeField(auto_now_add=True)
    quiz_type       = models.CharField(max_length=10, choices=TYPE_CHOICES, default='free')
    permalink       = models.SlugField(max_length=255, unique=True, blank=True)

    seo_title       = models.CharField(max_length=60, blank=True)
    seo_description = models.TextField(max_length=160, blank=True)
    focus_keyword   = models.CharField(max_length=100, blank=True)
    canonical_url   = models.URLField(blank=True)
    og_title        = models.CharField(max_length=100, blank=True)
    og_description  = models.TextField(max_length=200, blank=True)
    og_image        = models.URLField(blank=True)
    difficulty_level = models.CharField(
        max_length=10,
        choices=[
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard'),
            ('expert', 'Expert')
        ],
        default='medium',
        blank=True,
        null=True,
        help_text="Difficulty level of the quiz."
    )

    # ─── Tagging: many quizzes ↔ many tags ───────────────────────────────
    tags = models.ManyToManyField(
        Tag,
        blank=True,
        related_name='quizzes',
        help_text="Attach zero or more tags (auto-created if they don't exist)."
    )


    def save(self, *args, **kwargs):
        if not self.permalink:
            date_str     = timezone.now().strftime('%Y-%m-%d')
            title_slug   = slugify(japanese_to_romaji(self.title))
            user_slug    = slugify(self.created_by.username) if self.created_by else 'unknown-user'
            subject_slug = slugify(self.subject.name) if self.subject else 'no-subject'
            self.permalink = f"{user_slug}/{subject_slug}/{date_str}/{title_slug}"

        # --- Auto-fill SEO title & OG title from quiz title ---
        if not self.seo_title:
            self.seo_title = self.title
        if not self.og_title:
            self.og_title = self.title

        # --- SEO description: use title (plus subject if you like) ---
        if not self.seo_description:
            if self.title:
                if self.subject:
                    # e.g. “Photosynthesis Quiz | Biology”
                    self.seo_description = f"{self.title} Quiz on {self.subject.name}"
                else:
                    self.seo_description = self.title
            else:
                # fallback to first 160 chars of content
                text = BeautifulSoup(self.content or "", "html.parser").get_text()
                self.seo_description = text[:160]

        # --- OG description: mirror SEO description ---
        if not self.og_description:
            self.og_description = self.seo_description

        # --- Focus keyword: slugified title romaji ---
        if not self.focus_keyword and self.title:
            self.focus_keyword = slugify(japanese_to_romaji(self.title))

        # --- Canonical URL: point to your quiz’s public URL ---
        if not self.canonical_url and self.permalink:
            self.canonical_url = f"https://www.zportaacademy.com/quizzes/{self.permalink}/"

        # --- Default OG image (unchanged) ---
        if not self.og_image:
            self.og_image = "https://www.zportaacademy.com/static/default_quiz_image.png"
 

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

# --- Question Model ---
class Question(models.Model):
    quiz                = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    allow_speech_to_text = models.BooleanField(default=False)

    QUESTION_TYPE_CHOICES = [
        ('mcq', 'Multiple Choice'),
        ('multi', 'Multiple Select'),
        ('short', 'Short Answer'),
        ('dragdrop', 'Drag and Drop'),
        ('sort', 'Word Sorting'), # Assuming 'sort' is the key used in frontend/serializers
    ]

    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPE_CHOICES,
        default='mcq',
        help_text="Type of question (e.g., MCQ, Multiple Select, Drag & Drop)"
    )

    # --- Data Fields ---
    question_text       = models.TextField() # Question text is always required
    question_image      = models.ImageField(upload_to=quiz_question_media_path, blank=True, null=True)
    question_image_alt  = models.CharField(max_length=150, blank=True)
    question_audio      = models.FileField(upload_to=quiz_question_media_path, blank=True, null=True)

    # --- Option Fields (Make Optional in DB) ---
    option1             = models.TextField(blank=True, null=True) # MODIFIED
    option1_image       = models.ImageField(upload_to=option1_image_path, blank=True, null=True)
    option1_image_alt   = models.CharField(max_length=150, blank=True)
    option1_audio       = models.FileField(upload_to=option1_audio_path, blank=True, null=True)

    option2             = models.TextField(blank=True, null=True) # MODIFIED
    option2_image       = models.ImageField(upload_to=option2_image_path, blank=True, null=True)
    option2_image_alt   = models.CharField(max_length=150, blank=True)
    option2_audio       = models.FileField(upload_to=option2_audio_path, blank=True, null=True)

    option3             = models.TextField(blank=True, null=True) # Ensure null=True if using blank=True
    option3_image       = models.ImageField(upload_to=option3_image_path, blank=True, null=True)
    option3_image_alt   = models.CharField(max_length=150, blank=True)
    option3_audio       = models.FileField(upload_to=option3_audio_path, blank=True, null=True)

    option4             = models.TextField(blank=True, null=True) # Ensure null=True if using blank=True
    option4_image       = models.ImageField(upload_to=option4_image_path, blank=True, null=True)
    option4_image_alt   = models.CharField(max_length=150, blank=True)
    option4_audio       = models.FileField(upload_to=option4_audio_path, blank=True, null=True)

    # --- Answer/Data Fields (Already Optional/Flexible) ---
    correct_option      = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Correct option index (1-4) for MCQ.")
    correct_options     = models.JSONField(blank=True, null=True, help_text="List of correct option indices (e.g., [1, 3]) for Multi-Select, or solution structure for Sort/Drag.")
    correct_answer      = models.CharField(max_length=255, blank=True, null=True, help_text="Correct text answer for Short Answer.")
    question_data       = models.JSONField(blank=True, null=True, help_text="Data structure for Sort/Drag items/zones.")

    # --- Hints ---
    hint1               = models.TextField(blank=True)
    hint2               = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        # Auto-gen alt-text for question image
        if self.question_image and not self.question_image_alt:
            txt = BeautifulSoup(self.question_text, "html.parser").get_text().strip()
            self.question_image_alt = txt[:150]

        # Auto-gen alt-text for option images
        for idx in (1, 2, 3, 4):
            img_field = f"option{idx}_image"
            alt_field = f"option{idx}_image_alt"
            txt_field = f"option{idx}"
            if getattr(self, img_field) and not getattr(self, alt_field):
                text = BeautifulSoup(getattr(self, txt_field) or "", "html.parser").get_text().strip()
                setattr(self, alt_field, text[:150])

        super().save(*args, **kwargs)

    def __str__(self):
        # Truncate question text for display if it's too long
        q_text = self.question_text[:50] + '...' if len(self.question_text) > 50 else self.question_text
        return f"Q ({self.question_type}) for {self.quiz.title}: {q_text}"
    

class FillBlankQuestion(models.Model):
    """
    Extension of Question for ‘dragdrop’-style fill-in-the-blank quizzes.
    Stores the sentence with ‘*’ placeholders.
    """
    question = models.OneToOneField(
        Question,
        related_name='fill_blank',
        on_delete=models.CASCADE
    )
    sentence = models.TextField(
        help_text="Sentence with '*' as blank placeholders, e.g. 'The quick * fox jumps *.'"
    )

    def __str__(self):
        return f"FillBlank for Q#{self.question.id}"


class BlankWord(models.Model):
    """
    A single word in the bank for a FillBlankQuestion.
    """
    fill_blank = models.ForeignKey(
        FillBlankQuestion,
        related_name='words',
        on_delete=models.CASCADE
    )
    text = models.CharField(max_length=100)

    def __str__(self):
        return self.text


class BlankSolution(models.Model):
    """
    Which word goes into which blank slot.
    slot_index matches the Nth '*' in sentence (0-based).
    """
    fill_blank   = models.ForeignKey(
        FillBlankQuestion,
        related_name='solutions',
        on_delete=models.CASCADE
    )
    slot_index   = models.PositiveSmallIntegerField(
        help_text="Zero-based index of the blank in the sentence"
    )
    correct_word = models.ForeignKey(
        BlankWord,
        on_delete=models.SET_NULL,
        null=True,
        help_text="Which word from the bank fills this slot"
    )

    class Meta:
        unique_together = ('fill_blank', 'slot_index')

    def __str__(self):
        return f"Blank #{self.slot_index} → {self.correct_word}"