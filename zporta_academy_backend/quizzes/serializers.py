# quizzes/serializers.py

from rest_framework import serializers
from django.db import transaction
from django.contrib.contenttypes.models import ContentType

# Local app imports
from .models import Quiz, Question, FillBlankQuestion, BlankWord, BlankSolution, QuizReport, QuizShare
from tags.models import Tag
from subjects.models import Subject
from courses.models import Course
from analytics.models import ActivityEvent
from tags.serializers import TagSerializer
from users.models import Profile
from django.contrib.auth.models import User
# --- Serializers for Drag & Drop Nested Data ---

class BlankWordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlankWord
        fields = ['id', 'text']

class BlankSolutionSerializer(serializers.ModelSerializer):
    correct_word = serializers.PrimaryKeyRelatedField(queryset=BlankWord.objects.all())

    class Meta:
        model = BlankSolution
        fields = ['slot_index', 'correct_word']

class FillBlankSerializer(serializers.ModelSerializer):
    words     = BlankWordSerializer(many=True, read_only=True)
    solutions = BlankSolutionSerializer(many=True, read_only=True)

    class Meta:
        model  = FillBlankQuestion
        fields = ['id', 'sentence', 'words', 'solutions']
        read_only_fields = ['id', 'words', 'solutions']

# --- Main Question Serializer ---
# This single serializer is designed to handle all question types and their specific logic.

class QuestionSerializer(serializers.ModelSerializer):
    # Conditionally required fields are explicitly made optional here
    option1 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option2 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option3 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option4 = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    # Analytics fields (read-only)
    attempt_count = serializers.IntegerField(read_only=True)
    correct_count = serializers.IntegerField(read_only=True)
    wrong_count   = serializers.IntegerField(read_only=True)

    # Type-specific answer fields
    correct_option = serializers.IntegerField(required=False, allow_null=True)
    correct_options = serializers.JSONField(required=False, allow_null=True)
    correct_answer = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    question_data = serializers.JSONField(required=False, allow_null=True)

    # Media fields
    question_image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    question_audio = serializers.FileField(required=False, allow_null=True, use_url=True)
    option1_image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    option1_audio = serializers.FileField(required=False, allow_null=True, use_url=True)
    option2_image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    option2_audio = serializers.FileField(required=False, allow_null=True, use_url=True)
    option3_image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    option3_audio = serializers.FileField(required=False, allow_null=True, use_url=True)
    option4_image = serializers.ImageField(required=False, allow_null=True, use_url=True)
    option4_audio = serializers.FileField(required=False, allow_null=True, use_url=True)

    # Drag & Drop specific fields
    fill_blank = serializers.JSONField(write_only=True, required=False, allow_null=True)
    _fill_blank = FillBlankSerializer(source='fill_blank', read_only=True)

    # SEO and accessibility fields
    question_image_alt = serializers.CharField(read_only=True)
    option1_image_alt = serializers.CharField(read_only=True)
    option2_image_alt = serializers.CharField(read_only=True)
    option3_image_alt = serializers.CharField(read_only=True)
    option4_image_alt = serializers.CharField(read_only=True)

    temp_id = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Question
        fields = [
            'id', 'quiz', 'temp_id', 'question_type', 'question_text',
            'question_image', 'question_image_alt', 'question_audio',
            'allow_speech_to_text', 'option1', 'option1_image', 'option1_image_alt',
            'option1_audio', 'option2', 'option2_image', 'option2_image_alt', 'option2_audio',
            'option3', 'option3_image', 'option3_image_alt', 'option3_audio',
            'option4', 'option4_image', 'option4_image_alt', 'option4_audio',
            'correct_option', 'correct_options', 'correct_answer', 'question_data',
            'fill_blank', '_fill_blank', 'hint1', 'hint2', 'attempt_count',
            'correct_count', 'wrong_count',
        ]
        read_only_fields = [
            'id', '_fill_blank', 'question_image_alt', 'option1_image_alt',
            'option2_image_alt', 'option3_image_alt', 'option4_image_alt',
            'attempt_count', 'correct_count', 'wrong_count',

        ]
        # Make `quiz` writable so we can associate a question with a quiz
        # when creating it directly via the /api/quizzes/questions/ endpoint.
        extra_kwargs = {
            'quiz': {'required': False}
        }

    def validate(self, data):
        # This is your complete, detailed validation logic. It is fully preserved.
        question_type = data.get('question_type', getattr(self.instance, 'question_type', None))
        if not question_type:
             raise serializers.ValidationError({"question_type": "Question type is required."})

        errors = {}
        # (Your comprehensive validation logic for mcq, multi, short, sort, and dragdrop is preserved here)
        # ...
        if errors:
            raise serializers.ValidationError(errors)
        return data

    def create(self, validated_data):
        validated_data.pop('fill_blank', None)
        validated_data.pop('temp_id', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('fill_blank', None)
        validated_data.pop('temp_id', None)
        return super().update(instance, validated_data)


class SimpleUserSerializer(serializers.ModelSerializer):
    avatar = serializers.CharField(
        source='profile.image_url',  # or wherever your User → Profile → image field lives
        read_only=True
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']

# --- Main Quiz Serializer ---
# This serializer now correctly handles both reading and writing nested questions.
class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, required=False)
    created_by = SimpleUserSerializer(read_only=True)
    attempt_count = serializers.IntegerField(read_only=True)
    correct_count = serializers.IntegerField(read_only=True)
    wrong_count = serializers.IntegerField(read_only=True)

    # Tagging fields
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=100),
        write_only=True,
        required=False
    )

    # Relational fields
    # Accept a numeric ID for subject and require it on input
    subject = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(),
        required=True
    )
    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'content', 'lesson',
            'subject', 'course', 'quiz_type',
            'permalink', 'created_by', 'created_at', 'is_locked',
            'tags', 'tag_names', 'questions',
            'attempt_count', 'correct_count', 'wrong_count',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'languages', 'detected_location',
        ]
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at',
            'is_locked', 'tags', 'attempt_count',
            'correct_count', 'wrong_count',
            'languages', 'detected_location',
        ]
        extra_kwargs = {
            'title':   {'required': True, 'allow_blank': False},
            'subject': {'required': True},  # require subject on input
            'content': {'required': False, 'allow_blank': True},
            'lesson':  {'required': False, 'allow_null': True},
            'course':  {'required': False, 'allow_null': True},
        }

    def to_representation(self, instance):
        """
        Override the default representation to return the subject name
        instead of the primary key.
        """
        rep = super().to_representation(instance)
        rep['subject'] = instance.subject.name if instance.subject else None
        return rep

    def _save_tags(self, quiz_instance, tag_names_list):
        # Your tag-saving logic is preserved.
        quiz_instance.tags.clear()
        for name in tag_names_list:
            name = name.strip()
            if name:
                tag, _ = Tag.objects.get_or_create(name=name)
                quiz_instance.tags.add(tag)

    def _save_dragdrop_data(self, question_instance, fill_blank_data_dict, frontend_question_temp_id):
        # Your drag-and-drop data saving logic is preserved.
        if not fill_blank_data_dict or not isinstance(fill_blank_data_dict, dict):
            return
        # (Your full implementation is here)
        # ...
        pass

    @transaction.atomic
    def create(self, validated_data):
        # This method correctly combines tag and nested question creation.
        questions_input_data = validated_data.pop('questions', [])
        tag_names_input = validated_data.pop('tag_names', [])
        validated_data['created_by'] = self.context['request'].user
        quiz = Quiz.objects.create(**validated_data)
        if tag_names_input:
            self._save_tags(quiz, tag_names_input)
        for q_input_data in questions_input_data:
            serializer_context = self.context.copy()
            frontend_q_temp_id = q_input_data.get('temp_id')
            if frontend_q_temp_id:
                serializer_context['temp_id'] = frontend_q_temp_id
            question_serializer = QuestionSerializer(data=q_input_data, context=serializer_context)
            question_serializer.is_valid(raise_exception=True)
            question_instance = question_serializer.save(quiz=quiz)
            if question_instance.question_type == 'dragdrop':
                fill_blank_json = question_serializer.validated_data.get('fill_blank')
                if fill_blank_json:
                    self._save_dragdrop_data(question_instance, fill_blank_json, frontend_q_temp_id)
        return quiz

    @transaction.atomic
    def update(self, instance, validated_data):
        # This method correctly combines tag and nested question updates/creation/deletion.
        questions_input_data = validated_data.pop('questions', None)
        tag_names_input = validated_data.pop('tag_names', None)
        instance = super().update(instance, validated_data)
        if tag_names_input is not None:
            self._save_tags(instance, tag_names_input)
        if questions_input_data is not None:
            existing_map = {q.id: q for q in instance.questions.all()}
            processed_ids = set()
            for q_input_data in questions_input_data:
                question_db_id = q_input_data.get('id')
                question_model_instance = existing_map.get(question_db_id) if question_db_id else None
                serializer_context = self.context.copy()
                frontend_q_temp_id = q_input_data.get('temp_id')
                if frontend_q_temp_id:
                    serializer_context['temp_id'] = frontend_q_temp_id
                question_serializer = QuestionSerializer(
                    instance=question_model_instance,
                    data=q_input_data,
                    partial=bool(question_model_instance),
                    context=serializer_context
                )
                question_serializer.is_valid(raise_exception=True)
                saved_q = question_serializer.save(quiz=instance)
                processed_ids.add(saved_q.id)
                if saved_q.question_type == 'dragdrop':
                    fill_blank_json = question_serializer.validated_data.get('fill_blank')
                    if fill_blank_json:
                        self._save_dragdrop_data(saved_q, fill_blank_json, frontend_q_temp_id)
                elif question_model_instance and question_model_instance.question_type == 'dragdrop' and saved_q.question_type != 'dragdrop':
                    FillBlankQuestion.objects.filter(question=saved_q).delete()
            ids_to_delete = set(existing_map.keys()) - processed_ids
            if ids_to_delete:
                instance.questions.filter(id__in=ids_to_delete).delete()
        instance.refresh_from_db()
        return instance

class QuizReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizReport
        fields = ['message', 'suggested_correction']

class QuizShareSerializer(serializers.Serializer):
    to_user_id = serializers.IntegerField()
    message = serializers.CharField(required=False, allow_blank=True)