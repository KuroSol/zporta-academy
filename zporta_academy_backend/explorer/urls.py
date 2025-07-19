# zporta_academy_backend/explorer/urls.py

from django.urls import path
from .views import ExplorerSearchView

urlpatterns = [
    path('search/', ExplorerSearchView.as_view(), name='explorer-search'),
]
