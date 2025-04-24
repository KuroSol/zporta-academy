from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify

class Subject(models.Model):
    name = models.CharField(max_length=100, unique=True)
    permalink = models.SlugField(max_length=255, unique=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_subjects')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.permalink:  # Generate permalink only if it doesn't exist
            original_slug = slugify(self.name)
            unique_slug = original_slug
            num = 1
            while Subject.objects.filter(permalink=unique_slug).exists():
                unique_slug = f"{original_slug}-{num}"
                num += 1
            self.permalink = unique_slug
        super(Subject, self).save(*args, **kwargs)

    def __str__(self):
        return self.name
