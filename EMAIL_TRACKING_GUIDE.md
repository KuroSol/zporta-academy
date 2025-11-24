# Email Tracking & Analytics Guide

## Current Status

The Teacher Mail Magazine system currently tracks:
- ✅ **Times Sent**: Accurately tracked in database (`times_sent` field)
- ❌ **Delivered**: Not tracked (requires ESP integration)
- ❌ **Opened**: Not tracked (requires tracking pixel)
- ❌ **Clicked**: Not tracked (requires link tracking)

## Why Standard Email Doesn't Track Opens/Clicks

Basic `django.core.mail.send_mail()` just sends emails through SMTP. It has:
- ❌ No tracking pixels
- ❌ No webhook callbacks
- ❌ No delivery confirmations
- ❌ No open/click tracking

## How to Enable Full Tracking

### Option 1: SendGrid (Recommended)

**Features:**
- Delivery confirmations via webhooks
- Open tracking (invisible pixel)
- Click tracking (link wrapping)
- Bounce/spam reporting
- Free tier: 100 emails/day

**Setup:**

1. **Install SendGrid:**
   ```bash
   pip install sendgrid
   ```

2. **Update settings.py:**
   ```python
   EMAIL_BACKEND = 'sendgrid_backend.SendgridBackend'
   SENDGRID_API_KEY = 'your-api-key-here'
   SENDGRID_SANDBOX_MODE_IN_DEBUG = False
   
   # Enable tracking
   SENDGRID_TRACK_EMAIL_OPENS = True
   SENDGRID_TRACK_CLICKS_HTML = True
   SENDGRID_TRACK_CLICKS_PLAIN = True
   ```

3. **Set up webhooks:**
   - Go to SendGrid → Settings → Mail Settings
   - Enable "Event Webhook"
   - Set URL: `https://yourdomain.com/api/sendgrid/webhook/`
   - Select events: Delivered, Opened, Clicked, Bounced

4. **Create webhook endpoint:**
   ```python
   # mailmagazine/views.py
   from rest_framework.decorators import api_view
   from rest_framework.response import Response
   
   @api_view(['POST'])
   def sendgrid_webhook(request):
       events = request.data
       for event in events:
           email = event.get('email')
           event_type = event.get('event')
           
           # Update your tracking model
           if event_type == 'delivered':
               # Increment delivered count
               pass
           elif event_type == 'open':
               # Increment opened count
               pass
           elif event_type == 'click':
               # Increment clicked count
               pass
       
       return Response({'status': 'ok'})
   ```

### Option 2: Mailgun

Similar to SendGrid with webhooks for tracking.

**Setup:**
```bash
pip install django-mailgun
```

```python
EMAIL_BACKEND = 'django_mailgun.MailgunBackend'
MAILGUN_API_KEY = 'your-api-key'
MAILGUN_DOMAIN_NAME = 'your-domain.com'
MAILGUN_TRACK_OPENS = True
MAILGUN_TRACK_CLICKS = True
```

### Option 3: Amazon SES

AWS Simple Email Service with CloudWatch for analytics.

**Setup:**
```bash
pip install boto3
```

```python
EMAIL_BACKEND = 'django_ses.SESBackend'
AWS_SES_REGION_NAME = 'us-east-1'
AWS_SES_REGION_ENDPOINT = 'email.us-east-1.amazonaws.com'
```

## Database Schema for Tracking

Create a model to store email events:

```python
# mailmagazine/models.py

class EmailEvent(models.Model):
    EVENT_TYPES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('bounced', 'Bounced'),
        ('failed', 'Failed'),
    ]
    
    magazine = models.ForeignKey(
        TeacherMailMagazine,
        on_delete=models.CASCADE,
        related_name='events'
    )
    recipient_email = models.EmailField()
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['magazine', 'event_type']),
            models.Index(fields=['recipient_email', 'event_type']),
        ]
```

## Manual Tracking (Without ESP)

If you want basic tracking without ESP:

### 1. Add Tracking Pixel (Opens)

```python
# In send_email view, modify email body:
tracking_url = f"https://yourdomain.com/track/open/{magazine.id}/{recipient.id}/"
pixel = f'<img src="{tracking_url}" width="1" height="1" style="display:none;" />'
html_body = f"{magazine.body}{pixel}"

send_mail(
    subject=magazine.subject,
    message=magazine.body,  # Plain text
    html_message=html_body,  # HTML with pixel
    from_email=settings.EMAIL_HOST_USER,
    recipient_list=[recipient_email],
)
```

### 2. Create Tracking Endpoint

```python
# mailmagazine/views.py
from django.http import HttpResponse

def track_open(request, magazine_id, user_id):
    # Record the open event
    EmailEvent.objects.create(
        magazine_id=magazine_id,
        recipient_email=User.objects.get(id=user_id).email,
        event_type='opened'
    )
    
    # Return 1x1 transparent pixel
    pixel = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
    return HttpResponse(pixel, content_type='image/gif')
```

### 3. Wrap Links (Clicks)

```python
def wrap_links_with_tracking(html_content, magazine_id, user_id):
    """Replace all links with tracking redirects"""
    import re
    
    def replace_link(match):
        original_url = match.group(1)
        tracking_url = f"/track/click/{magazine_id}/{user_id}/?url={original_url}"
        return f'href="{tracking_url}"'
    
    return re.sub(r'href="([^"]+)"', replace_link, html_content)
```

## Best Practices

1. **Privacy Compliance**: Inform users about tracking in your privacy policy
2. **GDPR**: Allow users to opt-out of tracking
3. **Rate Limiting**: Don't send too many emails at once
4. **Bounce Handling**: Remove invalid emails from your list
5. **Unsubscribe Links**: Always include an unsubscribe option

## Testing Email Tracking

Use tools like:
- **Mailtrap.io**: Test emails in development
- **MailHog**: Local email testing server
- **SendGrid Sandbox**: Test without sending real emails

## Summary

**Current Implementation:**
- Basic email sending works ✅
- Times sent tracked ✅
- Opens/clicks/delivery NOT tracked ❌

**To Enable Full Tracking:**
1. Choose an ESP (SendGrid recommended)
2. Set up webhook endpoint
3. Create EmailEvent model
4. Update analytics to query events
5. Display real metrics in frontend

**Estimated Work:** 4-6 hours for full SendGrid integration
