from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from .models import Tag
from .serializers import TagSerializer, TagDetailSerializer

class TagPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100

class TagListView(APIView):
    def get(self, request):
        tags = Tag.objects.all().order_by('name')
        
        # Search support
        search = request.query_params.get('search', '').strip()
        if search:
            tags = tags.filter(Q(name__icontains=search) | Q(description__icontains=search))
        
        # Pagination
        paginator = TagPagination()
        page = paginator.paginate_queryset(tags, request)
        if page is not None:
            serializer = TagSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = TagSerializer(tags, many=True)
        return Response(serializer.data)

class TagDetailView(APIView):
    def get(self, request, slug):
        try:
            tag = Tag.objects.get(slug=slug)
        except Tag.DoesNotExist:
            return Response({'detail': 'Tag not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = TagDetailSerializer(tag, context={'request': request})
        return Response(serializer.data)
