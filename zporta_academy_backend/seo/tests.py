from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone

from users.models import Profile
from courses.models import Course
from lessons.models import Lesson
from quizzes.models import Quiz
from subjects.models import Subject
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
        self.profile = Profile.objects.create(
            user=self.user,
            role='guide',
            active_guide=True
        )
        
        # Create test subject
        self.subject = Subject.objects.create(name='Test Subject')
        
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
        inactive_profile = Profile.objects.create(
            user=inactive_user,
            role='guide',
            active_guide=False
        )
        
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
