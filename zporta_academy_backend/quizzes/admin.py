# quizzes/admin.py

from django.contrib import admin
from .models import Quiz, Question


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 1  # one extra blank form

    # Show all new media fields alongside existing ones
    fields = [
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
    readonly_fields = [
        'question_image_alt',
        'option1_image_alt',
        'option2_image_alt',
        'option3_image_alt',
        'option4_image_alt',
    ]
    # Enable file uploads in the inline
    show_change_link = True


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display    = ('title', 'created_by', 'display_subject', 'quiz_type', 'created_at', 'question_count')
    list_filter     = ('quiz_type', 'created_by', 'subject')
    search_fields   = ('title', 'created_by__username', 'subject__name')
    raw_id_fields   = ('created_by', 'subject')
    readonly_fields = ('permalink',)         # ← make permalink read-only
    inlines         = [QuestionInline]

    def display_subject(self, obj):
        return obj.subject.name if obj.subject else 'No Subject'
    display_subject.short_description = 'Subject'

    def question_count(self, obj):
        return obj.questions.count()
    question_count.short_description = 'Questions'


# Note: you don't need to call admin.site.register(Quiz, QuizAdmin)
# because of the @admin.register decorator above.
