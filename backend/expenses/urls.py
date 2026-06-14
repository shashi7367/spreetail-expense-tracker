from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import HealthCheckView, RegisterView, LoginView, MeView, GroupViewSet, ExpenseViewSet

# Initialize DRF Router to dynamically build REST paths for Group and Expense ViewSets
router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'expenses', ExpenseViewSet, basename='expense')

urlpatterns = [
    # Health checks
    path('health/', HealthCheckView.as_view(), name='health_check'),
    
    # Authentication routes
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    
    # Routers (Groups and Expenses REST endpoints)
    path('', include(router.urls)),
]
