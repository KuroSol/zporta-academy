from django.urls import path
from courses.views import AddQuizToCourseView
from .views import (
    QuizListCreateView,
    DynamicQuizView,
    QuizRetrieveUpdateDestroyView,
    MyQuizzesView,
    RecordQuizAnswerView,
    QuizListByCourseView,
    QuizSubmitView,
    QuestionListCreateView,
    QuestionRetrieveUpdateDestroyView,
    ReportQuizView, 
    ShareQuizView,
)

urlpatterns = [
    # 1. Question CRUD endpoints are correctly placed at the top.
    path('questions/', QuestionListCreateView.as_view(), name='question-list-create'),
    path('questions/<int:pk>/', QuestionRetrieveUpdateDestroyView.as_view(), name='question-detail'),

    # 2. Your existing Quiz endpoints remain unchanged.
    path('my/', MyQuizzesView.as_view(), name='my-quizzes'),
    path('detail/<int:pk>/', QuizRetrieveUpdateDestroyView.as_view(), name='quiz-detail'),
    path('<int:pk>/edit/', QuizRetrieveUpdateDestroyView.as_view(), name='quiz-edit'),
    path('<int:pk>/delete/', QuizRetrieveUpdateDestroyView.as_view(), name='quiz-delete'),
    path('<int:pk>/record-answer/', RecordQuizAnswerView.as_view(), name='record-quiz-answer'),
    path('<int:pk>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),
    path('<int:pk>/report/', ReportQuizView.as_view(), name='quiz-report'),
    path('<int:pk>/share/',  ShareQuizView.as_view(),  name='quiz-share'),
    path('course/<int:course_id>/', QuizListByCourseView.as_view(), name='quiz-list-by-course'),
    path('courses/<int:course_id>/add-quiz/', AddQuizToCourseView.as_view(), name='add-quiz-to-course'),
    path('<path:permalink>/', DynamicQuizView.as_view(), name='dynamic_quiz'),
    path('', QuizListCreateView.as_view(), name='quiz-list-create'),
]
