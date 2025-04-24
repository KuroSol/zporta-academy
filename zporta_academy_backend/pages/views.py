from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from .models import Page, Snippet
from .serializers import PageSerializer
from django.utils.safestring import mark_safe  # Ensure content is marked as safe for rendering

class PageListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pages = Page.objects.all()
        serializer = PageSerializer(pages, many=True)
        return Response(serializer.data, status=HTTP_200_OK)

    def post(self, request):
        serializer = PageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=HTTP_200_OK)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

class DynamicPageView(APIView):
    permission_classes = [AllowAny]  # Anyone can access dynamic pages

    def get(self, request, permalink):
        try:
            page = Page.objects.get(permalink=permalink)

            # Fetch all snippets
            snippets = Snippet.objects.all()

            # Build snippets' HTML
            snippets_html = "".join([mark_safe(snippet.content) for snippet in snippets])

            # SEO metadata
            seo_title = page.seo_title if page.seo_title else page.title
            seo_description = page.seo_description if page.seo_description else ""
            canonical_url = page.canonical_url if page.canonical_url else ""
            og_title = page.og_title if page.og_title else seo_title
            og_description = page.og_description if page.og_description else seo_description
            og_image = page.og_image if page.og_image else ""

            # Base HTML structure with SEO metadata
            base_html = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>{seo_title}</title>
                <meta name="description" content="{seo_description}">
                <link rel="canonical" href="{canonical_url}">
                
                <!-- Open Graph tags -->
                <meta property="og:title" content="{og_title}">
                <meta property="og:description" content="{og_description}">
                <meta property="og:image" content="{og_image}">
            </head>
            <body>
                {snippets_html}  <!-- Include all snippets here -->
                <div>
                    {mark_safe(page.content)}  <!-- Mark content as safe for rendering -->
                </div>
            </body>
            </html>
            """

            return HttpResponse(base_html, content_type="text/html")

        except Page.DoesNotExist:
            return HttpResponse("Page not found", status=404)
