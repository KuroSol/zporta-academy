from django.urls import path
from .views import PostListCreateView, PostRetrieveView, PostRetrieveUpdateDestroyView

urlpatterns = [
    path('', PostListCreateView.as_view(), name='post-list-create'),
    path('<path:permalink>/update/', PostRetrieveUpdateDestroyView.as_view(), name='post-update'),
    path('<path:permalink>/delete/', PostRetrieveUpdateDestroyView.as_view(), name='post-delete'),
    path('<path:permalink>/', PostRetrieveView.as_view(), name='post-detail'),
]
