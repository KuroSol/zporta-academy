from django.contrib import admin
from django.urls import path, include
from pages.views import DynamicPageView
from posts.views import DynamicPostView
from courses.views import DynamicCourseView
from lessons.views import DynamicLessonView
from quizzes.views import DynamicQuizView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('administration-zporta-repersentiivie/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/pages/', include('pages.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/courses/', include('courses.urls')),
    path('api/subjects/', include('subjects.urls')), 
    path('ckeditor5/', include('django_ckeditor_5.urls')),
    path('api/enrollments/', include('enrollment.urls')),
    path('api/mentions/', include('mentions.urls')),
    path('posts/<path:permalink>/', DynamicPostView.as_view(), name='dynamic_post'),
    path('courses/<path:permalink>/', DynamicCourseView.as_view(), name='dynamic_course'),
    path('lessons/<path:permalink>/', DynamicLessonView.as_view(), name='dynamic_lesson'),
    path('api/lessons/', include('lessons.urls')),
    path('api/quizzes/', include('quizzes.urls')),
    path('quizzes/<path:permalink>/', DynamicQuizView.as_view(), name='dynamic_quiz'),
    path('<slug:permalink>/', DynamicPageView.as_view(), name='dynamic_page'),
    path('api/notes/', include('notes.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/social/', include('social.urls')),
    path('api/notifications/', include(('notifications.urls', 'notifications'), namespace='notifications')),

    path('api/user_media/', include('user_media.urls')),
    path('api/', include('analytics.urls')),
    path('api/analytics/', include('analytics.urls')), # Corrected line
    path('api/study/', include('learning.urls')),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
