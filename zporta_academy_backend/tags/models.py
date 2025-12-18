"""Tag model with hardened slug generation and validation."""
import re

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify

class Tag(models.Model):
    INVALID_NAME_PATTERN = re.compile(r"[\\[\]\\{\\}\"',]")
    JSON_LIKE_PATTERN = re.compile(r'^\s*[\[{]')

    name = models.CharField(
        max_length=191,            # or your chosen size
        unique=True,
    )
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    description = models.TextField(blank=True, help_text="Optional tag description")
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def _validate_name(cls, name: str) -> str:
        trimmed = (name or "").strip()
        if not trimmed:
            raise ValidationError("Tag name cannot be empty.")
        if cls.JSON_LIKE_PATTERN.match(trimmed):
            raise ValidationError("Tag name cannot look like JSON.")
        if cls.INVALID_NAME_PATTERN.search(trimmed):
            raise ValidationError("Tag name contains invalid characters.")
        return trimmed

    def _build_unique_slug(self, name: str) -> str:
        base = slugify(name) or "tag"
        candidate = base
        counter = 2
        while Tag.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
            candidate = f"{base}-{counter}"
            counter += 1
        return candidate

    def save(self, *args, **kwargs):
        # Enforce clean names and deterministic slug creation on every save.
        self.name = self._validate_name(self.name)
        self.slug = self._build_unique_slug(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
