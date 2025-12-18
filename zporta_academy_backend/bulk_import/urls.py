from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BulkImportViewSet

router = DefaultRouter()
router.register(r'', BulkImportViewSet, basename='bulk-import')

urlpatterns = [
    path('', include(router.urls)),
]
