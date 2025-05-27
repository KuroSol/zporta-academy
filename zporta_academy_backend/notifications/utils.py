# --------------- Django Backend: notifications/utils.py ---------------
import firebase_admin
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from django.conf import settings # Not strictly needed here if DOMAIN is hardcoded or comes from elsewhere
from pathlib import Path # Not strictly needed here unless for other path operations

from .models import FCMToken, FCMLog, Notification as AppNotification

# Define your default domain here, or pull from settings if preferred
# e.g., from django.conf import settings; DEFAULT_DOMAIN = getattr(settings, 'DEFAULT_DOMAIN', 'https://zportaacademy.com')
DEFAULT_DOMAIN = "https://zportaacademy.com"

def send_push_to_user_devices(user, title, body, link=None, extra_data=None):
    """
    Sends a push notification to all active devices for a given user.
    Returns the number of successful deliveries.
    """
    try:
        firebase_admin.get_app()
    except ValueError:
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

    processed_extra_data = {}
    if extra_data:
        for key, value in extra_data.items():
            processed_extra_data[key] = str(value) # Ensure all extra_data values are strings

    # --- Robust Link Processing ---
    final_link_str = DEFAULT_DOMAIN + "/" # Default link if all else fails or link is None/empty

    if link and isinstance(link, str) and link.strip(): # Check if link is a non-empty string
        link_stripped = link.strip()
        if link_stripped.startswith("https://"):
            final_link_str = link_stripped
        elif link_stripped.startswith("http://"):
            # Convert HTTP to HTTPS or use default; for now, let's convert
            final_link_str = "https://" + link_stripped[len("http://"):]
            print(f"Info: Converted HTTP link '{link_stripped}' to HTTPS '{final_link_str}'.")
        elif link_stripped.startswith("/"):
            # Handle relative paths by prepending your domain
            final_link_str = f"{DEFAULT_DOMAIN}{link_stripped}"
            print(f"Info: Converted relative link '{link_stripped}' to '{final_link_str}'.")
        else:
            # If link is present but not recognized as valid https/http/relative,
            # or if it's a malformed URL, use default.
            # You might want to log a more specific warning if it's an unexpected format.
            print(f"Warning: Provided link '{link_stripped}' is not a recognized absolute HTTPS/HTTP URL or relative path. Using default link: '{final_link_str}'.")
    else: # link is None, empty, or not a string
        print(f"Info: No valid link provided or link is empty. Using default link: '{final_link_str}'.")
    # --- End of Robust Link Processing ---

    webpush_config = messaging.WebpushConfig(
        notification=messaging.WebpushNotification(
            title=str(title), body=str(body),
            icon=str(processed_extra_data.get("icon", f"{DEFAULT_DOMAIN}/logo192.png")), # Use default domain for default icon
            badge=str(processed_extra_data.get("badge", f"{DEFAULT_DOMAIN}/badge-icon.png")), # Use default domain for default badge
        ),
        fcm_options=messaging.WebpushFCMOptions(link=final_link_str) # Use the processed final_link_str
    )

    android_config = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            title=str(title), body=str(body),
            icon=str(processed_extra_data.get("icon_android", "ic_notification")),
            color=str(processed_extra_data.get("color", "#FFA500")),
            channel_id=str(processed_extra_data.get("channel_id", "default_channel_id")),
            click_action=final_link_str # For Android, click_action in notification payload can be used
        )
    )

    # For APNS, the click action is typically handled by the 'url' in custom_data or by the app interpreting the payload.
    # The 'custom_data' dictionary in APNSPayload is the right place for the URL.
    apns_custom_data = {key: str(value) for key, value in processed_extra_data.items()}
    apns_custom_data["url"] = final_link_str # Ensure the URL is in the custom data for APNS

    apns_config = messaging.APNSConfig(
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(title=str(title), body=str(body)),
                badge=int(processed_extra_data.get("badge_count", 1)), # Badge should be an int
                sound="default",
                custom_data=apns_custom_data # Pass the dictionary with the URL
            )
        )
    )

    data_payload = {
        "url": final_link_str, # Use the processed final_link_str
        "title": str(title),
        "body": str(body),
        **processed_extra_data
    }
    # Ensure all values in data_payload are strings, as FCM requires this for the 'data' field.
    for key in data_payload:
        data_payload[key] = str(data_payload[key])


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
        print(f"DEBUG: Attempting to send {len(messages_to_send)} fully configured messages. Link: {final_link_str}")
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
                fcm_token_instance.save() # Updates last_seen
            else:
                error_code = response_item.exception.code if hasattr(response_item.exception, 'code') else 'UNKNOWN_ERROR'
                error_detail = str(response_item.exception)
                print(f"DEBUG: Send failure for token {fcm_token_instance.token[:10]}... Error: {error_code} - {error_detail}")
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
        print(f"DEBUG: FirebaseError during FULL batch send: {e}")
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"FirebaseError during batch send: {str(e)}"
        )
        return 0

    return success_count
