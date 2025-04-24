from django.urls import path
from .views import MentionListView, MentionDetailView

urlpatterns = [
    path('', MentionListView.as_view(), name='mention-list'),
    path('<int:pk>/', MentionDetailView.as_view(), name='mention-detail'),
]
