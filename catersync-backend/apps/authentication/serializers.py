from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone',
            'password', 'password_confirm', 'organization'
        ]
        extra_kwargs = {
            'organization': {'required': False}
        }
    
    def validate(self, attrs):
        """Validate password confirmation and requirements."""
        password = attrs.get('password')
        password_confirm = attrs.pop('password_confirm', None)
        
        if password != password_confirm:
            raise serializers.ValidationError(
                {"password_confirm": "Password fields didn't match."}
            )
        
        # Use Django's password validation
        try:
            validate_password(password)
        except ValidationError as e:
            raise serializers.ValidationError({"password": e.messages})
        
        return attrs
    
    def create(self, validated_data):
        """Create user with encrypted password."""
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class UserLoginSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with additional user data."""
    
    def validate(self, attrs):
        """Validate credentials and return token with user data."""
        data = super().validate(attrs)
        
        # Add user information to the response
        user = self.user
        data['user'] = {
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'organization': {
                'id': str(user.organization.id) if user.organization else None,
                'name': user.organization.name if user.organization else None,
                'slug': user.organization.slug if user.organization else None,
            } if user.organization else None,
            'permissions': user.permissions,
            'is_staff': user.is_staff,
            'email_verified': user.email_verified_at is not None,
        }
        
        # Update last login timestamp
        user.update_last_login()
        
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile operations."""
    
    organization_name = serializers.CharField(
        source='organization.name', 
        read_only=True
    )
    organization_slug = serializers.CharField(
        source='organization.slug',
        read_only=True
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'phone',
            'role', 'permissions', 'avatar_url', 'is_active',
            'email_verified_at', 'last_login_at', 'created_at',
            'updated_at', 'organization', 'organization_name',
            'organization_slug'
        ]
        read_only_fields = [
            'id', 'email', 'role', 'permissions', 'is_active',
            'email_verified_at', 'last_login_at', 'created_at',
            'updated_at', 'organization'
        ]


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for user list operations."""
    
    full_name = serializers.ReadOnlyField()
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'is_active', 'organization_name',
            'created_at', 'last_login_at'
        ]


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for changing user password."""
    
    old_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate_old_password(self, value):
        """Validate old password."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
    
    def validate(self, attrs):
        """Validate new password confirmation."""
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')
        
        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": "New password fields didn't match."}
            )
        
        # Use Django's password validation
        try:
            validate_password(new_password)
        except ValidationError as e:
            raise serializers.ValidationError({"new_password": e.messages})
        
        return attrs
    
    def save(self):
        """Change user password."""
        user = self.context['request'].user
        new_password = self.validated_data['new_password']
        user.set_password(new_password)
        user.save(update_fields=['password', 'updated_at'])
        return user


class EmailVerificationSerializer(serializers.Serializer):
    """Serializer for email verification operations."""
    
    token = serializers.CharField()
    
    def validate_token(self, value):
        """Validate verification token."""
        # This would integrate with your email verification system
        # For now, we'll just validate that a token is provided
        if not value:
            raise serializers.ValidationError("Verification token is required.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request."""
    
    email = serializers.EmailField()
    
    def validate_email(self, value):
        """Validate that email exists in system."""
        if not User.objects.filter(email=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError(
                "No user found with this email address."
            )
        return value


class PasswordResetSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""
    
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        """Validate new password confirmation."""
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')
        
        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": "Password fields didn't match."}
            )
        
        # Use Django's password validation
        try:
            validate_password(new_password)
        except ValidationError as e:
            raise serializers.ValidationError({"new_password": e.messages})
        
        return attrs


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for admin user creation."""
    
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone',
            'role', 'organization', 'password', 'permissions'
        ]
        extra_kwargs = {
            'permissions': {'required': False, 'default': list}
        }
    
    def validate_password(self, value):
        """Validate password requirements."""
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value
    
    def create(self, validated_data):
        """Create user with encrypted password."""
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for admin user updates."""
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone', 'role',
            'permissions', 'is_active', 'avatar_url'
        ]
    
    def update(self, instance, validated_data):
        """Update user with validation."""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance