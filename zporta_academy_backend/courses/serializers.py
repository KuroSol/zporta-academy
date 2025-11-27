import os
from bs4 import BeautifulSoup
from user_media.models import UserMedia
from rest_framework import serializers
from django.conf import settings
from .models import Course
from lessons.models import Lesson
from django.contrib.auth.models import User
from tags.serializers import TagSerializer

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'created_at', 'permalink', 'is_premium', 'course', 'status', 'position']

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
    
    class Meta:
        model = Course
        fields = [
            'id','title','description','price','permalink','course_url',
            'cover_image','cover_image_url','og_image','og_image_url','is_locked',
            'tags','tag_names','subject','subject_name','created_by','created_at','unique_code','course_type',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'lesson_count', 'is_owner', 'is_draft', 'allowed_testers',
            'enrolled_count', 'completed_count',
            'selling_points',
            'publish',
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
        return f"{settings.SITE_URL}/courses/{obj.permalink}/"
    
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