from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import TeacherMailMagazine
from .serializers import TeacherMailMagazineSerializer
from .permissions import IsTeacherOrAdmin


class TeacherMailMagazineViewSet(viewsets.ModelViewSet):
    serializer_class = TeacherMailMagazineSerializer
    permission_classes = [IsAuthenticated, IsTeacherOrAdmin]

    def get_queryset(self):
        # Admins can see all mail magazines, teachers only see their own
        if self.request.user.is_staff or self.request.user.is_superuser:
            return TeacherMailMagazine.objects.all()
        return TeacherMailMagazine.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)
