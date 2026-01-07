from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.parsers import MultiPartParser, FormParser  # Add these for file uploads
from .models import Post
from .serializers import PostSerializer
from rest_framework import generics
from seo.utils import canonical_url

class PostRetrieveView(RetrieveAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    lookup_field = 'permalink'

class PostListCreateView(ListCreateAPIView):
    serializer_class = PostSerializer
    parser_classes = [MultiPartParser, FormParser]  # Enable file upload support

    def get_queryset(self):
        queryset = Post.objects.all().order_by('-created_at')
        username = self.request.query_params.get('created_by')
        if username:
            queryset = queryset.filter(created_by__username=username)
        return queryset
    
    def get_permissions(self):
        """
        - Allow public access for GET (viewing posts).
        - Require authentication for POST (creating posts).
        """
        if self.request.method == 'GET':
            return [AllowAny()]  # Public can view posts
        return [IsAuthenticated()]  # Only logged-in users can create posts

    def create(self, request, *args, **kwargs):
        """
        Custom post creation logic to attach the logged-in user as the creator.
        """
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)  # Set created_by to the logged-in user
            return Response(serializer.data, status=HTTP_200_OK)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

class DynamicPostView(APIView):
    permission_classes = [AllowAny]  # Allow public access

    def get(self, request, permalink):
        post = Post.objects.get(permalink=permalink)

        # Use seo_title if provided, otherwise fallback to the post title
        title = post.seo_title if post.seo_title else post.title
        description = post.seo_description if post.seo_description else ""
        canonical_url_value = canonical_url(post.canonical_url or f"/posts/{post.permalink}/")
        og_title = post.og_title if post.og_title else title
        og_description = post.og_description if post.og_description else description
        # For the og_image, if using an ImageField, you can access its URL:
        og_image = post.og_image.url if post.og_image else ""
        if og_image and not og_image.startswith("http"):
            og_image = canonical_url(og_image)

        # Render the post content with SEO metadata
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{title}</title>
            <meta name="description" content="{description}">
            <link rel="canonical" href="{canonical_url_value}">
            
            <!-- Open Graph tags -->
            <meta property="og:title" content="{og_title}">
            <meta property="og:description" content="{og_description}">
            <meta property="og:image" content="{og_image}">
            <meta property="og:url" content="{canonical_url_value}">
        </head>
        <body>
            <h1>{post.title}</h1>
            <div>{post.content}</div>
        </body>
        </html>
        """
        return HttpResponse(html_content, content_type="text/html")
    
class PostRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]  # Or customize as needed
    parser_classes = [MultiPartParser, FormParser]
    lookup_field = "permalink"

    def get_object(self):
        post = get_object_or_404(Post, permalink=self.kwargs.get("permalink"))
        # For update/delete, ensure that only the creator can modify:
        if self.request.method in ['PUT', 'PATCH', 'DELETE'] and post.created_by != self.request.user:
            self.permission_denied(self.request, message="Not allowed to modify this post")
        return post