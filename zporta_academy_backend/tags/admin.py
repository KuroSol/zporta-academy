from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count
from .models import Tag

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'total_usage', 'posts_count', 'lessons_count', 'courses_count', 'quizzes_count', 'created_at']
    search_fields = ['name', 'slug', 'description']
    list_filter = ['created_at']
    readonly_fields = ['slug', 'created_at', 'usage_details']
    
    fieldsets = (
        ('Tag Information', {
            'fields': ('name', 'slug', 'description')
        }),
        ('Usage Statistics', {
            'fields': ('usage_details',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Annotate queryset with usage counts for efficient display"""
        qs = super().get_queryset(request)
        return qs.annotate(
            _posts_count=Count('posts', distinct=True),
            _lessons_count=Count('lessons', distinct=True),
            _courses_count=Count('courses', distinct=True),
            _quizzes_count=Count('quizzes', distinct=True),
        )
    
    def total_usage(self, obj):
        """Display total number of times this tag is used across all content"""
        total = (
            getattr(obj, '_posts_count', 0) +
            getattr(obj, '_lessons_count', 0) +
            getattr(obj, '_courses_count', 0) +
            getattr(obj, '_quizzes_count', 0)
        )
        if total == 0:
            return format_html('<span style="color: #999;">0 (unused)</span>')
        return format_html('<strong>{}</strong>', total)
    total_usage.short_description = 'Total Usage'
    # No single order field for total; it's a computed sum
    
    def posts_count(self, obj):
        """Display count of posts using this tag with link to filter"""
        count = getattr(obj, '_posts_count', obj.posts.count())
        if count == 0:
            return '—'
        url = reverse('admin:posts_post_changelist') + f'?tags__id__exact={obj.id}'
        return format_html('<a href="{}">{} post{}</a>', url, count, 's' if count != 1 else '')
    posts_count.short_description = 'Posts'
    
    def lessons_count(self, obj):
        """Display count of lessons using this tag with link to filter"""
        count = getattr(obj, '_lessons_count', obj.lessons.count())
        if count == 0:
            return '—'
        url = reverse('admin:lessons_lesson_changelist') + f'?tags__id__exact={obj.id}'
        return format_html('<a href="{}">{} lesson{}</a>', url, count, 's' if count != 1 else '')
    lessons_count.short_description = 'Lessons'
    
    def courses_count(self, obj):
        """Display count of courses using this tag with link to filter"""
        count = getattr(obj, '_courses_count', obj.courses.count())
        if count == 0:
            return '—'
        url = reverse('admin:courses_course_changelist') + f'?tags__id__exact={obj.id}'
        return format_html('<a href="{}">{} course{}</a>', url, count, 's' if count != 1 else '')
    courses_count.short_description = 'Courses'
    
    def quizzes_count(self, obj):
        """Display count of quizzes using this tag with link to filter"""
        count = getattr(obj, '_quizzes_count', obj.quizzes.count())
        if count == 0:
            return '—'
        url = reverse('admin:quizzes_quiz_changelist') + f'?tags__id__exact={obj.id}'
        return format_html('<a href="{}">{} quiz{}</a>', url, count, 's' if count != 1 else '')
    quizzes_count.short_description = 'Quizzes'
    
    def usage_details(self, obj):
        """Display detailed list of all content using this tag"""
        if not obj.pk:
            return "Save tag first to see usage details."
        
        html_parts = []
        
        # Posts section
        posts = obj.posts.all()[:20]
        if posts:
            html_parts.append('<div style="margin-bottom: 20px;"><strong>📝 Posts:</strong><ul style="margin-top: 5px;">')
            for post in posts:
                admin_url = reverse('admin:posts_post_change', args=[post.id])
                html_parts.append(f'<li><a href="{admin_url}" target="_blank">{post.title}</a></li>')
            if obj.posts.count() > 20:
                posts_url = reverse('admin:posts_post_changelist') + f'?tags__id__exact={obj.id}'
                html_parts.append(f'<li><a href="{posts_url}">... and {obj.posts.count() - 20} more</a></li>')
            html_parts.append('</ul></div>')
        
        # Lessons section
        lessons = obj.lessons.all()[:20]
        if lessons:
            html_parts.append('<div style="margin-bottom: 20px;"><strong>📚 Lessons:</strong><ul style="margin-top: 5px;">')
            for lesson in lessons:
                admin_url = reverse('admin:lessons_lesson_change', args=[lesson.id])
                html_parts.append(f'<li><a href="{admin_url}" target="_blank">{lesson.title}</a></li>')
            if obj.lesson_set.count() > 20:
                lessons_url = reverse('admin:lessons_lesson_changelist') + f'?tags__id__exact={obj.id}'
                html_parts.append(f'<li><a href="{lessons_url}">... and {obj.lesson_set.count() - 20} more</a></li>')
            html_parts.append('</ul></div>')
        
        # Courses section
        courses = obj.courses.all()[:20]
        if courses:
            html_parts.append('<div style="margin-bottom: 20px;"><strong>🎓 Courses:</strong><ul style="margin-top: 5px;">')
            for course in courses:
                admin_url = reverse('admin:courses_course_change', args=[course.id])
                html_parts.append(f'<li><a href="{admin_url}" target="_blank">{course.title}</a></li>')
            if obj.course_set.count() > 20:
                courses_url = reverse('admin:courses_course_changelist') + f'?tags__id__exact={obj.id}'
                html_parts.append(f'<li><a href="{courses_url}">... and {obj.course_set.count() - 20} more</a></li>')
            html_parts.append('</ul></div>')
        
        # Quizzes section
        quizzes = obj.quizzes.all()[:20]
        if quizzes:
            html_parts.append('<div style="margin-bottom: 20px;"><strong>❓ Quizzes:</strong><ul style="margin-top: 5px;">')
            for quiz in quizzes:
                admin_url = reverse('admin:quizzes_quiz_change', args=[quiz.id])
                html_parts.append(f'<li><a href="{admin_url}" target="_blank">{quiz.title}</a></li>')
            if obj.quiz_set.count() > 20:
                quizzes_url = reverse('admin:quizzes_quiz_changelist') + f'?tags__id__exact={obj.id}'
                html_parts.append(f'<li><a href="{quizzes_url}">... and {obj.quiz_set.count() - 20} more</a></li>')
            html_parts.append('</ul></div>')
        
        if not html_parts:
            return format_html('<p style="color: #999; font-style: italic;">This tag is not used in any content yet.</p>')
        
        return format_html(''.join(html_parts))
    
    usage_details.short_description = 'Detailed Usage'
    
    def has_delete_permission(self, request, obj=None):
        """Warn before deleting tags that are in use"""
        if obj:
            # Allow delete but Django will show related objects
            return True
        return super().has_delete_permission(request, obj)
