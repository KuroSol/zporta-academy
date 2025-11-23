from django.core.management.base import BaseCommand
from django.db.models import Q
from lessons.models import Lesson
from user_media.models import UserMedia
from bs4 import BeautifulSoup
import os


class Command(BaseCommand):
    help = (
        "Scan lesson HTML for embedded media (img/audio/video) and link matching "
        "UserMedia records to the lesson. Safe by default (dry-run)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--lesson-id", type=int, default=None,
            help="Only process a single lesson by ID",
        )
        parser.add_argument(
            "--user", type=str, default=None,
            help="Limit to lessons created by this username",
        )
        parser.add_argument(
            "--types", type=str, default="image,audio,video",
            help="Comma-separated media types to link: image,audio,video",
        )
        parser.add_argument(
            "--commit", action="store_true",
            help="Actually save changes. Without this flag, runs in dry-run mode.",
        )

    def handle(self, *args, **options):
        lesson_id = options.get("lesson-id")
        username = options.get("user")
        types = {t.strip() for t in options.get("types", "image,audio,video").split(",") if t.strip()}
        commit = options.get("commit", False)

        qs = Lesson.objects.all()
        if lesson_id is not None:
            qs = qs.filter(id=lesson_id)
        if username:
            qs = qs.filter(created_by__username=username)

        total_processed = 0
        total_linked = 0
        self.stdout.write(self.style.NOTICE(
            f"Starting link_lesson_media (dry-run={not commit}) for {qs.count()} lesson(s). Types={','.join(sorted(types))}"
        ))

        for lesson in qs.iterator():
            total_processed += 1
            content = lesson.content or ""
            if not content:
                continue

            soup = BeautifulSoup(content, "html.parser")
            tags = []
            if "image" in types:
                tags.extend(soup.find_all("img"))
            if "audio" in types:
                tags.extend(soup.find_all("audio"))
            if "video" in types:
                tags.extend(soup.find_all("video"))

            linked_now = 0
            for tag in tags:
                src = tag.get("src")
                if not src:
                    continue

                filename = os.path.basename(src.split("?")[0])
                if not filename:
                    continue

                # Determine desired media_type based on tag
                desired_type = None
                if tag.name == "img":
                    desired_type = "image"
                elif tag.name == "audio":
                    desired_type = "audio"
                elif tag.name == "video":
                    desired_type = "video"

                # Skip if something is already linked for this file and lesson
                existing = UserMedia.objects.filter(
                    file__icontains=filename,
                    lesson=lesson,
                ).first()
                if existing:
                    continue

                # Build a relaxed query: match filename, respect desired_type when known,
                # prefer same user, and only pick unlinked media.
                media_q = UserMedia.objects.filter(
                    file__icontains=filename,
                    lesson__isnull=True,
                )
                if desired_type:
                    media_q = media_q.filter(media_type=desired_type)

                # Prefer media uploaded by the lesson owner, but fall back if none found
                owner_q = media_q.filter(user=lesson.created_by)
                media = owner_q.first() or media_q.first()
                if not media:
                    continue

                if commit:
                    media.lesson = lesson
                    media.save(update_fields=["lesson"])
                linked_now += 1

            if linked_now:
                total_linked += linked_now
                self.stdout.write(
                    f"Lesson {lesson.id} - linked {linked_now} media item(s)."
                )

        summary = f"Processed {total_processed} lesson(s). " \
                  f"Linked {total_linked} media item(s). " \
                  f"Mode={'COMMIT' if commit else 'DRY-RUN'}."
        if commit:
            self.stdout.write(self.style.SUCCESS(summary))
        else:
            self.stdout.write(self.style.WARNING(summary))
