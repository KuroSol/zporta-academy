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
        elif link_stripped.startswith("/"):
            final_link_str = f"{DEFAULT_DOMAIN}{link_stripped}"
    # (Simplified link processing from your previous simplified version for this test)

    messages_to_send_individually = []
    for fcm_token_obj in active_user_tokens:
        simple_data_payload = {
            'title': str(title),
            'body': str(body),
            'url': final_link_str,
        }
        if extra_data and "notification_db_id" in extra_data: # Keep essential data if needed by client
            simple_data_payload["notification_db_id"] = str(extra_data["notification_db_id"])
        
        # Also ensure all values in simple_data_payload are strings
        for key in simple_data_payload: simple_data_payload[key] = str(simple_data_payload[key])

        msg = messaging.Message(
            token=fcm_token_obj.token,
            data=simple_data_payload,
            # NO webpush, android, apns configs for this test to match test_fcm.py simplicity
        )
        messages_to_send_individually.append({ "message_obj": msg, "fcm_token_instance": fcm_token_obj })

    if not messages_to_send_individually:
        return 0

    success_count = 0
    print(f"DEBUG: Attempting to send {len(messages_to_send_individually)} messages INDIVIDUALLY using messaging.send(). Using app: {current_app.name}")

    for item_to_send in messages_to_send_individually:
        msg = item_to_send["message_obj"]
        fcm_token_instance = item_to_send["fcm_token_instance"]
        try:
            print(f"DEBUG: Sending to token {msg.token[:20]}...")
            response_message_id = messaging.send(msg, app=current_app) # Using messaging.send()
            success_count += 1
            print(f"DEBUG: Successfully sent message to token {msg.token[:20]}... Message ID: {response_message_id}")
            FCMLog.objects.create(
                user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                action='send_success', success=True, detail=f"Message ID: {response_message_id}"
            )
            fcm_token_instance.save() # Updates last_seen
        except FirebaseError as e:
            error_code = e.code if hasattr(e, 'code') else 'UNKNOWN_ERROR'
            error_detail = str(e)
            print(f"DEBUG: FirebaseError during individual send to token {msg.token[:20]}... Error: {error_code} - {error_detail}")
            if hasattr(e, 'http_response') and e.http_response is not None:
                 print(f"DEBUG: HTTP Response Status for failed send: {e.http_response.status_code}")
                 print(f"DEBUG: HTTP Response Text for failed send: {e.http_response.text}")
            FCMLog.objects.create(
                user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                action='send_failure', success=False, detail=f"Error sending individually: {error_code} - {error_detail}"
            )
            # Handle token deactivation as before if needed based on error_code
            unregistered_codes = [
                'messaging/registration-token-not-registered',
                'messaging/invalid-registration-token',
            ]
            if error_code in unregistered_codes:
                fcm_token_instance.is_active = False
                fcm_token_instance.save()
                # ... (log token_inactive)
            elif error_code == 'messaging/invalid-argument' and "registration token" in error_detail.lower():
                fcm_token_instance.is_active = False
                fcm_token_instance.save()
                # ... (log token_inactive)
        except Exception as ex_generic: # Catch any other unexpected errors
            print(f"DEBUG: Generic error during individual send to token {msg.token[:20]}... Error: {str(ex_generic)}")
            FCMLog.objects.create(
                user=user, token=fcm_token_instance.token, device_id=fcm_token_instance.device_id,
                action='send_failure', success=False, detail=f"Generic error sending individually: {str(ex_generic)}"
            )


    FCMLog.objects.create(
        user=user, action='send_attempt', success=(success_count > 0),
        detail=f"Individual send attempts completed. Success: {success_count}, Total attempted: {len(messages_to_send_individually)}."
    )
    return success_count