# enrollment/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from .models import Enrollment
from courses.models import Course    
from lessons.serializers import LessonSerializer # Ensure these exist and work
from quizzes.serializers import QuizSerializer # Ensure these exist and work
from lessons.models import LessonCompletion 
import logging # Import logging

from .models import CollaborationSession, SessionStroke, SessionNote
from .models import ShareInvite


User = get_user_model()

class SimpleUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

logger = logging.getLogger(__name__) # Setup logger

class EnrollmentSerializer(serializers.ModelSerializer):
    course = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    # New: include any one-time share invite details when accessed via shared_token
    share_invite = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'user', 'content_type', 'object_id',
            'enrollment_date', 'status', 'enrollment_type',
            'course', 'progress', 'share_invite',  # include new field
        ]
        read_only_fields = ['enrollment_date', 'user', 'content_type', 'course', 'progress', 'share_invite']

    def get_share_invite(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        token = request.query_params.get('shared_token')
        if not token:
            return None
        try:
            invite = obj.invitations.get(token=token)
        except ShareInvite.DoesNotExist:
            return None
        return {
            'invited_by': invite.invited_by.username,
            'invited_at': invite.created_at,
        }

    def validate(self, attrs):
        user        = self.context['request'].user
        obj_id      = attrs.get('object_id')
        enroll_type = attrs.get('enrollment_type')
        if enroll_type != 'course':
            raise serializers.ValidationError("Only course enrollments are allowed via this endpoint.")
        try:
            course = Course.objects.get(pk=obj_id, is_draft=False)
        except Course.DoesNotExist:
            raise serializers.ValidationError("Invalid course ID.")
        course_ct = ContentType.objects.get_for_model(Course)
        if Enrollment.objects.filter(user=user, content_type=course_ct, object_id=course.id).exists():
            raise serializers.ValidationError("You’re already enrolled in this course.")
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
                    quizzes_qs = course_obj.quizzes.all()  
                    serialized_quizzes = QuizSerializer(
                        quizzes_qs, many=True,
                        context={'request': request}
                    ).data
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
    
class CollaborationSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollaborationSession
        fields = ['id', 'session_id', 'enrollment', 'created_at', 'ended_at']
        read_only_fields = ['id', 'created_at']

class SessionStrokeSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True, default=serializers.CurrentUserDefault())
    class Meta:
        model = SessionStroke
        fields = ['id', 'session', 'user', 'stroke_data', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

class SessionNoteSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True, default=serializers.CurrentUserDefault())
    class Meta:
        model = SessionNote
        fields = ['id', 'session', 'user', 'note', 'highlight_data', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
class ShareInviteSerializer(serializers.ModelSerializer):
    # WRITE: accept a PK
    invited_user = serializers.PrimaryKeyRelatedField(
      queryset=User.objects.all()
    )
    # READ: show the full user object at the same key
    invited_user = SimpleUserSerializer(read_only=False)
    invited_by   = SimpleUserSerializer(read_only=True)

    class Meta:
        model = ShareInvite
        fields = [
          'id','enrollment','invited_user','invited_by',
          'token','created_at'
        ]
        read_only_fields = ['id','invited_by','token','created_at']