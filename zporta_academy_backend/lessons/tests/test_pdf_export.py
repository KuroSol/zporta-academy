"""
Tests for lesson PDF export functionality.
"""

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from io import BytesIO
from unittest.mock import patch, MagicMock
from bs4 import BeautifulSoup

from lessons.models import Lesson
from lessons.pdf_utils import (
    build_print_html_from_lesson,
    render_lesson_pdf_bytes,
    get_or_generate_lesson_pdf
)
from subjects.models import Subject
from courses.models import Course
from enrollment.models import Enrollment
from django.contrib.contenttypes.models import ContentType


class PDFUtilsTestCase(TestCase):
    """Test PDF utility functions."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.subject = Subject.objects.create(name='English')
        
        # Sample HTML content with media and accordions
        self.html_with_media = """
        <div class="lesson-content">
            <h2>Day 1: Introduction</h2>
            <p>This is a test lesson with <strong>English</strong> and <strong>日本語</strong> text.</p>
            <img src="test.jpg" alt="Test image">
            <audio controls src="test.mp3"></audio>
            <video controls src="test.mp4"></video>
            <iframe src="https://example.com"></iframe>
            <script>alert('test');</script>
            <details class="zporta-acc-item">
                <summary class="zporta-acc-title">Show Japanese Explanation</summary>
                <div class="zporta-acc-panel">
                    <p>これは日本語の説明です。</p>
                    <p>もう一つの段落。</p>
                </div>
            </details>
            <table>
                <tr><th>Term</th><th>意味</th></tr>
                <tr><td>Hello</td><td>こんにちは</td></tr>
            </table>
        </div>
        """
        
        self.lesson = Lesson.objects.create(
            title='Test Lesson',
            content=self.html_with_media,
            subject=self.subject,
            created_by=self.user,
            status=Lesson.PUBLISHED
        )
    
    def test_build_print_html_removes_media(self):
        """Test that images, audio, video are removed from HTML."""
        clean_html = build_print_html_from_lesson(self.lesson)
        soup = BeautifulSoup(clean_html, 'html.parser')
        
        # Media should be removed
        self.assertEqual(len(soup.find_all('img')), 0)
        self.assertEqual(len(soup.find_all('audio')), 0)
        self.assertEqual(len(soup.find_all('video')), 0)
        self.assertEqual(len(soup.find_all('iframe')), 0)
        self.assertEqual(len(soup.find_all('script')), 0)
    
    def test_build_print_html_keeps_text(self):
        """Test that English and Japanese text is preserved."""
        clean_html = build_print_html_from_lesson(self.lesson)
        
        # Text should be preserved
        self.assertIn('This is a test lesson', clean_html)
        self.assertIn('English', clean_html)
        self.assertIn('日本語', clean_html)
        self.assertIn('これは日本語の説明です', clean_html)
        self.assertIn('Hello', clean_html)
        self.assertIn('こんにちは', clean_html)
    
    def test_build_print_html_flattens_accordions(self):
        """Test that details/summary accordions are flattened."""
        clean_html = build_print_html_from_lesson(self.lesson)
        soup = BeautifulSoup(clean_html, 'html.parser')
        
        # Accordion elements should be gone
        self.assertEqual(len(soup.find_all('details')), 0)
        self.assertEqual(len(soup.find_all('summary')), 0)
        
        # But content should be present
        self.assertIn('Japanese Explanation', clean_html)
        self.assertIn('これは日本語の説明です', clean_html)
    
    def test_build_print_html_preserves_tables(self):
        """Test that tables are preserved."""
        clean_html = build_print_html_from_lesson(self.lesson)
        soup = BeautifulSoup(clean_html, 'html.parser')
        
        tables = soup.find_all('table')
        self.assertGreater(len(tables), 0)
        
        # Table content should be present
        self.assertIn('Term', clean_html)
        self.assertIn('意味', clean_html)
    
    def test_build_print_html_removes_event_handlers(self):
        """Test that onclick and other event handlers are removed."""
        html_with_events = """
        <div class="lesson-content" onclick="alert('test')">
            <button onclick="doSomething()">Click</button>
            <p contenteditable="true">Editable</p>
        </div>
        """
        lesson = Lesson.objects.create(
            title='Event Test',
            content=html_with_events,
            subject=self.subject,
            created_by=self.user,
            status=Lesson.PUBLISHED
        )
        
        clean_html = build_print_html_from_lesson(lesson)
        
        # Event handlers should be removed
        self.assertNotIn('onclick', clean_html)
        self.assertNotIn('contenteditable', clean_html)
    
    @patch('lessons.pdf_utils.HTML')
    def test_render_lesson_pdf_bytes(self, mock_html):
        """Test PDF rendering with WeasyPrint."""
        # Mock WeasyPrint
        mock_html_instance = MagicMock()
        mock_html.return_value = mock_html_instance
        
        # Mock write_pdf to write fake PDF bytes
        def mock_write_pdf(buffer, font_config=None):
            buffer.write(b'%PDF-1.4 fake pdf content')
        
        mock_html_instance.write_pdf = mock_write_pdf
        
        pdf_bytes = render_lesson_pdf_bytes(self.lesson)
        
        # Should return bytes
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 0)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))
    
    def test_get_or_generate_lesson_pdf_caching(self):
        """Test that PDF caching works correctly."""
        # First call should generate PDF
        with patch('lessons.pdf_utils.render_lesson_pdf_bytes') as mock_render:
            mock_render.return_value = b'%PDF-1.4 test'
            
            pdf_bytes1 = get_or_generate_lesson_pdf(self.lesson)
            
            # Should have called render once
            self.assertEqual(mock_render.call_count, 1)
            self.lesson.refresh_from_db()
            self.assertIsNotNone(self.lesson.export_generated_at)
        
        # Second call should use cache (no render call)
        with patch('lessons.pdf_utils.render_lesson_pdf_bytes') as mock_render:
            pdf_bytes2 = get_or_generate_lesson_pdf(self.lesson)
            
            # Should NOT have called render (used cache)
            self.assertEqual(mock_render.call_count, 0)
    
    def test_get_or_generate_lesson_pdf_invalidation(self):
        """Test that cache is invalidated when lesson is updated."""
        # Generate initial PDF
        with patch('lessons.pdf_utils.render_lesson_pdf_bytes') as mock_render:
            mock_render.return_value = b'%PDF-1.4 test'
            get_or_generate_lesson_pdf(self.lesson)
        
        # Update the lesson
        self.lesson.content = "<p>Updated content</p>"
        self.lesson.save()
        
        # Next call should regenerate
        with patch('lessons.pdf_utils.render_lesson_pdf_bytes') as mock_render:
            mock_render.return_value = b'%PDF-1.4 updated'
            get_or_generate_lesson_pdf(self.lesson)
            
            # Should have called render (cache invalidated)
            self.assertEqual(mock_render.call_count, 1)


class LessonExportPDFViewTestCase(TestCase):
    """Test the PDF export API endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            password='otherpass123'
        )
        
        self.subject = Subject.objects.create(name='English')
        
        self.public_lesson = Lesson.objects.create(
            title='Public Lesson',
            content='<p>Public content</p>',
            subject=self.subject,
            created_by=self.user,
            status=Lesson.PUBLISHED,
            is_premium=False
        )
        
        self.course = Course.objects.create(
            title='Premium Course',
            description='Test',
            created_by=self.user,
            course_type='premium',
            is_draft=False
        )
        
        self.premium_lesson = Lesson.objects.create(
            title='Premium Lesson',
            content='<p>Premium content</p>',
            subject=self.subject,
            created_by=self.user,
            status=Lesson.PUBLISHED,
            is_premium=True,
            course=self.course
        )
        
        self.draft_lesson = Lesson.objects.create(
            title='Draft Lesson',
            content='<p>Draft content</p>',
            subject=self.subject,
            created_by=self.user,
            status=Lesson.DRAFT
        )
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_public_lesson_authenticated(self, mock_render):
        """Test exporting a public lesson as authenticated user."""
        mock_render.return_value = b'%PDF-1.4 test content'
        
        self.client.force_authenticate(user=self.user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.public_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertTrue(response.content.startswith(b'%PDF'))
    
    def test_export_requires_authentication(self):
        """Test that PDF export requires authentication."""
        url = reverse('lesson-export-pdf', kwargs={'pk': self.public_lesson.pk})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_premium_lesson_without_enrollment(self, mock_render):
        """Test that premium lesson export requires enrollment."""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.premium_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Enrollment required', response.data['detail'])
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_premium_lesson_with_enrollment(self, mock_render):
        """Test that enrolled users can export premium lessons."""
        mock_render.return_value = b'%PDF-1.4 premium content'
        
        # Enroll the user
        course_ct = ContentType.objects.get_for_model(Course)
        Enrollment.objects.create(
            user=self.other_user,
            content_type=course_ct,
            object_id=self.course.id,
            enrollment_type='course'
        )
        
        self.client.force_authenticate(user=self.other_user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.premium_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_premium_lesson_as_creator(self, mock_render):
        """Test that lesson creator can always export (no enrollment needed)."""
        mock_render.return_value = b'%PDF-1.4 creator content'
        
        self.client.force_authenticate(user=self.user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.premium_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_draft_lesson_as_other_user(self, mock_render):
        """Test that non-creators cannot export draft lessons."""
        self.client.force_authenticate(user=self.other_user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.draft_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_draft_lesson_as_creator(self, mock_render):
        """Test that creators can export their own draft lessons."""
        mock_render.return_value = b'%PDF-1.4 draft content'
        
        self.client.force_authenticate(user=self.user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.draft_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_export_error_handling(self, mock_render):
        """Test that PDF generation errors are handled gracefully."""
        # Simulate a rendering error
        mock_render.side_effect = Exception("WeasyPrint error")
        
        self.client.force_authenticate(user=self.user)
        url = reverse('lesson-export-pdf', kwargs={'pk': self.public_lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('PDF generation failed', response.data['detail'])
        # Should not leak error details to client
        self.assertNotIn('WeasyPrint', response.data['detail'])
    
    def test_export_nonexistent_lesson(self):
        """Test exporting non-existent lesson returns 404."""
        self.client.force_authenticate(user=self.user)
        url = reverse('lesson-export-pdf', kwargs={'pk': 99999})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    @patch('lessons.pdf_utils.render_lesson_pdf_bytes')
    def test_japanese_text_handling(self, mock_render):
        """Test that Japanese characters are handled correctly."""
        lesson = Lesson.objects.create(
            title='日本語レッスン',
            content='<p>これはテストです。漢字、ひらがな、カタカナ。</p>',
            subject=self.subject,
            created_by=self.user,
            status=Lesson.PUBLISHED
        )
        
        # Should not raise exception
        mock_render.return_value = b'%PDF-1.4 japanese content'
        
        self.client.force_authenticate(user=self.user)
        url = reverse('lesson-export-pdf', kwargs={'pk': lesson.pk})
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify that render was called with lesson containing Japanese
        mock_render.assert_called_once()
        called_lesson = mock_render.call_args[0][0]
        self.assertIn('これはテストです', called_lesson.content)
