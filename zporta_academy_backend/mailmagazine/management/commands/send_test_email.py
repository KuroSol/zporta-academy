from django.core.management.base import BaseCommand, CommandError
from django.core.mail import EmailMessage
from django.conf import settings

class Command(BaseCommand):
    help = "Send a test email using current SMTP configuration (or console backend)."

    def add_arguments(self, parser):
        parser.add_argument('--to', required=True, help='Recipient email address')
        parser.add_argument('--subject', default='Local SMTP test')
        parser.add_argument('--body', default='If you received this, local email settings are working.')

    def handle(self, *args, **options):
        to = [options['to']]
        subject = options['subject']
        body = options['body']

        email = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, to)
        try:
            sent = email.send(fail_silently=False)
            if sent:
                self.stdout.write(self.style.SUCCESS(f"Sent test email to {to[0]} using backend {settings.EMAIL_BACKEND}"))
            else:
                raise CommandError('Email send returned 0 (no recipients accepted).')
        except Exception as e:
            raise CommandError(f'Failed to send email: {e}')
