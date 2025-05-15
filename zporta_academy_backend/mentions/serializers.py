from rest_framework import serializers
from mentions.models import Mention

class MentionSerializer(serializers.ModelSerializer):
    # You can include additional note details by following the relation
    note_text = serializers.CharField(source="note.text", read_only=True)
    note_created_at = serializers.DateTimeField(source="note.created_at", read_only=True)
    # ← add this line to expose the diary writer’s username:
    note_author      = serializers.CharField(source="note.user.username", read_only=True)

    class Meta:
        model = Mention
        fields = [
            'id',
            'note',
            'note_text',
            'note_created_at',
            'note_author',
            'is_read',
            'created_at',
        ]
