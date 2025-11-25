# Generated migration for MailMagazineIssue model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('mailmagazine', '0003_teachermailmagazine_times_sent'),
    ]

    operations = [
        migrations.CreateModel(
            name='MailMagazineIssue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('subject', models.CharField(max_length=200)),
                ('html_content', models.TextField(help_text='Full HTML content including wrapper')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('is_public', models.BooleanField(default=False, help_text='Make visible to non-recipients')),
                ('magazine', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='issues', to='mailmagazine.teachermailmagazine')),
                ('recipients', models.ManyToManyField(blank=True, help_text='Users who received this issue', related_name='received_issues', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-sent_at'],
                'indexes': [
                    models.Index(fields=['magazine', '-sent_at'], name='mailmagazin_magazin_idx'),
                ],
            },
        ),
    ]
