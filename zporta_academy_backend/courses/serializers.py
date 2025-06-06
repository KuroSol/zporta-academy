import os
from bs4 import BeautifulSoup
from user_media.models import UserMedia
from rest_framework import serializers
from django.conf import settings
from .models import Course
from lessons.models import Lesson
from django.contrib.auth.models import User

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'created_at', 'permalink']

class CourseSerializer(serializers.ModelSerializer):
    enrolled_count  = serializers.IntegerField(read_only=True)
    completed_count = serializers.IntegerField(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    course_url = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    is_draft = serializers.BooleanField(read_only=True)
    allowed_testers = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False
    )
    
    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'price', 'permalink', 'course_url', 'cover_image','is_locked',
            'tags', 'subject', 'created_by', 'created_at', 'unique_code', 'course_type',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'lesson_count', 'is_owner', 'is_draft', 'allowed_testers',
            'enrolled_count', 'completed_count',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'permalink', 'unique_code', 'is_draft']
    
    def create(self, validated_data):
        # Pop many-to-many fields safely
        tags_data = validated_data.pop('tags', None) or []
        allowed_testers_data = validated_data.pop('allowed_testers', None) or []
        
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['is_draft'] = True  # New courses start as drafts
        
        # Use all_objects manager to create the course (bypassing published filtering)
        course = Course.all_objects.create(**validated_data)
        
        if tags_data:
            course.tags.set(tags_data)
        
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
