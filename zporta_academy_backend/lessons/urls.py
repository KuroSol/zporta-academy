from django.urls import path
from .views import (
    LessonListCreateView, 
    UserLessonsView, 
    LessonRetrieveUpdateDestroyView,
    DynamicLessonView,
    MarkLessonCompleteView,
    LessonEnrollmentCompletionStatusView, 
    AddQuizToLessonView,
    DetachQuizFromLessonView,
    RecentLessonCompletionsView,
)

urlpatterns = [
    path('my/', UserLessonsView.as_view(), name='user-lessons'),
    path('', LessonListCreateView.as_view(), name='lesson-list-create'),

    # ✅ Place more specific routes first
    path('<path:permalink>/update/', LessonRetrieveUpdateDestroyView.as_view(), name='lesson-update'),
    path('<path:permalink>/delete/', LessonRetrieveUpdateDestroyView.as_view(), name='lesson-delete'),
    path('<path:permalink>/complete/', MarkLessonCompleteView.as_view(), name='lesson-complete'),
    
    # ✅ Move this ABOVE the generic pattern
    path('<path:permalink>/enrollment-status/', LessonEnrollmentCompletionStatusView.as_view(), name='lesson-enrollment-status'),

    path('<path:permalink>/add-quiz/', AddQuizToLessonView.as_view(), name='add-quiz-to-lesson'),
    path('<path:permalink>/detach-quiz/', DetachQuizFromLessonView.as_view(), name='detach-quiz-from-lesson'),

    # ✅ This should always be at the bottom
    path('completed/recent/', RecentLessonCompletionsView.as_view(), name='recent-lesson-completions'), # Add this line
    path('<path:permalink>/', DynamicLessonView.as_view(), name='dynamic_lesson'),
]
