# users/activity_serializers.py
"""
Serializers for user activity and progress tracking.
"""
from rest_framework import serializers
from .activity_models import UserActivity


class QuizItemSerializer(serializers.Serializer):
    """Serializer for quiz question items in learning score"""
    quiz_id = serializers.IntegerField(allow_null=True)
    quiz_title = serializers.CharField()
    quiz_permalink = serializers.CharField(allow_null=True, required=False)
    question_id = serializers.IntegerField()
    question_text = serializers.CharField()
    subject = serializers.CharField(allow_null=True, required=False)
    answered_at = serializers.DateTimeField(allow_null=True, required=False)
    points = serializers.IntegerField()


class LessonItemSerializer(serializers.Serializer):
    """Serializer for lesson items in learning score"""
    course_id = serializers.IntegerField(allow_null=True)
    course_title = serializers.CharField(allow_null=True)
    lesson_id = serializers.IntegerField()
    lesson_title = serializers.CharField()
    lesson_permalink = serializers.CharField()
    subject = serializers.CharField(allow_null=True, required=False)
    completed_at = serializers.DateTimeField(allow_null=True, required=False)
    points = serializers.IntegerField()


class CourseItemSerializer(serializers.Serializer):
    """Serializer for course enrollment items in learning score"""
    course_id = serializers.IntegerField()
    course_title = serializers.CharField()
    course_permalink = serializers.CharField()
    subject = serializers.CharField(allow_null=True, required=False)
    is_free = serializers.BooleanField()
    is_premium = serializers.BooleanField()
    points = serializers.IntegerField()


class LearningScoreSerializer(serializers.Serializer):
    """Serializer for learning score response"""
    total_score = serializers.IntegerField()
    quiz_items = QuizItemSerializer(many=True)
    lesson_items = LessonItemSerializer(many=True)
    course_items = CourseItemSerializer(many=True)
    breakdown = serializers.DictField()


class ImpactCourseItemSerializer(serializers.Serializer):
    """Serializer for course enrollment items in impact score"""
    course_id = serializers.IntegerField()
    course_title = serializers.CharField()
    course_permalink = serializers.CharField(allow_null=True, required=False)
    subject = serializers.CharField(allow_null=True, required=False)
    student_name = serializers.CharField()
    enrolled_at = serializers.DateTimeField(allow_null=True, required=False)
    is_free = serializers.BooleanField()
    is_premium = serializers.BooleanField()
    points = serializers.IntegerField()


class ImpactQuizItemSerializer(serializers.Serializer):
    """Serializer for quiz question items in impact score"""
    quiz_id = serializers.IntegerField()
    quiz_title = serializers.CharField()
    quiz_permalink = serializers.CharField(allow_null=True, required=False)
    question_id = serializers.IntegerField()
    question_text = serializers.CharField()
    subject = serializers.CharField(allow_null=True, required=False)
    student_name = serializers.CharField()
    answered_at = serializers.DateTimeField(allow_null=True, required=False)
    points = serializers.IntegerField()


class ImpactScoreSerializer(serializers.Serializer):
    """Serializer for impact score response"""
    total_score = serializers.IntegerField()
    course_items = ImpactCourseItemSerializer(many=True)
    quiz_items = ImpactQuizItemSerializer(many=True)
    breakdown = serializers.DictField()


class UserActivitySerializer(serializers.ModelSerializer):
    """Serializer for UserActivity model with content details"""
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    content_title = serializers.SerializerMethodField()
    content_link = serializers.SerializerMethodField()
    
    class Meta:
        model = UserActivity
        fields = [
            'id',
            'user',
            'role',
            'role_display',
            'activity_type',
            'activity_type_display',
            'points',
            'metadata',
            'created_at',
            'content_title',
            'content_link',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_content_title(self, obj):
        """Extract content title from metadata or content_object"""
        if obj.metadata:
            # Try to get title from metadata
            for key in ['lesson_title', 'quiz_title', 'course_title']:
                if key in obj.metadata:
                    return obj.metadata[key]
        
        # Fallback to content_object if available
        if obj.content_object:
            return getattr(obj.content_object, 'title', str(obj.content_object))
        
        return None
    
    def get_content_link(self, obj):
        """Generate appropriate link based on content type"""
        md = obj.metadata or {}

        # Prefer slug-based permalinks for stable front-end routes
        if 'lesson_permalink' in md and md['lesson_permalink']:
            return f"/lessons/{md['lesson_permalink']}"
        if 'course_permalink' in md and md['course_permalink']:
            return f"/courses/{md['course_permalink']}"
        if 'quiz_permalink' in md and md['quiz_permalink']:
            return f"/quizzes/{md['quiz_permalink']}"

        # Fallback to content_object.permalink when available
        target = getattr(obj, 'content_object', None)
        if target and hasattr(target, 'permalink') and getattr(target, 'permalink'):
            model_name = target.__class__.__name__.lower()
            if model_name == 'lesson':
                return f"/lessons/{target.permalink}"
            if model_name == 'course':
                return f"/courses/{target.permalink}"
            if model_name == 'quiz':
                return f"/quizzes/{target.permalink}"

        # Final coarse fallback (ID-based) if nothing else exists
        if 'lesson_id' in md and not md.get('course_id') and md.get('lesson_id'):
            # Standalone lesson without course
            # No stable route without permalink; return None
            return None
        if 'quiz_id' in md and md.get('quiz_id'):
            return f"/quizzes/{md['quiz_id']}"
        if 'course_id' in md and md.get('course_id'):
            return f"/courses/{md['course_id']}"

        return None


class ProgressOverviewSerializer(serializers.Serializer):
    """Serializer for progress overview response"""
    # Student fields
    learning_score = serializers.IntegerField(required=False)
    total_points_30d_student = serializers.IntegerField(required=False)
    all_time_points_student = serializers.IntegerField(required=False)
    breakdown_by_activity_type_student = serializers.DictField(required=False)
    daily_points_last_30d_student = serializers.ListField(required=False)
    
    # Teacher fields
    impact_score = serializers.IntegerField(required=False)
    total_points_30d_teacher = serializers.IntegerField(required=False)
    all_time_points_teacher = serializers.IntegerField(required=False)
    breakdown_by_activity_type_teacher = serializers.DictField(required=False)
    daily_points_last_30d_teacher = serializers.ListField(required=False)

    # Extended metrics & help sections
    total_quizzes_answered = serializers.IntegerField(required=False)
    total_lessons_completed = serializers.IntegerField(required=False)
    total_courses_completed = serializers.IntegerField(required=False)
    total_courses_enrolled = serializers.IntegerField(required=False)
    recent_lessons = serializers.ListField(child=serializers.DictField(), required=False)
    recent_courses = serializers.ListField(child=serializers.DictField(), required=False)
    learning_streak_days = serializers.IntegerField(required=False)
    
    # Detailed activity lists for students
    lesson_completions_detail = serializers.ListField(child=serializers.DictField(), required=False)
    course_completions_detail = serializers.ListField(child=serializers.DictField(), required=False)
    courses_enrolled_detail = serializers.ListField(child=serializers.DictField(), required=False)
    recent_correct_answers = serializers.ListField(child=serializers.DictField(), required=False)
    quizzes_taken_detail = serializers.ListField(child=serializers.DictField(), required=False)
    
    total_teacher_quiz_engagements = serializers.IntegerField(required=False)
    total_enrollments_free = serializers.IntegerField(required=False)
    total_enrollments_premium = serializers.IntegerField(required=False)
    total_standalone_lessons = serializers.IntegerField(required=False)
    impact_streak_days = serializers.IntegerField(required=False)
    
    # Detailed activity lists for teachers (impact)
    enrollments_detail = serializers.ListField(child=serializers.DictField(), required=False)
    quiz_first_attempts_detail = serializers.ListField(child=serializers.DictField(), required=False)
    
    score_help = serializers.DictField(required=False)
    activity_help = serializers.DictField(required=False)
    # Login / study time analytics
    total_login_minutes_7d = serializers.FloatField(required=False)
    average_login_minutes_per_day_7d = serializers.FloatField(required=False)
    login_daily_minutes = serializers.ListField(child=serializers.DictField(), required=False)
    login_goal_weekly_minutes = serializers.IntegerField(required=False)
    login_goal_progress_percent = serializers.IntegerField(required=False)
