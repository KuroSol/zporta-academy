from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dailycast', '0001_initial'),
    ]

    operations = [
        # Add multi-language fields
        migrations.AddField(
            model_name='dailypodcast',
            name='primary_language',
            field=models.CharField(default='en', help_text='BCP-47 language code (e.g. en, ja, es, fr)', max_length=12),
        ),
        migrations.AddField(
            model_name='dailypodcast',
            name='secondary_language',
            field=models.CharField(blank=True, default='', help_text='Optional second language for multilingual content', max_length=12),
        ),
        
        # Add output format field
        migrations.AddField(
            model_name='dailypodcast',
            name='output_format',
            field=models.CharField(
                choices=[('text', 'Text Only'), ('audio', 'Audio Only'), ('both', 'Text & Audio')],
                default='both',
                help_text='Text only, audio only, or both',
                max_length=10
            ),
        ),
        
        # Add course personalization
        migrations.AddField(
            model_name='dailypodcast',
            name='included_courses',
            field=models.JSONField(blank=True, default=list, help_text="List of course IDs/names included in podcast"),
        ),
        
        # Add Q&A fields
        migrations.AddField(
            model_name='dailypodcast',
            name='questions_asked',
            field=models.JSONField(blank=True, default=list, help_text="List of questions asked in podcast"),
        ),
        migrations.AddField(
            model_name='dailypodcast',
            name='student_answers',
            field=models.JSONField(blank=True, default=dict, help_text="Store student answers if captured"),
        ),
        
        # Add secondary audio file
        migrations.AddField(
            model_name='dailypodcast',
            name='audio_file_secondary',
            field=models.FileField(blank=True, help_text='Secondary language audio (if multilingual)', null=True, upload_to='podcasts/'),
        ),
        
        # Add secondary duration
        migrations.AddField(
            model_name='dailypodcast',
            name='duration_seconds_secondary',
            field=models.PositiveIntegerField(default=0, help_text='Duration of secondary language audio'),
        ),
        
        # Add index for performance
        migrations.AddIndex(
            model_name='dailypodcast',
            index=models.Index(fields=['user', '-created_at'], name='dailycast_user_date_idx'),
        ),
        
        # Remove old language field if it exists and update script_text help text
        migrations.AlterField(
            model_name='dailypodcast',
            name='script_text',
            field=models.TextField(blank=True, help_text='Main script with Q&A format'),
        ),
    ]
