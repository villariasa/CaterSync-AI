from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from .models import Organization
from .serializers import (
    OrganizationSerializer, 
    OrganizationCreateSerializer,
    OrganizationListSerializer
)


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Organization CRUD operations with tenant management.
    Provides endpoints for tenant registration and management.
    """
    queryset = Organization.objects.filter(deleted_at__isnull=True)
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subscription_plan', 'subscription_status']
    search_fields = ['name', 'slug', 'email']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['name']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return OrganizationCreateSerializer
        elif self.action == 'list':
            return OrganizationListSerializer
        return OrganizationSerializer
    
    def get_queryset(self):
        """Filter organizations based on user permissions."""
        queryset = super().get_queryset()
        
        # If user has organization context, scope to their organization
        if hasattr(self.request, 'organization') and self.request.organization:
            # Allow users to see only their own organization
            return queryset.filter(id=self.request.organization.id)
        
        # For super users or during tenant registration, show all
        if self.request.user.is_superuser:
            return queryset
        
        # For non-super users without organization context, return empty
        return queryset.none()
    
    def perform_create(self, serializer):
        """Create organization with audit information."""
        serializer.save()
    
    def perform_update(self, serializer):
        """Update organization with audit information."""
        serializer.save()
    
    def perform_destroy(self, instance):
        """Soft delete the organization."""
        instance.soft_delete()
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate an organization's subscription."""
        organization = self.get_object()
        organization.subscription_status = 'active'
        organization.save(update_fields=['subscription_status', 'updated_at'])
        
        serializer = self.get_serializer(organization)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend an organization's subscription."""
        organization = self.get_object()
        organization.subscription_status = 'suspended'
        organization.save(update_fields=['subscription_status', 'updated_at'])
        
        serializer = self.get_serializer(organization)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate an organization's subscription."""
        organization = self.get_object()
        organization.subscription_status = 'inactive'
        organization.save(update_fields=['subscription_status', 'updated_at'])
        
        serializer = self.get_serializer(organization)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """
        Register a new organization (tenant registration endpoint).
        This allows creation without requiring existing organization context.
        """
        serializer = OrganizationCreateSerializer(data=request.data)
        if serializer.is_valid():
            organization = serializer.save()
            response_serializer = OrganizationSerializer(organization)
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
