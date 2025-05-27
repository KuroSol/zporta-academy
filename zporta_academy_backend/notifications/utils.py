# --------------- Django Backend: notifications/utils.py ---------------
import firebase_admin
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from django.conf import settings
from pathlib import Path

from .models import FCMToken, FCMLog, Notification as AppNotification

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

    # --- Minimalist Test (Uncomment the block below and comment out the detailed configs if the string conversion above doesn't work) ---
    # print("DEBUG: Attempting MINIMALIST push notification send.")
    # data_payload_minimal = {
    #     "title": str(title),
    #     "body": str(body),
    #     "url": str(link or "https://zportaacademy.com/"), # Ensure link is also a string
    #     # "click_action": str(link or "https://zportaacademy.com/") # Sometimes used
    # }
    # webpush_config_minimal = messaging.WebpushConfig(
    #     notification=messaging.WebpushNotification(title=str(title), body=str(body)),
    #     fcm_options=messaging.WebpushFCMOptions(link=str(link or "https://zportaacademy.com/"))
    # )
    # messages_to_send_minimal = []
    # for fcm_token_obj in active_user_tokens:
    #     msg = messaging.Message(
    #         token=fcm_token_obj.token,
    #         data=data_payload_minimal, # Using minimal data payload
    #         # webpush=webpush_config_minimal # Optionally add minimal webpush
    #     )
    #     messages_to_send_minimal.append(msg)
    #
    # if not messages_to_send_minimal:
    #     return 0
    # try:
    #     print(f"DEBUG: Sending {len(messages_to_send_minimal)} MINIMAL messages.")
    #     batch_response = messaging.send_all(messages_to_send_minimal)
    #     # ... (rest of your logging and success/failure handling for the minimal test)
    #     # For brevity, I'm omitting the detailed batch response handling here, but you'd adapt it.
    #     print(f"DEBUG: Minimal batch response success: {batch_response.success_count}, failure: {batch_response.failure_count}")
    #     if batch_response.success_count > 0:
    #        return batch_response.success_count
    #     else: # if failures, log the first error for insight
    #        for resp_item in batch_response.responses:
    #            if not resp_item.success:
    #                print(f"DEBUG: Minimal send failure: {resp_item.exception}")
    #                FCMLog.objects.create(user=user, action='send_failure', success=False, detail=f"Minimal send error: {str(resp_item.exception)}")
    #                break # Log first error
    #        return 0
    # except FirebaseError as e:
    #     print(f"DEBUG: FirebaseError during MINIMAL batch send: {e}")
    #     FCMLog.objects.create(user=user, action='send_attempt', success=False, detail=f"Minimal FirebaseError: {str(e)}")
    #     return 0
    # --- End of Minimalist Test block ---

    # If not using the minimalist test, use the original detailed configuration:
    webpush_config = messaging.WebpushConfig(
        notification=messaging.WebpushNotification(
            title=str(title), body=str(body), # Ensure title and body are strings
            icon=str(processed_extra_data.get("icon", "https://zportaacademy.com/logo192.png")),
            badge=str(processed_extra_data.get("badge", "https://zportaacademy.com/badge-icon.png")),
        ),
        fcm_options=messaging.WebpushFCMOptions(link=str(link or "https://zportaacademy.com/"))
    )

    android_config = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            title=str(title), body=str(body), # Ensure title and body are strings
            icon=str(processed_extra_data.get("icon_android", "ic_notification")),
            color=str(processed_extra_data.get("color", "#FFA500")),
            channel_id=str(processed_extra_data.get("channel_id", "default_channel_id")),
        )
    )

    apns_config = messaging.APNSConfig(
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(title=str(title), body=str(body)), # Ensure title and body are strings
                badge=int(processed_extra_data.get("badge_count", 1)), # Badge should be an int
                sound="default",
                custom_data={key: str(value) for key, value in {**processed_extra_data, "url": str(link or "https://zportaacademy.com/")}.items()}
            )
        )
    )

    data_payload = {
        "url": str(link or "https://zportaacademy.com/"),
        "title": str(title),
        "body": str(body),
        **processed_extra_data # Use the processed_extra_data with string values
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
        print(f"DEBUG: Attempting to send {len(messages_to_send)} fully configured messages.") # Added debug print
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
                print(f"DEBUG: Send failure for token {fcm_token_instance.token[:10]}... Error: {error_code} - {error_detail}") # Added debug print
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
        print(f"DEBUG: FirebaseError during FULL batch send: {e}") # Added debug print
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"FirebaseError during batch send: {str(e)}"
        )
        return 0

    return success_count