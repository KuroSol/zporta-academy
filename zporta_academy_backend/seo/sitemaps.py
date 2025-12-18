"""Sitemap helpers with canonicalization."""
import re
from types import SimpleNamespace

from django.contrib.sitemaps import Sitemap
from django.contrib.sitemaps.views import index as django_sitemap_index
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from quizzes.models import Quiz
from courses.models import Course
from lessons.models import Lesson
from posts.models import Post
from tags.models import Tag
from users.models import Profile

from seo.utils import (
    CANONICAL_HOST,
    CANONICAL_ORIGIN,
    canonical_path,
    canonical_url,
    is_public_indexable_path,
)

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


class CanonicalSitemap(Sitemap):
    protocol = "https"
    cache_timeout = 0

    def _canonicalize(self, raw_path: str) -> str:
        path = canonical_path(raw_path)
        if not is_public_indexable_path(path):
            raise ValueError(f"Non-indexable path rejected: {path}")
        return path

    def get_urls(self, page=1, site=None, protocol=None):
        site = SimpleNamespace(domain=CANONICAL_HOST)
        urls = super().get_urls(page=page, site=site, protocol=self.protocol)
        filtered = []
        for entry in urls:
            if not is_public_indexable_path(entry.get("location")):
                continue
            entry["location"] = canonical_url(entry.get("location"))
            filtered.append(entry)
        return filtered


class QuizSitemap(CanonicalSitemap):
    changefreq = "daily"
    priority = 0.7

    def items(self):
        # Only free quizzes
        return Quiz.objects.filter(quiz_type="free", permalink__isnull=False).exclude(permalink="").order_by("id")

    def location(self, obj):
        # If permalink already contains a full path like
        # "alex/english/2025-05-04/quiz-slug", use it directly.
        p = (getattr(obj, "permalink", "") or "").strip("/")
        if "/" in p:
            return self._canonicalize(f"/quizzes/{p}/")

        # Otherwise compose from parts.
        author = slugify(getattr(getattr(obj, "created_by", None), "username", "") or "unknown")
        subject_name = getattr(getattr(obj, "subject", None), "name", "") or "no-subject"
        subject_slug = slugify(subject_name)
        date_src = getattr(obj, "published_at", None) or getattr(obj, "created_at", None) or timezone.now()
        date_str = timezone.localtime(date_src).date().isoformat()
        slug = p or slugify(getattr(obj, "title", "") or str(obj.pk))
        return self._canonicalize(f"/quizzes/{author}/{subject_slug}/{date_str}/{slug}/")

    def lastmod(self, obj):
        return _lastmod(obj)


class CourseSitemap(CanonicalSitemap):
    changefreq = "weekly"
    priority = 0.6

    def items(self):
        # Only published courses (free or premium are OK)
        return Course.objects.filter(is_draft=False, permalink__isnull=False).exclude(permalink="")

    def location(self, obj):
        return self._canonicalize(f"/courses/{obj.permalink}/")

    def lastmod(self, obj):
        return _lastmod(obj)


class LessonSitemap(CanonicalSitemap):
    changefreq = "monthly"
    priority = 0.5

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
        ).exclude(permalink="").order_by("id")

    def location(self, obj):
        return self._canonicalize(f"/lessons/{obj.permalink}/")

    def lastmod(self, obj):
        return _lastmod(obj)


class PostSitemap(CanonicalSitemap):
    changefreq = "weekly"
    priority = 0.5
    
    def items(self):
        # Return all posts (Post model doesn't have is_published field)
        return Post.objects.exclude(permalink="").order_by("-created_at")

    def location(self, obj):
        return self._canonicalize(f"/posts/{obj.permalink}/")

    def lastmod(self, obj):
        return _lastmod(obj)


class TagSitemap(CanonicalSitemap):
    changefreq = "weekly"
    priority = 0.4
    
    def items(self):
        return Tag.objects.exclude(slug__isnull=True).exclude(slug="").exclude(
            slug__regex=r'["\'\[\]\{\},]'
        ).order_by("name")

    def location(self, obj):
        return self._canonicalize(f"/tags/{obj.slug}/")

    def lastmod(self, obj):
        return _lastmod(obj)


class TeacherSitemap(CanonicalSitemap):
    changefreq = "weekly"
    priority = 0.8  # High priority for teacher discoverability
    
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
        # Frontend route is /guide/{username}, not /guides/
        return self._canonicalize(f"/guide/{obj.user.username}/")
    
    def lastmod(self, obj):
        return _lastmod(obj)


def canonical_sitemap_index(request, *args, **kwargs):
    """Wrap Django's sitemap index to force canonical host in <loc> entries."""
    response = django_sitemap_index(request, *args, **kwargs)
    if getattr(response, "status_code", None) == 200:
        if hasattr(response, "render"):
            response.render()
        if getattr(response, "content", None):
            body = response.content.decode()
            body = re.sub(r"https?://[^/]+", CANONICAL_ORIGIN, body)
            response.content = body.encode()
    return response