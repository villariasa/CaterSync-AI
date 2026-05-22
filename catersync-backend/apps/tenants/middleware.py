from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.urls import reverse
from .models import Organization


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to handle tenant resolution and organization scoping.
    Extracts organization from request headers or URL patterns.
    """
    
    def process_request(self, request):
        # Skip tenant resolution for admin, health checks, and auth endpoints
        skip_paths = [
            '/admin/',
            '/api/health/',
            '/api/auth/',
            '/',  # Root health check
        ]
        
        if any(request.path.startswith(path) for path in skip_paths):
            return None
        
        # Try to get organization from X-Organization header
        org_identifier = request.META.get('HTTP_X_ORGANIZATION')
        
        if not org_identifier:
            # Try to extract from subdomain (if using subdomain-based routing)
            host = request.get_host().split(':')[0]  # Remove port
            subdomain = host.split('.')[0] if '.' in host else None
            if subdomain and subdomain != 'www':
                org_identifier = subdomain
        
        if org_identifier:
            try:
                # Try to find organization by slug first, then by ID
                if org_identifier.count('-') == 4:  # Looks like a UUID
                    organization = Organization.objects.get(
                        id=org_identifier,
                        deleted_at__isnull=True
                    )
                else:
                    organization = Organization.objects.get(
                        slug=org_identifier,
                        deleted_at__isnull=True
                    )
                
                # Check if organization is active
                if not organization.is_active:
                    return JsonResponse(
                        {'error': 'Organization subscription is not active'}, 
                        status=403
                    )
                
                # Add organization to request
                request.organization = organization
                
            except Organization.DoesNotExist:
                return JsonResponse(
                    {'error': 'Organization not found'}, 
                    status=404
                )
        else:
            # For API endpoints that require organization, return error
            if request.path.startswith('/api/') and not any(
                request.path.startswith(path) for path in skip_paths
            ):
                return JsonResponse(
                    {'error': 'Organization identifier required in X-Organization header'}, 
                    status=400
                )
        
        return None