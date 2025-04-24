# analytics/serializers.py
from rest_framework import serializers
from .models import ActivityEvent

class ActivityEventSerializer(serializers.ModelSerializer):
    quiz_title     = serializers.CharField(source='content_object.title', read_only=True)
    quiz_slug      = serializers.CharField(source='content_object.slug', read_only=True)
    quiz_permalink = serializers.CharField(source='content_object.permalink', read_only=True)

    class Meta:
      model = ActivityEvent
      fields = [
           'id','event_type','object_id','metadata','timestamp',
           'quiz_title','quiz_slug','quiz_permalink',
         ]