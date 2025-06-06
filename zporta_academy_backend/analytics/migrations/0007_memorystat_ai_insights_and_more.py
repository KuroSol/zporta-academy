# Generated by Django 5.1.6 on 2025-06-05 07:58

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analytics', '0006_alter_memorystat_options_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='memorystat',
            name='ai_insights',
            field=models.JSONField(blank=True, help_text="Stores insights from AI models, e.g., {'predicted_difficulty': 'medium'}", null=True),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='event_type',
            field=models.CharField(choices=[('content_viewed', 'Content Viewed'), ('content_interaction_time', 'Content Interaction Time'), ('quiz_started', 'Quiz Started'), ('quiz_completed', 'Quiz Completed'), ('quiz_submitted', 'Quiz Submitted'), ('quiz_answer_submitted', 'Quiz Answer Submitted'), ('quiz_session_time', 'Quiz Session Time'), ('question_focused', 'Question Focused'), ('question_unfocused', 'Question Unfocused'), ('question_interaction_time', 'Question Interaction Time'), ('lesson_clicked', 'Lesson Clicked'), ('lesson_completed', 'Lesson Completed'), ('analytics_report_generated', 'Analytics Report Generated')], max_length=50),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='metadata',
            field=models.JSONField(blank=True, help_text='Stores event-specific data.', null=True),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='user',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='analytics_activity_events', to=settings.AUTH_USER_MODEL),
        ),
    ]
