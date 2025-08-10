# seo/sitemaps.py

from django.contrib.sitemaps import Sitemap
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from quizzes.models import Quiz
from courses.models import Course
from lessons.models import Lesson


def _lastmod(obj):
    """
    Try common timestamp fields in order; fall back to 'now'
    so Google always gets a valid lastmod.
    """
    for attr in ("updated_at", "modified", "updated", "created_at", "created"):
        val = getattr(obj, attr, None)
        if val:
            return val
    return timezone.now()


class QuizSitemap(Sitemap):
    protocol   = "https"
    changefreq = "daily"
    priority   = 0.7

    def items(self):
        # Only free quizzes
        return Quiz.objects.filter(quiz_type="free").order_by("id")

    def location(self, obj):
        # Build the front-end route
        date = (
            timezone.localtime(obj.created_at).date().isoformat()
            if getattr(obj, "created_at", None)
            else timezone.now().date().isoformat()
        )
        subject_name = obj.subject.name if getattr(obj, "subject", None) else "no-subject"
        subject_slug = slugify(subject_name)
        return f"/quizzes/{obj.created_by.username}/{subject_slug}/{date}/{obj.permalink}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class CourseSitemap(Sitemap):
    protocol   = "https"
    changefreq = "weekly"
    priority   = 0.6

    def items(self):
        # Only published, non-premium courses
        return Course.objects.filter(course_type="free", is_draft=False)

    def location(self, obj):
        return f"/courses/{obj.permalink}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class LessonSitemap(Sitemap):
    protocol   = "https"
    changefreq = "monthly"
    priority   = 0.5

    def items(self):
        # Public lessons = no course OR parent course is free
        return Lesson.objects.filter(
            Q(course__isnull=True) | Q(course__course_type="free")
        )

    def location(self, obj):
        return f"/lessons/{obj.permalink}/"

    def lastmod(self, obj):
        return _lastmod(obj)
