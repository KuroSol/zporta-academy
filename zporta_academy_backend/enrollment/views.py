# enrollment/views.py

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from .models import Enrollment
from .serializers import EnrollmentSerializer
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from courses.models import Course
from .utils import lock_course_and_content


class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        if serializer.validated_data.get("enrollment_type") == "course":
            course_content_type = ContentType.objects.get_for_model(Course)
            enrollment = serializer.save(user=self.request.user, content_type=course_content_type)
            course = enrollment.content_object
            lock_course_and_content(course)
            enrollment.save()
        else:
            serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='my-enrollments')
    def my_enrollments(self, request):
        user_enrollments = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(user_enrollments, many=True)
        return Response(serializer.data)
    
class UserEnrollmentList(ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(user=self.request.user)
