# Generated by Django 5.1.6 on 2025-05-23 06:23

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0006_fcmlog'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='fcmtoken',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='fcmtoken',
            name='device_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
