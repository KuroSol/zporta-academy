# seo/sitemaps.py

from django.contrib.sitemaps import Sitemap
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from quizzes.models import Quiz
from courses.models import Course
from lessons.models import Lesson
from posts.models import Post
from tags.models import Tag
from users.models import Profile

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
    cache_timeout = 0  # disable cache to flush stale empty section

    def items(self):
        # Only free quizzes
        return Quiz.objects.filter(quiz_type="free").order_by("id")

    def location(self, obj):
        # If permalink already contains a full path like
        # "alex/english/2025-05-04/quiz-slug", use it directly.
        p = (getattr(obj, "permalink", "") or "").strip("/")
        if "/" in p:
            return f"/quizzes/{p}/"

        # Otherwise compose from parts.
        author = slugify(getattr(getattr(obj, "created_by", None), "username", "") or "unknown")
        subject_name = getattr(getattr(obj, "subject", None), "name", "") or "no-subject"
        subject_slug = slugify(subject_name)
        date_src = getattr(obj, "published_at", None) or getattr(obj, "created_at", None) or timezone.now()
        date_str = timezone.localtime(date_src).date().isoformat()
        slug = p or slugify(getattr(obj, "title", "") or str(obj.pk))
        return f"/quizzes/{author}/{subject_slug}/{date_str}/{slug}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class CourseSitemap(Sitemap):
    protocol   = "https"
    changefreq = "weekly"
    priority   = 0.6
    cache_timeout = 0

    def items(self):
        # Only published courses (free or premium are OK)
        return Course.objects.filter(is_draft=False)

    def location(self, obj):
        return f"/courses/{obj.permalink}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class LessonSitemap(Sitemap):
    protocol   = "https"
    changefreq = "monthly"
    priority   = 0.5
    cache_timeout = 0

    def items(self):
        """
        Public lessons:
          - must be status=published
          - exclude premium lessons
          - and either have no course OR the parent course is free
        """
        return Lesson.objects.filter(
            Q(status=Lesson.PUBLISHED) &
            Q(is_premium=False) &
            (Q(course__isnull=True) | Q(course__course_type="free"))
        ).order_by("id")

    def location(self, obj):
        return f"/lessons/{obj.permalink}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class PostSitemap(Sitemap):
    protocol   = "https"
    changefreq = "weekly"
    priority   = 0.5
    cache_timeout = 0
    
    def items(self):
        # Return all posts (Post model doesn't have is_published field)
        return Post.objects.all().order_by("-created_at")

    def location(self, obj):
        return f"/posts/{obj.permalink}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class TagSitemap(Sitemap):
    protocol   = "https"
    changefreq = "weekly"
    priority   = 0.4
    cache_timeout = 0
    
    def items(self):
        return Tag.objects.all().order_by("name")

    def location(self, obj):
        return f"/tags/{obj.slug}/"

    def lastmod(self, obj):
        return _lastmod(obj)


class TeacherSitemap(Sitemap):
    protocol   = "https"
    changefreq = "weekly"
    priority   = 0.8  # High priority for teacher discoverability
    cache_timeout = 0
    
    def items(self):
        """
        Include all active guides/teachers with public profiles.
        Filter by role 'guide' or 'both', and optionally active_guide=True.
        """
        return Profile.objects.filter(
            role__in=['guide', 'both'],
            active_guide=True
        ).select_related('user').order_by('-created_at')
    
    def location(self, obj):
        return f"/guides/{obj.user.username}/"
    
    def lastmod(self, obj):
        return _lastmod(obj)