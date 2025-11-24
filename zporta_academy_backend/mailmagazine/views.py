from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import TeacherMailMagazine
from .serializers import TeacherMailMagazineSerializer


class TeacherMailMagazineViewSet(viewsets.ModelViewSet):
    serializer_class = TeacherMailMagazineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TeacherMailMagazine.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)
