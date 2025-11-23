from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from lessons.models import Lesson
from user_media.models import UserMedia
from django.core.files.uploadedfile import SimpleUploadedFile
import zipfile
import io
import os

class LessonAudioExportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client.force_authenticate(user=self.user)
        
        self.lesson = Lesson.objects.create(
            title="Test Lesson",
            content="<p>Test content</p>",
            created_by=self.user,
            status=Lesson.PUBLISHED
        )
        
        # Create dummy audio file
        self.audio_content = b"fake audio content"
        self.audio_file = SimpleUploadedFile("test_audio.mp3", self.audio_content, content_type="audio/mpeg")
        
        self.user_media = UserMedia.objects.create(
            user=self.user,
            lesson=self.lesson,
            file=self.audio_file,
            media_type='audio',
            media_category='lesson'
        )

    def tearDown(self):
        # Clean up uploaded files
        if self.user_media.file:
            if os.path.isfile(self.user_media.file.path):
                os.remove(self.user_media.file.path)

    def test_export_audio_zip(self):
        url = reverse('lesson-export-audio', kwargs={'pk': self.lesson.pk})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Content-Type might be application/zip or application/x-zip-compressed depending on system
        self.assertIn('zip', response['Content-Type'])
        self.assertTrue(response['Content-Disposition'].startswith('attachment; filename="lesson-'))
        
        # Verify zip content
        buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(buffer, 'r') as z:
            # The filename in zip might be the full path or just basename depending on how it was saved
            # In our view we used os.path.basename(audio.file.name)
            # But SimpleUploadedFile might save it with a random suffix or in a folder
            
            # Let's check if any file in the zip ends with .mp3
            files = z.namelist()
            self.assertTrue(any(f.endswith('.mp3') for f in files))
            
            # Read the first file
            first_file = files[0]
            extracted_content = z.read(first_file)
            self.assertEqual(extracted_content, self.audio_content)

    def test_no_audio_files(self):
        # Delete the audio media
        self.user_media.delete()
        
        url = reverse('lesson-export-audio', kwargs={'pk': self.lesson.pk})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unauthorized_access(self):
        self.client.logout()
        url = reverse('lesson-export-audio', kwargs={'pk': self.lesson.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
