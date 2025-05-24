# --------------- Django Backend: notifications/utils.py ---------------
import firebase_admin # Import the top-level firebase_admin module
from firebase_admin import messaging
# credentials and initialize_app are no longer needed here if initialized in apps.py
from firebase_admin.exceptions import FirebaseError
from django.conf import settings # For Firebase creds path if stored in settings
from pathlib import Path

from .models import FCMToken, FCMLog, Notification as AppNotification # Using the renamed AppNotification

# --- Firebase Admin SDK Initialization is now handled in notifications/apps.py ---
# Ensure that notifications.apps.NotificationsConfig.ready() is correctly initializing Firebase.

def send_push_to_user_devices(user, title, body, link=None, extra_data=None):
    """
    Sends a push notification to all active devices for a given user.
    Returns the number of successful deliveries.
    """
    # Correct way to check if the default Firebase app is initialized
    try:
        firebase_admin.get_app() 
    except ValueError: # No default app has been initialized
        print("Firebase Admin SDK not initialized. Cannot send push notifications.")
        FCMLog.objects.create(action='send_attempt', success=False, detail="Firebase Admin SDK not initialized.")
        return 0

    active_user_tokens = FCMToken.objects.filter(user=user, is_active=True)
    if not active_user_tokens.exists():
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"No active FCM tokens found for user {user.username}."
        )
        return 0

    # Ensure extra_data is a dictionary
    if extra_data is None:
        extra_data = {}

    webpush_config = messaging.WebpushConfig(
        notification=messaging.WebpushNotification(
            title=title, body=body,
            icon=extra_data.get("icon", "https://zportaacademy.com/logo192.png"),
            badge=extra_data.get("badge", "https://zportaacademy.com/badge-icon.png"),
        ),
        fcm_options=messaging.WebpushFCMOptions(link=link or "https://zportaacademy.com")
    )
    
    android_config = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            title=title, body=body,
            icon=extra_data.get("icon_android", "ic_notification"), 
            color=extra_data.get("color", "#FFA500"), 
            channel_id=extra_data.get("channel_id", "default_channel_id"),
        )
    )

    apns_config = messaging.APNSConfig(
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(title=title, body=body),
                badge=extra_data.get("badge_count", 1), 
                sound="default",
                custom_data={key: str(value) for key, value in {**(extra_data or {}), "url": link or "https://zportaacademy.com"}.items()}
            )
        )
    )

    data_payload = {
        "url": link or "https://zportaacademy.com", 
        "title": title, 
        "body": body,   
        **extra_data 
    }

    messages_to_send = []
    token_instances_map = {} 

    for fcm_token_obj in active_user_tokens:
        msg = messaging.Message(
            token=fcm_token_obj.token,
            data=data_payload,
            webpush=webpush_config,
            android=android_config,
            apns=apns_config
        )
        messages_to_send.append(msg)
        token_instances_map[fcm_token_obj.token] = fcm_token_obj


    if not messages_to_send:
        return 0

    success_count = 0
    try:
        batch_response = messaging.send_all(messages_to_send)
        
        FCMLog.objects.create(
            user=user, action='send_attempt', success=True, 
            detail=f"Batch send attempted. Success: {batch_response.success_count}, Failure: {batch_response.failure_count} for {len(messages_to_send)} tokens."
        )

        for idx, response_item in enumerate(batch_response.responses):
            original_message = messages_to_send[idx]
            token_str_for_this_message = original_message.token
            fcm_token_instance = token_instances_map.get(token_str_for_this_message)

            if not fcm_token_instance:
                print(f"Error: Could not find FCMToken instance for token {token_str_for_this_message[:10]} during batch response processing.")
                continue

            if response_item.success:
                success_count += 1
                FCMLog.objects.create(
                    user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                    action='send_success', success=True, detail=f"Message ID: {response_item.message_id}"
                )
                fcm_token_instance.save() 
            else:
                error_code = response_item.exception.code if hasattr(response_item.exception, 'code') else 'UNKNOWN_ERROR'
                error_detail = str(response_item.exception)
                FCMLog.objects.create(
                    user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                    action='send_failure', success=False, detail=f"Error: {error_code} - {error_detail}"
                )
                
                unregistered_codes = [
                    'messaging/registration-token-not-registered', 
                    'messaging/invalid-registration-token',        
                ]
                if error_code in unregistered_codes:
                    fcm_token_instance.is_active = False
                    fcm_token_instance.save()
                    FCMLog.objects.create(
                        user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                        action='token_inactive', detail=f"Token marked inactive due to send error: {error_code}"
                    )
                elif error_code == 'messaging/invalid-argument' and "registration token" in error_detail.lower():
                    fcm_token_instance.is_active = False
                    fcm_token_instance.save()
                    FCMLog.objects.create(
                        user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                        action='token_inactive', detail=f"Token marked inactive due to invalid argument (likely bad token): {error_detail}"
                    )

    except FirebaseError as e:
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"FirebaseError during batch send: {str(e)}"
        )
        return 0

    return success_count
