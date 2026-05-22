from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserRegistrationView, UserLoginView, UserLogoutView, UserProfileView,
    PasswordChangeView, EmailVerificationView, PasswordResetRequestView,
    PasswordResetView, UserViewSet, CustomTokenRefreshView
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    # Authentication endpoints
    path('register/', UserRegistrationView.as_view(), name='user_register'),
    path('login/', UserLoginView.as_view(), name='user_login'),
    path('logout/', UserLogoutView.as_view(), name='user_logout'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    
    # Profile endpoints
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('password/change/', PasswordChangeView.as_view(), name='password_change'),
    
    # Email verification
    path('email/verify/', EmailVerificationView.as_view(), name='email_verify'),
    
    # Password reset
    path('password/reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password/reset/', PasswordResetView.as_view(), name='password_reset'),
    
    # User management (admin endpoints)
    path('', include(router.urls)),
]