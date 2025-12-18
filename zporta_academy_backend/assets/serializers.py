from rest_framework import serializers
from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    """
    Serializer for Asset model with computed fields.
    """
    url = serializers.SerializerMethodField()
    path = serializers.SerializerMethodField()
    
    class Meta:
        model = Asset
        fields = ['id', 'kind', 'url', 'path', 'original_filename', 'suggested_name', 'provider', 'created_at']
        read_only_fields = ['id', 'url', 'path', 'created_at', 'suggested_name']
    
    def get_url(self, obj):
        """Return full URL to the asset."""
        return obj.get_url()
    
    def get_path(self, obj):
        """Return relative path to the asset."""
        return obj.get_path()


class AssetUploadSerializer(serializers.ModelSerializer):
    """
    Serializer for uploading assets with kind.
    """
    file = serializers.FileField(required=True)
    kind = serializers.ChoiceField(choices=Asset.ASSET_KINDS, required=True)
    
    class Meta:
        model = Asset
        fields = ['file', 'kind', 'provider']
    
    def create(self, validated_data):
        """Create asset and auto-set original_filename."""
        file_obj = validated_data['file']
        validated_data['original_filename'] = file_obj.name
        return super().create(validated_data)


class AssetResolveSerializer(serializers.Serializer):
    """
    Serializer for resolving asset IDs to URLs/paths.
    Accepts { "ids": ["uuid1", "uuid2", ...] }
    """
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=True,
        help_text="List of asset UUIDs to resolve"
    )
    
    def to_representation(self, instance):
        """
        Override to return resolved assets.
        instance should be { 'ids': [...] }
        """
        # This will be handled in the view
        return instance
