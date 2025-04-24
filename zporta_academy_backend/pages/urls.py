from django.urls import path
from .views import PageListCreateView, DynamicPageView

urlpatterns = [
    path('', PageListCreateView.as_view(), name='page-list-create'),  # List and Create Pages
    path('<slug:permalink>/', DynamicPageView.as_view(), name='dynamic-page'),  # Dynamic Pages
]
