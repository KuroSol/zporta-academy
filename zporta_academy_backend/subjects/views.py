# subjects/views.py
from rest_framework import generics
from rest_framework.permissions import AllowAny  # You can change this to IsAuthenticated if needed
from .models import Subject
from .serializers import SubjectSerializer

class SubjectListCreateView(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [AllowAny]  # Change this to IsAuthenticated for authenticated users only
