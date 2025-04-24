from django.contrib import admin
from .models import Quiz
from django.db.models import Count

class QuizAdmin(admin.ModelAdmin):
    list_display = ('question', 'created_by', 'display_subject', 'quiz_type', 'num_options')
    list_filter = ('quiz_type', 'created_by', 'subject')
    search_fields = ('question', 'created_by__username', 'subject__name')
    raw_id_fields = ('created_by', 'subject')

    def display_subject(self, obj):
        return obj.subject.name if obj.subject else 'No Subject'
    display_subject.short_description = 'Subject'

    def num_options(self, obj):
        return len([opt for opt in [obj.option1, obj.option2, obj.option3, obj.option4] if opt])
    num_options.short_description = 'Number of Options'

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_num_options=Count('option1') + Count('option2') + Count('option3') + Count('option4'))

admin.site.register(Quiz, QuizAdmin)
