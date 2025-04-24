from django.db import models
from django.utils.text import slugify
from pykakasi import kakasi
from bs4 import BeautifulSoup
import re

def japanese_to_romaji(text):
    kks = kakasi()
    kks.setMode("H", "a")  # Hiragana to alphabet
    kks.setMode("K", "a")  # Katakana to alphabet
    kks.setMode("J", "a")  # Japanese to alphabet
    kks.setMode("r", "Hepburn")  # Use Hepburn Romanization
    converter = kks.getConverter()
    return converter.do(text)

class Page(models.Model):
    title = models.CharField(max_length=200)
    permalink = models.SlugField(unique=True, blank=True)
    content = models.TextField()  # Replaced CKEditor5Field with TextField
    created_by = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    # SEO fields
    seo_title = models.CharField(max_length=60, blank=True, help_text="Recommended: 50-60 characters.")
    seo_description = models.TextField(max_length=160, blank=True, help_text="Recommended: 50-160 characters.")
    focus_keyword = models.CharField(max_length=100, blank=True, help_text="Primary keyword for this page.")
    canonical_url = models.URLField(blank=True, help_text="URL to specify the canonical source.")
    og_title = models.CharField(max_length=100, blank=True, help_text="Open Graph title for social sharing.")
    og_description = models.TextField(max_length=200, blank=True, help_text="Open Graph description for social sharing.")
    og_image = models.URLField(blank=True, help_text="URL of the Open Graph image.")

    def save(self, *args, **kwargs):
        # Generate permalink if not provided
        if not self.permalink:
            romaji_title = japanese_to_romaji(self.title)
            self.permalink = slugify(romaji_title)
        
        # Auto-fill SEO fields from content if they are not provided
        if not self.seo_title and self.content:
            soup = BeautifulSoup(self.content, "html.parser")
            headers = soup.find_all(re.compile('^h[1-6]$'))
            if headers:
                self.seo_title = headers[0].get_text(strip=True)[:60]

        if not self.seo_description and self.content:
            text = BeautifulSoup(self.content, "html.parser").get_text(separator=' ', strip=True)
            self.seo_description = text[:160]

        super(Page, self).save(*args, **kwargs)

    def __str__(self):
        return self.title

class Snippet(models.Model):
    name = models.CharField(max_length=100, unique=True)
    content = models.TextField()  # Replaced CKEditor5Field with TextField
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
