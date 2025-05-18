# notifications/utils.py

from firebase_admin import messaging
from .models import FCMToken

def send_push_notification(user, title, body, link=None):
    try:
        fcm = FCMToken.objects.get(user=user)

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=fcm.token,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="/logo192.png",
                    click_action=link or "https://zportaacademy.com"
                )
            )
        )

        response = messaging.send(message)
        print("✅ Push sent:", response)
        return True
    except FCMToken.DoesNotExist:
        print(f"❌ No token for {user.username}")
        return False
