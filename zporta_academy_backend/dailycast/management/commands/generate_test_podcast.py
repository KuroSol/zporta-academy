from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Generate an on-demand test podcast for DAILYCAST_TEST_USER_ID (24-hour cooldown enforced)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--language",
            dest="language",
            default=getattr(settings, "DAILYCAST_DEFAULT_LANGUAGE", "en"),
            help="Language code to use (default: settings.DAILYCAST_DEFAULT_LANGUAGE)",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        test_user_id = getattr(settings, "DAILYCAST_TEST_USER_ID", None)
        if not test_user_id:
            raise CommandError("DAILYCAST_TEST_USER_ID is not set in settings.")

        try:
            user = User.objects.get(id=test_user_id)
        except User.DoesNotExist:
            raise CommandError(f"User with id {test_user_id} not found.")

        language = options.get("language")
        
        try:
            from dailycast.services_interactive import create_multilingual_podcast_for_user
            
            self.stdout.write(f"🎙️  Generating podcast for {user.username} (language={language})...")
            
            podcast = create_multilingual_podcast_for_user(
                user,
                primary_language=language,
                output_format="both"
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ Podcast generated successfully!\n"
                    f"   ID: {podcast.id}\n"
                    f"   User: {user.username}\n"
                    f"   Language: {podcast.primary_language}"
                    f"{' + ' + podcast.secondary_language if podcast.secondary_language else ''}\n"
                    f"   Script: {len(podcast.script_text)} characters\n"
                    f"   Audio: {podcast.audio_file.name if podcast.audio_file else 'N/A'}\n"
                    f"   Status: {podcast.status}"
                )
            )
        except ValueError as e:
            # Handle 24-hour cooldown
            if "already generated within" in str(e):
                raise CommandError(f"⏳ {e}")
            else:
                raise CommandError(f"Validation error: {e}")
        except PermissionError as e:
            raise CommandError(f"Permission denied: {e}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Podcast generation failed: {e}"))
            raise
