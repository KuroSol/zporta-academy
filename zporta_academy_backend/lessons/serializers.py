# lessons/serializers.py
from django.conf import settings
from rest_framework import serializers
from .models import Lesson, LessonTemplate, LessonCompletion
from tags.models import Tag
from subjects.models import Subject
from bs4 import BeautifulSoup
import os
from user_media.models import UserMedia
from django.contrib.auth.models import User

from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer

# NOTE: Ensure you have installed beautifulsoup4: pip install beautifulsoup4

class SimpleLessonSerializerForCompletion(serializers.ModelSerializer):
    """ Minimal Lesson details needed for the history card """
    course_title = serializers.CharField(source='course.title', read_only=True, allow_null=True)
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'permalink', 'course_title'] # Add other fields if needed

class SimpleLessonCompletionSerializer(serializers.ModelSerializer):
    """ Serializer for the recent completions list """
    lesson = SimpleLessonSerializerForCompletion(read_only=True)
    lesson_title    = serializers.CharField(source="lesson.title")
    lesson_permalink = serializers.CharField(source="lesson.permalink")
    completed_at = serializers.DateTimeField(read_only=True)
    class Meta:
        model = LessonCompletion
        fields = ['id', 'lesson', 'completed_at', 'lesson_title', 'lesson_permalink'] # Include fields needed by frontend

class LessonSerializer(serializers.ModelSerializer):
    is_locked = serializers.BooleanField(read_only=True)
    # Flag indicating whether this lesson is premium.  If set to True,
    # the lesson must be attached to a premium course.
    is_premium = serializers.BooleanField(required=False)

    content_type = serializers.ChoiceField(
    choices=Lesson.CONTENT_TYPE_CHOICES,
    default='text',
    help_text="Type of this lesson: text or video."

    )
    # Input field for tags (list of strings)
    tags = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False,
        help_text="List of tag names."
    )
    # Output field for tags (list of strings)
    tags_output = serializers.SerializerMethodField(read_only=True)
    # Input/Output field for subject (handles ID)
    subject = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), allow_null=False, required=True
    )
    # Output field for subject name
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    # Output fields for course title and creator username
    course_title = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    course_data = serializers.SerializerMethodField()


    user_quizzes = serializers.SerializerMethodField(read_only=True)
    quizzes      = QuizSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'content', 'video_url', 'content_type',
            'template', 'accent_color', 'custom_css', 'custom_js', 'template_ref',
            'template_name', 
            'subject',         # Expects/returns Subject ID
            'subject_name',    # Read-only Subject Name
            'course', 'course_data',        # Course ID (read-only by default unless in writable fields)
            'course_title',    # Read-only Course Title
            'tags',            # <-- write_only input field (MUST be in fields)
            'tags_output',     # <-- read_only output field
            'permalink', 'created_by', 'created_at', 'is_locked',
            'is_premium',      # Allow clients to mark lessons as premium or free.
            'status', 'published_at',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'quizzes',         # the quizzes already attached to *this* lesson
            'user_quizzes',    # all quizzes the user owns, regardless of attachment
        ]
        # Define fields not settable via API or derived
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at', 'is_locked',
            'subject_name', 'course_title', 'tags_output',
            'published_at'
         ]
        
    template_name = serializers.CharField(source='template_ref.name', read_only=True)

    def get_user_quizzes(self, lesson):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return []
        # pull every quiz the user created; the front‑end can then
        # look at each quiz’s .lesson and .course to know what's free
        queryset = Quiz.objects.filter(created_by=request.user)
        return QuizSerializer(queryset, many=True, context=self.context).data
  
        # Add 'course' to read_only_fields if it shouldn't be set/changed via this serializer

    # --- Methods to get derived read-only fields ---
    def get_course_title(self, obj):
        return obj.course.title if obj.course else None

    def get_created_by(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_tags_output(self, instance):
        # Returns list of names for the 'tags_output' field
        return [tag.name for tag in instance.tags.all()]

    def get_course_data(self, obj):
        if obj.course:
            return {
                "title": obj.course.title,
                "permalink": obj.course.permalink
            }
        return None

    # --- Private helper for media processing ---
    def _process_lesson_media(self, lesson_instance, content_html, user):
        if not content_html or not user:
            return
        try:
            soup = BeautifulSoup(content_html, "html.parser")
            media_tags = soup.find_all(["img", "audio", "video"]) # Include video if needed
            linked_media_ids = set()

            for tag in media_tags:
                src = tag.get("src")
                if src:
                    try:
                        filename = os.path.basename(src.split('?')[0])
                        if not filename: continue # Skip if no filename

                        # Find UserMedia matching filename, category, user, and NOT already linked
                        media = UserMedia.objects.filter(
                            file__icontains=filename,
                            user=user,
                            media_category='lesson', # Match category used in CustomEditor
                            lesson__isnull=True # Only link unlinked media
                        ).first()

                        if media:
                            media.lesson = lesson_instance
                            media.save()
                            linked_media_ids.add(media.id)
                        else:
                            # Optional: If media is in content but NOT found/linkable, what to do?
                            # Maybe try finding already linked media to prevent unlinking later?
                             existing_media = UserMedia.objects.filter(file__icontains=filename, user=user, media_category='lesson', lesson=lesson_instance).first()
                             if existing_media:
                                 linked_media_ids.add(existing_media.id)

                    except Exception as e:
                        print(f"Error processing media src {src}: {e}")

            # --- Optional: Unlink media removed from content during UPDATE ---
            # This part only runs if lesson_instance already exists (i.e., during update)
            if lesson_instance.pk:
                media_to_unlink = UserMedia.objects.filter(lesson=lesson_instance).exclude(id__in=linked_media_ids)
                for media in media_to_unlink:
                    media.lesson = None
                    media.save()
                    print(f"Unlinked media {media.id} from lesson {lesson_instance.id}")
            # --- End Optional Unlink ---

        except Exception as e:
             print(f"Error processing media for lesson {lesson_instance.id}: {e}")

    def validate(self, data):
        """
        Enforce premium rules only when publishing.
        Premium drafts are allowed without a course.
        """
        # Determine the intended premium flag.  If not provided in the payload,
        # fall back to the instance value (for updates).
        is_premium = data.get('is_premium', getattr(self.instance, 'is_premium', False))
        # Determine the intended course.  For creation this will be in data;
        # for updates fall back to the current instance.
        course = data.get('course', getattr(self.instance, 'course', None))
        # Determine the intended status (if being changed).  Default to existing status or draft.
        if self.instance:
            current_status = self.instance.status
        else:
            current_status = Lesson.DRAFT
        status_value = data.get('status', current_status)

        # Only enforce when publishing:
        if status_value == Lesson.PUBLISHED:
            # Premium rule
            if is_premium and (not course or getattr(course, "course_type", None) != "premium"):
                raise serializers.ValidationError({
                    "status": "Premium lessons cannot be published unless attached to a premium course."
                })
            # Course must not be draft
            if course and getattr(course, "is_draft", False):
                raise serializers.ValidationError({
                    "status": "Cannot publish a lesson while its course is in draft. Publish the course first or save the lesson as draft."
                })

        return data

    # --- create Method ---
    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        # Subject instance is already in validated_data['subject'] from PrimaryKeyRelatedField

        # created_by is set in the view's perform_create; do not override here
        request = self.context.get("request")
        user = request.user if request else None

        # Create the Lesson object
        lesson = Lesson.objects.create(**validated_data)

        # Attach tags
        if tags_data:
             for tag_name in tags_data:
                 tag_instance, _ = Tag.objects.get_or_create(name=tag_name)
                 lesson.tags.add(tag_instance)

        # Process inline media after lesson is created
        self._process_lesson_media(lesson, lesson.content, user)

        return lesson

    # --- update Method ---
    def update(self, instance, validated_data):
        tags_data = validated_data.pop('tags', None)
        # Subject is handled by super().update() via PrimaryKeyRelatedField

        # Process media BEFORE calling super().update() if content is changing
        new_content = validated_data.get('content')
        if new_content is not None and new_content != instance.content:
             request = self.context.get("request")
             user = request.user if request else None
             self._process_lesson_media(instance, new_content, user) # Process linking/unlinking

        # Update standard fields (including subject via PrimaryKeyRelatedField)
        prev_status = instance.status
        instance = super().update(instance, validated_data)
        # auto-set published_at the first time it becomes published
        if prev_status != 'published' and instance.status == 'published' and not instance.published_at:
            from django.utils import timezone
            instance.published_at = timezone.now()
            instance.save(update_fields=['published_at'])

        # Handle tags update (clear existing, add new)
        if tags_data is not None: # Check if tags were actually passed in request
            instance.tags.clear()
            for tag_name in tags_data:
                tag_instance, _ = Tag.objects.get_or_create(name=tag_name)
                instance.tags.add(tag_instance)
        # No explicit instance.save() needed just for M2M

        return instance
    
    def validate_custom_js(self, value):
        if not value:
            return value
        lowered = value.lower()
        # Disallow ANY <script> wrapper; store plain JS only
        if "<script" in lowered:
            raise serializers.ValidationError("Remove <script> tags. Paste plain JS only.")
        return value.strip()
        
class LessonTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonTemplate
        fields = ['id', 'name', 'description', 'accent_color', 'predefined_css']