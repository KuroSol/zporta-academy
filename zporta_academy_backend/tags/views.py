from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Tag
from .serializers import TagSerializer

class TagListView(APIView):
    def get(self, request):
        tags = Tag.objects.all()
        serializer = TagSerializer(tags, many=True)
        return Response(serializer.data)
