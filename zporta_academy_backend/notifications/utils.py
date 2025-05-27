# --------------- Django Backend: notifications/utils.py ---------------
import firebase_admin
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
# from django.conf import settings # Only if you need settings.DEFAULT_DOMAIN
from pathlib import Path # Not strictly needed here for this version

from .models import FCMToken, FCMLog, Notification as AppNotification

DEFAULT_DOMAIN = "https://zportaacademy.com" # Hardcoded for simplicity, or use settings

def send_push_to_user_devices(user, title, body, link=None, extra_data=None):
    """
    Sends a push notification to all active devices for a given user.
    Returns the number of successful deliveries.
    """
    try:
        # Get the default Firebase app instance.
        # This assumes Firebase was initialized successfully at startup (e.g., in base.py or apps.py)
        current_app = firebase_admin.get_app()
        print(f"DEBUG: Using Firebase app: {current_app.name} for project: {current_app.project_id}")
    except ValueError:
        print("CRITICAL ERROR: Firebase Admin SDK not initialized (default app not found). Cannot send push notifications.")
        FCMLog.objects.create(action='send_attempt', success=False, detail="Firebase Admin SDK default app not found prior to send.")
        return 0 # Critical failure, SDK isn't ready

    active_user_tokens = FCMToken.objects.filter(user=user, is_active=True)
    if not active_user_tokens.exists():
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"No active FCM tokens found for user {user.username}."
        )
        return 0

    processed_extra_data = {}
    if extra_data:
        for key, value in extra_data.items():
            processed_extra_data[key] = str(value)

    final_link_str = DEFAULT_DOMAIN + "/"
    if link and isinstance(link, str) and link.strip():
        link_stripped = link.strip()
        if link_stripped.startswith("https://"):
            final_link_str = link_stripped
        elif link_stripped.startswith("http://"):
            final_link_str = "https://" + link_stripped[len("http://"):]
            print(f"Info: Converted HTTP link '{link_stripped}' to HTTPS '{final_link_str}'.")
        elif link_stripped.startswith("/"):
            final_link_str = f"{DEFAULT_DOMAIN}{link_stripped}"
            print(f"Info: Converted relative link '{link_stripped}' to '{final_link_str}'.")
        else:
            print(f"Warning: Provided link '{link_stripped}' is not a recognized URL. Using default: '{final_link_str}'.")
    else:
        print(f"Info: No valid link provided. Using default: '{final_link_str}'.")

    webpush_config = messaging.WebpushConfig(
        notification=messaging.WebpushNotification(
            title=str(title), body=str(body),
            icon=str(processed_extra_data.get("icon", f"{DEFAULT_DOMAIN}/logo192.png")),
            badge=str(processed_extra_data.get("badge", f"{DEFAULT_DOMAIN}/badge-icon.png")),
        ),
        fcm_options=messaging.WebpushFCMOptions(link=final_link_str)
    )

    android_config = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            title=str(title), body=str(body),
            icon=str(processed_extra_data.get("icon_android", "ic_notification")),
            color=str(processed_extra_data.get("color", "#FFA500")),
            channel_id=str(processed_extra_data.get("channel_id", "default_channel_id")),
            click_action=final_link_str
        )
    )

    apns_custom_data = {key: str(value) for key, value in processed_extra_data.items()}
    apns_custom_data["url"] = final_link_str

    apns_config = messaging.APNSConfig(
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(title=str(title), body=str(body)),
                badge=int(processed_extra_data.get("badge_count", 1)),
                sound="default",
                custom_data=apns_custom_data
            )
        )
    )

    data_payload = {
        "url": final_link_str, "title": str(title), "body": str(body),
        **processed_extra_data
    }
    for key in data_payload: data_payload[key] = str(data_payload[key])

    messages_to_send = []
    token_instances_map = {}
    for fcm_token_obj in active_user_tokens:
        msg = messaging.Message(
            token=fcm_token_obj.token, data=data_payload,
            webpush=webpush_config, android=android_config, apns=apns_config
        )
        messages_to_send.append(msg)
        token_instances_map[fcm_token_obj.token] = fcm_token_obj

    if not messages_to_send: return 0

    success_count = 0
    try:
        print(f"DEBUG: Attempting to send {len(messages_to_send)} messages. Link: {final_link_str}. Using app: {current_app.name}")
        # Explicitly pass the app instance to send_all
        batch_response = messaging.send_all(messages_to_send, app=current_app) # <--- Explicit app instance
        
        FCMLog.objects.create(
            user=user, action='send_attempt', success=True,
            detail=f"Batch send attempted. Success: {batch_response.success_count}, Failure: {batch_response.failure_count} for {len(messages_to_send)} tokens."
        )

        for idx, response_item in enumerate(batch_response.responses):
            # ... (rest of your existing success/failure logging for each item in batch_response) ...
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
                print(f"DEBUG: Send failure for token {fcm_token_instance.token[:10]}... Error: {error_code} - {error_detail}")
                FCMLog.objects.create(
                    user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                    action='send_failure', success=False, detail=f"Error: {error_code} - {error_detail}"
                )
                # ... (your existing code for handling unregistered_codes) ...
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
        print(f"DEBUG: FirebaseError during FULL batch send (utils.py): {e}")
        if hasattr(e, 'http_response') and e.http_response is not None:
             print(f"DEBUG: HTTP Response Status: {e.http_response.status_code}")
             print(f"DEBUG: HTTP Response Text: {e.http_response.text}")
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"FirebaseError during batch send: {str(e)}"
        )
        return 0

    return success_count
