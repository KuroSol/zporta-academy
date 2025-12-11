from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.core.files.base import ContentFile
from django.utils import timezone
import os


class Command(BaseCommand):
    help = "Generate a personalized daily study report for a user (single-language teacher-style audio)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            dest="user_id",
            type=int,
            required=True,
            help="User ID to generate report for",
        )
        parser.add_argument(
            "--language",
            dest="language",
            type=str,
            default=None,
            choices=["en", "ja", "es", "fr", "de", "zh", "ko"],
            help="Language for report audio (en, ja, es, fr, de, zh, ko). Default: user preference",
        )
        parser.add_argument(
            "--save-db",
            dest="save_db",
            action="store_true",
            default=False,
            help="Save audio file and script to database as DailyPodcast record",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        user_id = options.get("user_id")
        language = options.get("language")
        save_to_db = options.get("save_db")
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise CommandError(f"User with id {user_id} not found.")

        try:
            from dailycast.services_interactive import (
                generate_daily_study_report,
                build_daily_report_script
            )
            
            self.stdout.write(f"[INFO] Generating daily report for {user.username}...")
            if language:
                self.stdout.write(f"   Language: {language}")
            
            # Generate script
            script_text = build_daily_report_script(user, language)
            self.stdout.write(f"  [OK] Script: {len(script_text)} chars")
            
            # Generate audio
            audio_bytes = generate_daily_study_report(user, language)
            self.stdout.write(f"  [OK] Audio: {len(audio_bytes)} bytes")
            
            # Save to file (always)
            os.makedirs("media/daily_reports", exist_ok=True)
            timestamp = int(timezone.now().timestamp())
            lang_code = language if language else "auto"
            filename = f"daily_reports/report_{user.id}_{lang_code}_{timestamp}.mp3"
            filepath = os.path.join("media", filename)
            
            with open(filepath, 'wb') as f:
                f.write(audio_bytes)
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"[SUCCESS] Daily report generated successfully!\n"
                    f"   User: {user.username}\n"
                    f"   Language: {lang_code}\n"
                    f"   Script: {len(script_text)} characters\n"
                    f"   Audio: {filename}\n"
                    f"   Size: {len(audio_bytes)} bytes\n"
                    f"   Duration: ~{len(audio_bytes) / (128000/8):.1f} seconds"
                )
            )
            
            # Optionally save to database
            if save_to_db:
                from dailycast.models import DailyPodcast
                
                podcast = DailyPodcast.objects.create(
                    user=user,
                    primary_language=language or "en",
                    secondary_language="",
                    script_text=script_text,
                    status=DailyPodcast.STATUS_COMPLETED,
                    tts_provider=f"openai_{language or 'auto'}",
                    duration_seconds=int(len(audio_bytes) / (128000/8))
                )
                
                # Save audio file
                podcast.audio_file.save(
                    os.path.basename(filename),
                    ContentFile(audio_bytes),
                    save=True
                )
                
                self.stdout.write(f"   Saved to DB: DailyPodcast ID {podcast.id}")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"[ERROR] Report generation failed: {e}"))
            import traceback
            traceback.print_exc()
            raise CommandError(f"Failed to generate report: {e}")
