from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Generate an on-demand podcast for any user (respects 24-hour cooldown except for Alex)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-id",
            type=int,
            required=True,
            help="User ID to generate podcast for",
        )
        parser.add_argument(
            "--language",
            dest="language",
            default=getattr(settings, "DAILYCAST_DEFAULT_LANGUAGE", "en"),
            help="Language code to use (default: settings.DAILYCAST_DEFAULT_LANGUAGE)",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        user_id = options["user_id"]
        language = options["language"]
        
        # Get user
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise CommandError(f"User with id {user_id} not found.")
        
        # Check if user can generate podcast (cooldown check)
        from dailycast.services_interactive import can_generate_podcast
        can_generate, reason = can_generate_podcast(user)
        
        if not can_generate:
            raise CommandError(f"⏳ Cannot generate podcast: {reason}")
        
        # Generate podcast
        try:
            from dailycast.services_interactive import create_multilingual_podcast_for_user
            
            self.stdout.write(f"🎙️  Generating bilingual podcast for {user.username} (language={language})...")
            
            podcast = create_multilingual_podcast_for_user(
                user,
                primary_language=language,
                output_format="both"
            )
            
            # Calculate cost estimate (Google TTS: $16 per 1M chars)
            script_chars = len(podcast.script_text)
            cost_estimate = (script_chars * 16) / 1_000_000
            
            # Calculate audio duration
            word_count = len(podcast.script_text.split())
            duration_minutes = word_count / 150  # 150 words per minute
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ Podcast generated successfully!\n"
                    f"   ID: {podcast.id}\n"
                    f"   User: {user.username} (ID: {user.id})\n"
                    f"   Language: {podcast.primary_language}"
                    f"{' + ' + podcast.secondary_language if podcast.secondary_language else ''}\n"
                    f"   Script: {script_chars:,} characters ({word_count:,} words)\n"
                    f"   Audio: {podcast.audio_file.name if podcast.audio_file else 'N/A'}\n"
                    f"   Duration: ~{duration_minutes:.1f} minutes\n"
                    f"   TTS Provider: {podcast.tts_provider}\n"
                    f"   LLM Provider: {podcast.llm_provider}\n"
                    f"   Status: {podcast.status}\n"
                    f"   Cost Estimate: ${cost_estimate:.4f} USD (Google TTS)"
                )
            )
        except PermissionError as e:
            raise CommandError(f"🚫 Permission denied: {e}")
        except ValueError as e:
            raise CommandError(f"❌ Validation error: {e}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Podcast generation failed: {e}"))
            import traceback
            self.stdout.write(traceback.format_exc())
            raise
