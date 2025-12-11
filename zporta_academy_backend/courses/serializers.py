import os
from bs4 import BeautifulSoup
from user_media.models import UserMedia
from rest_framework import serializers
from django.conf import settings
from .models import Course
from lessons.models import Lesson
from django.contrib.auth.models import User
from tags.serializers import TagSerializer
from quizzes.models import Quiz

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'created_at', 'permalink', 'is_premium', 'course', 'status', 'position']

# Lightweight quiz serializer for course detail view (avoids fetching all questions)
class LightweightQuizSerializer(serializers.ModelSerializer):
    """Minimal quiz data for course detail - no questions loaded"""
    lesson_title = serializers.CharField(source='lesson.title', read_only=True, allow_null=True)
    lesson_permalink = serializers.CharField(source='lesson.permalink', read_only=True, allow_null=True)
    
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'permalink', 'quiz_type', 'status', 'lesson_id', 'lesson_title', 'lesson_permalink']

class CourseSerializer(serializers.ModelSerializer):
    cover_image_url = serializers.SerializerMethodField()
    og_image_url    = serializers.SerializerMethodField()
    enrolled_count  = serializers.IntegerField(read_only=True)
    completed_count = serializers.IntegerField(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    course_url = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    is_draft = serializers.BooleanField(read_only=True)
    # allow publish via a dedicated write-only flag
    publish = serializers.BooleanField(write_only=True, required=False, default=False)

    subject_name = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    allowed_testers = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False
    )
    
    # Course-level quizzes (attached directly to this course)
    quizzes = serializers.SerializerMethodField()
    
    # Enrolled users list (for course introduction/detail view)
    enrolled_users = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id','title','description','price','permalink','course_url',
            'cover_image','cover_image_url','og_image','og_image_url','is_locked',
            'tags','tag_names','subject','subject_name','created_by','created_at','unique_code','course_type',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'lesson_count', 'is_owner', 'is_draft', 'allowed_testers',
            'enrolled_count', 'completed_count', 'enrolled_users',
            'selling_points',
            'publish',
            'quizzes',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'permalink', 'unique_code', 'is_draft']
    
    def _abs(self, request, url_or_path):
        if not url_or_path:
            return None
        return request.build_absolute_uri(url_or_path)

    def create(self, validated_data):
        # Pop many-to-many fields safely
        from tags.models import Tag
        from django.utils.text import slugify
        import re
        
        tag_names_data = validated_data.pop('tag_names', None) or []
        allowed_testers_data = validated_data.pop('allowed_testers', None) or []
        publish_flag = bool(validated_data.pop('publish', False))
        
        user = self.context['request'].user
        validated_data['created_by'] = user
        # respect publish flag
        validated_data['is_draft'] = not publish_flag
        
        # Use all_objects manager to create the course (bypassing published filtering)
        course = Course.all_objects.create(**validated_data)
        
        if tag_names_data:
            for tag_name in tag_names_data:
                # Clean tag name (same as lesson serializer)
                cleaned = tag_name.strip()
                cleaned = cleaned.replace(' ', '-')
                cleaned = re.sub(r'[^a-zA-Z0-9\-]', '', cleaned)
                cleaned = re.sub(r'-+', '-', cleaned).lower()
                if cleaned:
                    tag, _ = Tag.objects.get_or_create(name=cleaned, defaults={'slug': slugify(cleaned)})
                    course.tags.add(tag)
        
        allowed_testers_users = []
        for tester in allowed_testers_data:
            if isinstance(tester, int):
                try:
                    tester_obj = User.objects.get(pk=tester)
                    allowed_testers_users.append(tester_obj)
                except User.DoesNotExist:
                    continue
            elif isinstance(tester, str):
                try:
                    tester_obj = User.objects.get(username=tester)
                    allowed_testers_users.append(tester_obj)
                except User.DoesNotExist:
                    continue
            else:
                allowed_testers_users.append(tester)
        if allowed_testers_users:
            course.allowed_testers.set(allowed_testers_users)
        
        # Process course description for media (audio & image tags)
        soup = BeautifulSoup(course.description, "html.parser")
        audio_tags = soup.find_all("audio")
        for audio in audio_tags:
            src = audio.get("src")
            if src:
                filename = os.path.basename(src)
                media = UserMedia.objects.filter(file__icontains=filename, course__isnull=True).first()
                if media:
                    media.course = course
                    media.media_category = 'course'
                    media.save()
        
        img_tags = soup.find_all("img")
        for img in img_tags:
            src = img.get("src")
            if src:
                filename = os.path.basename(src)
                media = UserMedia.objects.filter(file__icontains=filename, course__isnull=True).first()
                if media:
                    media.course = course
                    media.media_category = 'course'
                    media.save()
        
        return course
    def update(self, instance, validated_data):
        from tags.models import Tag
        from django.utils.text import slugify
        import re
        
        # allow publish via flag on update
        publish_flag = validated_data.pop('publish', None)
        
        # Handle tag_names
        tag_names_data = validated_data.pop('tag_names', None)

        # Normalize allowed_testers: accept IDs or usernames from multipart/form-data
        incoming_allowed = None
        if 'allowed_testers' in validated_data:
            # DRF may have already resolved these to User instances
            incoming_allowed = validated_data.pop('allowed_testers')
        else:
            # Fallback to raw payload (supports repeated keys in FormData)
            raw = self.context['request'].data.getlist('allowed_testers') if hasattr(self.context.get('request'), 'data') else None
            if raw:
                users = []
                for v in raw:
                    try:
                        # try by PK first
                        users.append(User.objects.get(pk=int(v)))
                    except (ValueError, User.DoesNotExist):
                        try:
                            users.append(User.objects.get(username=str(v)))
                        except User.DoesNotExist:
                            continue
                incoming_allowed = users

        obj = super().update(instance, validated_data)
        
        # Update tags if provided
        if tag_names_data is not None:
            obj.tags.clear()
            for tag_name in tag_names_data:
                # Clean tag name (same as lesson serializer)
                cleaned = tag_name.strip()
                cleaned = cleaned.replace(' ', '-')
                cleaned = re.sub(r'[^a-zA-Z0-9\-]', '', cleaned)
                cleaned = re.sub(r'-+', '-', cleaned).lower()
                if cleaned:
                    tag, _ = Tag.objects.get_or_create(name=cleaned, defaults={'slug': slugify(cleaned)})
                    obj.tags.add(tag)

        if incoming_allowed is not None and not obj.is_draft:
            obj.allowed_testers.set(incoming_allowed)

        if publish_flag is True and obj.is_draft:
            obj.is_draft = False
            obj.save(update_fields=['is_draft'])
        return obj
    
    def get_course_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f"/courses/{obj.permalink}/")
        site_url = getattr(settings, 'SITE_URL', 'http://localhost:8000')
        return f"{site_url}/courses/{obj.permalink}/"
    
    def get_created_by(self, obj):
        return obj.created_by.username
    
    def get_lesson_count(self, obj):
        from lessons.models import Lesson
        return Lesson.objects.filter(course=obj).count()
    
    def get_is_owner(self, obj):
        request = self.context.get('request')
        return request.user.is_authenticated and request.user == obj.created_by

    def get_subject_name(self, obj):
        return obj.subject.name if obj.subject else None

    def get_cover_image_url(self, obj):
        request = self.context.get('request')
        if obj.cover_image:
            return self._abs(request, obj.cover_image.url)
        return None

    def get_og_image_url(self, obj):
        request = self.context.get('request')
        # og_image is a URLField (may already be absolute). If blank, fall back to cover_image.
        if obj.og_image:
            return obj.og_image if obj.og_image.startswith('http') else self._abs(request, obj.og_image)
        if obj.cover_image:
            return self._abs(request, obj.cover_image.url)
        return None

    def get_quizzes(self, obj):
        """Return lightweight quiz data for course detail view (course-level and lesson-level)"""
        # Get course-level quizzes (attached directly to this course)
        course_quizzes = obj.quizzes.all()
        # Get lesson-level quizzes (from lessons attached to this course)
        lesson_quizzes = Quiz.objects.filter(lesson__course=obj)
        # Combine both (avoid duplicates if a quiz is attached at both levels)
        all_quizzes = course_quizzes.union(lesson_quizzes)
        return LightweightQuizSerializer(all_quizzes, many=True).data

    def get_enrolled_users(self, obj):
        """Return list of enrolled users for this course with their details.
        
        Includes user profile info (name, avatar, progress) in course introduction.
        """
        from enrollment.models import Enrollment
        from django.contrib.auth.models import User
        
        try:
            # Get all users enrolled in this course
            enrollments = Enrollment.objects.filter(
                enrollment_type='course',
                object_id=obj.id
            ).select_related('user')
            
            enrolled_user_list = []
            for enrollment in enrollments:
                user = enrollment.user
                user_data = {
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'enrolled_at': enrollment.created_at.isoformat() if hasattr(enrollment, 'created_at') else None,
                }
                
                # Include user avatar if available
                try:
                    from user_media.models import UserMedia
                    avatar = UserMedia.objects.filter(
                        user=user,
                        media_category='avatar'
                    ).first()
                    if avatar and avatar.file:
                        request = self.context.get('request')
                        user_data['avatar_url'] = request.build_absolute_uri(avatar.file.url) if request else avatar.file.url
                except:
                    user_data['avatar_url'] = None
                
                # Include user's progress in this course
                try:
                    from analytics.models import ActivityEvent
                    from datetime import timedelta
                    from django.utils import timezone
                    
                    lessons_completed = ActivityEvent.objects.filter(
                        user=user,
                        event_type='lesson_completed',
                        # Associated with this course's lessons
                    ).count()
                    
                    quizzes_taken = ActivityEvent.objects.filter(
                        user=user,
                        event_type='quiz_completed'
                    ).count()
                    
                    user_data['progress'] = {
                        'lessons_completed': lessons_completed,
                        'quizzes_taken': quizzes_taken,
                    }
                except:
                    user_data['progress'] = {
                        'lessons_completed': 0,
                        'quizzes_taken': 0,
                    }
                
                enrolled_user_list.append(user_data)
            
            return enrolled_user_list
        except Exception as e:
            # Log error but don't fail the entire serialization
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error fetching enrolled users for course {obj.id}: {e}")
            return []
        all_quizzes = (course_quizzes | lesson_quizzes).distinct()
        # Return lightweight serialized data
        return LightweightQuizSerializer(all_quizzes, many=True).data