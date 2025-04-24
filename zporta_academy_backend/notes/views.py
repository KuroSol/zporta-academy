from rest_framework.response import Response
from rest_framework import status, generics, permissions
from .models import Note, Comment
from .serializers import NoteSerializer, CommentSerializer
from mentions.models import Mention
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

class CommentUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """
    A view to retrieve, update, or delete a comment.
    Only the owner of the comment is allowed to modify it.
    """
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Comment.objects.all()

    def get_object(self):
        comment = super().get_object()
        # Ensure that only the comment owner can modify it.
        if self.request.user != comment.user:
            raise PermissionDenied("You do not have permission to modify this comment.")
        return comment
    

class UserNoteCommentsView(generics.ListAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        note_id = self.kwargs.get('note_id')
        return Comment.objects.filter(note_id=note_id, user=self.request.user)

class NoteListCreateView(generics.ListCreateAPIView):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return notes belonging to the authenticated user, ordered from newest to oldest.
        return Note.objects.filter(user=self.request.user).order_by('-created_at')
    
    def perform_create(self, serializer):
        # Capture the created note by assigning serializer.save() to note.
        note = serializer.save(user=self.request.user)
        # Process the mentions.
        mentioned_users = serializer.validated_data.get('mentions', [])
        for user in mentioned_users:
            # Add the user to the note's mentions field
            note.mentions.add(user)
            # Create a notification entry for the mention
            Mention.objects.create(user=user, note=note)

    def get_serializer_context(self):
        # This method adds the current request to the serializer context.
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context
    
class NoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return notes where the user is the owner or is mentioned
        return Note.objects.filter(Q(user=self.request.user) | Q(mentions=self.request.user))
    
    def update(self, request, *args, **kwargs):
        note = self.get_object()
        # If the user is the owner, update the note normally.
        if request.user == note.user:
            return super().update(request, *args, **kwargs)
        # If the user is mentioned in the note, create a comment instead.
        elif request.user in note.mentions.all():
            new_text = request.data.get('text', '').strip()
            if not new_text:
                return Response({'detail': 'Comment text cannot be empty.'},
                                status=status.HTTP_400_BAD_REQUEST)
            Comment.objects.create(note=note, user=request.user, text=new_text)
            # Optionally: update the related Mention (e.g., mark as read) here.
            serializer = self.get_serializer(note)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response({'detail': 'You do not have permission to edit this note.'},
                            status=status.HTTP_403_FORBIDDEN)
    
    def perform_update(self, serializer):
        # This method will only be called for the note owner (via super().update())
        note = serializer.save()
        new_mentions = serializer.validated_data.get('mentions', None)
        if new_mentions is not None:
            current_mentions = set(note.mentions.all())
            new_mentions_set = set(new_mentions)
            removed_users = current_mentions - new_mentions_set
            added_users = new_mentions_set - current_mentions
            
            note.mentions.set(new_mentions)
            
            # Remove mention notifications for removed users.
            Mention.objects.filter(note=note, user__in=removed_users).delete()
            # Create mention notifications for newly added users.
            for user in added_users:
                Mention.objects.create(note=note, user=user)
        return note
    
    def get_serializer_context(self):
        # Add the request to the serializer context for filtering my_comments.
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context