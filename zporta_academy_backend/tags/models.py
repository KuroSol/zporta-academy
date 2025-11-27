# tags/models.py
from django.core.validators import RegexValidator
from django.db import models
from django.utils.text import slugify

class Tag(models.Model):
    name = models.CharField(
        max_length=191,            # or your chosen size
        unique=True,
        validators=[RegexValidator(r'^\S+$', 'Tags cannot contain spaces.')]
    )
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    description = models.TextField(blank=True, help_text="Optional tag description")
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
