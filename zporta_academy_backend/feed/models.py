from django.db import models
from django.conf import settings

class Subject(models.Model):
    name = models.CharField(max_length=100, unique=True)
    def __str__(self):
        return self.name

class Language(models.Model):
    name = models.CharField(max_length=100, unique=True)
    def __str__(self):
        return self.name

class Region(models.Model):
    name = models.CharField(max_length=100, unique=True)
    def __str__(self):
        return self.name

class UserPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preference"
    )
    subjects = models.ManyToManyField(Subject, blank=True, related_name="users")
    languages = models.ManyToManyField(Language, blank=True, related_name="users")
    regions  = models.ManyToManyField(Region, blank=True, related_name="users")

    def __str__(self):
        return f"Preferences for {self.user}"
