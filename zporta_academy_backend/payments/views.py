import json
import stripe
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from courses.models import Course  # Import the Course model
from django.contrib.auth.models import User  # Import the User model
from enrollment.models import Enrollment  # Import the Enrollment model

# Set your Stripe API key from settings.
stripe.api_key = settings.STRIPE_SECRET_KEY

@csrf_exempt
def create_checkout_session(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Retrieve the course_id from the request body.
            course_id = data.get('course_id')
            # Fetch the course from the database.
            course = Course.objects.get(id=course_id)
            # Calculate price in cents (e.g., $25.00 becomes 2500 cents)
            price_in_cents = int(course.price * 100)
            
            # Set your domain URL (adjust if needed)
            domain_url = "http://localhost:3000/"
            # Create the Stripe checkout session.
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': course.title,  # Use the course title
                        },
                        'unit_amount': price_in_cents,  # Dynamic course price
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{domain_url}payment-success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{domain_url}payment-cancel",
                metadata={
                    'course_id': course.id,
                    'user_id': request.user.id if request.user.is_authenticated else 'guest'
                }
            )
            return JsonResponse({'sessionId': checkout_session['id']})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return HttpResponse(status=405)


@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET  # Make sure this is set in your .env
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        return HttpResponse(status=400)

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        course_id = session.get('metadata', {}).get('course_id')
        user_id = session.get('metadata', {}).get('user_id')
        if course_id and user_id and user_id != "guest":
            try:
                course = Course.objects.get(id=course_id)
                user = User.objects.get(id=user_id)
                Enrollment.objects.create(
                    user=user,
                    object_id=course.id,
                    enrollment_type="course"
                )
            except Exception as e:
                print("Enrollment error:", e)
                return HttpResponse(status=400)
    return HttpResponse(status=200)
