# lessons/serializers.py
from django.conf import settings
from rest_framework import serializers
from .models import Lesson, LessonTemplate, LessonCompletion
from tags.models import Tag
from tags.serializers import TagSerializer
from subjects.models import Subject
from bs4 import BeautifulSoup
import os
import re
from user_media.models import UserMedia
from django.contrib.auth.models import User

from quizzes.models import Quiz
from quizzes.serializers import QuizSerializer

# NOTE: Ensure you have installed beautifulsoup4: pip install beautifulsoup4

# Lightweight quiz serializer for lesson detail view (avoids fetching all questions)
class LightweightQuizSerializer(serializers.ModelSerializer):
    """Minimal quiz data for lesson detail - no questions loaded"""
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'permalink', 'quiz_type', 'status']


class AttachedQuizSerializer(serializers.ModelSerializer):
    """Tiny payload for edit screen attach/detach lists."""
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'permalink', 'quiz_type', 'status',
            'lesson', 'course', 'subject', 'subject_name', 'created_by_username',
        ]
        read_only_fields = fields

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
    # Input field for tags (list of strings) - write only
    tag_names = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False,
        help_text="List of tag names."
    )
    # Output field for tags (full tag objects with slug)
    tags = TagSerializer(many=True, read_only=True)
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
    # Use lightweight serializer by default to avoid loading all quiz questions
    quizzes = serializers.SerializerMethodField(read_only=True)

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
            'tag_names',       # <-- write_only input field
            'tags',            # <-- read_only output field (full tag objects)
            'permalink', 'created_by', 'created_at', 'is_locked',
            'is_premium',      # Allow clients to mark lessons as premium or free.
            'status', 'published_at', 'position',  # Include position for proper ordering
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'quizzes',         # the quizzes already attached to *this* lesson
            'user_quizzes',    # all quizzes the user owns, regardless of attachment (ONLY in edit context)
        ]
        # Define fields not settable via API or derived
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at', 'is_locked',
            'subject_name', 'course_title', 'tags',
            'published_at'
         ]
        
    template_name = serializers.CharField(source='template_ref.name', read_only=True)

    def get_quizzes(self, lesson):
        """Return lightweight quiz data for lesson detail view"""
        request = self.context.get('request')
        is_edit_context = self.context.get('is_edit_context', False)
        
        # In edit context, return full quiz data with questions
        if is_edit_context:
            return AttachedQuizSerializer(lesson.quizzes.all(), many=True, context=self.context).data
        
        # In public view, return lightweight quiz data (no questions)
        return LightweightQuizSerializer(lesson.quizzes.all(), many=True).data

    def get_user_quizzes(self, lesson):
        request = self.context.get('request')
        # OPTIMIZATION: Only fetch user_quizzes in edit/admin context, not public view
        # Check if this is being called from an edit endpoint
        is_edit_context = self.context.get('is_edit_context', False)
        
        if not is_edit_context or not request or not request.user.is_authenticated:
            return []
        
        # pull every quiz the user created; the front‑end can then
        # look at each quiz's .lesson and .course to know what's free
        queryset = Quiz.objects.filter(created_by=request.user).only(
            'id', 'title', 'permalink', 'quiz_type', 'status',
            'lesson_id', 'course_id', 'subject_id', 'created_by_id'
        ).select_related('subject', 'created_by')
        return AttachedQuizSerializer(queryset, many=True, context=self.context).data
  
        # Add 'course' to read_only_fields if it shouldn't be set/changed via this serializer

    # --- Methods to get derived read-only fields ---
    def get_course_title(self, obj):
        return obj.course.title if obj.course else None

    def get_created_by(self, obj):
        return obj.created_by.username if obj.created_by else None

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

                        # Find UserMedia matching filename and NOT already linked
                        # We relax the category check to ensure we catch all relevant files
                        media_qs = UserMedia.objects.filter(
                            file__icontains=filename,
                            lesson__isnull=True # Only link unlinked media
                        )
                        
                        # If user is known, prefer their media, but allow admins to link any unlinked media
                        if user and not user.is_staff:
                            media_qs = media_qs.filter(user=user)
                            
                        media = media_qs.first()

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

            # If publishing a premium lesson, ensure any inline restricted blocks
            # reference the SAME premium course (or none) to prevent cross-course leaks.
            if is_premium and course:
                html = data.get('content', getattr(self.instance, 'content', ''))
                if html:
                    try:
                        doc = BeautifulSoup(html, 'html.parser')
                        mismatched = False
                        # Check permalink-based reference
                        for node in doc.select('[data-required-course-permalink]'):
                            if node.get('data-required-course-permalink') != getattr(course, 'permalink', None):
                                mismatched = True
                                break
                        # Check id-based reference
                        if not mismatched:
                            for node in doc.select('[data-required-course-id]'):
                                try:
                                    if int(node.get('data-required-course-id')) != getattr(course, 'id', None):
                                        mismatched = True
                                        break
                                except Exception:
                                    mismatched = True
                                    break
                        if mismatched:
                            raise serializers.ValidationError({
                                'content': 'Premium lessons can only include inline-restricted blocks that reference their own premium course while published. Use draft if cross-course previews are needed.'
                            })
                    except Exception:
                        # If parsing fails, do not block publishing silently
                        pass

        return data

    # --- create Method ---
    def create(self, validated_data):
        tag_names_data = validated_data.pop('tag_names', [])
        # Subject instance is already in validated_data['subject'] from PrimaryKeyRelatedField

        # created_by is set in the view's perform_create; do not override here
        request = self.context.get("request")
        user = request.user if request else None

        # Create the Lesson object
        lesson = Lesson.objects.create(**validated_data)

        # Attach tags with cleaning
        if tag_names_data:
             for tag_name in tag_names_data:
                 # Clean tag name: replace spaces with hyphens, remove special chars
                 cleaned = tag_name.strip().lower().replace(' ', '-')
                 cleaned = re.sub(r'[^\w-]', '', cleaned)  # Keep only alphanumeric and hyphens
                 cleaned = re.sub(r'-+', '-', cleaned).strip('-')  # Remove multiple/trailing hyphens
                 
                 if cleaned:  # Only create if not empty after cleaning
                     tag_instance, _ = Tag.objects.get_or_create(name=cleaned)
                     lesson.tags.add(tag_instance)

        # Process inline media after lesson is created
        self._process_lesson_media(lesson, lesson.content, user)

        return lesson

    # --- update Method ---
    # AFTER (Correct)
    def update(self, instance, validated_data):
        import logging
        logger = logging.getLogger(__name__)
        before = (instance.content or "")
        new_content = validated_data.get('content')
        logger.info("Lesson %s BEFORE len=%s", instance.id, len(before))
        tags_data = validated_data.pop('tags', None)

        if new_content is not None and new_content != instance.content:
            request = self.context.get("request")
            user = request.user if request else None
            self._process_lesson_media(instance, new_content, user)

        prev_status = instance.status
        print("DATA TO BE SAVED:", validated_data.keys()) 
        instance = super().update(instance, validated_data)
        
        # The refresh_from_db line is now gone.
        
        after = (instance.content or "")
        logger.info("Lesson %s AFTER  len=%s", instance.id, len(after))

        if prev_status != 'published' and instance.status == 'published' and not instance.published_at:
            from django.utils import timezone
            instance.published_at = timezone.now()
            instance.save(update_fields=['published_at'])

        tag_names_data = validated_data.get('tag_names')
        if tag_names_data is not None:
            instance.tags.clear()
            for tag_name in tag_names_data:
                # Clean tag name: replace spaces with hyphens, remove special chars
                cleaned = tag_name.strip().lower().replace(' ', '-')
                cleaned = re.sub(r'[^\w-]', '', cleaned)  # Keep only alphanumeric and hyphens
                cleaned = re.sub(r'-+', '-', cleaned).strip('-')  # Remove multiple/trailing hyphens
                
                if cleaned:  # Only create if not empty after cleaning
                    tag_instance, _ = Tag.objects.get_or_create(name=cleaned)
                    instance.tags.add(tag_instance)

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