from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify
from django.conf import settings
from django_ckeditor_5.fields import CKEditor5Field
import uuid
from django.utils import timezone
from bs4 import BeautifulSoup
from tags.models import Tag
from subjects.models import Subject
from pykakasi import kakasi
import os, random

def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")  # Hiragana to alphabet
    kks.setMode("K", "a")  # Katakana to alphabet
    kks.setMode("J", "a")  # Japanese to alphabet
    kks.setMode("r", "Hepburn")  # Use Hepburn Romanization
    converter = kks.getConverter()
    return converter.do(text)

def course_cover_path(instance, filename):
    ext = filename.split('.')[-1]
    title_slug = slugify(instance.title) if instance.title else "course"
    subject_slug = slugify(instance.subject.name) if instance.subject else "no-subject"
    date_str = timezone.now().strftime('%Y%m%d')
    rand_num = random.randint(1000, 9999)
    new_filename = f"{instance.created_by.username}-{title_slug}-{subject_slug}-{date_str}-{rand_num}.{ext}"
    return os.path.join(f"user_{instance.created_by.username}", "course_covers", new_filename)

class PublishedCourseManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_draft=False)

class Course(models.Model):
    COURSE_TYPE_CHOICES = [
        ('free', 'Free'),
        ('premium', 'Premium'),
    ]
    
    title = models.CharField(max_length=200)
    description = CKEditor5Field(config_name='default')
    permalink = models.SlugField(max_length=255, unique=True, blank=True)
    cover_image = models.ImageField(upload_to=course_cover_path, blank=True, null=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='courses')
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_courses')
    created_at = models.DateTimeField(auto_now_add=True)
    unique_code = models.UUIDField(default=uuid.uuid4, editable=False)
    course_type = models.CharField(max_length=10, choices=COURSE_TYPE_CHOICES, default='free')
    price = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, default=0.00)
    is_draft = models.BooleanField(default=True)
    allowed_testers = models.ManyToManyField(User, blank=True, related_name="allowed_test_courses")
    is_locked = models.BooleanField(
    default=False, 
    help_text="Prevent further editing after the first user enrollment."
    )
    # SEO fields
    seo_title = models.CharField(max_length=60, blank=True)
    seo_description = models.TextField(max_length=160, blank=True)
    focus_keyword = models.CharField(max_length=100, blank=True)
    canonical_url = models.URLField(blank=True)
    og_title = models.CharField(max_length=100, blank=True)
    og_description = models.TextField(max_length=200, blank=True)
    og_image = models.URLField(blank=True)
    
    # Up to 3 short selling points to highlight benefits on the detail page
    # Stored as a JSON list of strings for flexibility and i18n friendliness.
    selling_points = models.JSONField(default=list, blank=True)
    
    # Stripe Product ID for premium courses (created when course is published)
    stripe_product_id = models.CharField(max_length=100, blank=True, null=True)
    stripe_price_id = models.CharField(max_length=100, blank=True, null=True)
    
    # Default manager returns only published courses.
    objects = PublishedCourseManager()
    # Use all_objects when you need access to every course (drafts and published).
    all_objects = models.Manager()
    
    def save(self, *args, **kwargs):
        if not self.permalink:
            date_str = timezone.now().strftime('%Y-%m-%d')
            subject_slug = slugify(self.subject.name) if self.subject else 'no-subject'
            title_slug = slugify(japanese_to_romaji(self.title))
            self.permalink = f"{self.created_by.username}/{date_str}/{subject_slug}/{title_slug}"
        
        if not self.seo_title:
            self.seo_title = self.title
        
        if not self.seo_description and self.description:
            soup = BeautifulSoup(self.description, "html.parser")
            text = soup.get_text()
            self.seo_description = text[:160]
        
        if not self.og_title:
            self.og_title = self.title
        
        if not self.og_description and self.description:
            soup = BeautifulSoup(self.description, "html.parser")
            text = soup.get_text()
            self.og_description = text[:200]
        
        # --- SEO absolutes (set once if missing) ---
        base = getattr(settings, "SITE_URL", "").rstrip("/")
        if base:
            if not self.canonical_url and self.permalink:
                self.canonical_url = f"{base}/courses/{self.permalink}/"
            if not self.og_image and self.cover_image:
                # Make cover_image absolute for social previews
                self.og_image = f"{base}{self.cover_image.url}"
        super(Course, self).save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        if self.cover_image:
            self.cover_image.delete(save=False)
        self.media.all().delete()
        super(Course, self).delete(*args, **kwargs)
    
    def __str__(self):
        return self.title

