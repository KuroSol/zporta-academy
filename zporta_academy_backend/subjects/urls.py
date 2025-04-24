# subjects/urls.py
from django.urls import path
from .views import SubjectListCreateView

urlpatterns = [
    path('', SubjectListCreateView.as_view(), name='subject-list-create'),  # Handles GET and POST requests
]
