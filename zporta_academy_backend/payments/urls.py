from django.urls import path
from .views import create_checkout_session, stripe_webhook, confirm_checkout_session, create_promo_code, validate_promo_code

urlpatterns = [
    path('create-checkout-session/', create_checkout_session, name='create-checkout-session'),
    path('confirm/', confirm_checkout_session, name='confirm-checkout-session'),
    path('webhook/', stripe_webhook, name='stripe-webhook'),  # Optional webhook endpoint
    path('create-promo-code/', create_promo_code, name='create-promo-code'),
    path('validate-promo-code/', validate_promo_code, name='validate-promo-code'),
]
