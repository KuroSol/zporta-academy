from django.urls import path
from .views import NoteListCreateView, NoteDetailView, UserNoteCommentsView, CommentUpdateDeleteView

urlpatterns = [
    path('', NoteListCreateView.as_view(), name="note-list-create"),
    path('<int:pk>/', NoteDetailView.as_view(), name="note-detail"),
    path('notes/<int:note_id>/my-comments/', UserNoteCommentsView.as_view(), name='note-user-comments'),
    path('comments/<int:pk>/', CommentUpdateDeleteView.as_view(), name="comment-update-delete"),
]
