from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


# We will define our specific expense views here.
# For verification, we add a simple health check endpoint.
class HealthCheckView(APIView):
    """
    Public health check endpoint to verify database and server status.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "healthy", "message": "Django REST Framework server is running!"})


class RegisterView(APIView):
    """
    Endpoint for creating new CustomUser profiles.
    
    Why: Handles registration payload, saves new users, and immediately responds with
    JWT tokens to support seamless frontend login.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate credentials tokens for immediate sign-in (friction-reduction)
            refresh = RefreshToken.for_user(user)
            user_serializer = UserSerializer(user)
            
            return Response({
                "user": user_serializer.data,
                "refresh": str(refresh),
                "access": str(refresh.access_token)
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    Endpoint for authenticating existing users using email and password.
    
    Why: Bypasses standard username requirement, runs custom validation via LoginSerializer,
    and returns access/refresh tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user_data = UserSerializer(serializer.validated_data['user']).data
            return Response({
                "user": user_data,
                "refresh": serializer.validated_data['refresh'],
                "access": serializer.validated_data['access']
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    """
    Endpoint for retrieving the current active user profile.
    
    Why: Used by frontends during page loads to check if local JWT access token is valid
    and load active user state. Protects routes with IsAuthenticated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
