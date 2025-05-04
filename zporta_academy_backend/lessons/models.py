# lessons/models.py

from django.db import models
from django.conf import settings
from tags.models import Tag
from subjects.models import Subject
from courses.models import Course
from django.utils.text import slugify
from pykakasi import kakasi
from django.contrib.auth.models import User
from django.utils import timezone
from bs4 import BeautifulSoup

def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")  # Hiragana -> alphabet
    kks.setMode("K", "a")  # Katakana -> alphabet
    kks.setMode("J", "a")  # Kanji -> alphabet
    kks.setMode("r", "Hepburn")
    converter = kks.getConverter()
    return converter.do(text)

class Lesson(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    video_url = models.URLField(blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, related_name='lessons')
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='lessons')
    tags = models.ManyToManyField(Tag, blank=True, related_name='lessons')
    permalink = models.SlugField(max_length=255, unique=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    is_locked = models.BooleanField(default=False, help_text="Prevent editing after enrollment.")

    # SEO fields
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.TextField(max_length=160, blank=True)
    focus_keyword = models.CharField(max_length=100, blank=True)
    canonical_url = models.URLField(blank=True)
    og_title = models.CharField(max_length=100, blank=True)
    og_description = models.TextField(max_length=200, blank=True)
    og_image = models.URLField(blank=True)

    def save(self, *args, **kwargs):
        # --- Generate permalink only on initial save ---
        if not self.permalink:
            date_str = timezone.now().strftime('%Y-%m-%d')
            # Ensure title exists before slugifying
            title_slug = slugify(japanese_to_romaji(self.title or "untitled"))
            subject_slug = slugify(self.subject.name) if self.subject else 'no-subject'
             # Ensure creator exists before accessing username
            creator_username = self.created_by.username if self.created_by else 'unknown-user'

            base_permalink = f"{creator_username}/{subject_slug}/{date_str}/{title_slug}"
            unique_permalink = base_permalink
            num = 1
            # Ensure uniqueness check excludes self during creation if pk is not yet set
            qs = Lesson.objects.filter(permalink=unique_permalink)
            if self.pk:
                 qs = qs.exclude(pk=self.pk)
            while qs.exists():
                unique_permalink = f"{base_permalink}-{num}"
                num += 1
                # Re-query inside loop for uniqueness check
                qs = Lesson.objects.filter(permalink=unique_permalink)
                if self.pk:
                     qs = qs.exclude(pk=self.pk)
            self.permalink = unique_permalink
        # --- End permalink generation ---

        # --- Keep SEO field generation logic ---
        if not self.seo_title:
            # truncate to 60 chars so we never overflow the field
            self.seo_title = self.title[:200]
        if not self.seo_description and self.content:
            # Ensure BeautifulSoup is imported: from bs4 import BeautifulSoup
            text = BeautifulSoup(self.content, "html.parser").get_text(separator=' ', strip=True)
            self.seo_description = text[:160]
        if not self.og_title:
            self.og_title = self.title
        if not self.og_description and self.content:
             # Ensure BeautifulSoup is imported
            text = BeautifulSoup(self.content, "html.parser").get_text(separator=' ', strip=True)
            self.og_description = text[:200]
        # --- End SEO logic ---

        super().save(*args, **kwargs) # Call the "real" save() method.
    
    def delete(self, *args, **kwargs):
        self.media.all().delete()  # This deletes associated UserMedia records; your post_delete signal will remove the files.
        super(Lesson, self).delete(*args, **kwargs)

    def __str__(self):
        return self.title

    
class LessonCompletion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lesson_completions'
    )
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='completions'
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'lesson')
    
    def __str__(self):
        return f"{self.user.username} completed {self.lesson.title}"