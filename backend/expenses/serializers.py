from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    """
    Serializes CustomUser profile data.
    
    Why: Sanitizes user info, returning only safe public/private fields and excluding password hashes.
    """
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'phone', 'first_name', 'last_name']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    """
    Validates registration inputs and handles user creation.
    
    Why: Customizes user creation logic. Enforces that email must be unique, and hashes the
    plain-text password during DB write.
    """
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'password', 'phone', 'first_name', 'last_name']

    def validate_email(self, value):
        # Enforce unique email check manually, as AbstractUser email is not unique by default in Django.
        if not value:
            raise serializers.ValidationError("Email address is required.")
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return value

    def create(self, validated_data):
        # create_user automatically handles secure password hashing before DB write.
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            phone=validated_data.get('phone', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user


class LoginSerializer(serializers.Serializer):
    """
    Authenticates a user via email and password, returning tokens and user data.
    
    Why: Custom authentication serialization that bypasses username requirements in default simplejwt.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise serializers.ValidationError("Both email and password are required.")

        # Find user by email (case insensitive search for better user experience)
        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("No active account found with the given credentials.")

        # Verify password hash
        if not user.check_password(password):
            raise serializers.ValidationError("No active account found with the given credentials.")

        if not user.is_active:
            raise serializers.ValidationError("This user account is deactivated.")

        # Programmatically generate tokens
        refresh = RefreshToken.for_user(user)

        return {
            'user': user,
            'refresh': str(refresh),
            'access': str(refresh.access_token)
        }
