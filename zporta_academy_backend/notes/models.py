from django.db import models
from django.contrib.auth.models import User

class Note(models.Model):
    PRIVACY_CHOICES = [
        ('private', 'Private'),
        ('public', 'Public'),
        ('mention', 'Mention'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")
    text = models.TextField()
    image = models.ImageField(upload_to="note_images/", blank=True, null=True)
    privacy = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default='private')
    mentions = models.ManyToManyField(User, related_name="mentioned_notes", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.text[:20]}"

class Comment(models.Model):
    note = models.ForeignKey('Note', on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.user.username} on Note {self.note.id}"