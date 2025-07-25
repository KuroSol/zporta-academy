from django.urls import path
from .views import TagListView

urlpatterns = [
    # THIS will serve GET /api/tags/
    path('',      TagListView.as_view(), name='tag_list'),

    # LEGACY: still serve GET /api/tags/tags/ for any code that hard-codes it
    path('tags/', TagListView.as_view(), name='tag_list'),
]
