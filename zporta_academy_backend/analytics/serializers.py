# analytics/serializers.py
from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType 
from django.contrib.auth import get_user_model

from .models import ActivityEvent, MemoryStat

User = get_user_model()

# Attempt to import Quizzes models for richer learnable_item display
try:
    from quizzes.models import Question as QuizzesQuestion, Quiz as QuizzesQuiz
    QUIZZES_APP_AVAILABLE = True
except ImportError:
    QuizzesQuestion = None
    QuizzesQuiz = None
    QUIZZES_APP_AVAILABLE = False

# --- Serializer for individual question stats within DetailedQuizAnalyticsSerializer ---
class QuestionAnalyticsSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    question_text = serializers.CharField(read_only=True, required=False)
    times_answered = serializers.IntegerField()
    distinct_users_answered = serializers.IntegerField(required=False) 
    times_correct = serializers.IntegerField()
    times_wrong = serializers.IntegerField()
    percentage_correct = serializers.FloatField()
    percentage_wrong = serializers.FloatField()

# --- Serializer for DetailedQuizAnalyticsView ---
class DetailedQuizAnalyticsSerializer(serializers.Serializer):
    quiz_id = serializers.IntegerField()
    quiz_title = serializers.CharField(read_only=True, required=False)
    unique_participants = serializers.IntegerField()
    unique_finishers = serializers.IntegerField(required=False, allow_null=True)
    total_answers_submitted_for_quiz = serializers.IntegerField()
    total_correct_answers_for_quiz = serializers.IntegerField()
    total_wrong_answers_for_quiz = serializers.IntegerField()
    overall_correctness_percentage = serializers.FloatField()
    overall_wrongness_percentage = serializers.FloatField()
    questions_stats = QuestionAnalyticsSerializer(many=True)


# --- ActivityEvent Serializer ---
class ActivityEventSerializer(serializers.ModelSerializer):
    user = serializers.IntegerField(source='user_id', read_only=True, allow_null=True) # Output user_id as 'user'
    content_type = serializers.IntegerField(source='content_type_id', read_only=True, allow_null=True) # Output content_type_id as 'content_type'

    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    content_object_display = serializers.SerializerMethodField()

    class Meta:
        model = ActivityEvent
        fields = [
            'id', 
            'user', # Will be user_id
            'user_username', 
            'event_type', 'event_type_display',
            'content_type', # Will be content_type_id
            'object_id', 
            'content_object_display', 
            'metadata', 'timestamp',
        ]
        read_only_fields = ['id', 'user_username', 'event_type_display', 'content_object_display', 'timestamp']
        # extra_kwargs for 'user' and 'content_type' are implicitly handled by the field definitions above.

    def get_content_object_display(self, obj):
        # This method relies on obj.content_type being a ContentType object.
        # If obj.content_type is an ID due to the change above, this might need adjustment
        # or ensure that content_type object is still accessible via the instance.
        # However, the 'content_type' field in Meta.fields is now an ID.
        # For this method to work, obj.content_type (the model field) must still be the object.
        # The change above only affects serialization output.
        if obj.content_object: # This resolves the GFK
            actual_content_type = ContentType.objects.get_for_model(obj.content_object)
            model_name = actual_content_type.model.capitalize()
            if hasattr(obj.content_object, 'title'):
                return f"{model_name}: {str(obj.content_object.title)[:70]}"
            if hasattr(obj.content_object, 'question_text'): 
                return f"Question: {str(obj.content_object.question_text)[:70]}..."
            if hasattr(obj.content_object, 'name'):
                return f"{model_name}: {str(obj.content_object.name)[:70]}"
            return f"{model_name} ID: {obj.object_id}"
        elif obj.content_type_id and obj.object_id: # Use content_type_id if content_type object isn't loaded
            try:
                ct = ContentType.objects.get_for_id(obj.content_type_id)
                return f"{ct.model.capitalize()} ID: {obj.object_id} (Instance not loaded for display)"
            except ContentType.DoesNotExist:
                 return f"Unknown Type (ID: {obj.content_type_id}) ID: {obj.object_id}"
        return None

# --- MemoryStat Serializer ---
class LearnableItemDisplayField(serializers.RelatedField):
    # This field should receive the actual learnable_item object.
    def to_representation(self, value):
        if value is None:
            return "N/A (Item not found)"
        if QUIZZES_APP_AVAILABLE:
            if QuizzesQuestion and isinstance(value, QuizzesQuestion):
                return f"Question: \"{str(value.question_text)[:60]}...\" (ID: {value.id})"
            elif QuizzesQuiz and isinstance(value, QuizzesQuiz):
                return f"Quiz: \"{value.title}\" (ID: {value.id})"
        if hasattr(value, 'title'):
            return f"{value.__class__.__name__}: \"{value.title}\" (ID: {value.id})"
        return f"{value.__class__.__name__} ID: {value.id}"

class MemoryStatSerializer(serializers.ModelSerializer):
    # Output the IDs for 'user' and 'content_type' fields in the JSON
    user = serializers.IntegerField(source='user_id', read_only=True)
    content_type = serializers.IntegerField(source='content_type_id', read_only=True)

    # These fields rely on the related objects being accessible (e.g., via select_related in view)
    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True) 
    content_type_name = serializers.CharField(source='content_type.model', read_only=True) 
    learnable_item_info = serializers.SerializerMethodField() 

    class Meta:
        model = MemoryStat
        fields = [
            'id', 
            'user', # Serialized as user_id
            'user_username', 
            'content_type', # Serialized as content_type_id
            'content_type_name', 
            'object_id', 
            'learnable_item_info', 
            'interval_days', 'easiness_factor', 'repetitions',
            'last_reviewed_at', 'next_review_at',
            'current_retention_estimate',
            'last_quality_of_recall', 'last_time_spent_ms',
            'created_at', 'updated_at'
        ]
        # Most fields are effectively read-only due to how they are defined or sourced.
        # Explicitly listing them here is for clarity or if some were writable.
        read_only_fields = (
            'id', 'user_username', 'learnable_item_info', 'content_type_name',
            'created_at', 'updated_at', 'last_quality_of_recall', 'last_time_spent_ms',
            'current_retention_estimate', 'next_review_at', 'interval_days', 
            'easiness_factor', 'repetitions', 'last_reviewed_at'
        )

    def get_learnable_item_info(self, obj):
        item_display_string = "N/A"
        item_title = None
        
        # obj.content_type should be a ContentType object here for .model to work
        item_class_name = obj.content_type.model if obj.content_type and isinstance(obj.content_type, ContentType) else "Unknown"

        # obj.learnable_item should be pre_fetched by the view if possible
        # This is the actual related object (e.g., a Question instance)
        actual_item = obj.learnable_item 
        if actual_item: 
            instance = actual_item # Use the resolved GFK object
            if hasattr(instance, 'title') and instance.title:
                item_title = instance.title
                item_display_string = f"{item_class_name.capitalize()}: {item_title}"
            elif hasattr(instance, 'question_text') and instance.question_text: 
                item_title = str(instance.question_text)[:100] + "..." if len(str(instance.question_text)) > 100 else str(instance.question_text)
                item_display_string = f"Question: {item_title}"
            else:
                item_display_string = f"{item_class_name.capitalize()} ID: {obj.object_id}"
        elif obj.content_type_id and obj.object_id: # Fallback if GFK object not loaded
             # Try to get model name from content_type_id if content_type object isn't loaded
             try:
                ct_obj_for_name = ContentType.objects.get_for_id(obj.content_type_id)
                item_class_name = ct_obj_for_name.model.capitalize()
             except ContentType.DoesNotExist:
                item_class_name = "UnknownType"
             item_display_string = f"{item_class_name} ID: {obj.object_id} (Instance not loaded)"

        return {
            "type": item_class_name,
            "id": obj.object_id,
            "display_text": item_display_string,
            "title": item_title 
        }

# --- Serializer for Quiz-Specific Retention Insights ---
class QuizRetentionInsightSerializer(serializers.Serializer):
    quiz_id = serializers.IntegerField()
    quiz_title = serializers.CharField(required=False, allow_null=True)
    retention_days = serializers.IntegerField(help_text="Estimated days until the next ideal review for the whole quiz.")
    message = serializers.CharField(help_text="User-friendly message about quiz review status.")
    last_attempt_timestamp = serializers.DateTimeField(allow_null=True, required=False, help_text="Timestamp of the user's last attempt/interaction with this quiz.")
    current_quiz_retention_estimate = serializers.FloatField(allow_null=True, required=False, help_text="Overall retention estimate for the quiz if available.")

# --- Serializer for User Memory Profile View (More Detailed) ---
class UserMemoryProfileItemSerializer(MemoryStatSerializer):
    class Meta(MemoryStatSerializer.Meta): 
        pass 

class UserMemoryProfileResponseSerializer(serializers.Serializer):
    items_to_review = UserMemoryProfileItemSerializer(many=True)
    strong_memory_items = UserMemoryProfileItemSerializer(many=True)
    upcoming_review_items = UserMemoryProfileItemSerializer(many=True, help_text="Items scheduled for review in the near future but not yet due.")
    message = serializers.CharField()
    summary = serializers.DictField(help_text="Overall summary like total items tracked, average retention, etc.")

class QuizAttemptOverviewSerializer(serializers.Serializer):
    total_quizzes   = serializers.IntegerField()
    total_correct   = serializers.IntegerField()
    total_mistakes  = serializers.IntegerField()
    quizzes_fixed   = serializers.IntegerField()
    never_fixed     = serializers.IntegerField()
    filters         = serializers.DictField(child=serializers.ListField(), read_only=True)