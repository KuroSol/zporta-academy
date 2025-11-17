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
            allow_promotion_codes=True,
            success_url=f"{domain_url}payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{domain_url}payment-cancel",
            metadata={
                'course_id': str(course.id),
                'user_id': str(request.user.id),
            }
        )
        # Return both the session id and the hosted Checkout URL. Redirecting
        # directly to the hosted URL avoids any mismatch with publishable keys
        # on the frontend and works without Stripe.js.
        return Response({'sessionId': checkout_session['id'], 'url': checkout_session.get('url')})
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_promo_code(request):
    """Create a Stripe Coupon + Promotion Code for a course.
    Accepts percent_off, optional custom code (or generates one), expiration, and limits.
    """
    data = request.data or {}
    course_id = data.get('course_id')
    if not course_id:
        return Response({'error': 'course_id required'}, status=400)
    try:
        course = Course.all_objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found'}, status=404)

    # Only the creator can create codes for this course
    if not request.user.is_authenticated or request.user.id != course.created_by_id:
        return Response({'error': 'Not authorized'}, status=403)

    try:
        percent_off = int(data.get('percent_off', 10))
        if percent_off < 1 or percent_off > 100:
            return Response({'error': 'percent_off must be between 1 and 100'}, status=400)
    except Exception:
        return Response({'error': 'percent_off must be an integer'}, status=400)

    code = (data.get('code') or '').strip()
    max_redemptions = data.get('max_redemptions')
    first_time_only = bool(data.get('first_time_only', False))
    expires_at = data.get('expires_at')  # ISO8601 or epoch seconds

    # Parse expires_at into epoch seconds if provided as string
    expires_ts = None
    if expires_at:
        try:
            if isinstance(expires_at, (int, float)):
                expires_ts = int(expires_at)
            else:
                # ISO8601 -> epoch
                from datetime import datetime
                expires_ts = int(datetime.fromisoformat(str(expires_at).replace('Z','+00:00')).timestamp())
        except Exception:
            return Response({'error': 'Invalid expires_at format'}, status=400)

    # Create coupon
    coupon = stripe.Coupon.create(
        percent_off=percent_off,
        duration='once',
        metadata={
            'course_id': str(course.id),
            'creator_id': str(request.user.id),
        }
    )

    # Generate a random code if not provided
    import random, string
    def gen_code(n=10):
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(n))
    if not code:
        code = gen_code(10)

    # Create promotion code
    promo_kwargs = dict(
        coupon=coupon.id,
        code=code,
        active=True,
        metadata={
            'course_id': str(course.id),
            'creator_id': str(request.user.id),
        }
    )
    if expires_ts:
        promo_kwargs['expires_at'] = expires_ts
    if max_redemptions:
        try:
            promo_kwargs['max_redemptions'] = int(max_redemptions)
        except Exception:
            return Response({'error': 'max_redemptions must be an integer'}, status=400)
    restrictions = {}
    if first_time_only:
        restrictions['first_time_transaction'] = True
    if restrictions:
        promo_kwargs['restrictions'] = restrictions

    try:
        promo = stripe.PromotionCode.create(**promo_kwargs)
    except stripe.error.InvalidRequestError as e:
        # If code already exists, try with a new random code
        if 'already exists' in str(e).lower():
            promo_kwargs['code'] = gen_code(12)
            promo = stripe.PromotionCode.create(**promo_kwargs)
        else:
            raise

    return Response({
        'coupon_id': coupon.id,
        'promotion_code_id': promo.id,
        'code': promo.code,
        'percent_off': percent_off,
        'expires_at': promo.expires_at,
        'max_redemptions': getattr(promo, 'max_redemptions', None),
        'first_time_only': first_time_only,
    }, status=201)
