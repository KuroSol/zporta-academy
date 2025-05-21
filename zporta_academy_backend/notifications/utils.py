from firebase_admin import messaging
from .models import FCMToken
from firebase_admin.messaging import WebpushNotificationAction

from firebase_admin.exceptions import InvalidArgumentError

def send_push_notification(user, title, body, link=None):
    try:
        fcm = FCMToken.objects.get(user=user)

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            token=fcm.token,
            webpush=messaging.WebpushConfig(
                headers={"Urgency": "high"},
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="https://zportaacademy.com/logo192.png",
                    badge="https://zportaacademy.com/badge-icon.png",
                    vibrate=[200, 100, 200],
                    actions=[
                        WebpushNotificationAction(
                            action="open",
                            title="Open App"
                        )
                    ]
                ),
                fcm_options=messaging.WebpushFCMOptions(
                    link=link or "https://zportaacademy.com"
                )
            ),
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="default_channel",
                    click_action=link or "https://zportaacademy.com"
                )
            ),
            data={
                "url": link or "https://zportaacademy.com"
            }
        )

        response = messaging.send(message)
        print("✅ Push sent:", response)
        return True

    except FCMToken.DoesNotExist:
        print(f"❌ No token for {user.username}")
        return False

    except InvalidArgumentError as e:
        print(f"❌ Invalid token for {user.username}: {fcm.token}")
        # Optionally delete bad token
        fcm.delete()
        return False
