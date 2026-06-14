from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import CustomUser, Group, Member, Expense, ExpenseSplit


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


class GroupSerializer(serializers.ModelSerializer):
    """
    Serializes basic Group info.
    
    Why: Handles creating a group and automatically registers the creator as a Member.
    """
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'created_by', 'base_currency', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']

    def create(self, validated_data):
        request = self.context.get('request')
        creator = request.user
        group = Group.objects.create(created_by=creator, **validated_data)
        
        # Auto-join the group creator as the first member of the group
        Member.objects.create(group=group, user=creator)
        return group


class GroupDetailSerializer(serializers.ModelSerializer):
    """
    Serializes detailed Group info, including the list of Members.
    
    Why: Used for detailed group pages where the frontend needs to show participant names.
    """
    created_by = UserSerializer(read_only=True)
    members = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'created_by', 'base_currency', 'created_at', 'members']

    def get_members(self, obj):
        # Fetch all user objects linked to this group via memberships
        memberships = obj.memberships.select_related('user')
        users = [m.user for m in memberships]
        return UserSerializer(users, many=True).data


class ExpenseSplitSerializer(serializers.ModelSerializer):
    """
    Serializes participant share details for a specific expense.
    
    Why: Details which user owes how much for the parent expense.
    """
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = ExpenseSplit
        fields = ['id', 'user', 'user_id', 'share_amount']


class ExpenseSerializer(serializers.ModelSerializer):
    """
    Serializes Expense details, including splits.
    
    Why: Implements auto-splitting (equal split across group members by default)
    and validates that the sum of split shares equals the total expense amount.
    """
    paid_by = UserSerializer(read_only=True)
    paid_by_id = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(), source='paid_by', required=False
    )
    splits = ExpenseSplitSerializer(many=True, required=False)

    class Meta:
        model = Expense
        fields = [
            'id', 'group', 'paid_by', 'paid_by_id', 'amount', 'currency', 
            'amount_inr', 'description', 'category', 'expense_date', 
            'import_source', 'is_deleted', 'deleted_at', 'created_at', 'splits'
        ]
        read_only_fields = ['id', 'paid_by', 'amount_inr', 'is_deleted', 'deleted_at', 'created_at']

    def create(self, validated_data):
        from decimal import Decimal
        request = self.context.get('request')
        
        # Default paid_by to request.user if not specified
        if 'paid_by' not in validated_data and request:
            validated_data['paid_by'] = request.user

        # Set amount_inr. For simplicity, default to 1:1 with amount if not provided
        amount = validated_data['amount']
        amount_inr_raw = self.initial_data.get('amount_inr')
        if amount_inr_raw is not None:
            validated_data['amount_inr'] = Decimal(str(amount_inr_raw))
        else:
            validated_data['amount_inr'] = amount

        splits_data = self.initial_data.get('splits')
        group = validated_data['group']

        expense = Expense.objects.create(**validated_data)

        if splits_data:
            # Custom splits passed in request
            total_split = Decimal('0.00')
            splits_to_create = []
            for split in splits_data:
                user = CustomUser.objects.get(id=split['user_id'])
                share = Decimal(str(split['share_amount']))
                total_split += share
                splits_to_create.append(ExpenseSplit(expense=expense, user=user, share_amount=share))

            # Financial integrity validation
            if total_split != amount:
                expense.delete()
                raise serializers.ValidationError({"splits": "The sum of split share amounts must equal the total expense amount."})
            
            ExpenseSplit.objects.bulk_create(splits_to_create)
        else:
            # Auto-split equally among all members of the group
            memberships = group.memberships.all()
            member_count = memberships.count()
            if member_count == 0:
                expense.delete()
                raise serializers.ValidationError({"group": "Cannot create an expense in a group with no members."})

            # Divide amount equally using Decimal division to prevent binary float representation error
            share = (amount / Decimal(str(member_count))).quantize(Decimal('0.01'))
            
            # Resolve remainder by assigning it to the payer's share
            total_calculated = share * Decimal(str(member_count))
            remainder = amount - total_calculated

            splits_to_create = []
            for m in memberships:
                user_share = share
                if m.user == expense.paid_by:
                    user_share += remainder
                splits_to_create.append(ExpenseSplit(expense=expense, user=m.user, share_amount=user_share))
            
            ExpenseSplit.objects.bulk_create(splits_to_create)

        return expense

    def update(self, instance, validated_data):
        from decimal import Decimal
        
        # Update core fields
        instance.description = validated_data.get('description', instance.description)
        instance.amount = validated_data.get('amount', instance.amount)
        instance.currency = validated_data.get('currency', instance.currency)
        instance.expense_date = validated_data.get('expense_date', instance.expense_date)
        instance.category = validated_data.get('category', instance.category)
        
        amount_inr_raw = self.initial_data.get('amount_inr')
        if amount_inr_raw is not None:
            instance.amount_inr = Decimal(str(amount_inr_raw))
        elif 'amount' in validated_data:
            instance.amount_inr = validated_data['amount']

        instance.save()

        # Update splits if provided
        splits_data = self.initial_data.get('splits')

        if splits_data is not None:
            # Recreate custom splits
            instance.splits.all().delete()
            total_split = Decimal('0.00')
            splits_to_create = []
            for split in splits_data:
                user = CustomUser.objects.get(id=split['user_id'])
                share = Decimal(str(split['share_amount']))
                total_split += share
                splits_to_create.append(ExpenseSplit(expense=instance, user=user, share_amount=share))

            if total_split != instance.amount:
                raise serializers.ValidationError({"splits": "The sum of split share amounts must equal the total expense amount."})
            
            ExpenseSplit.objects.bulk_create(splits_to_create)
        elif 'amount' in validated_data:
            # Amount changed but no splits passed - recalculate equal splits
            instance.splits.all().delete()
            group = instance.group
            memberships = group.memberships.all()
            member_count = memberships.count()
            if member_count > 0:
                share = (instance.amount / Decimal(str(member_count))).quantize(Decimal('0.01'))
                total_calculated = share * Decimal(str(member_count))
                remainder = instance.amount - total_calculated

                splits_to_create = []
                for m in memberships:
                    user_share = share
                    if m.user == instance.paid_by:
                        user_share += remainder
                    splits_to_create.append(ExpenseSplit(expense=instance, user=m.user, share_amount=user_share))
                ExpenseSplit.objects.bulk_create(splits_to_create)

        return instance
