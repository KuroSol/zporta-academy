import stripe
from django.core.management.base import BaseCommand
from django.conf import settings
from courses.models import Course
from bs4 import BeautifulSoup

stripe.api_key = settings.STRIPE_SECRET_KEY


class Command(BaseCommand):
    help = 'Create Stripe products and prices for all published premium courses that don\'t have them'

    def handle(self, *args, **options):
        # Get all published premium courses without Stripe product ID
        courses = Course.objects.filter(
            course_type='premium',
            is_draft=False,
            price__isnull=False,
            stripe_product_id__isnull=True
        )
        
        count = courses.count()
        self.stdout.write(f"Found {count} premium courses without Stripe products")
        
        success = 0
        failed = 0
        
        for course in courses:
            try:
                price_in_cents = int(float(course.price) * 100)
                
                # Prepare product data
                product_data = {
                    'name': course.title,
                    'metadata': {
                        'course_id': str(course.id),
                        'creator_id': str(course.created_by.id),
                        'permalink': course.permalink,
                    }
                }
                
                # Add description if available
                if course.description:
                    soup = BeautifulSoup(course.description, 'html.parser')
                    text = soup.get_text()[:500]
                    product_data['description'] = text
                
                # Create Stripe Product
                product = stripe.Product.create(**product_data)
                self.stdout.write(f"✓ Created product for: {course.title} (ID: {product.id})")
                
                # Create Stripe Price
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=price_in_cents,
                    currency='usd',
                )
                self.stdout.write(f"  → Created price: ${course.price} (ID: {price.id})")
                
                # Update course
                Course.all_objects.filter(id=course.id).update(
                    stripe_product_id=product.id,
                    stripe_price_id=price.id
                )
                
                success += 1
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"✗ Failed for {course.title}: {str(e)}"))
                failed += 1
        
        self.stdout.write(self.style.SUCCESS(f"\nCompleted: {success} successful, {failed} failed"))
