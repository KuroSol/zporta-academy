# C:\Users\AlexSol\Documents\zporta_academy_backend\seo\models.py

from django.db import models

class SEOSetting(models.Model):
    path = models.CharField(max_length=191, unique=True, help_text="URL pattern or specific path for SEO settings")
    title = models.CharField(max_length=70, blank=True, help_text="SEO title for the page")
    description = models.TextField(max_length=160, blank=True, help_text="SEO description for better search engine visibility")
    keywords = models.CharField(max_length=255, blank=True, help_text="Comma-separated SEO keywords")
    canonical_url = models.URLField(blank=True, null=True, help_text="Canonical URL to avoid duplicate content issues")

    def __str__(self):
        return f"SEO Settings for {self.path}"

class Redirect(models.Model):
    old_path = models.CharField(max_length=255, unique=True, help_text="The original URL path to redirect from")
    new_path = models.CharField(max_length=255, help_text="The destination URL path to redirect to")
    permanent = models.BooleanField(default=True, help_text="True if the redirect is permanent (HTTP 301), else temporary (HTTP 302)")

    def __str__(self):
        return f"Redirect from {self.old_path} to {self.new_path}"
