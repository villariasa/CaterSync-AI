from rest_framework import serializers
from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model with full CRUD operations."""
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'address', 'phone', 'email', 'website',
            'logo_url', 'subscription_plan', 'subscription_status',
            'subscription_expires_at', 'settings', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_slug(self, value):
        """Ensure slug is unique and valid format."""
        if not value:
            raise serializers.ValidationError("Slug is required")
        
        # Check uniqueness for new objects or updates to different slugs
        if self.instance and self.instance.slug == value:
            return value
            
        if Organization.objects.filter(slug=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Organization with this slug already exists")
        
        return value


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new organizations with required fields."""
    
    class Meta:
        model = Organization
        fields = [
            'name', 'slug', 'address', 'phone', 'email', 'website',
            'subscription_plan'
        ]
    
    def validate_slug(self, value):
        """Ensure slug is unique for new organizations."""
        if Organization.objects.filter(slug=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Organization with this slug already exists")
        return value
    
    def create(self, validated_data):
        """Create organization with default active status."""
        validated_data['subscription_status'] = 'active'
        return super().create(validated_data)


class OrganizationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing organizations."""
    
    is_active = serializers.ReadOnlyField()
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'subscription_plan', 'subscription_status',
            'is_active', 'created_at'
        ]