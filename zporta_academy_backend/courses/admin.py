from django.contrib import admin
from .models import Course
from lessons.models import Lesson
from quizzes.models import Quiz  # Ensure this import is correct

class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0  # No empty forms by default

class QuizInline(admin.TabularInline):  # Adding a Quiz inline
    model = Quiz
    extra = 0  # No empty forms by default

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject', 'created_by', 'course_type']
    prepopulated_fields = {'permalink': ('title',)}
    inlines = [LessonInline, QuizInline]  # Adding QuizInline here
