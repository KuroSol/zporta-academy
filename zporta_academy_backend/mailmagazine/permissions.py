from rest_framework import permissions


class IsTeacherOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow teachers (guides) and admins to access mail magazine.
    Students (explorers) are not allowed.
    """
    
    def has_permission(self, request, view):
        # User must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins (staff or superuser) have full access
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Check if user has a profile and is a guide (teacher)
        if hasattr(request.user, 'profile'):
            role = request.user.profile.role
            # Allow guides and users with 'both' role
            return role in ['guide', 'both']
        
        return False
