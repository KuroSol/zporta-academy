from django.urls import path
from .views import create_checkout_session, stripe_webhook

urlpatterns = [
    path('create-checkout-session/', create_checkout_session, name='create-checkout-session'),
    path('webhook/', stripe_webhook, name='stripe-webhook'),  # Optional webhook endpoint
]
