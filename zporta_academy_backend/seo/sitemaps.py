# seo/sitemaps.py

from django.contrib.sitemaps import Sitemap
from django.db.models import Q
from quizzes.models import Quiz
from courses.models import Course
from lessons.models import Lesson
from django.utils import timezone
from django.utils.text import slugify

class QuizSitemap(Sitemap):
    changefreq = "daily"
    priority   = 0.7

    # Only free quizzes
    def items(self):
        return Quiz.objects.filter(quiz_type="free").order_by('id')

    # Build the front‑end route; adjust to match your React router
    def location(self, obj):
        date = timezone.localtime(obj.created_at).date().isoformat()
        subject_slug = slugify(obj.subject.name if obj.subject else 'no-subject')
        return f"/quizzes/{obj.created_by.username}/{subject_slug}/{date}/{obj.permalink}"



class CourseSitemap(Sitemap):
    changefreq = "weekly"
    priority   = 0.6

    def items(self):
        # only published, non‑premium courses
        return Course.objects.filter(course_type="free", is_draft=False)

    def location(self, obj):
        return f"/courses/{obj.permalink}"

class LessonSitemap(Sitemap):
    changefreq = "monthly"
    priority   = 0.5

    def items(self):
        # public lessons = no course OR parent course is free
        return Lesson.objects.filter(Q(course__isnull=True) | Q(course__course_type="free"))

    def location(self, obj):
        return f"/lessons/{obj.permalink}"
