from django.db import models
from django.utils.functional import LazyObject
from django.conf import settings

class ManagedImage(models.Model):
    image = models.ImageField(upload_to='managed_images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    @property
    def full_url(self):
        return f"{settings.CURRENT_DOMAIN}{self.image.url}"

    def __str__(self):
        return f"Image uploaded by {self.uploaded_by.username} on {self.uploaded_at}"
