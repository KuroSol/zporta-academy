from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAdminUser
from rest_framework.authentication import SessionAuthentication
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from .models import Asset
from .serializers import AssetSerializer, AssetUploadSerializer, AssetResolveSerializer


class AssetViewSet(viewsets.ModelViewSet):
    """
    Asset Library API ViewSet.
    
    Endpoints:
    - POST /api/assets/ - Upload a new asset
    - GET /api/assets/ - List assets (filterable by kind, searchable by name)
    - GET /api/assets/{id}/ - Get specific asset details
    - DELETE /api/assets/{id}/ - Delete an asset
    - POST /api/assets/resolve/ - Resolve asset IDs to URLs/paths
    """
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [IsAdminUser]
    authentication_classes = [SessionAuthentication]
    
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['kind']
    search_fields = ['suggested_name', 'original_filename', 'provider']
    
    def get_serializer_class(self):
        """Use appropriate serializer based on action."""
        if self.action == 'create':
            return AssetUploadSerializer
        elif self.action == 'resolve':
            return AssetResolveSerializer
        return AssetSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Upload a new asset.
        
        Request format:
        - multipart/form-data
        - Fields: file (required), kind (required), provider (optional)
        
        Returns:
        - id, kind, url, path, suggested_name, created_at
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return full asset details
        asset = serializer.instance
        output_serializer = AssetSerializer(asset)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'], url_path='resolve')
    def resolve(self, request):
        """
        Resolve asset IDs to full URLs and paths.
        
        Request format:
        {
            "ids": ["uuid-1", "uuid-2", ...]
        }
        
        Returns:
        {
            "assets": [
                {
                    "id": "uuid-1",
                    "kind": "image",
                    "url": "/media/assets/image/2024/12/...",
                    "path": "assets/image/2024/12/...",
                    "suggested_name": "my-image",
                    "created_at": "..."
                },
                ...
            ]
        }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ids = serializer.validated_data.get('ids', [])
        
        # Fetch assets by IDs
        assets = Asset.objects.filter(id__in=ids)
        
        # If some IDs not found, return warning
        found_ids = set(str(a.id) for a in assets)
        missing_ids = set(str(id_) for id_ in ids) - found_ids
        
        output_serializer = AssetSerializer(assets, many=True)
        
        response_data = {
            'assets': output_serializer.data,
        }
        
        if missing_ids:
            response_data['missing_ids'] = list(missing_ids)
            response_data['warning'] = f"Could not find assets with IDs: {', '.join(missing_ids)}"
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete an asset and its file.
        """
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
