from django.db import models
from django.contrib.auth.models import User
from notes.models import Note  # assuming your diary/notes app is named "notes"

class Mention(models.Model):
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='mentions_received'
    )
    note = models.ForeignKey(
        Note, 
        on_delete=models.CASCADE, 
        related_name='mention_notifications'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} mentioned in Note {self.note.id}"
