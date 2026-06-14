from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

# We will define our specific expense views here.
# For verification, we add a simple health check endpoint.
class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "healthy", "message": "Django REST Framework server is running!"})
