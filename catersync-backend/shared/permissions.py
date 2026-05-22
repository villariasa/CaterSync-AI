from rest_framework.permissions import BasePermission


class IsOrganizationMember(BasePermission):
    message = "You must belong to the requested organization."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
