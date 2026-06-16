from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    HealthCheckView, RegisterView, LoginView, MeView, 
    GroupViewSet, ExpenseViewSet, CSVImportView,
    BudgetViewSet, NotificationViewSet, OCRScanView,
    AnalyticsSummaryView, ExpensePredictionView
)

# Initialize DRF Router to dynamically build REST paths for ViewSets
router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'budgets', BudgetViewSet, basename='budget')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    # Health checks
    path('health/', HealthCheckView.as_view(), name='health_check'),
    
    # Authentication routes
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    
    # CSV Import route
    path('import/csv/', CSVImportView.as_view(), name='csv_import'),
    
    # Custom API endpoints
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics_summary'),
    path('analytics/predict/', ExpensePredictionView.as_view(), name='analytics_predict'),
    path('ocr/scan/', OCRScanView.as_view(), name='ocr_scan'),
    
    # Routers (Groups, Expenses, Budgets, Notifications endpoints)
    path('', include(router.urls)),
]

