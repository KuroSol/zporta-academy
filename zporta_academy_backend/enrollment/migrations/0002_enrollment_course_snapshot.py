# Generated by Django 5.1.6 on 2025-03-10 00:48

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0004_coursesnapshot'),
        ('enrollment', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollment',
            name='course_snapshot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='courses.coursesnapshot'),
        ),
    ]
