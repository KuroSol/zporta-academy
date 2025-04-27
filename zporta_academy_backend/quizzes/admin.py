from django.contrib import admin
from .models import Quiz, Question

class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1  # Show 1 extra empty form to add more questions

class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'display_subject', 'quiz_type', 'created_at')
    list_filter = ('quiz_type', 'created_by', 'subject')
    search_fields = ('title', 'created_by__username', 'subject__name')
    raw_id_fields = ('created_by', 'subject')
    inlines = [QuestionInline]  # Inline Questions inside Quiz admin

    def display_subject(self, obj):
        return obj.subject.name if obj.subject else 'No Subject'
    display_subject.short_description = 'Subject'

admin.site.register(Quiz, QuizAdmin)
