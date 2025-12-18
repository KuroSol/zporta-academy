from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import Tag

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'description', 'created_at']
        read_only_fields = ['slug', 'created_at']

    def validate_name(self, value):
        try:
            return Tag._validate_name(value)
        except ValidationError as exc:
            raise serializers.ValidationError(str(exc))

class TagDetailSerializer(serializers.ModelSerializer):
    posts = serializers.SerializerMethodField()
    lessons = serializers.SerializerMethodField()
    courses = serializers.SerializerMethodField()
    quizzes = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'description', 'created_at', 'posts', 'lessons', 'courses', 'quizzes']
        read_only_fields = ['slug', 'created_at']

    def get_posts(self, obj):
        from posts.models import Post
        posts = obj.posts.all().order_by('-created_at')
        
        # Pagination
        request = self.context.get('request')
        page_size = 20
        page = 1
        if request:
            try:
                page = int(request.query_params.get('page', 1))
            except (ValueError, TypeError):
                page = 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_posts = posts[start:end]
        
        results = []
        for post in paginated_posts:
            excerpt = ''
            if post.seo_description:
                excerpt = post.seo_description
            elif post.content:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(post.content, 'html.parser')
                excerpt = soup.get_text()[:200]
            
            cover_url = ''
            if post.og_image:
                if request:
                    cover_url = request.build_absolute_uri(post.og_image.url)
                else:
                    cover_url = post.og_image.url
            
            results.append({
                'id': post.id,
                'title': post.title,
                'slug': post.permalink,
                'published_at': post.created_at,
                'excerpt': excerpt,
                'cover_image_url': cover_url,
                'created_by': post.created_by.username if post.created_by else 'Anonymous'
            })
        
        return {
            'count': posts.count(),
            'page': page,
            'page_size': page_size,
            'results': results
        }

    def _paginate_qs(self, qs, request, page_param='page', page_size=20):
        try:
            page = int(request.query_params.get(page_param, 1)) if request else 1
        except (ValueError, TypeError):
            page = 1
        start = (page - 1) * page_size
        end = start + page_size
        return page, page_size, qs[start:end]

    def get_lessons(self, obj):
        lessons_qs = obj.lessons.all().order_by('-created_at')
        request = self.context.get('request')
        page, page_size, page_qs = self._paginate_qs(lessons_qs, request, page_param='lessons_page')
        results = []
        for l in page_qs:
            results.append({
                'id': l.id,
                'title': l.title,
                'permalink': l.permalink,
                'created_at': l.created_at,
                'course_title': getattr(l.course, 'title', None),
            })
        return {
            'count': lessons_qs.count(),
            'page': page,
            'page_size': page_size,
            'results': results
        }

    def get_courses(self, obj):
        courses_qs = obj.courses.all().order_by('-created_at')
        request = self.context.get('request')
        page, page_size, page_qs = self._paginate_qs(courses_qs, request, page_param='courses_page')
        results = []
        for c in page_qs:
            results.append({
                'id': c.id,
                'title': c.title,
                'permalink': c.permalink,
                'created_at': c.created_at,
                'subject_name': getattr(c.subject, 'name', None),
            })
        return {
            'count': courses_qs.count(),
            'page': page,
            'page_size': page_size,
            'results': results
        }

    def get_quizzes(self, obj):
        quizzes_qs = obj.quizzes.all().order_by('-created_at')
        request = self.context.get('request')
        page, page_size, page_qs = self._paginate_qs(quizzes_qs, request, page_param='quizzes_page')
        results = []
        for q in page_qs:
            results.append({
                'id': q.id,
                'title': q.title,
                'permalink': q.permalink,
                'created_at': q.created_at,
                'subject_name': getattr(q.subject, 'name', None),
            })
        return {
            'count': quizzes_qs.count(),
            'page': page,
            'page_size': page_size,
            'results': results
        }
