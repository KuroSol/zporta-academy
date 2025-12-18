import uuid
import os
from django.db import models
from django.core.files.storage import default_storage
from django.utils.text import slugify
from django.urls import reverse
from datetime import datetime


def asset_file_path(instance, filename):
    """
    Generate a deterministic file path for assets.
    Format: media/assets/{kind}/{yyyy}/{mm}/{slug}-{uuid}.{ext}
    """
    ext = os.path.splitext(filename)[1].lower()
    now = datetime.now()
    
    # Create the path components
    kind = instance.kind
    year = now.strftime('%Y')
    month = now.strftime('%m')
    slug = instance.suggested_name or slugify(instance.original_filename)
    
    # Ensure slug is not empty
    if not slug:
        slug = 'asset'
    
    # Combine: assets/{kind}/{yyyy}/{mm}/{slug}-{uuid}{ext}
    filename = f"{slug}-{instance.id}{ext}"
    return os.path.join('assets', kind, year, month, filename)


class Asset(models.Model):
    """
    Stores uploaded media assets (images, audio, etc.) with metadata.
    Supports easy referencing by ID for JSON provider configs.
    """
    ASSET_KINDS = [
        ('image', 'Image'),
        ('audio', 'Audio'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=ASSET_KINDS, db_index=True)
    
    # File storage with custom path
    file = models.FileField(upload_to=asset_file_path)
    
    original_filename = models.CharField(max_length=255, help_text="Original uploaded filename")
    suggested_name = models.SlugField(
        max_length=255, 
        blank=True, 
        db_index=True,
        help_text="Slugified name for easy reference"
    )
    
    provider = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        help_text="Optional provider tag (e.g., 'Gemini', 'Google AI Studio')"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['kind', '-created_at']),
            models.Index(fields=['suggested_name', 'kind']),
        ]
    
    def __str__(self):
        return f"{self.kind.capitalize()}: {self.original_filename}"
    
    def get_url(self):
        """Return the full URL to the asset file."""
        if self.file:
            return self.file.url
        return None
    
    def get_path(self):
        """Return the relative path to the asset file."""
        if self.file:
            return self.file.name
        return None
    
    def save(self, *args, **kwargs):
        """Auto-generate suggested_name if not provided."""
        if not self.suggested_name:
            self.suggested_name = slugify(self.original_filename.rsplit('.', 1)[0])
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Delete the file when the model is deleted."""
        if self.file:
            self.file.delete(save=False)
        super().delete(*args, **kwargs)
