# Generated by Django 5.1.6 on 2025-05-22 17:47

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0003_notification_is_sent_notification_title'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='fcmtoken',
            name='token',
            field=models.CharField(max_length=512, unique=True),
        ),
        migrations.AlterField(
            model_name='fcmtoken',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fcm_tokens', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterUniqueTogether(
            name='fcmtoken',
            unique_together={('user', 'token')},
        ),
    ]
