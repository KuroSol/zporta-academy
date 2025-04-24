# enrollment/serializers.py
from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import Enrollment
from courses.models import Course    
from lessons.serializers import LessonSerializer # Ensure these exist and work
from quizzes.serializers import QuizSerializer # Ensure these exist and work
from lessons.models import LessonCompletion 
import logging # Import logging


logger = logging.getLogger(__name__) # Setup logger

class EnrollmentSerializer(serializers.ModelSerializer):
    course = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id',
            'user', # Consider making 'user' read_only or removing if not needed in response
            'content_type', # Often only needed internally, maybe remove from fields?
            'object_id',    # Often only needed internally, maybe remove from fields?
            'enrollment_date',
            'status',
            'enrollment_type',
            'course',      # This is the detailed object from get_course
            'progress'
        ]
        # Added user and potentially content_type/object_id here
        read_only_fields = ['enrollment_date', 'user', 'content_type', 'course', 'progress']

    def validate(self, attrs):
        user        = self.context['request'].user
        obj_id      = attrs.get('object_id')
        enroll_type = attrs.get('enrollment_type')

        # Only support course enrollments here
        if enroll_type != 'course':
            raise serializers.ValidationError("Only course enrollments are allowed via this endpoint.")

        # 1) Check the course exists and is published
        try:
            course = Course.objects.get(pk=obj_id, is_draft=False)
        except Course.DoesNotExist:
            raise serializers.ValidationError("Invalid course ID.")

        # 2) Prevent duplicates
        course_ct = ContentType.objects.get_for_model(Course)
        if Enrollment.objects.filter(
                user=user,
                content_type=course_ct,
                object_id=course.id
        ).exists():
            raise serializers.ValidationError("You’re already enrolled in this course.")

        # scrub the incoming content_type so nobody can fake another model
        attrs['content_type'] = course_ct
        return attrs

    def get_course(self, obj):
        # Only process if it's a course enrollment and the object exists
        if obj.enrollment_type == 'course' and obj.content_object:
            course_obj = obj.content_object
            cover = getattr(course_obj, 'cover_image', None)
            request = self.context.get('request')
            cover_url = None
            if cover and hasattr(cover, 'url') and request:
                 try:
                     cover_url = request.build_absolute_uri(cover.url)
                 except ValueError: # Handle cases where URL might be invalid
                     cover_url = None # Or some default image URL
            elif cover and hasattr(cover, 'url'): # Fallback if no request
                 cover_url = cover.url


            subject_data = None
            if hasattr(course_obj, 'subject') and course_obj.subject:
                subject_data = {
                    'id': course_obj.subject.id,
                    'name': course_obj.subject.name
                }

            # Safely get related lessons/quizzes
            serialized_lessons = []
            if hasattr(course_obj, 'lessons'):
                try:
                    lessons = course_obj.lessons.all()
                    serialized_lessons = LessonSerializer(lessons, many=True, context={'request': request}).data
                except Exception as e:
                    logger.error(f"Error serializing lessons for course {course_obj.id}: {e}")


            serialized_quizzes = []
            if hasattr(course_obj, 'quizzes'):
                 try:
                     quizzes = course_obj.quizzes.all()
                     serialized_quizzes = QuizSerializer(quizzes, many=True, context={'request': request}).data
                 except Exception as e:
                     logger.error(f"Error serializing quizzes for course {course_obj.id}: {e}")


            return {
                # Use getattr for safety in case fields don't exist on the model instance
                'id': getattr(course_obj, 'id', None), # Good practice to include ID
                'title': getattr(course_obj, 'title', 'Untitled Course'),
                'description': getattr(course_obj, 'description', ''),
                'permalink': getattr(course_obj, 'permalink', ''),
                'cover_image': cover_url,
                'subject': subject_data,
                'lessons': serialized_lessons,
                'quizzes': serialized_quizzes,
            }
        # Removed the duplicated elif block
        return None # Return None if not a course enrollment or object missing

    def get_progress(self, obj):
        if obj.enrollment_type == 'course' and obj.content_object:
            course = obj.content_object
            total_lessons = 0
            if hasattr(course, 'lessons'):
                 try:
                    total_lessons = course.lessons.count()
                 except Exception as e:
                    logger.error(f"Error counting lessons for course {course.id}: {e}")
                    return 0 # Return 0 if lessons can't be counted

            if total_lessons == 0:
                return 100 # Or 0? Decide what progress means if there are no lessons. Let's say 100% complete if 0 lessons.

            try:
                # Make sure this model and filter are correct for your lesson completion tracking
                from lessons.models import LessonCompletion # Ensure this import is valid
                completed_lessons = LessonCompletion.objects.filter(
                    user=obj.user,
                    lesson__course=course,
                    completed_at__isnull=False  # Check if completed_at timestamp is set
                ).count()
                progress = int((completed_lessons / total_lessons) * 100)
                return progress
            except ImportError:
                 logger.error("Could not import LessonCompletion model. Progress calculation skipped.")
                 return None # Or 0
            except Exception as e:
                # Log the specific error
                logger.error(f"Error calculating progress for enrollment {obj.id}: {e}")
                return 0 # Return 0 on error
        return None # Return None if not applicable