from rest_framework import serializers
from django.contrib.auth.models import User
from notes.models import Note, Comment 
from mentions.models import Mention

class CommentSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'user', 'user_username', 'text', 'created_at']

class NoteSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    mentions = serializers.PrimaryKeyRelatedField(
    queryset=User.objects.all(),
    many=True,
    required=False
    )
    comments = CommentSerializer(many=True, read_only=True)
    my_comments = serializers.SerializerMethodField()
    class Meta:
        model = Note
        fields = ['id', 'user', 'user_username',  'text', 'image', 'privacy', 'mentions', 'created_at', 'updated_at', 'comments', 'my_comments']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_my_comments(self, obj):
        # Access the request from context; ensure your view passes it.
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user_comments = obj.comments.filter(user=request.user)
            return CommentSerializer(user_comments, many=True).data
        return []

    def create(self, validated_data):
        # Pop out the mentions list from validated_data (or use an empty list if not provided)
        mentions = validated_data.pop('mentions', [])
        # Create the note
        note = Note.objects.create(**validated_data)
        # Set the many-to-many field for mentions
        note.mentions.set(mentions)
        return note
    
    def update(self, instance, validated_data):
        # Extract the new mention list, if provided
        new_mentions = validated_data.pop('mentions', None)
        # Update other fields normally
        instance = super().update(instance, validated_data)
        
        if new_mentions is not None:
            # Get the current set of mentioned users
            current_mentions = set(instance.mentions.all())
            new_mentions_set = set(new_mentions)
            
            # Determine users removed and added
            removed_users = current_mentions - new_mentions_set
            added_users = new_mentions_set - current_mentions
            
            # Update the many-to-many field
            instance.mentions.set(new_mentions)
            
            # Remove mention notifications for removed users
            Mention.objects.filter(note=instance, user__in=removed_users).delete()
            
            # Create mention notifications for newly added users
            for user in added_users:
                Mention.objects.create(note=instance, user=user)
                
        return instance

