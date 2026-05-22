"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)


admin.site.site_header = "CaterSync AI Administration"
admin.site.site_title = "CaterSync AI Admin"
admin.site.index_title = "Operations Console"


def health_check(_request):
    return JsonResponse({"service": "catersync-backend", "status": "ok"})

urlpatterns = [
    path("", health_check, name="root-health-check"),
    path("api/health/", health_check, name="api-health-check"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/tenants/", include("apps.tenants.urls")),
    path('admin/', admin.site.urls),
]
