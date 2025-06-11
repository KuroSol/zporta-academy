from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from mentions.models import Mention
from notes.models import Comment
from .models import Notification # Refers to your main Notification model
from .utils import send_push_to_user_devices # For sending push notifications


@receiver(post_save, sender=Notification)
def auto_push_on_notification_create(sender, instance, created, **kwargs):
    """
    Whenever a new Notification is saved, immediately fire the Firebase push.
    """
    # Only on create, and only if we haven't already sent a push
    if not created or instance.is_sent_push:
        return

    # Send to all devices for this user
    sent_count = send_push_to_user_devices(
        user=instance.user,
        title=instance.title,
        body=instance.message,
        link=instance.link,
        extra_data={"notification_app_id": str(instance.id), "type": "auto_push"}
    )

    # Mark as sent so we don't duplicate
    if sent_count > 0:
        instance.is_sent_push = True
        instance.save(update_fields=["is_sent_push"])
        

@receiver(post_save, sender=Mention)
def create_mention_notification(sender, instance, created, **kwargs):
    if not created:
        return
    
    note = instance.note
    from_user = note.user
    to_user = instance.user

    if from_user == to_user: # Don't notify user about their own mentions if note.user is the mentioner
        return

    message = f"{from_user.username} mentioned you in a diary entry."
    link = f"/diary/{note.id}/" # Consider making this a full URL if needed by frontend directly

    # Create the in-app notification
    app_notification = Notification.objects.create(
        user=to_user,
        title="New Mention", # Add a title
        message=message,
        link=link
    )

    # Optionally, send a push notification
    # Consider if all mentions should trigger an immediate push.
    # You might want to add user preferences for this.
    #if getattr(settings, 'SEND_PUSH_ON_MENTION', True): # Example setting
        #send_push_to_user_devices(
        #    user=to_user,
        #    title="New Mention",
        #    body=message,
        #    link=link,
        #    extra_data={"type": "mention", "object_id": str(note.id)}
        #)
        #app_notification.is_sent_push = True # Mark that a push was attempted
        #app_notification.save(update_fields=['is_sent_push'])


@receiver(post_save, sender=Comment)
def create_comment_notification(sender, instance, created, **kwargs):
    if not created:
        return

    comment = instance
    note = comment.note
    from_user = comment.user

    # 1) Notify the diary’s author if someone (other than them) comments:
    if note.user != from_user:
        author_message = f"{from_user.username} commented on your diary entry."
        author_link = f"/diary/{note.id}/"
        author_title = "New Comment on Your Diary"

        author_app_notification = Notification.objects.create(
            user=note.user,
            title=author_title,
            message=author_message,
            link=author_link
        )
        if getattr(settings, 'SEND_PUSH_ON_COMMENT_AUTHOR', True):
            send_push_to_user_devices(
                user=note.user,
                title=author_title,
                body=author_message,
                link=author_link,
                extra_data={"type": "comment_author", "object_id": str(note.id)}
            )
            author_app_notification.is_sent_push = True
            author_app_notification.save(update_fields=['is_sent_push'])


    # 2) Notify other mentioned users (excluding the commenter and the note author if already notified)
    #    when someone replies to a diary entry where they were mentioned.
    mentioned_users_to_notify = note.mentions.all().exclude(pk=from_user.pk).exclude(pk=note.user.pk)
    
    if mentioned_users_to_notify.exists():
        mention_reply_title = "Reply in a Mentioned Diary"
        mention_reply_message = f"{from_user.username} replied to a diary entry where you were mentioned."
        mention_reply_link = f"/diary/{note.id}/" # Link to the specific diary entry

        for mentioned_user in mentioned_users_to_notify:
            mention_app_notification = Notification.objects.create(
                user=mentioned_user,
                title=mention_reply_title,
                message=mention_reply_message,
                link=mention_reply_link
            )
            if getattr(settings, 'SEND_PUSH_ON_MENTION_REPLY', True):
                send_push_to_user_devices(
                    user=mentioned_user,
                    title=mention_reply_title,
                    body=mention_reply_message,
                    link=mention_reply_link,
                    extra_data={"type": "comment_mention_reply", "object_id": str(note.id)}
                )
                mention_app_notification.is_sent_push = True
                mention_app_notification.save(update_fields=['is_sent_push'])