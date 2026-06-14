from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import HealthCheckView, RegisterView, LoginView, MeView

urlpatterns = [
    # Health checks
    path('health/', HealthCheckView.as_view(), name='health_check'),
    
    # Authentication routes
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
]
