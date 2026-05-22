from rest_framework import permissions
from django.core.exceptions import PermissionDenied


class IsOwnerOrStaff(permissions.BasePermission):
    """
    Permission that allows access only to object owners or staff members.
    """
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user can access the specific object.
        """
        # Staff can access any object
        if request.user.is_staff:
            return True
        
        # Check if object has user field for ownership
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        # Check if object is the user themselves
        if hasattr(obj, 'id') and hasattr(request.user, 'id'):
            return obj.id == request.user.id
        
        return False


class IsOrganizationMember(permissions.BasePermission):
    """
    Permission that allows access only to members of the same organization.
    """
    
    def has_permission(self, request, view):
        """
        Check if user belongs to an organization.
        """
        # Superusers can access everything
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        return True
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user can access the specific object within their organization.
        """
        # Superusers can access everything
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        # Check if object belongs to the same organization
        if hasattr(obj, 'organization'):
            return obj.organization == request.user.organization
        
        # For user objects, check if they belong to the same organization
        if hasattr(obj, 'id') and hasattr(obj, 'organization'):
            return obj.organization == request.user.organization
        
        return True


class IsOrganizationAdmin(permissions.BasePermission):
    """
    Permission that allows access only to organization administrators.
    """
    
    def has_permission(self, request, view):
        """
        Check if user is an organization admin.
        """
        # Superusers can access everything
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization and have admin role
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        # Check if user has admin role
        return request.user.role in ['admin', 'manager']
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user can access the specific object as an admin.
        """
        # Superusers can access everything
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization and have admin role
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        if request.user.role not in ['admin', 'manager']:
            return False
        
        # Check if object belongs to the same organization
        if hasattr(obj, 'organization'):
            return obj.organization == request.user.organization
        
        return True


class IsOwnerOrOrganizationAdmin(permissions.BasePermission):
    """
    Permission that allows access to object owners or organization administrators.
    """
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user is owner or organization admin.
        """
        # Superusers can access everything
        if request.user.is_superuser:
            return True
        
        # Check if user is the owner
        if hasattr(obj, 'user') and obj.user == request.user:
            return True
        
        # Check if object is the user themselves
        if hasattr(obj, 'id') and hasattr(request.user, 'id'):
            if obj.id == request.user.id:
                return True
        
        # Check if user is organization admin
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        if request.user.role not in ['admin', 'manager']:
            return False
        
        # Check if object belongs to the same organization
        if hasattr(obj, 'organization'):
            return obj.organization == request.user.organization
        
        return True


class CanManageUsers(permissions.BasePermission):
    """
    Permission for managing users within organization.
    """
    
    def has_permission(self, request, view):
        """
        Check if user can manage users.
        """
        # Superusers can manage all users
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        # Must have admin or manager role
        return request.user.role in ['admin', 'manager']


class CanViewReports(permissions.BasePermission):
    """
    Permission for viewing reports and analytics.
    """
    
    def has_permission(self, request, view):
        """
        Check if user can view reports.
        """
        # Superusers can view all reports
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        # Must have appropriate role for viewing reports
        return request.user.role in ['admin', 'manager', 'staff']


class IsReadOnlyOrOrganizationAdmin(permissions.BasePermission):
    """
    Permission that allows read-only access to organization members,
    but write access only to organization admins.
    """
    
    def has_permission(self, request, view):
        """
        Check if user has permission based on request method.
        """
        # Superusers can do everything
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        # Read permissions for all organization members
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for admins/managers
        return request.user.role in ['admin', 'manager']
    
    def has_object_permission(self, request, view, obj):
        """
        Check object-level permissions.
        """
        # Superusers can access everything
        if request.user.is_superuser:
            return True
        
        # User must belong to an organization
        if not hasattr(request.user, 'organization') or not request.user.organization:
            return False
        
        # Check if object belongs to the same organization
        if hasattr(obj, 'organization'):
            if obj.organization != request.user.organization:
                return False
        
        # Read permissions for all organization members
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for admins/managers
        return request.user.role in ['admin', 'manager']