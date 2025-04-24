import os
import random
from django.db import models
from django.contrib.auth.models import User
from django_ckeditor_5.fields import CKEditor5Field
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from pykakasi import kakasi
from unidecode import unidecode
from django.utils import timezone
from bs4 import BeautifulSoup
import re

# Convert Japanese text to Romaji
def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")  # Hiragana to alphabet
    kks.setMode("K", "a")  # Katakana to alphabet
    kks.setMode("J", "a")  # Japanese(kanji) to alphabet
    kks.setMode("r", "Hepburn")  # Use Hepburn Romanization
    converter = kks.getConverter()
    return converter.do(text)

# Custom validator for permalink format
def validate_permalink(value):
    """
    Ensures permalink follows the format: username/post/YYYY/MM/DD/title
    Example: alex/post/2025/02/17/my-awesome-title
    """
    pattern = r'^[a-zA-Z0-9_-]+/post/\d{4}/\d{2}/\d{2}/[-a-zA-Z0-9_]+$'
    if not re.match(pattern, value):
        raise ValidationError("Invalid permalink format. Expected: username/post/YYYY/MM/DD/title")

def post_cover_path(instance, filename):
    ext = filename.split('.')[-1]  # File extension
    title_slug = slugify(instance.title) if instance.title else "post"
    date_str = timezone.now().strftime('%Y%m%d')
    rand_num = random.randint(1000, 9999)
    new_filename = f"{instance.created_by.username}-{title_slug}-{date_str}-{rand_num}.{ext}"
    # Files will be stored under: user_<username>/post_covers/<new_filename>
    return os.path.join(f"user_{instance.created_by.username}", "post_covers", new_filename)

class Post(models.Model):
    # Core Fields
    title = models.CharField(max_length=200)
    permalink = models.CharField(
        max_length=255, unique=True, blank=True, null=True, validators=[validate_permalink]
    )
    content = CKEditor5Field(config_name='default')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blog_posts")
    created_at = models.DateTimeField(auto_now_add=True)

    # SEO Fields
    seo_title = models.CharField(
        max_length=60,
        blank=True,
        help_text="Recommended: 50-60 characters."
    )
    seo_description = models.TextField(
        max_length=160,
        blank=True,
        help_text="Recommended: 50-160 characters."
    )
    focus_keyword = models.CharField(
        max_length=100,
        blank=True,
        help_text="Primary keyword for this post."
    )
    canonical_url = models.URLField(
        blank=True,
        help_text="Canonical URL to avoid duplicate content issues."
    )
    og_title = models.CharField(
        max_length=100,
        blank=True,
        help_text="Title for Open Graph (Facebook, Twitter, etc.)."
    )
    og_description = models.TextField(
        max_length=200,
        blank=True,
        help_text="Short description for social media previews."
    )
    # Updated: Use an ImageField for uploading an Open Graph image
    og_image = models.ImageField(
        upload_to='post_og_images/',
        blank=True,
        null=True,
        help_text="Upload an image for social media previews (Open Graph image)."
    )

    def save(self, *args, **kwargs):
        """
        - Generates a dynamic permalink structure: username/post/YYYY/MM/DD/title
        - Ensures SEO fields are auto-filled based on content.
        """
        if not self.permalink:
            date_str = timezone.now().strftime('%Y/%m/%d')
            username = self.created_by.username
            romaji_title = japanese_to_romaji(self.title)
            title_slug = slugify(romaji_title)
            self.permalink = f"{username}/post/{date_str}/{title_slug}"

        # Auto-generate SEO metadata if missing
        soup = BeautifulSoup(self.content, "html.parser")
        text_content = soup.get_text()

        if not self.seo_title:
            self.seo_title = self.title[:60]

        if not self.seo_description:
            self.seo_description = text_content[:160]

        if not self.og_title:
            self.og_title = self.title

        if not self.og_description:
            self.og_description = text_content[:200]

        super(Post, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Delete the cover image file if it exists.
        if self.og_image and self.og_image.name:
            try:
                self.og_image.delete(save=False)
            except Exception as e:
                print("Error deleting og_image:", e)
        # Delete all related UserMedia records.
        self.media.all().delete()  # This will trigger the post_delete signal for each UserMedia record.
        # Finally, delete the post instance.
        super(Post, self).delete(*args, **kwargs)


    
    def calculate_seo_score(self):
        """
        Calculates a basic SEO score based on metadata completeness.
        - SEO title: 50-60 characters (20 points)
        - SEO description: 50-160 characters (20 points)
        - Focus keyword provided (20 points)
        - Canonical URL provided (10 points)
        - Open Graph fields (title, description, image) (30 points)
        """
        score = 0
        if 50 <= len(self.seo_title) <= 60:
            score += 20
        if 50 <= len(self.seo_description) <= 160:
            score += 20
        if self.focus_keyword:
            score += 20
        if self.canonical_url:
            score += 10
        if self.og_title and self.og_description and self.og_image:
            score += 30
        return score

    def __str__(self):
        return self.title
