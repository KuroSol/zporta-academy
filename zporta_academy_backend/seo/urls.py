# zporta_academy_backend/seo/urls.py

from django.urls import path
from django.contrib.sitemaps.views import sitemap
from .sitemaps import QuizSitemap, CourseSitemap, LessonSitemap
from .views import robots_txt  # You will make this view

sitemaps = {
    'quizzes': QuizSitemap,
    'courses': CourseSitemap,
    'lessons': LessonSitemap,
}

urlpatterns = [
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),
    path('robots.txt', robots_txt, name='robots_txt'),
]
