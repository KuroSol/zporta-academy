from firebase_admin import messaging
from .models import FCMToken, FCMLog
from firebase_admin.messaging import WebpushNotificationAction

from firebase_admin.exceptions import InvalidArgumentError, UnregisteredError

def send_push_notification(user, title, body, link=None):
    # 1) Fetch all tokens for this user
    tokens = list(
        FCMToken.objects
        .filter(user=user)
        .values_list('token', flat=True)
    )
    if not tokens:
        # Log no-token case
        FCMLog.objects.create(
            user=user,
            token='',
            action='send',
            success=False,
            detail='No tokens found'
        )
        return False

    success_count = 0

    for token in tokens:
        try:
            # 2) Build your message exactly as before, but per-token
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                token=token,
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
                data={"url": link or "https://zportaacademy.com"}
            )

            response = messaging.send(message)
            success_count += 1

            # 3) Log the successful send
            FCMLog.objects.create(
                user=user,
                token=token,
                action='send',
                success=True,
                detail=f"Response: {response}"
            )

        except UnregisteredError:
            # 4) Prune only truly unregistered tokens
            FCMToken.objects.filter(token=token).delete()
            FCMLog.objects.create(
                user=user,
                token=token,
                action='prune',
                success=True,
                detail='Pruned unregistered token'
            )

        except InvalidArgumentError as e:
            # 5) Log invalid-token errors, but don’t delete
            FCMLog.objects.create(
                user=user,
                token=token,
                action='send',
                success=False,
                detail=f"InvalidArgument: {e}"
            )

        except Exception as e:
            # 6) Catch any other failures without nuking tokens
            FCMLog.objects.create(
                user=user,
                token=token,
                action='send',
                success=False,
                detail=f"Other error: {e}"
            )

    # Return True if at least one device got it
    return success_count > 0
