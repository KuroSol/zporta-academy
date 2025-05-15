from django.db.models.signals import post_save
from django.dispatch import receiver

from mentions.models import Mention       # Mention model :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
from notes.models import Comment          # Comment model  :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}
from notifications.models import Notification  # Notification model :contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}

@receiver(post_save, sender=Mention)
def create_mention_notification(sender, instance, created, **kwargs):
    if not created:
        return
    note       = instance.note
    from_user  = note.user
    to_user    = instance.user

    Notification.objects.create(
        user    = to_user,
        message = f"{from_user.username} mentioned you in a diary entry.",
        link    = f"/diary/{note.id}/"
    )

@receiver(post_save, sender=Comment)
def create_comment_notification(sender, instance, created, **kwargs):
    if not created:
        return
    comment   = instance
    note      = comment.note
    from_user = comment.user

    # Notify every mentioned user (except the replier)
    for mentioned_user in note.mentions.exclude(pk=from_user.pk):
        Notification.objects.create(
            user    = mentioned_user,
            message = f"{from_user.username} replied to a diary entry where you were mentioned.",
            link    = "/diary"
        )

