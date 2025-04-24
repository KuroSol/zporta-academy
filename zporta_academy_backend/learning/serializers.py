# learning/serializers.py
from rest_framework import serializers
from .models import LearningRecord
from courses.models import Course # Import Course
from lessons.models import Lesson # Import Lesson
from quizzes.models import Quiz   # Import Quiz
from subjects.models import Subject # Import Subject

# Keep existing serializer if used elsewhere, but it's not directly used in the new feed view
class LearningRecordSerializer(serializers.ModelSerializer):
    course_id    = serializers.IntegerField(source='enrollment.object_id', read_only=True)
    course_title = serializers.CharField(source='enrollment.content_object.title', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = LearningRecord
        fields = [
            'id',
            'enrollment',
            'course_id',
            'course_title',
            'subject_name',
            'started_at',
        ]
        read_only_fields = fields

# --- New Serializers for the Feed ---

class _BaseFeedItemSerializer(serializers.Serializer):
    """ Base class to ensure common structure """
    id = serializers.CharField() # Unique identifier for the feed item (e.g., "lesson-123", "quiz-45")
    type = serializers.CharField(read_only=True, source='*')
    timestamp = serializers.DateTimeField(required=False) # Optional: for sorting feed items

class _SimpleSubjectSerializer(serializers.ModelSerializer):
    """ Minimal subject info """
    class Meta:
        model = Subject
        fields = ['id', 'name']

class _SimpleCourseSerializer(serializers.ModelSerializer):
    """ Minimal course info needed for context """
    permalink = serializers.CharField(read_only=True) # Assuming permalink is a method or property
    subject = _SimpleSubjectSerializer(read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'permalink', 'subject']

class NextLessonFeedItemSerializer(_BaseFeedItemSerializer):
    """ Serializer for the 'next lesson to study' item """
    lesson_title = serializers.CharField(source='title')
    lesson_permalink = serializers.CharField(source='permalink') # Assuming permalink is on Lesson model
    course = _SimpleCourseSerializer(read_only=True)
    subject = _SimpleSubjectSerializer(source='course.subject') # Get subject via course

    def to_representation(self, instance):
        # instance here is expected to be a Lesson object
        representation = super().to_representation(instance)
        representation['id'] = f"lesson-{instance.id}"
        representation['type'] = "next_lesson"
        # Add lesson-specific fields
        representation['data'] = {
            'lesson_title': instance.title,
            'lesson_permalink': instance.permalink, # Make sure Lesson model has permalink property/field
            'course': _SimpleCourseSerializer(instance.course, context=self.context).data if instance.course else None,
            'subject': _SimpleSubjectSerializer(instance.course.subject, context=self.context).data if instance.course and instance.course.subject else None,
            
            # Add other relevant lesson details if needed
            # 'short_description': instance.short_description,
        }
        # give a short excerpt of the lesson content
        full_text = getattr(instance, 'content', '') or ''
        #representation['data']['excerpt'] = full_text[:100].strip() + ('…' if len(full_text) > 100 else '')
        representation['data']['excerpt'] = full_text.strip()

        # Set timestamp for potential sorting (e.g., course enrollment time or lesson creation time)
        # representation['timestamp'] = instance.course.enrollment_set.first().created_at # Example, adjust as needed
        return representation

class SuggestedLessonFeedItemSerializer(_BaseFeedItemSerializer):
    """ Serializer for a suggested lesson item """
    lesson_title = serializers.CharField(source='title')
    lesson_permalink = serializers.CharField(source='permalink')
    subject = _SimpleSubjectSerializer(read_only=True)
    short_description = serializers.CharField(required=False) # Optional description

    def to_representation(self, instance):
        # instance here is expected to be a Lesson object
        representation = super().to_representation(instance)
        representation['id'] = f"lesson-{instance.id}"
        representation['type'] = "suggested_lesson"
        representation['data'] = {
            'lesson_title': instance.title,
            'lesson_permalink': instance.permalink,
            'subject': _SimpleSubjectSerializer(instance.subject, context=self.context).data if instance.subject else None,
            'short_description': getattr(instance, 'short_description', None), # Safely get description
            'course_title': instance.course.title if instance.course else None, # Indicate if part of a course
            'course_permalink': instance.course.permalink if instance.course else None,
        }
        # give a short excerpt of the lesson content
        full_text = getattr(instance, 'content', '') or ''
        #representation['data']['excerpt'] = full_text[:100].strip() + ('…' if len(full_text) > 100 else '')
        representation['data']['excerpt'] = full_text.strip()

        # representation['timestamp'] = instance.created_at # Example timestamp
        return representation

class SuggestedQuizFeedItemSerializer(_BaseFeedItemSerializer):
    """ Serializer for a suggested quiz item """
    # Reuses the existing QuizSerializer logic but wraps it
    quiz_data = serializers.SerializerMethodField()

    def get_quiz_data(self, instance):
        # instance here is expected to be a Quiz object
        # Use the existing QuizSerializer or define fields directly
        # IMPORTANT: Ensure QuizSerializer includes 'permalink' or necessary fields to build it
        return QuizSerializer(instance, context=self.context).data

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['id'] = f"quiz-{instance.id}"
        representation['type'] = "suggested_quiz"
        representation['data'] = self.get_quiz_data(instance)
        # representation['timestamp'] = instance.created_at # Example timestamp
        return representation

# Optional: Serializer for Course Summary if you still want to include them
class CourseSummaryFeedItemSerializer(_BaseFeedItemSerializer):
    """ Serializer for an enrolled course summary (less emphasis) """
    # Reuses EnrollmentSerializer logic but wraps it
    enrollment_data = serializers.SerializerMethodField()

    def get_enrollment_data(self, instance):
        # instance here is expected to be an Enrollment object
        # Ensure EnrollmentSerializer provides necessary course details and progress
        from enrollment.serializers import EnrollmentSerializer # Avoid circular import
        return EnrollmentSerializer(instance, context=self.context).data

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Make sure the enrollment data contains a unique course ID
        course_id = self.get_enrollment_data(instance).get('course', {}).get('id', None)
        representation['id'] = f"enrolled-course-{course_id}" if course_id else f"enrollment-{instance.id}"
        representation['type'] = "enrolled_course_summary"
        representation['data'] = self.get_enrollment_data(instance)
        # representation['timestamp'] = instance.created_at # Example timestamp
        return representation
