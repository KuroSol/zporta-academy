from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyPodcast',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('language', models.CharField(default='en', help_text='BCP-47 language code (e.g. en, ja)', max_length=12)),
                ('script_text', models.TextField(blank=True)),
                ('audio_file', models.FileField(blank=True, null=True, upload_to='podcasts/')),
                ('llm_provider', models.CharField(choices=[('openai', 'OpenAI'), ('gemini', 'Google Gemini'), ('template', 'Template')], default='template', max_length=20)),
                ('tts_provider', models.CharField(choices=[('polly', 'Amazon Polly'), ('none', 'None')], default='polly', max_length=20)),
                ('duration_seconds', models.PositiveIntegerField(default=0)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_podcasts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Daily Podcast',
                'verbose_name_plural': 'Daily Podcasts',
                'ordering': ['-created_at'],
            },
        ),
    ]
