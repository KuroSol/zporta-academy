import stripe
from django.conf import settings
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Course
from django.core.cache import cache

stripe.api_key = settings.STRIPE_SECRET_KEY


@receiver(post_save, sender=Course)
def create_or_update_stripe_product(sender, instance, created, **kwargs):
    """
    Create or update a Stripe Product and Price when a premium course is saved.
    This allows promo codes to be restricted to specific products.
    """
    # Only create Stripe products for premium courses
    if instance.course_type != 'premium' or not instance.price:
        return
    
    # Skip if course is still a draft (no need to create products yet)
    if instance.is_draft:
        return
    
    try:
        price_in_cents = int(float(instance.price) * 100)
        
        # Prepare product data
        product_data = {
            'name': instance.title,
            'metadata': {
                'course_id': str(instance.id),
                'creator_id': str(instance.created_by.id),
                'permalink': instance.permalink,
            }
        }
        
        # Add description if available
        if instance.description:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(instance.description, 'html.parser')
            text = soup.get_text()[:500]  # Stripe description max 500 chars
            product_data['description'] = text
        
        # Create or update Stripe Product
        if instance.stripe_product_id:
            # Update existing product
            try:
                stripe.Product.modify(
                    instance.stripe_product_id,
                    **product_data
                )
                product_id = instance.stripe_product_id
            except stripe.error.InvalidRequestError:
                # Product doesn't exist, create new one
                product = stripe.Product.create(**product_data)
                product_id = product.id
        else:
            # Create new product
            product = stripe.Product.create(**product_data)
            product_id = product.id
        
        # Create or update Price
        # Note: Stripe Prices are immutable, so we create a new one if price changed
        # and archive the old one
        if instance.stripe_price_id:
            try:
                existing_price = stripe.Price.retrieve(instance.stripe_price_id)
                # Check if price amount changed
                if existing_price.unit_amount != price_in_cents:
                    # Archive old price
                    stripe.Price.modify(instance.stripe_price_id, active=False)
                    # Create new price
                    new_price = stripe.Price.create(
                        product=product_id,
                        unit_amount=price_in_cents,
                        currency='usd',
                    )
                    price_id = new_price.id
                else:
                    price_id = instance.stripe_price_id
            except stripe.error.InvalidRequestError:
                # Price doesn't exist, create new one
                new_price = stripe.Price.create(
                    product=product_id,
                    unit_amount=price_in_cents,
                    currency='usd',
                )
                price_id = new_price.id
        else:
            # Create new price
            new_price = stripe.Price.create(
                product=product_id,
                unit_amount=price_in_cents,
                currency='usd',
            )
            price_id = new_price.id
        
        # Update course with Stripe IDs (avoid triggering signal recursively)
        if instance.stripe_product_id != product_id or instance.stripe_price_id != price_id:
            Course.all_objects.filter(id=instance.id).update(
                stripe_product_id=product_id,
                stripe_price_id=price_id
            )
    
    except Exception as e:
        # Log error but don't fail the save operation
        print(f"Error creating/updating Stripe product for course {instance.id}: {str(e)}")

    # Invalidate cached serialization after any save
    try:
        cache.delete(f"course_lessons_quizzes_{instance.id}")
    except Exception:
        pass
