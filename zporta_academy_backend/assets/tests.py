import os
import io
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase
from rest_framework import status
from .models import Asset

User = get_user_model()


class AssetModelTest(TestCase):
    """Test the Asset model."""
    
    def setUp(self):
        """Create test asset."""
        self.image_file = SimpleUploadedFile(
            name='test_image.jpg',
            content=b'fake image content',
            content_type='image/jpeg'
        )
        self.asset = Asset.objects.create(
            kind='image',
            file=self.image_file,
            original_filename='test_image.jpg'
        )
    
    def test_asset_creation(self):
        """Test asset is created correctly."""
        self.assertEqual(self.asset.kind, 'image')
        self.assertEqual(self.asset.original_filename, 'test_image.jpg')
        self.assertIsNotNone(self.asset.id)
        self.assertIsNotNone(self.asset.created_at)
    
    def test_suggested_name_auto_generated(self):
        """Test suggested_name is auto-generated from filename."""
        self.assertEqual(self.asset.suggested_name, 'test_image')
    
    def test_asset_file_path_format(self):
        """Test file is stored in correct path format."""
        # Path should be: assets/{kind}/{yyyy}/{mm}/{slug}-{uuid}.{ext}
        path = self.asset.file.name
        parts = path.split('/')
        self.assertEqual(parts[0], 'assets')
        self.assertEqual(parts[1], 'image')
        self.assertEqual(len(parts[2]), 4)  # Year
        self.assertEqual(len(parts[3]), 2)  # Month
        # Filename should contain slug and uuid
        self.assertIn('test_image', parts[4])
    
    def test_get_url(self):
        """Test get_url returns file URL."""
        url = self.asset.get_url()
        self.assertIsNotNone(url)
        self.assertIn('/media/', url)
    
    def test_get_path(self):
        """Test get_path returns file path."""
        path = self.asset.get_path()
        self.assertIsNotNone(path)
        self.assertIn('assets/image', path)
    
    def test_asset_deletion_removes_file(self):
        """Test asset deletion removes the file."""
        file_name = self.asset.file.name
        self.assertTrue(self.asset.file.storage.exists(file_name))
        
        # Delete the asset
        asset_id = self.asset.id
        self.asset.delete()
        
        # File should be deleted
        from django.core.files.storage import default_storage
        self.assertFalse(default_storage.exists(file_name))
    
    def tearDown(self):
        """Clean up after tests."""
        try:
            if self.asset and self.asset.file and self.asset.file.name:
                if self.asset.file.storage.exists(self.asset.file.name):
                    self.asset.file.delete()
        except:
            pass


class AssetAPITest(APITestCase):
    """Test Asset API endpoints."""
    
    def setUp(self):
        """Set up test client and admin user."""
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@test.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.admin_user)
    
    def test_upload_image(self):
        """Test uploading an image asset."""
        image_file = SimpleUploadedFile(
            name='test_upload.jpg',
            content=b'fake image',
            content_type='image/jpeg'
        )
        
        data = {
            'file': image_file,
            'kind': 'image',
            'provider': 'Gemini'
        }
        
        response = self.client.post('/api/assets/', data, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['kind'], 'image')
        self.assertEqual(response.data['provider'], 'Gemini')
        self.assertIn('url', response.data)
        self.assertIn('path', response.data)
        self.assertIn('id', response.data)
    
    def test_upload_audio(self):
        """Test uploading an audio asset."""
        audio_file = SimpleUploadedFile(
            name='test_audio.mp3',
            content=b'fake audio',
            content_type='audio/mpeg'
        )
        
        data = {
            'file': audio_file,
            'kind': 'audio',
            'provider': 'Google AI Studio'
        }
        
        response = self.client.post('/api/assets/', data, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['kind'], 'audio')
    
    def test_list_assets(self):
        """Test listing assets."""
        # Create test assets
        image_file = SimpleUploadedFile(
            name='image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        audio_file = SimpleUploadedFile(
            name='audio.mp3',
            content=b'fake',
            content_type='audio/mpeg'
        )
        
        Asset.objects.create(kind='image', file=image_file, original_filename='image.jpg')
        Asset.objects.create(kind='audio', file=audio_file, original_filename='audio.mp3')
        
        response = self.client.get('/api/assets/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response might be paginated dict or plain list
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 2)
    
    def test_filter_by_kind(self):
        """Test filtering assets by kind."""
        image_file = SimpleUploadedFile(
            name='image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        audio_file = SimpleUploadedFile(
            name='audio.mp3',
            content=b'fake',
            content_type='audio/mpeg'
        )
        
        Asset.objects.create(kind='image', file=image_file, original_filename='image.jpg')
        Asset.objects.create(kind='audio', file=audio_file, original_filename='audio.mp3')
        
        response = self.client.get('/api/assets/?kind=image')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response might be paginated dict or plain list
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['kind'], 'image')
    
    def test_search_assets(self):
        """Test searching assets by name."""
        image_file = SimpleUploadedFile(
            name='my_awesome_image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        
        Asset.objects.create(
            kind='image', 
            file=image_file, 
            original_filename='my_awesome_image.jpg'
        )
        
        response = self.client.get('/api/assets/?search=awesome')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Response might be paginated dict or plain list
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
    
    def test_delete_asset(self):
        """Test deleting an asset."""
        image_file = SimpleUploadedFile(
            name='image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        
        asset = Asset.objects.create(kind='image', file=image_file, original_filename='image.jpg')
        asset_id = asset.id
        
        response = self.client.delete(f'/api/assets/{asset_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Asset.objects.filter(id=asset_id).exists())
    
    def test_resolve_assets(self):
        """Test resolving asset IDs to URLs."""
        image_file = SimpleUploadedFile(
            name='image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        audio_file = SimpleUploadedFile(
            name='audio.mp3',
            content=b'fake',
            content_type='audio/mpeg'
        )
        
        image = Asset.objects.create(kind='image', file=image_file, original_filename='image.jpg')
        audio = Asset.objects.create(kind='audio', file=audio_file, original_filename='audio.mp3')
        
        data = {
            'ids': [str(image.id), str(audio.id)]
        }
        
        response = self.client.post('/api/assets/resolve/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['assets']), 2)
    
    def test_resolve_with_missing_ids(self):
        """Test resolving with some missing IDs."""
        import uuid
        
        image_file = SimpleUploadedFile(
            name='image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        
        image = Asset.objects.create(kind='image', file=image_file, original_filename='image.jpg')
        fake_id = uuid.uuid4()
        
        data = {
            'ids': [str(image.id), str(fake_id)]
        }
        
        response = self.client.post('/api/assets/resolve/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['assets']), 1)
        self.assertIn('missing_ids', response.data)
        self.assertIn('warning', response.data)
    
    def test_unauthorized_access(self):
        """Test non-admin users cannot upload."""
        # Create non-admin user
        regular_user = User.objects.create_user(
            username='user',
            email='user@test.com',
            password='testpass123'
        )
        
        # Create new client for regular user
        client = APIClient()
        client.force_authenticate(user=regular_user)
        
        image_file = SimpleUploadedFile(
            name='image.jpg',
            content=b'fake',
            content_type='image/jpeg'
        )
        
        data = {
            'file': image_file,
            'kind': 'image'
        }
        
        response = client.post('/api/assets/', data, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def tearDown(self):
        """Clean up after tests."""
        for asset in Asset.objects.all():
            if asset.file.storage.exists(asset.file.name):
                asset.file.delete()
