import os
import sys


def setup_django():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zporta.settings")
    import django
    django.setup()


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/check_lesson.py <permalink>")
        sys.exit(1)
    permalink = sys.argv[1]

    from lessons.models import Lesson

    try:
        lesson = Lesson.objects.get(permalink=permalink)
    except Lesson.DoesNotExist:
        print(f"Lesson not found for permalink: {permalink}")
        sys.exit(2)

    fields = {
        "id": lesson.id,
        "permalink": lesson.permalink,
        "status": getattr(lesson, "status", None),
        "is_premium": getattr(lesson, "is_premium", None),
        "is_locked": getattr(lesson, "is_locked", None),
        "published_at": getattr(lesson, "published_at", None),
        "subject_id": getattr(lesson, "subject_id", None),
        "content_type": getattr(lesson, "content_type", None),
    }

    for k, v in fields.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    setup_django()
    main()
