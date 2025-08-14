# tags/models.py
from django.core.validators import RegexValidator
from django.db import models

class Tag(models.Model):
    name = models.CharField(
        max_length=191,            # or your chosen size
        unique=True,
        validators=[RegexValidator(r'^\S+$', 'Tags cannot contain spaces.')]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
