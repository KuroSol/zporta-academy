# lessons/urls.py

from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import (
    LessonListCreateView,
    UserLessonsView,
    LessonRetrieveUpdateDestroyView,
    DynamicLessonView,
    MarkLessonCompleteView,
    EnrollmentLessonCompletionsView,
    LessonEnrollmentCompletionStatusView,
    AddQuizToLessonView,
    DetachQuizFromLessonView,
    RecentLessonCompletionsView,
    LessonTemplateViewSet,
    PublishLessonView,
    AttachCourseToLessonView,
    DetachCourseFromLessonView,
)

# 1) Register the "templates" endpoint with a router
router = SimpleRouter()
router.register(r'templates', LessonTemplateViewSet, basename='lesson-templates')

# 2) List/Create, custom actions, but NOT the catch-all
urlpatterns = [
    path('my/', UserLessonsView.as_view(), name='user-lessons'),
    path('', LessonListCreateView.as_view(), name='lesson-list-create'),
    path('enrollments/<int:enrollment_id>/completions/',
         EnrollmentLessonCompletionsView.as_view(),
         name='enrollment-lesson-completions'),
    path('<path:permalink>/update/',
         LessonRetrieveUpdateDestroyView.as_view(),
         name='lesson-update'),
    path('<path:permalink>/delete/',
         LessonRetrieveUpdateDestroyView.as_view(),
         name='lesson-delete'),
    path('<path:permalink>/complete/',
         MarkLessonCompleteView.as_view(),
         name='lesson-complete'),
     path('<path:permalink>/publish/',
         PublishLessonView.as_view(),
         name='lesson-publish'),
    path('<path:permalink>/enrollment-status/',
         LessonEnrollmentCompletionStatusView.as_view(),
         name='lesson-enrollment-status'),
    path('<path:permalink>/add-quiz/',
         AddQuizToLessonView.as_view(),
         name='add-quiz-to-lesson'),
    path('<path:permalink>/detach-quiz/',
         DetachQuizFromLessonView.as_view(),
         name='detach-quiz-from-lesson'),
    path('<path:permalink>/attach-course/',
         AttachCourseToLessonView.as_view(),
         name='lesson-attach-course'),
    path('<path:permalink>/detach-course/',
         DetachCourseFromLessonView.as_view(),
         name='lesson-detach-course'),
    path('completed/recent/',
         RecentLessonCompletionsView.as_view(),
         name='recent-lesson-completions'),
]

# 3) Insert the routered "templates/" URLs here
urlpatterns += router.urls

# 4) Finally, the catch-all permalink route
urlpatterns += [
    path('<path:permalink>/', DynamicLessonView.as_view(), name='dynamic_lesson'),
]
