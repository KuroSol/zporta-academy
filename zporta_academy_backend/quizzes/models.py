# quizzes/models.py

import os
import random
from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify
from django.utils import timezone
from bs4 import BeautifulSoup
from pykakasi import kakasi


def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")
    kks.setMode("K", "a")
    kks.setMode("J", "a")
    kks.setMode("r", "Hepburn")
    return kks.getConverter().do(text)


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


# --- wrappers for migrations (no lambdas) ---
def option1_image_path(inst, fn): return quiz_option_media_path(inst, fn, 1, 'img')
def option1_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 1, 'aud')
def option2_image_path(inst, fn): return quiz_option_media_path(inst, fn, 2, 'img')
def option2_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 2, 'aud')
def option3_image_path(inst, fn): return quiz_option_media_path(inst, fn, 3, 'img')
def option3_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 3, 'aud')
def option4_image_path(inst, fn): return quiz_option_media_path(inst, fn, 4, 'img')
def option4_audio_path(inst, fn): return quiz_option_media_path(inst, fn, 4, 'aud')


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

    def save(self, *args, **kwargs):
        if not self.permalink:
            date_str     = timezone.now().strftime('%Y-%m-%d')
            title_slug   = slugify(japanese_to_romaji(self.title))
            user_slug    = slugify(self.created_by.username) if self.created_by else 'unknown-user'
            subject_slug = slugify(self.subject.name) if self.subject else 'no-subject'
            self.permalink = f"{user_slug}/{subject_slug}/{date_str}/{title_slug}"

        if not self.seo_title:
            self.seo_title = self.title

        if not self.seo_description and self.content:
            text = BeautifulSoup(self.content, "html.parser").get_text()
            self.seo_description = text[:160]

        if not self.og_title:
            self.og_title = self.title

        if not self.og_description and self.content:
            text = BeautifulSoup(self.content, "html.parser").get_text()
            self.og_description = text[:200]

        if not self.og_image:
            self.og_image = "https://www.zportaacademy.com/static/default_quiz_image.png"

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Question(models.Model):
    quiz                = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    question_text       = models.TextField()
    question_image      = models.ImageField(upload_to=quiz_question_media_path, blank=True, null=True)
    question_image_alt  = models.CharField(max_length=150, blank=True)
    question_audio      = models.FileField(upload_to=quiz_question_media_path, blank=True, null=True)

    option1             = models.TextField()
    option1_image       = models.ImageField(upload_to=option1_image_path, blank=True, null=True)
    option1_image_alt   = models.CharField(max_length=150, blank=True)
    option1_audio       = models.FileField(upload_to=option1_audio_path, blank=True, null=True)

    option2             = models.TextField()
    option2_image       = models.ImageField(upload_to=option2_image_path, blank=True, null=True)
    option2_image_alt   = models.CharField(max_length=150, blank=True)
    option2_audio       = models.FileField(upload_to=option2_audio_path, blank=True, null=True)

    option3             = models.TextField(blank=True)
    option3_image       = models.ImageField(upload_to=option3_image_path, blank=True, null=True)
    option3_image_alt   = models.CharField(max_length=150, blank=True)
    option3_audio       = models.FileField(upload_to=option3_audio_path, blank=True, null=True)

    option4             = models.TextField(blank=True)
    option4_image       = models.ImageField(upload_to=option4_image_path, blank=True, null=True)
    option4_image_alt   = models.CharField(max_length=150, blank=True)
    option4_audio       = models.FileField(upload_to=option4_audio_path, blank=True, null=True)

    correct_option      = models.PositiveSmallIntegerField()
    hint1               = models.TextField(blank=True)
    hint2               = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        # auto-gen alt-text for question
        if self.question_image and not self.question_image_alt:
            txt = BeautifulSoup(self.question_text, "html.parser").get_text().strip()
            self.question_image_alt = txt[:150]

        # auto-gen alt-text for options
        for idx in (1, 2, 3, 4):
            img = getattr(self, f"option{idx}_image")
            alt = f"option{idx}_image_alt"
            txt = getattr(self, f"option{idx}")
            if img and not getattr(self, alt):
                text = BeautifulSoup(txt or "", "html.parser").get_text().strip()
                setattr(self, alt, text[:150])

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Question for {self.quiz.title}"
