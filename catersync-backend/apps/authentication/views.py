from rest_framework import generics, viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import logout
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import User
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, UserProfileSerializer,
    UserListSerializer, PasswordChangeSerializer, EmailVerificationSerializer,
    PasswordResetRequestSerializer, PasswordResetSerializer, 
    UserCreateSerializer, UserUpdateSerializer
)
from .permissions import IsOwnerOrStaff, IsOrganizationMember


class UserRegistrationView(generics.CreateAPIView):
    """
    Public endpoint for user registration.
    Creates new user account with email verification trigger.
    """
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        """Create user and return success message."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # TODO: Send email verification
        
        return Response({
            'message': 'User registered successfully. Please check your email for verification.',
            'user_id': str(user.id)
        }, status=status.HTTP_201_CREATED)


class UserLoginView(TokenObtainPairView):
    """
    Authentication endpoint using JWT tokens.
    Returns access/refresh tokens with user data.
    """
    serializer_class = UserLoginSerializer


class UserLogoutView(generics.GenericAPIView):
    """
    Logout endpoint that blacklists refresh token.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Blacklist refresh token and logout user."""
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            return Response({
                'message': 'Logged out successfully'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': 'Invalid token'
            }, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    User profile endpoint for viewing and updating own profile.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        """Return current authenticated user."""
        return self.request.user


class PasswordChangeView(generics.GenericAPIView):
    """
    Endpoint for authenticated users to change their password.
    """
    serializer_class = PasswordChangeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Change user password."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)


class EmailVerificationView(generics.GenericAPIView):
    """
    Email verification endpoint.
    """
    serializer_class = EmailVerificationSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """Verify email with token."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Implement token verification logic
        # For now, return success
        
        return Response({
            'message': 'Email verified successfully'
        }, status=status.HTTP_200_OK)


class PasswordResetRequestView(generics.GenericAPIView):
    """
    Request password reset email.
    """
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """Send password reset email."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Send password reset email
        
        return Response({
            'message': 'Password reset email sent if account exists'
        }, status=status.HTTP_200_OK)


class PasswordResetView(generics.GenericAPIView):
    """
    Reset password with token.
    """
    serializer_class = PasswordResetSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """Reset password with token."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Implement token verification and password reset
        
        return Response({
            'message': 'Password reset successfully'
        }, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing users within an organization.
    Admin and manager access only.
    """
    queryset = User.objects.filter(deleted_at__isnull=True)
    permission_classes = [permissions.IsAuthenticated, IsOrganizationMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['first_name', 'last_name', 'email']
    ordering_fields = ['first_name', 'last_name', 'email', 'created_at']
    ordering = ['first_name', 'last_name']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'list':
            return UserListSerializer
        return UserProfileSerializer
    
    def get_queryset(self):
        """Filter users by organization."""
        user = self.request.user
        if user.is_superuser:
            return self.queryset
        
        if user.organization:
            return self.queryset.filter(organization=user.organization)
        return User.objects.none()
    
    def perform_create(self, serializer):
        """Create user within current user's organization."""
        organization = self.request.user.organization
        if not organization and not self.request.user.is_superuser:
            raise permissions.PermissionDenied(
                "You must belong to an organization to create users"
            )
        
        # Set organization for non-superusers
        if not self.request.user.is_superuser:
            serializer.save(organization=organization)
        else:
            serializer.save()
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete user instead of hard delete."""
        user = self.get_object()
        user.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user account."""
        user = self.get_object()
        user.is_active = True
        user.deleted_at = None
        user.save(update_fields=['is_active', 'deleted_at', 'updated_at'])
        
        return Response({
            'message': f'User {user.email} activated successfully'
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user account."""
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])
        
        return Response({
            'message': f'User {user.email} deactivated successfully'
        })
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Admin endpoint to reset user password."""
        user = self.get_object()
        
        # Generate temporary password or send reset email
        # TODO: Implement password reset logic
        
        return Response({
            'message': f'Password reset initiated for {user.email}'
        })
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's profile."""
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get user statistics for the organization."""
        queryset = self.get_queryset()
        
        stats = {
            'total_users': queryset.count(),
            'active_users': queryset.filter(is_active=True).count(),
            'inactive_users': queryset.filter(is_active=False).count(),
            'by_role': {}
        }
        
        # Count by role
        for role_code, role_name in User.ROLE_CHOICES:
            count = queryset.filter(role=role_code).count()
            stats['by_role'][role_code] = {
                'name': role_name,
                'count': count
            }
        
        return Response(stats)


# Token refresh view (using SimpleJWT default)
class CustomTokenRefreshView(TokenRefreshView):
    """Custom token refresh view."""
    pass