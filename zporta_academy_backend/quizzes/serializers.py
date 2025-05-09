# quizzes/serializers.py

from rest_framework import serializers
# Assuming Subject/Course models live in separate apps:
from subjects.models import Subject # Import Subject from the 'subjects' app
from courses.models import Course   # Import Course from the 'courses' app
from .models import Quiz, Question # Import Quiz and Question from the local models

class QuestionSerializer(serializers.ModelSerializer):
    # Explicitly define fields that are conditionally required as not required here
    # Allow blank/null based on the model changes
    option1 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option2 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option3 = serializers.CharField(required=False, allow_blank=True, allow_null=True) # Keep optional
    option4 = serializers.CharField(required=False, allow_blank=True, allow_null=True) # Keep optional

    correct_option = serializers.IntegerField(required=False, allow_null=True) # For MCQ
    correct_options = serializers.JSONField(required=False, allow_null=True) # For Multi, Sort, DragDrop solution
    correct_answer = serializers.CharField(required=False, allow_blank=True, allow_null=True) # For Short Answer
    question_data = serializers.JSONField(required=False, allow_null=True) # For Sort/DragDrop items/zones

    # Media fields are inherently optional via the model's blank=True, null=True
    # Ensure use_url=True if you want URLs in the response, remove if you only handle uploads
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

    # Read-only fields for generated alt text
    question_image_alt = serializers.CharField(read_only=True)
    option1_image_alt = serializers.CharField(read_only=True)
    option2_image_alt = serializers.CharField(read_only=True)
    option3_image_alt = serializers.CharField(read_only=True)
    option4_image_alt = serializers.CharField(read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'quiz', # quiz is read-only during nested creation/update
            'question_type',
            'question_text',
            'question_image', 'question_image_alt', 'question_audio',
            'allow_speech_to_text',

            # Options
            'option1', 'option1_image', 'option1_image_alt', 'option1_audio',
            'option2', 'option2_image', 'option2_image_alt', 'option2_audio',
            'option3', 'option3_image', 'option3_image_alt', 'option3_audio',
            'option4', 'option4_image', 'option4_image_alt', 'option4_audio',

            # Answers / Data
            'correct_option',  # For MCQ
            'correct_options', # For Multi, Sort, DragDrop solution
            'correct_answer',  # For Short Answer
            'question_data',   # For Sort/DragDrop items/zones

            # Hints
            'hint1', 'hint2',
        ]
        # Quiz is typically set in the view/QuizSerializer, not directly by QuestionSerializer input
        read_only_fields = [
            'id', 'quiz',
            'question_image_alt', 'option1_image_alt', 'option2_image_alt',
            'option3_image_alt', 'option4_image_alt',
        ]

    def validate(self, data):
        """
        Perform validation based on question_type.
        'data' contains the fields submitted for this specific question.
        'self.instance' is the existing question object if this is an update.
        """
        # Determine the question type being validated
        # Use submitted type if present, otherwise fallback to existing instance type
        question_type = data.get('question_type', getattr(self.instance, 'question_type', None))

        if not question_type:
             # This should ideally be caught by the ChoiceField itself if submitted data is empty
             raise serializers.ValidationError({"question_type": "Question type is required."})

        errors = {} # Accumulate errors

        # --- Validation for MCQ (Single Correct Choice) ---
        if question_type == 'mcq':
            if not data.get('option1'): errors['option1'] = 'Option 1 text is required for MCQ.'
            if not data.get('option2'): errors['option2'] = 'Option 2 text is required for MCQ.'
            correct_option = data.get('correct_option')
            if correct_option is None: # Use 'is None' to check for absence
                 errors['correct_option'] = 'A correct option (1-4) must be selected for MCQ.'
            elif not isinstance(correct_option, int) or correct_option not in [1, 2, 3, 4]:
                 errors['correct_option'] = 'Correct option must be 1, 2, 3, or 4.'
            # Check if the selected correct option actually has text provided
            elif not data.get(f"option{correct_option}"):
                 # Use setdefault to handle potential list if other errors occur for this field
                 errors.setdefault('correct_option', []).append(
                     f"The selected correct option ({correct_option}) does not have any text."
                 )

        # --- Validation for Multi (Multiple Correct Choices) ---
        elif question_type == 'multi':
            if not data.get('option1'): errors['option1'] = 'Option 1 text is required for Multi-Select.'
            if not data.get('option2'): errors['option2'] = 'Option 2 text is required for Multi-Select.'
            correct_options = data.get('correct_options')
            if not correct_options or not isinstance(correct_options, list) or len(correct_options) == 0:
                errors['correct_options'] = 'At least one correct option must be selected as a list (e.g., [1, 3]) for Multi-Select.'
            else:
                # Validate each selected option number
                invalid_options = []
                for opt_num in correct_options:
                    if not isinstance(opt_num, int) or opt_num not in [1, 2, 3, 4]:
                        invalid_options.append(f"Invalid option number: {opt_num}. Must be 1-4.")
                    elif not data.get(f"option{opt_num}"):
                        invalid_options.append(f"Selected correct option {opt_num} does not have any text.")
                if invalid_options:
                     # Assign list of specific errors for correct_options
                     errors['correct_options'] = invalid_options

        # --- Validation for Short Answer ---
        elif question_type == 'short':
            # Check if allow_speech_to_text is being set or exists on the instance
            allow_speech = data.get('allow_speech_to_text', getattr(self.instance, 'allow_speech_to_text', False))
            if not data.get('correct_answer') and not allow_speech:
                 errors['correct_answer'] = 'A correct text answer is required for Short Answer questions unless speech input is enabled.'

        # --- Validation for Word Sort ---
        # Note: Assumes frontend uses 'sort' as the value for question_type
        elif question_type == 'sort':
             q_data = data.get('question_data', {}) # Get question_data or empty dict
             # Ensure q_data is a dict before accessing 'items'
             items = q_data.get('items', []) if isinstance(q_data, dict) else []
             if not isinstance(items, list) or len(items) < 2:
                  errors['question_data'] = "At least two sortable 'items' (words/phrases) are required in question_data for Word Sort."
             # Optional: Validate correct_options is a list of strings matching items if provided
             # correct_opts_sort = data.get('correct_options')
             # if correct_opts_sort and not isinstance(correct_opts_sort, list):
             #    errors['correct_options'] = "Correct options for Word Sort must be a list of strings."

        # --- Validation for Drag and Drop ---
        elif question_type == 'dragdrop':
             q_data = data.get('question_data', {}) # Get question_data or empty dict
             # Ensure q_data is a dict before accessing keys
             items = q_data.get('items', []) if isinstance(q_data, dict) else []
             dropZones = q_data.get('dropZones', []) if isinstance(q_data, dict) else []
             if not isinstance(items, list) or len(items) == 0:
                  errors['question_data'] = "At least one draggable 'item' is required in question_data for Drag and Drop."
             if not isinstance(dropZones, list) or len(dropZones) == 0:
                  errors['question_data'] = "At least one 'dropZone' is required in question_data for Drag and Drop."
             # Optional: Validate correct_options structure (e.g., {"solution": [{"itemId": "id1", "zoneId": "idA"}, ...]})
             # correct_opts_drag = data.get('correct_options')
             # if correct_opts_drag and (not isinstance(correct_opts_drag, dict) or 'solution' not in correct_opts_drag):
             #     errors['correct_options'] = "Correct options for Drag/Drop requires a specific JSON structure with a 'solution' key."


        # --- Raise errors if any were found ---
        if errors:
            raise serializers.ValidationError(errors)

        # --- Clean up unused fields based on type ---
        # This prevents saving irrelevant data from previous type selections in the UI
        # Note: This modifies the 'data' dict *before* it's used to create/update the model instance
        if question_type not in ['mcq', 'multi']:
             data['option1'] = None
             data['option2'] = None
             data['option3'] = None
             data['option4'] = None
             data['correct_option'] = None
             # Clear related media fields - BE CAREFUL with updates, might delete existing media
             # Consider handling media clearing logic differently if needed
             # data['option1_image'] = None ... etc.

        # Keep correct_options for multi, sort, dragdrop as they use it for answers/solutions
        if question_type not in ['multi', 'sort', 'dragdrop']:
            data['correct_options'] = None

        if question_type != 'short':
             data['correct_answer'] = None

        if question_type not in ['sort', 'dragdrop']:
             data['question_data'] = None


        return data # Return validated (and potentially cleaned) data

# --- QuizSerializer ---
class QuizSerializer(serializers.ModelSerializer):
    # Use the updated QuestionSerializer for nested handling
    questions = QuestionSerializer(many=True, required=False) # Make questions optional at quiz level if needed
    # Ensure created_by is read-only or handled correctly
    created_by = serializers.CharField(source='created_by.username', read_only=True)
    # Make subject/course writable via IDs or nested serializers if needed
    # Ensure Subject/Course models are imported if using these fields
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(), allow_null=True, required=False)
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'content', 'lesson', 'subject', 'course', 'quiz_type',
            'permalink', 'created_by', 'created_at',
            'seo_title', 'seo_description', 'focus_keyword', 'canonical_url',
            'og_title', 'og_description', 'og_image', 'is_locked', 'questions',
        ]
        read_only_fields = [
            'id', 'permalink', 'created_by', 'created_at', 'is_locked',
            'seo_title', 'seo_description', 'canonical_url',
            'og_title', 'og_description', 'og_image',
        ]
        # Define extra_kwargs if you need to override default serializer field behavior
        # e.g., ensure title is always required on create
        extra_kwargs = {
            'title': {'required': True, 'allow_blank': False},
            'subject': {'required': True}, # Make subject required at quiz level if needed
        }

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        # Ensure created_by is set from the request context
        # This assumes authentication is handled and request.user is available
        validated_data['created_by'] = self.context['request'].user
        quiz = Quiz.objects.create(**validated_data)

        # Validate and create questions individually
        for question_data in questions_data:
            # Don't pass 'quiz' in data, set it before saving
            question_serializer = QuestionSerializer(data=question_data, context=self.context)
            if question_serializer.is_valid(raise_exception=True):
                 # Save the validated question, associating it with the quiz
                 question_serializer.save(quiz=quiz)
            # else: # Error already raised by raise_exception=True
            #    print("Question validation failed:", question_serializer.errors) # Debugging
        return quiz

    def update(self, instance, validated_data):
        # Prevent changing certain fields on update
        validated_data.pop('title', None) # Example: Title cannot be changed
        validated_data.pop('permalink', None)
        validated_data.pop('created_by', None) # Cannot change owner

        questions_data = validated_data.pop('questions', None) # Pop questions before updating the quiz instance

        # Update Quiz fields first using the default update mechanism
        # This handles fields like content, subject, course, quiz_type etc.
        instance = super().update(instance, validated_data)

        # --- Handle Question Updates/Creations/Deletions ---
        if questions_data is not None: # Process questions only if the key was present in the request
            existing_questions = {q.id: q for q in instance.questions.all()}
            incoming_ids = set() # Keep track of IDs submitted in the request

            for question_data in questions_data:
                qid = question_data.get('id', None)
                question_instance = existing_questions.get(qid, None) # Find existing instance or None

                # Pass the instance for updates, None for creates
                # Use partial=True for updates to allow sending only changed fields
                question_serializer = QuestionSerializer(
                    instance=question_instance,
                    data=question_data,
                    partial=question_instance is not None, # partial=True only if updating
                    context=self.context
                )
                try:
                    if question_serializer.is_valid(raise_exception=True):
                        # Save the validated question, associating/re-associating with the quiz
                        saved_question = question_serializer.save(quiz=instance)
                        incoming_ids.add(saved_question.id)
                except serializers.ValidationError as e:
                    # Add context to the error (e.g., which question failed)
                    # This provides clearer error messages back to the client
                    raise serializers.ValidationError({f"question_{qid or 'new'}": e.detail})


            # Delete questions associated with the quiz that were NOT in the incoming update list
            ids_to_delete = set(existing_questions.keys()) - incoming_ids
            if ids_to_delete:
                instance.questions.filter(id__in=ids_to_delete).delete()

        # Important: Refresh the instance from DB to reflect changes if needed elsewhere immediately
        instance.refresh_from_db()
        return instance
