from django.core.management.base import BaseCommand
from django.core.mail import send_mail

class Command(BaseCommand):
    help = 'Test email functionality with Amazon SES'

    def handle(self, *args, **kwargs):
        send_mail(
            'Test Email Subject',
            'This is a test email body.',
            'info@zportaacademy.com',  # From email (make sure this is verified in SES)
            ['cyrusinout@gmail.com'],  # Replace with the recipient email address
            fail_silently=False,
        )
        self.stdout.write(self.style.SUCCESS('Test email sent successfully!'))
