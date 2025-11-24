from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from mailmagazine.permissions import IsTeacherOrAdmin
from users.models import Profile


class IsTeacherOrAdminPermissionTest(TestCase):
    """Test the IsTeacherOrAdmin permission class"""
    
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = IsTeacherOrAdmin()
        
        # Create users with different roles
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            is_staff=True
        )
        
        self.guide_user = User.objects.create_user(
            username='guide',
            email='guide@test.com',
            password='testpass123'
        )
        self.guide_user.profile.role = 'guide'
        self.guide_user.profile.save()
        
        self.both_user = User.objects.create_user(
            username='both',
            email='both@test.com',
            password='testpass123'
        )
        self.both_user.profile.role = 'both'
        self.both_user.profile.save()
        
        self.explorer_user = User.objects.create_user(
            username='explorer',
            email='explorer@test.com',
            password='testpass123'
        )
        self.explorer_user.profile.role = 'explorer'
        self.explorer_user.profile.save()
    
    def test_admin_has_permission(self):
        """Test that staff users have permission"""
        request = self.factory.get('/api/teacher-mail-magazines/')
        request.user = self.admin_user
        drf_request = Request(request)
        drf_request.user = self.admin_user
        
        self.assertTrue(
            self.permission.has_permission(drf_request, None),
            "Admin user should have permission"
        )
    
    def test_guide_has_permission(self):
        """Test that guide users have permission"""
        request = self.factory.get('/api/teacher-mail-magazines/')
        request.user = self.guide_user
        drf_request = Request(request)
        drf_request.user = self.guide_user
        
        self.assertTrue(
            self.permission.has_permission(drf_request, None),
            "Guide user should have permission"
        )
    
    def test_both_has_permission(self):
        """Test that users with 'both' role have permission"""
        request = self.factory.get('/api/teacher-mail-magazines/')
        request.user = self.both_user
        drf_request = Request(request)
        drf_request.user = self.both_user
        
        self.assertTrue(
            self.permission.has_permission(drf_request, None),
            "User with 'both' role should have permission"
        )
    
    def test_explorer_no_permission(self):
        """Test that explorer users do not have permission"""
        request = self.factory.get('/api/teacher-mail-magazines/')
        request.user = self.explorer_user
        drf_request = Request(request)
        drf_request.user = self.explorer_user
        
        self.assertFalse(
            self.permission.has_permission(drf_request, None),
            "Explorer user should not have permission"
        )
    
    def test_unauthenticated_no_permission(self):
        """Test that unauthenticated users do not have permission"""
        from django.contrib.auth.models import AnonymousUser
        request = self.factory.get('/api/teacher-mail-magazines/')
        request.user = AnonymousUser()
        drf_request = Request(request)
        drf_request.user = AnonymousUser()
        
        self.assertFalse(
            self.permission.has_permission(drf_request, None),
            "Unauthenticated user should not have permission"
        )
