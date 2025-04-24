from django.db import models
from django.contrib.auth.models import User

class Payment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course_id = models.IntegerField()  # Alternatively, a ForeignKey to your Course model
    stripe_payment_id = models.CharField(max_length=255)
    amount = models.IntegerField()  # in cents
    currency = models.CharField(max_length=10, default="usd")
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.stripe_payment_id} for User {self.user.id}"
