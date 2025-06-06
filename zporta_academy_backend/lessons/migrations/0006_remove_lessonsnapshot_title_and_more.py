# Generated by Django 5.1.6 on 2025-03-15 10:40

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lessons', '0005_lessonsnapshot_is_locked'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='lessonsnapshot',
            name='title',
        ),
        migrations.AlterField(
            model_name='lessonsnapshot',
            name='original_lesson',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='snapshots', to='lessons.lesson'),
        ),
    ]
