import re

from django.test import TestCase
from django.contrib.auth.models import User

from users.models import Profile
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz
from subjects.models import Subject
from tags.models import Tag
from seo.utils import canonical_url, canonical_path, is_public_indexable_path
from seo.sitemaps import (
    TeacherSitemap, CourseSitemap, LessonSitemap, QuizSitemap
)


class SitemapURLTests(TestCase):
    """Test sitemap URL generation to ensure correct routing"""

    def setUp(self):
        # Create test user and profile
        self.user = User.objects.create_user(
            username='testteacher',
            email='teacher@example.com',
            password='testpass123'
        )
        self.profile, _ = Profile.objects.get_or_create(
            user=self.user,
            defaults={
                'role': 'guide',
                'active_guide': True,
            }
        )
        if not self.profile.active_guide or self.profile.role != 'guide':
            Profile.objects.filter(pk=self.profile.pk).update(role='guide', active_guide=True)
            self.profile.refresh_from_db()
        
        # Create test subject
        self.subject = Subject.objects.create(name='Test Subject', created_by=self.user)
        
        # Create test course
        self.course = Course.objects.create(
            title='Test Course',
            created_by=self.user,
            subject=self.subject,
            is_draft=False
        )
        
        # Create test lesson
        self.lesson = Lesson.objects.create(
            title='Test Lesson',
            created_by=self.user,
            subject=self.subject,
            status=Lesson.PUBLISHED
        )
        
        # Create test quiz
        self.quiz = Quiz.objects.create(
            title='Test Quiz',
            created_by=self.user,
            quiz_type='free'
        )

    def test_teacher_sitemap_uses_singular_guide_path(self):
        """Test that teacher URLs use /guide/{username} not /guides/{username}"""
        sitemap = TeacherSitemap()
        location = sitemap.location(self.profile)
        
        # Must use singular /guide/ not plural /guides/
        self.assertIn('/guide/', location)
        self.assertNotIn('/guides/', location)
        self.assertEqual(location, '/guide/testteacher/')

    def test_course_sitemap_url_structure(self):
        """Test that course URLs are well-formed"""
        sitemap = CourseSitemap()
        location = sitemap.location(self.course)
        
        self.assertTrue(location.startswith('/courses/'))
        self.assertTrue(location.endswith('/'))

    def test_lesson_sitemap_url_structure(self):
        """Test that lesson URLs are well-formed"""
        sitemap = LessonSitemap()
        location = sitemap.location(self.lesson)
        
        self.assertTrue(location.startswith('/lessons/'))
        self.assertTrue(location.endswith('/'))

    def test_quiz_sitemap_url_structure(self):
        """Test that quiz URLs are well-formed"""
        sitemap = QuizSitemap()
        location = sitemap.location(self.quiz)
        
        self.assertTrue(location.startswith('/quizzes/'))
        self.assertTrue(location.endswith('/'))

    def test_teacher_sitemap_includes_active_guides(self):
        """Test that active guides are included in sitemap"""
        sitemap = TeacherSitemap()
        items = list(sitemap.items())
        
        self.assertIn(self.profile, items)

    def test_teacher_sitemap_excludes_inactive_guides(self):
        """Test that inactive guides are excluded from sitemap"""
        # Create inactive guide
        inactive_user = User.objects.create_user(
            username='inactiveteacher',
            email='inactive@example.com',
            password='testpass123'
        )
        inactive_profile, _ = Profile.objects.get_or_create(
            user=inactive_user,
            defaults={'role': 'guide', 'active_guide': False}
        )
        if inactive_profile.active_guide or inactive_profile.role != 'guide':
            Profile.objects.filter(pk=inactive_profile.pk).update(role='guide', active_guide=False)
            inactive_profile.refresh_from_db()
        
        sitemap = TeacherSitemap()
        items = list(sitemap.items())
        
        self.assertNotIn(inactive_profile, items)
        self.assertIn(self.profile, items)

    def test_lesson_sitemap_excludes_draft_lessons(self):
        """Test that draft lessons are excluded from sitemap"""
        draft_lesson = Lesson.objects.create(
            title='Draft Lesson',
            created_by=self.user,
            subject=self.subject,
            status=Lesson.DRAFT
        )
        
        sitemap = LessonSitemap()
        items = list(sitemap.items())
        
        self.assertNotIn(draft_lesson, items)
        self.assertIn(self.lesson, items)

    def test_quiz_sitemap_only_includes_free_quizzes(self):
        """Test that only free quizzes are included in sitemap"""
        premium_quiz = Quiz.objects.create(
            title='Premium Quiz',
            created_by=self.user,
            quiz_type='premium'
        )
        
        sitemap = QuizSitemap()
        items = list(sitemap.items())
        
        self.assertIn(self.quiz, items)
        self.assertNotIn(premium_quiz, items)


class CanonicalBuilderTests(TestCase):
    def test_canonical_path_strips_api_and_trailing(self):
        self.assertEqual(canonical_path("/api/lessons/foo"), "/lessons/foo/")
        self.assertEqual(canonical_path("https://www.zportaacademy.com/courses/bar/"), "/courses/bar/")

    def test_canonical_url_enforces_origin(self):
        self.assertEqual(
            canonical_url("http://www.zportaacademy.com/quizzes/q1"),
            "https://zportaacademy.com/quizzes/q1/"
        )

    def test_is_public_indexable_path_blocks_auth_and_redirect(self):
        self.assertFalse(is_public_indexable_path("/login"))
        self.assertFalse(is_public_indexable_path("/register"))
        self.assertFalse(is_public_indexable_path("/password-reset/foo"))
        self.assertFalse(is_public_indexable_path("/api/lessons/foo"))
        self.assertFalse(is_public_indexable_path("/lessons/foo?redirect_to=/login"))


class SitemapCleanlinessTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='xmlteacher', email='xml@example.com', password='pass'
        )
        self.subject = Subject.objects.create(name='XML Subject', created_by=self.user)
        self.profile, _ = Profile.objects.get_or_create(
            user=self.user,
            defaults={
                'role': 'guide',
                'active_guide': True,
            }
        )
        if not self.profile.active_guide or self.profile.role != 'guide':
            Profile.objects.filter(pk=self.profile.pk).update(role='guide', active_guide=True)
            self.profile.refresh_from_db()
        self.course = Course.objects.create(
            title='XML Course',
            description='desc',
            created_by=self.user,
            subject=self.subject,
            is_draft=False,
        )
        self.lesson = Lesson.objects.create(
            title='XML Lesson',
            content='body',
            created_by=self.user,
            subject=self.subject,
            status=Lesson.PUBLISHED,
            is_premium=False,
        )
        self.quiz = Quiz.objects.create(
            title='XML Quiz',
            created_by=self.user,
            quiz_type='free',
            status='published'
        )
        self.tag = Tag.objects.create(name='xml')

    def _assert_clean(self, body: str):
        locs = re.findall(r"<loc>(.*?)</loc>", body)
        self.assertTrue(locs)
        forbidden = [
            "\"",
            "http://",
            "www.",
            "www.zportaacademy.com",
            "/api/",
            "/login",
            "/register",
            "/password-reset",
            "redirect_to",
            "[",
            "]",
            "tags//",
        ]
        for loc in locs:
            loc = loc.strip()
            self.assertTrue(loc.startswith("https://zportaacademy.com/"))
            if not loc.endswith(".xml"):
                self.assertTrue(loc.endswith("/"))
            for token in forbidden:
                self.assertNotIn(token, loc)

    def test_sitemap_index_is_canonical(self):
        resp = self.client.get("/sitemap.xml")
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode()
        self._assert_clean(body)
        self.assertIn("https://zportaacademy.com/sitemap-courses.xml", body)

    def test_section_sitemaps_are_clean(self):
        for section in ("courses", "lessons", "quizzes", "tags", "teachers"):
            resp = self.client.get(f"/sitemap-{section}.xml")
            self.assertEqual(resp.status_code, 200)
            self._assert_clean(resp.content.decode())

    def test_tag_sitemap_locations(self):
        resp = self.client.get("/sitemap-tags.xml")
        self.assertEqual(resp.status_code, 200)
        self._assert_clean(resp.content.decode())
