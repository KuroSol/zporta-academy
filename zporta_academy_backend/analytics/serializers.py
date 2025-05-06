# analytics/serializers.py
from rest_framework import serializers
from .models import ActivityEvent

class ActivityEventSerializer(serializers.ModelSerializer):
    quiz_title     = serializers.SerializerMethodField()
    quiz_slug      = serializers.SerializerMethodField()
    quiz_permalink = serializers.SerializerMethodField()

    class Meta:
      model = ActivityEvent
      fields = [
           'id','event_type','object_id','metadata','timestamp',
           'quiz_title','quiz_slug','quiz_permalink',
         ]

    def get_quiz_title(self, obj):
        return getattr(obj.content_object, 'title', None) if obj.content_object else None

    def get_quiz_slug(self, obj):
        return getattr(obj.content_object, 'slug', None) if obj.content_object else None

    def get_quiz_permalink(self, obj):
        if hasattr(obj.content_object, 'permalink'):
            return getattr(obj.content_object, 'permalink', None) 
        return None


# --- Serializer for individual attempt history ---
class AttemptHistorySerializer(serializers.Serializer):
    accuracy = serializers.FloatField()
    correct = serializers.IntegerField()
    total = serializers.IntegerField() 
    answered_count = serializers.IntegerField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True) 
    outcome_summary = serializers.CharField(allow_null=True, required=False)


# --- Updated Insight Serializer ---
# This serializer now expects 'last_attempt', 'correct', and 'wrong' keys 
# from the view, matching the error log and older structure for these specific fields.
class QuizRetentionInsightSerializer(serializers.Serializer):
    quiz_id          = serializers.IntegerField()
    quiz_title       = serializers.CharField(required=False, allow_null=True) 
    retention_days   = serializers.IntegerField()
    message          = serializers.CharField()
    last_attempt     = serializers.DateTimeField(allow_null=True, required=False) # Expects 'last_attempt'
    correct          = serializers.IntegerField(required=False)                  # Expects 'correct'
    wrong            = serializers.IntegerField(required=False)                  # Expects 'wrong'
    attempt_history  = AttemptHistorySerializer(many=True, read_only=True) 
