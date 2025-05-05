# quizzes/serializers.py

from rest_framework import serializers
from .models import Quiz, Question


class QuestionSerializer(serializers.ModelSerializer):
    # media fields
    question_image      = serializers.ImageField(required=False, allow_null=True)
    question_image_alt  = serializers.CharField(read_only=True)
    question_audio      = serializers.FileField(required=False, allow_null=True)

    option1_image       = serializers.ImageField(required=False, allow_null=True)
    option1_image_alt   = serializers.CharField(read_only=True)
    option1_audio       = serializers.FileField(required=False, allow_null=True)

    option2_image       = serializers.ImageField(required=False, allow_null=True)
    option2_image_alt   = serializers.CharField(read_only=True)
    option2_audio       = serializers.FileField(required=False, allow_null=True)

    option3_image       = serializers.ImageField(required=False, allow_null=True)
    option3_image_alt   = serializers.CharField(read_only=True)
    option3_audio       = serializers.FileField(required=False, allow_null=True)

    option4_image       = serializers.ImageField(required=False, allow_null=True)
    option4_image_alt   = serializers.CharField(read_only=True)
    option4_audio       = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Question
        fields = [
            'id',
            'quiz',
            'question_text',
            'question_image',
            'question_image_alt',
            'question_audio',
            'option1',
            'option1_image',
            'option1_image_alt',
            'option1_audio',
            'option2',
            'option2_image',
            'option2_image_alt',
            'option2_audio',
            'option3',
            'option3_image',
            'option3_image_alt',
            'option3_audio',
            'option4',
            'option4_image',
            'option4_image_alt',
            'option4_audio',
            'correct_option',
            'hint1',
            'hint2',
        ]
        read_only_fields = [
            'id',
            'quiz',
            'question_image_alt',
            'option1_image_alt',
            'option2_image_alt',
            'option3_image_alt',
            'option4_image_alt',
        ]


class QuizSerializer(serializers.ModelSerializer):
    content       = serializers.CharField(
                        required=False,
                        allow_blank=True,
                        help_text="Main explanation or content about the quiz."
                    )
    is_locked     = serializers.BooleanField(read_only=True)
    created_by    = serializers.SerializerMethodField()
    questions     = QuestionSerializer(many=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'title',
            'content',
            'lesson',
            'subject',
            'course',
            'quiz_type',
            'permalink',
            'created_by',
            'created_at',
            'seo_title',
            'seo_description',
            'focus_keyword',
            'canonical_url',
            'og_title',
            'og_description',
            'og_image',
            'is_locked',
            'questions',
        ]
        read_only_fields = [
            'id',
            'permalink',
            'created_by',
            'created_at',
            'seo_title',
            'seo_description',
            'canonical_url',
            'og_title',
            'og_description',
            'og_image',
            'is_locked',
        ]

    def get_created_by(self, obj):
        if hasattr(obj, 'created_by') and obj.created_by:
            return obj.created_by.username
        elif hasattr(obj, 'original_quiz') and obj.original_quiz and hasattr(obj.original_quiz, 'created_by'):
            return obj.original_quiz.created_by.username
        return ""

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        request = self.context.get("request")
        if request:
            validated_data['created_by'] = request.user

        quiz = Quiz.objects.create(**validated_data)

        for question_data in questions_data:
            Question.objects.create(quiz=quiz, **question_data)

        return quiz

    def update(self, instance, validated_data):
        # prevent title/permalink changes via this endpoint
        validated_data.pop('title', None)
        validated_data.pop('permalink', None)

        questions_data = validated_data.pop('questions', None)

        # update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # sync questions if provided
        if questions_data is not None:
            existing = {q.id: q for q in instance.questions.all()}
            incoming_ids = []
            for qd in questions_data:
                qid = qd.get('id', None)
                if qid and qid in existing:
                    q = existing[qid]
                    for field, val in qd.items():
                        if field != 'id':
                            setattr(q, field, val)
                    q.save()
                    incoming_ids.append(qid)
                else:
                    qnew = Question.objects.create(
                        quiz=instance,
                        **{k: v for k, v in qd.items() if k != 'id'}
                    )
                    incoming_ids.append(qnew.id)
            # remove questions not in incoming list
            for q in instance.questions.exclude(id__in=incoming_ids):
                q.delete()

        return instance
