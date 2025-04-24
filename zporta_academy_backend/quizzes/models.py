from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify
from django_ckeditor_5.fields import CKEditor5Field
from django.utils import timezone
from bs4 import BeautifulSoup
from pykakasi import kakasi

def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")  # Hiragana to alphabet
    kks.setMode("K", "a")  # Katakana to alphabet
    kks.setMode("J", "a")  # Japanese to alphabet
    kks.setMode("r", "Hepburn")  # Use Hepburn Romanization
    converter = kks.getConverter()
    return converter.do(text)

class Quiz(models.Model):
    TYPE_CHOICES = [
        ('free', 'Free'),
        ('premium', 'Premium'),
    ]
    title = models.CharField(max_length=200)
    content = CKEditor5Field(config_name='default', help_text="Main explanation or content about the quiz.")
    is_locked = models.BooleanField(default=False, help_text="Prevent editing after enrollment.")
    question = CKEditor5Field(config_name='default', help_text="Primary question for the quiz.")
    option1 = CKEditor5Field(config_name='default')
    option2 = CKEditor5Field(config_name='default')
    option3 = CKEditor5Field(config_name='default', blank=True)
    option4 = CKEditor5Field(config_name='default', blank=True)
    correct_option = models.PositiveSmallIntegerField(help_text="Index of the correct option (1-4).")
    hint1 = CKEditor5Field(config_name='default', blank=True, help_text="First hint to help solve the quiz.")
    hint2 = CKEditor5Field(config_name='default', blank=True, help_text="Second hint to help solve the quiz.")
    # Use string references to break circular imports
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    subject = models.ForeignKey('subjects.Subject', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    course = models.ForeignKey('courses.Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_quizzes')
    created_at = models.DateTimeField(auto_now_add=True)
    quiz_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='free')
    permalink = models.SlugField(max_length=255, unique=True, blank=True)

    # SEO fields
    seo_title = models.CharField(max_length=60, blank=True)
    seo_description = models.TextField(max_length=160, blank=True)
    focus_keyword = models.CharField(max_length=100, blank=True)
    canonical_url = models.URLField(blank=True)
    og_title = models.CharField(max_length=100, blank=True)
    og_description = models.TextField(max_length=200, blank=True)
    og_image = models.URLField(blank=True)

    def save(self, *args, **kwargs):
        if not self.permalink:
            date_str = timezone.now().strftime('%Y-%m-%d')
            title_slug = slugify(japanese_to_romaji(self.title))
            username_slug = slugify(self.created_by.username) if self.created_by else 'unknown-user'
            subject_slug = slugify(self.subject.name) if self.subject else 'no-subject'
            self.permalink = f"{username_slug}/{subject_slug}/{date_str}/{title_slug}"
        if not self.seo_title:
            self.seo_title = self.title
        if not self.seo_description and self.content:
            soup = BeautifulSoup(self.content, "html.parser")
            text = soup.get_text()
            self.seo_description = text[:160]
        if not self.og_title:
            self.og_title = self.title
        if not self.og_description and self.content:
            soup = BeautifulSoup(self.content, "html.parser")
            text = soup.get_text()
            self.og_description = text[:200]
        if not self.og_image:
            self.og_image = "https://www.yourdomain.com/static/default_quiz_image.png"
        super(Quiz, self).save(*args, **kwargs)

    def __str__(self):
        return self.title

