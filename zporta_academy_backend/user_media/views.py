# user_media/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import UserMedia

class FileUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, format=None):
        # Ensure a file is provided
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Retrieve the media_type from the request (must be one of 'image', 'audio', or 'video')
        media_type = request.data.get('media_type')
        if media_type not in ['image', 'audio', 'video']:
            return Response({"error": "Invalid media_type"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Optional: if the file is related to a specific course, get course_id
        course_id = request.data.get('course_id')
        # New: get the media_category (for example, 'course', 'post', 'quiz', or 'lesson')
        media_category = request.data.get('media_category', None)
        
        # Create a new UserMedia instance including the optional fields if provided,
        # and set uploaded_by to the current user.
        user_media = UserMedia.objects.create(
            user=request.user,
            file=file_obj,
            media_type=media_type,
            course_id=course_id if course_id else None,
            media_category=media_category,
            uploaded_by=request.user
        )
        
        file_url = request.build_absolute_uri(user_media.file.url)
        return Response({"url": file_url, "media_type": media_type}, status=status.HTTP_201_CREATED)
