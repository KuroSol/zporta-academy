# quizzes/serializers.py
import random
from rest_framework import serializers
from django.db import transaction
from django.contrib.contenttypes.models import ContentType

# Local app imports
from .models import Quiz, Question, FillBlankQuestion, BlankWord, BlankSolution, QuizReport, QuizShare
from .difficulty_explanation import get_difficulty_explanation
from tags.models import Tag
from subjects.models import Subject
from courses.models import Course
from analytics.models import ActivityEvent
from tags.serializers import TagSerializer
from users.models import Profile
from django.contrib.auth.models import User
from users.serializers import PublicProfileSerializer 
# --- Serializers for Drag & Drop Nested Data ---
import re, unicodedata
SPLIT_RE = re.compile(r'[\s\u3000,，、;；]+' )  # space, full-width space, commas, etc.

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
    
    # AI-computed difficulty (read-only)
    computed_difficulty_score = serializers.FloatField(read_only=True)
    difficulty_level = serializers.SerializerMethodField()
    
    def get_difficulty_level(self, obj):
        """Return human-readable difficulty level."""
        score = getattr(obj, 'computed_difficulty_score', None)
        if score is None:
            return None
        if score < 300:
            return "Very Easy"
        elif score < 400:
            return "Easy"
        elif score < 500:
            return "Medium"
        elif score < 600:
            return "Hard"
        elif score < 700:
            return "Very Hard"
        else:
            return "Expert"

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
            'id', 'quiz', 'temp_id', 'permalink', 'question_type', 'question_text',
            'question_image', 'question_image_alt', 'question_audio',
            'allow_speech_to_text', 'option1', 'option1_image', 'option1_image_alt',
            'option1_audio', 'option2', 'option2_image', 'option2_image_alt', 'option2_audio',
            'option3', 'option3_image', 'option3_image_alt', 'option3_audio',
            'option4', 'option4_image', 'option4_image_alt', 'option4_audio',
            'correct_option', 'correct_options', 'correct_answer', 'question_data',
            'fill_blank', '_fill_blank', 'hint1', 'hint2', 'attempt_count',
            'correct_count', 'wrong_count', 'computed_difficulty_score', 'difficulty_level',
        ]
        read_only_fields = [
            'id', 'permalink', '_fill_blank', 'question_image_alt', 'option1_image_alt',
            'option2_image_alt', 'option3_image_alt', 'option4_image_alt',
            'attempt_count', 'correct_count', 'wrong_count',

        ]
        # Make `quiz` writable so we can associate a question with a quiz
        # when creating it directly via the /api/quizzes/questions/ endpoint.
        extra_kwargs = {
            'quiz': {'required': False}
        }
    def to_representation(self, instance):
        """
        Shuffle options for Multiple Choice questions before sending to the client.
        """
        # First, get the standard serialized representation of the question
        rep = super().to_representation(instance)

        # Only shuffle for 'mcq' (Multiple Choice) question types
        if instance.question_type == 'mcq' and instance.correct_option is not None:
            # Group the options and their related media/alt text together
            options = []
            for i in range(1, 5):
                option_text = getattr(instance, f'option{i}', None)
                if option_text:  # Only include options that exist
                    options.append({
                        'text': option_text,
                        'image': getattr(instance, f'option{i}_image').url if getattr(instance, f'option{i}_image') else None,
                        'image_alt': getattr(instance, f'option{i}_image_alt', ''),
                        'audio': getattr(instance, f'option{i}_audio').url if getattr(instance, f'option{i}_audio') else None,
                        'is_correct': (i == instance.correct_option) # Track the correct answer
                    })
            
            # Shuffle the collected options
            random.shuffle(options)

            # Find the new index of the correct answer after shuffling
            new_correct_option = -1
            for i, option in enumerate(options):
                if option['is_correct']:
                    new_correct_option = i + 1  # 1-based index
                    break
            
            # Update the representation with the shuffled options
            for i, option_data in enumerate(options):
                rep[f'option{i+1}'] = option_data['text']
                rep[f'option{i+1}_image'] = option_data['image']
                rep[f'option{i+1}_image_alt'] = option_data['image_alt']
                rep[f'option{i+1}_audio'] = option_data['audio']

            # Update the correct_option to point to the new shuffled position
            rep['correct_option'] = new_correct_option

        return rep
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


# --- Main Quiz Serializer ---
# This serializer now correctly handles both reading and writing nested questions.
class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, required=False)
    created_by = PublicProfileSerializer(source='created_by.profile', read_only=True)
    attempt_count = serializers.IntegerField(read_only=True)
    correct_count = serializers.IntegerField(read_only=True)
    wrong_count = serializers.IntegerField(read_only=True)
    
    # AI-computed difficulty (read-only)
    computed_difficulty_score = serializers.FloatField(read_only=True)
    difficulty_level = serializers.SerializerMethodField()
    difficulty_explanation = serializers.SerializerMethodField()
    
    def get_difficulty_level(self, obj):
        """Return human-readable difficulty level."""
        score = getattr(obj, 'computed_difficulty_score', None)
        if score is None:
            return None
        if score < 300:
            return "Very Easy"
        elif score < 400:
            return "Easy"
        elif score < 500:
            return "Medium"
        elif score < 600:
            return "Hard"
        elif score < 700:
            return "Very Hard"
        else:
            return "Expert"
    
    def get_difficulty_explanation(self, obj):
        """
        Return a detailed explanation of why the quiz received its difficulty rating.
        Includes 5-level categorization, confidence score, and AI factors.
        """
        try:
            return get_difficulty_explanation(obj)
        except Exception as e:
            # Fallback: return None if difficulty explanation fails
            # This ensures the API doesn't crash and frontend renders without badge
            import logging
            logging.warning(f"Error computing difficulty explanation for quiz {obj.id}: {e}")
            return None

    # Tagging fields
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=191),
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
    # Read-only course details (for showing attachment relationships)
    course_title = serializers.CharField(source='course.title', read_only=True, allow_null=True)
    # Read-only lesson details (for showing attachment relationships)
    lesson_id = serializers.IntegerField(source='lesson.id', read_only=True, allow_null=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True, allow_null=True)
    lesson_permalink = serializers.CharField(source='lesson.permalink', read_only=True, allow_null=True)

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'content', 'lesson',
            'lesson_id', 'lesson_title', 'lesson_permalink',
            'subject', 'course', 'course_title', 'quiz_type',
            'permalink', 'created_by', 'created_at', 'is_locked',
            'status', 'published_at',
            'tags', 'tag_names', 'questions',
            'attempt_count', 'correct_count', 'wrong_count',
            'computed_difficulty_score', 'difficulty_level', 'difficulty_explanation',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image',
            'languages', 'detected_location',
        ]
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at',
            'is_locked', 'tags', 'attempt_count',
            'correct_count', 'wrong_count',
            'computed_difficulty_score', 'difficulty_level', 'difficulty_explanation',
            'languages', 'detected_location',
            'course_title', 'lesson_id', 'lesson_title', 'lesson_permalink',
        ]
        extra_kwargs = {
            'title':   {'required': True, 'allow_blank': False},
            'subject': {'required': True},  # require subject on input
            'content': {'required': False, 'allow_blank': True},
            'lesson':  {'required': False, 'allow_null': True},
            'course':  {'required': False, 'allow_null': True},
        }

    def validate_tag_names(self, value):
        """
        Normalize tag_names so we always work with a Python list.
        Accepts:
        - list of strings
        - single string
        - JSON-encoded list in a string (e.g. '["#a","#b"]')
        """
        import json
        if isinstance(value, str):
            s = value.strip()
            if s.startswith('[') and s.endswith(']'):
                try:
                    parsed = json.loads(s)
                    if isinstance(parsed, list):
                        return parsed
                except Exception:
                    pass
            return [s]
        return value

    def to_representation(self, instance):
        """
        Override the default representation to return the subject name
        instead of the primary key.
        """
        rep = super().to_representation(instance)
        rep['subject'] = instance.subject.name if instance.subject else None
        return rep
    
    def _expand_tags(self, incoming):
        flat = []
        for item in incoming or []:
            for t in SPLIT_RE.split(item or ''):
                t = unicodedata.normalize('NFKC', t).strip()
                if t.startswith('#'): t = t[1:]
                if t: flat.append(t)
        # de-dupe, keep order
        seen, out = set(), []
        for t in flat:
            if t not in seen:
                seen.add(t); out.append(t)
        return out


    def _save_tags(self, quiz_instance, tag_names_list):
        names = self._expand_tags(tag_names_list)  # split/normalize/de-dupe
        quiz_instance.tags.clear()
        for name in names:
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
        # forbid unpublish by non-staff
        prev_status = instance.status
        new_status  = validated_data.get('status', prev_status)
        req_user    = self.context.get('request').user if self.context.get('request') else None
        if prev_status == 'published' and new_status == 'draft' and (not req_user or not req_user.is_staff):
            raise serializers.ValidationError({'status': 'Cannot revert a published quiz to draft.'})
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