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
from django.core.exceptions import ValidationError

class LessonTemplate(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    accent_color = models.CharField(max_length=7, default="#3498db")
    predefined_css = models.TextField(blank=True)

    def __str__(self):
        return self.name
    
TEMPLATE_CHOICES = [
    ("modern", "Modern"),
    ("minimal", "Minimal"),
    ("dark", "Dark"),
]

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
    DRAFT = "draft"
    PUBLISHED = "published"
    STATUS_CHOICES = [(DRAFT, "Draft"), (PUBLISHED, "Published")]

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=DRAFT, db_index=True)
    is_premium = models.BooleanField(default=False, db_index=True)
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='lessons')
    tags = models.ManyToManyField(Tag, blank=True, related_name='lessons')
    template_ref = models.ForeignKey(
    'LessonTemplate',
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name='lessons',
    help_text="Optionally choose a pre-defined template"
    )
    permalink = models.SlugField(max_length=255, unique=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    published_at = models.DateTimeField(null=True, blank=True)

    def clean(self):
        """
        Enforce business rules for premium lessons **only when publishing**.
        Premium drafts are allowed to be unattached.
        """
        if self.is_premium and self.status == self.PUBLISHED:
            if not self.course:
                raise ValidationError({"course": "Premium lessons must be attached to a premium course to publish."})
            if getattr(self.course, "course_type", None) != "premium":
                raise ValidationError({"course": "Premium lessons must be attached to a premium course to publish."})
            
        return super().clean()

    created_at = models.DateTimeField(auto_now_add=True)
    is_locked = models.BooleanField(default=False, help_text="Prevent editing after enrollment.")
    custom_js = models.TextField(
        blank=True,
        null=True,
        help_text="Optional user‑defined JavaScript to execute only on this lesson page"
    )
    # SEO fields
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.TextField(max_length=160, blank=True)
    focus_keyword = models.CharField(max_length=100, blank=True)
    canonical_url = models.URLField(blank=True)
    og_title = models.CharField(max_length=100, blank=True)
    og_description = models.TextField(max_length=200, blank=True)
    og_image = models.URLField(blank=True)

    CONTENT_TYPE_CHOICES = [
        ('text', 'Text'),
        ('video', 'Video'),
        ('quiz', 'Quiz'),
    ]

    content_type = models.CharField(
        max_length=20,
        choices=CONTENT_TYPE_CHOICES,
        default='text'
    )
    
    # === NEW: Template and Style ===
    template = models.CharField(
        max_length=20,
        choices=TEMPLATE_CHOICES,
        default="modern"
    )
    accent_color = models.CharField(
        max_length=7,
        default="#3498db"
    )
    custom_css = models.TextField(
        blank=True,
        null=True,
        help_text="Optional user-defined custom CSS for this lesson."
    )

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