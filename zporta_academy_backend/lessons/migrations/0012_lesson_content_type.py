# Generated by Django 5.1.6 on 2025-05-13 03:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lessons', '0011_alter_lesson_seo_title'),
    ]

    operations = [
        migrations.AddField(
            model_name='lesson',
            name='content_type',
            field=models.CharField(choices=[('text', 'Text'), ('video', 'Video'), ('quiz', 'Quiz')], default='text', max_length=20),
        ),
    ]
