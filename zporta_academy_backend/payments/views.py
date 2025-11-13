import json
import stripe
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from courses.models import Course
from django.contrib.auth.models import User
from enrollment.models import Enrollment
from django.contrib.contenttypes.models import ContentType
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    """Create a Stripe Checkout Session for a premium course.
    Requires authentication so we can persist the user_id in metadata reliably.
    """
    try:
        course_id = request.data.get('course_id')
        if not course_id:
            return Response({'error': 'course_id required'}, status=400)
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=404)

        if course.price is None:
            return Response({'error': 'Course has no price configured'}, status=400)

        price_in_cents = int(float(course.price) * 100)
        domain_url = getattr(settings, 'FRONTEND_URL_BASE', 'https://zportaacademy.com').rstrip('/') + '/'

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': course.title,
                    },
                    'unit_amount': price_in_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{domain_url}payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{domain_url}payment-cancel",
            metadata={
                'course_id': str(course.id),
                'user_id': str(request.user.id),
            }
        )
        return Response({'sessionId': checkout_session['id']})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_checkout_session(request):
    """Verify a Stripe session and enroll the current user if paid.
    This avoids relying solely on webhooks (which might not be configured).
    """
    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'error': 'session_id required'}, status=400)
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.get('payment_status') != 'paid':
            return Response({'status': session.get('payment_status', 'unknown')}, status=402)
        course_id = session.get('metadata', {}).get('course_id')
        if not course_id:
            return Response({'error': 'No course metadata on session'}, status=400)
        course = Course.objects.filter(id=course_id).first()
        if not course:
            return Response({'error': 'Course not found'}, status=404)

        # Create enrollment if not exists
        course_ct = ContentType.objects.get_for_model(Course)
        Enrollment.objects.get_or_create(
            user=request.user,
            content_type=course_ct,
            object_id=course.id,
            defaults={
                'enrollment_type': 'course',
                'status': 'active',
            }
        )
        return Response({'ok': True, 'course_id': course.id, 'course_permalink': getattr(course, 'permalink', '')})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


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
                course_ct = ContentType.objects.get_for_model(Course)
                Enrollment.objects.get_or_create(
                    user=user,
                    content_type=course_ct,
                    object_id=course.id,
                    defaults={
                        'enrollment_type': 'course',
                        'status': 'active',
                    }
                )
            except Exception as e:
                print("Enrollment error:", e)
                return HttpResponse(status=400)
    return HttpResponse(status=200)
