# Generated migration for Asset model

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Asset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kind', models.CharField(choices=[('image', 'Image'), ('audio', 'Audio')], db_index=True, max_length=20)),
                ('file', models.FileField(upload_to='assets.models.asset_file_path')),
                ('original_filename', models.CharField(help_text='Original uploaded filename', max_length=255)),
                ('suggested_name', models.SlugField(blank=True, db_index=True, help_text='Slugified name for easy reference', max_length=255)),
                ('provider', models.CharField(blank=True, help_text="Optional provider tag (e.g., 'Gemini', 'Google AI Studio')", max_length=100, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='asset',
            index=models.Index(fields=['kind', '-created_at'], name='assets_asset_kind_created_idx'),
        ),
        migrations.AddIndex(
            model_name='asset',
            index=models.Index(fields=['suggested_name', 'kind'], name='assets_asset_name_kind_idx'),
        ),
    ]
