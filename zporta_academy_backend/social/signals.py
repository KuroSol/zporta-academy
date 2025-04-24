from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import GuideRequest
from notifications.models import Notification

@receiver(post_save, sender=GuideRequest)
def notify_guide_on_request(sender, instance, created, **kwargs):
    # Remove or comment out this notification creation
    # if created:
    #     Notification.objects.create(
    #         user=instance.guide,
    #         message=f"{instance.explorer.username} has requested to attend your profile.",
    #         link="/guide-requests/",
    #         guide_request=instance
    #     )
     pass