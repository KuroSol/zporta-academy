from django.urls import path
from .views import (
    CourseListCreateView,
    MyCoursesView,
    CourseRetrieveUpdateDestroyView,
    DynamicCourseView,
    AddLessonToCourseView,
    DetachLessonFromCourseView,
    SuggestedCoursesView,
    DraftCourseDetailView,
    PublishCourseView,
    UnpublishCourseView,
    AddQuizToCourseView,
    DetachQuizFromCourseView,
    BulkPublishLessonsView,
)

urlpatterns = [
    path('', CourseListCreateView.as_view(), name='course-list-create'),
    path('my/', MyCoursesView.as_view(), name='my-courses'),
    path('suggestions/', SuggestedCoursesView.as_view(), name='course-suggestions'),
    path('<path:permalink>/update/', CourseRetrieveUpdateDestroyView.as_view(), name='course-update'),
    path('<path:permalink>/delete/', CourseRetrieveUpdateDestroyView.as_view(), name='course-delete'),
    path('<path:permalink>/add-lesson/', AddLessonToCourseView.as_view(), name='add-lesson-to-course'),
    path('<path:permalink>/detach-lesson/', DetachLessonFromCourseView.as_view(), name='detach-lesson-from-course'),
    path('draft/<path:permalink>/', DraftCourseDetailView.as_view(), name='draft-course-detail'),
    path('<path:permalink>/publish/', PublishCourseView.as_view(), name='course-publish'),
    path('<path:permalink>/unpublish/', UnpublishCourseView.as_view(), name='course-unpublish'),
    path('<path:permalink>/lessons/bulk-publish/', BulkPublishLessonsView.as_view(), name='course-bulk-publish-lessons'),
    # Place add-quiz and detach-quiz before the catch-all dynamic view:
    path('<path:permalink>/add-quiz/', AddQuizToCourseView.as_view(), name='add-quiz-to-course'),
    path('<path:permalink>/detach-quiz/', DetachQuizFromCourseView.as_view(), name='detach-quiz-from-course'),
    # Catch-all for dynamic course view:
    path('<path:permalink>/', DynamicCourseView.as_view(), name='dynamic_course'),
]
