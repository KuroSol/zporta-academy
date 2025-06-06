# Generated by Django 5.1.6 on 2025-05-27 13:30

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0011_remove_notification_is_sent_fcmlog_device_id_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='notification',
            name='is_sent',
        ),
        migrations.AddField(
            model_name='fcmlog',
            name='device_id',
            field=models.CharField(blank=True, help_text='Device ID associated with the token, if available.', max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='fcmtoken',
            name='is_active',
            field=models.BooleanField(default=True, help_text='Token is active and can receive messages.'),
        ),
        migrations.AddField(
            model_name='fcmtoken',
            name='last_seen',
            field=models.DateTimeField(auto_now=True, help_text='Timestamp of the last time this token was seen or used.'),
        ),
        migrations.AddField(
            model_name='notification',
            name='is_sent_push',
            field=models.BooleanField(default=False, help_text='Tracks if a push notification was successfully sent for this.'),
        ),
    ]
