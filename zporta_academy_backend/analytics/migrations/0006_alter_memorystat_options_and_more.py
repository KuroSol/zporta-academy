# Generated by Django 5.1.6 on 2025-06-04 13:54

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analytics', '0005_alter_memorystat_content_type_and_more'),
        ('contenttypes', '0002_remove_content_type_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='memorystat',
            options={'ordering': ['user', '-updated_at'], 'verbose_name': 'User Memory Statistic', 'verbose_name_plural': 'User Memory Statistics'},
        ),
        migrations.RemoveIndex(
            model_name='memorystat',
            name='analytics_m_user_id_757553_idx',
        ),
        migrations.AddField(
            model_name='memorystat',
            name='last_quality_of_recall',
            field=models.IntegerField(blank=True, help_text='The quality of recall (0-5) from the last review.', null=True),
        ),
        migrations.AddField(
            model_name='memorystat',
            name='last_time_spent_ms',
            field=models.PositiveIntegerField(blank=True, help_text='Time spent in milliseconds on the last review/answer of this item.', null=True),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='event_type',
            field=models.CharField(choices=[('content_viewed', 'Content Viewed'), ('content_interaction_time', 'Content Interaction Time'), ('quiz_started', 'Quiz Started'), ('quiz_completed', 'Quiz Completed'), ('quiz_submitted', 'Quiz Submitted'), ('quiz_answer_submitted', 'Quiz Answer Submitted'), ('quiz_session_time', 'Quiz Session Time'), ('question_focused', 'Question Focused'), ('question_unfocused', 'Question Unfocused'), ('question_interaction_time', 'Question Interaction Time'), ('lesson_clicked', 'Lesson Clicked'), ('lesson_completed', 'Lesson Completed')], max_length=50),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='metadata',
            field=models.JSONField(blank=True, help_text="\n        Stores event-specific data. Examples:\n        - 'quiz_answer_submitted': {'quiz_id': X, 'question_id': Y, 'is_correct': Z, 'answer_data': {...}, 'time_spent_ms': TTT, 'quality_of_recall_used': Q}\n        - 'content_interaction_time': {'item_id': X, 'item_type': 'QuizCard', 'duration_ms': TTT, 'context': 'ExplorerView'}\n        - 'question_interaction_time': {'quiz_id': X, 'question_id': Y, 'duration_ms': TTT}\n        - 'quiz_session_time': {'quiz_id': X, 'duration_ms': TTT}\n    ", null=True),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='timestamp',
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='content_type',
            field=models.ForeignKey(help_text='The type of the learnable item.', on_delete=django.db.models.deletion.CASCADE, to='contenttypes.contenttype'),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='easiness_factor',
            field=models.FloatField(default=2.5, help_text='Easiness Factor (EF), min 1.3.'),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='interval_days',
            field=models.FloatField(default=0.0, help_text='Current review interval in days (I(n)).'),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='last_reviewed_at',
            field=models.DateTimeField(blank=True, help_text='Timestamp of the last review/attempt for this item.', null=True),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='next_review_at',
            field=models.DateTimeField(blank=True, db_index=True, help_text='Recommended next review timestamp based on SM-2.', null=True),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='repetitions',
            field=models.IntegerField(default=0, help_text='Number of times reviewed correctly in a row (n).'),
        ),
        migrations.AlterField(
            model_name='memorystat',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memory_stats_analytics', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddIndex(
            model_name='activityevent',
            index=models.Index(fields=['user', 'event_type'], name='analytics_a_user_id_77e142_idx'),
        ),
        migrations.AddIndex(
            model_name='activityevent',
            index=models.Index(fields=['content_type', 'object_id', 'event_type'], name='analytics_a_content_5afd89_idx'),
        ),
        migrations.AddIndex(
            model_name='memorystat',
            index=models.Index(fields=['user', 'content_type', 'object_id', 'last_reviewed_at'], name='analytics_m_user_id_5acd9a_idx'),
        ),
    ]
