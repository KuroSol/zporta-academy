# --------------- Django Backend: notifications/utils.py ---------------
import firebase_admin
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
# from django.conf import settings
# from pathlib import Path

from .models import FCMToken, FCMLog, Notification as AppNotification

DEFAULT_DOMAIN = "https://zportaacademy.com"

def send_push_to_user_devices(user, title, body, link=None, extra_data=None):
    """
    Sends a push notification to all active devices for a given user.
    Returns the number of successful deliveries.
    """
    try:
        current_app = firebase_admin.get_app()
        print(f"DEBUG: Using Firebase app: {current_app.name} for project: {current_app.project_id}")
    except ValueError:
        print("CRITICAL ERROR: Firebase Admin SDK not initialized. Cannot send push notifications.")
        FCMLog.objects.create(action='send_attempt', success=False, detail="Firebase Admin SDK default app not found prior to send.")
        return 0

    active_user_tokens = FCMToken.objects.filter(user=user, is_active=True)
    if not active_user_tokens.exists():
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"No active FCM tokens found for user {user.username}."
        )
        return 0

    # --- Simplified Link for testing ---
    final_link_str = DEFAULT_DOMAIN + "/"
    if link and isinstance(link, str) and link.strip():
        if link.strip().startswith("https://"):
            final_link_str = link.strip()
        elif link.strip().startswith("/"):
            final_link_str = f"{DEFAULT_DOMAIN}{link.strip()}"
    # --- End of Simplified Link ---


    messages_to_send = []
    token_instances_map = {}

    for fcm_token_obj in active_user_tokens:
        # --- Create the SIMPLEST possible message, similar to test_fcm.py ---
        simple_data_payload = {
            'title': str(title),
            'body': str(body),
            'url': final_link_str, # Use the processed link
            # Add any absolutely essential extra_data items as strings
        }
        if extra_data and "notification_db_id" in extra_data:
            simple_data_payload["notification_db_id"] = str(extra_data["notification_db_id"])

        print(f"DEBUG: Constructing simple message for token {fcm_token_obj.token[:10]}... with payload: {simple_data_payload}")

        msg = messaging.Message(
            token=fcm_token_obj.token,
            data=simple_data_payload,
            # Temporarily remove complex configs to isolate the problem:
            # webpush=webpush_config,
            # android=android_config,
            # apns=apns_config
        )
        messages_to_send.append(msg)
        token_instances_map[fcm_token_obj.token] = fcm_token_obj

    if not messages_to_send:
        return 0

    success_count = 0
    try:
        print(f"DEBUG: Attempting to send {len(messages_to_send)} SIMPLIFIED messages. Using app: {current_app.name}")
        batch_response = messaging.send_all(messages_to_send, app=current_app)
        
        FCMLog.objects.create(
            user=user, action='send_attempt', success=True,
            detail=f"Batch send (simplified) attempted. Success: {batch_response.success_count}, Failure: {batch_response.failure_count} for {len(messages_to_send)} tokens."
        )

        # ... (rest of your success/failure logging based on batch_response) ...
        # This part remains the same as your previous version
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
                print(f"DEBUG: Send failure (simplified) for token {fcm_token_instance.token[:10]}... Error: {error_code} - {error_detail}")
                FCMLog.objects.create(
                    user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                    action='send_failure', success=False, detail=f"Error (simplified send): {error_code} - {error_detail}"
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
        print(f"DEBUG: FirebaseError during SIMPLIFIED batch send (utils.py): {e}")
        if hasattr(e, 'http_response') and e.http_response is not None:
             print(f"DEBUG: HTTP Response Status: {e.http_response.status_code}")
             print(f"DEBUG: HTTP Response Text: {e.http_response.text}") # This will show the HTML 404 page if it's still that
        FCMLog.objects.create(
            user=user, action='send_attempt', success=False,
            detail=f"FirebaseError during simplified batch send: {str(e)}"
        )
        return 0

    return success_count