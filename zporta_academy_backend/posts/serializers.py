from rest_framework import serializers
from django.conf import settings
from django.utils.text import slugify
from .models import Post
from bs4 import BeautifulSoup
import os
import re
from user_media.models import UserMedia
from tags.serializers import TagSerializer
from tags.models import Tag

class PostSerializer(serializers.ModelSerializer):
    post_url = serializers.SerializerMethodField()  # Full post URL
    created_by = serializers.SerializerMethodField()  # Display username
    og_image_url = serializers.SerializerMethodField()  # Absolute URL for the image
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'content', 'permalink', 'post_url', 'created_by', 'created_at',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image', 'og_image_url', 'tags',
            'tag_names'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'permalink']

    def get_post_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f"/posts/{obj.permalink}/")
        return f"{settings.SITE_URL}/posts/{obj.permalink}/"

    def get_created_by(self, obj):
        return obj.created_by.username

    def get_og_image_url(self, obj):
        request = self.context.get('request')
        if not obj.og_image:
            return ""
        return request.build_absolute_uri(obj.og_image.url) if request else f"{settings.SITE_URL}{obj.og_image.url}" or ""


    def _apply_tags(self, post, tag_names):
        """Attach tags by name, creating them if missing."""
        cleaned_names = []
        for raw in tag_names or []:
            name = (raw or "").strip()
            if not name:
                continue
            normalized = name.replace(" ", "-")
            normalized = re.sub(r"[^a-zA-Z0-9\-]", "", normalized)
            normalized = re.sub(r"-+", "-", normalized).lower()
            if not normalized:
                continue
            cleaned_names.append(normalized)

        for name in cleaned_names:
            tag, _ = Tag.objects.get_or_create(
                name=name, defaults={"slug": slugify(name)}
            )
            post.tags.add(tag)

    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', None) or []
        # Create the post normally
        post = Post.objects.create(**validated_data)

        # Attach tags after creation
        self._apply_tags(post, tag_names)
        
        # Parse the post content for inline images
        soup = BeautifulSoup(post.content, "html.parser")
        # Process image tags
        img_tags = soup.find_all("img")
        for img in img_tags:
            src = img.get("src")
            if src:
                filename = os.path.basename(src)
                # Find a UserMedia record with matching filename, media_category 'post', and not yet attached
                media = UserMedia.objects.filter(
                    file__icontains=filename,
                    post__isnull=True,
                    media_category='post'
                ).first()
                if media:
                    media.post = post  # Attach the media to this post
                    media.save()
                    
        # Process audio tags similarly
        audio_tags = soup.find_all("audio")
        for audio in audio_tags:
            src = audio.get("src")
            if src:
                filename = os.path.basename(src)
                media = UserMedia.objects.filter(
                    file__icontains=filename,
                    post__isnull=True,
                    media_category='post'
                ).first()
                if media:
                    media.post = post  # Attach the media to this post
                    media.save()
                    
        return post

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tag_names', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if tag_names is not None:
            instance.tags.clear()
            self._apply_tags(instance, tag_names)

        return instance
