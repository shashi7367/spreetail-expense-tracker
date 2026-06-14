from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone

from .models import CustomUser, Group, Member, Expense, ExpenseSplit, Settlement
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    GroupSerializer, GroupDetailSerializer, ExpenseSerializer
)


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


class GroupViewSet(viewsets.ModelViewSet):
    """
    ModelViewSet handling Group actions: Listing, Creating, Retrieving.
    Includes custom actions for joining groups and calculating simplified debts.
    """
    queryset = Group.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        # Return detailed serializer (with member lists) for retrieve detail views.
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer

    def get_queryset(self):
        # For 'join' action, we must allow looking up any group in the database,
        # otherwise self.get_object() raises a 404 since the user is not yet a member.
        if self.action == 'join':
            return Group.objects.all()

        # Limit Group visibility to groups the current user belongs to (membership check)
        user = self.request.user
        return Group.objects.filter(memberships__user=user)

    @action(detail=True, methods=['post'], url_path='join')
    def join(self, request, pk=None):
        """
        Custom POST route allowing the active user to join this group.
        Path: POST /api/groups/{id}/join/
        """
        group = self.get_object()
        user = request.user

        # Prevent duplicate group memberships
        if Member.objects.filter(group=group, user=user).exists():
            return Response(
                {"detail": "You are already a member of this group."},
                status=status.HTTP_400_BAD_REQUEST
            )

        Member.objects.create(group=group, user=user)
        return Response(
            {"detail": f"Successfully joined group '{group.name}'."},
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'], url_path='balances')
    def balances(self, request, pk=None):
        """
        Custom GET route to compute who owes whom using flow minimization.
        Path: GET /api/groups/{id}/balances/
        """
        from decimal import Decimal
        group = self.get_object()

        # Step 1: Initialize net balances for all members of the group to 0.00
        memberships = group.memberships.select_related('user')
        net_balances = {m.user: Decimal('0.00') for m in memberships}

        # Step 2: Process all active expenses and splits
        # Exclude soft-deleted expenses
        expenses = group.expenses.filter(is_deleted=False).prefetch_related('splits')
        for exp in expenses:
            # Payer gets positive balance credit for the amount they spent
            if exp.paid_by in net_balances:
                net_balances[exp.paid_by] += exp.amount
            
            # Participants get negative balance debt for their split share
            for split in exp.splits.all():
                if split.user in net_balances:
                    net_balances[split.user] -= split.share_amount

        # Step 3: Process all peer settlements
        settlements = group.settlements.all()
        for setl in settlements:
            # Sender gets positive credit because they paid off some of their debt
            if setl.paid_by in net_balances:
                net_balances[setl.paid_by] += setl.amount
            # Receiver gets negative debit because they received cash and are owed less
            if setl.paid_to in net_balances:
                net_balances[setl.paid_to] -= setl.amount

        # Step 4: Segregate into debtors and creditors
        # Quantize to 2 decimal places to avoid floating-point/precision issues
        debtors = []
        creditors = []
        for user, bal in net_balances.items():
            bal = bal.quantize(Decimal('0.01'))
            if bal < 0:
                debtors.append({'user': user, 'balance': bal})
            elif bal > 0:
                creditors.append({'user': user, 'balance': bal})

        # Sort lists: most negative first (largest debtors), most positive first (largest creditors)
        debtors.sort(key=lambda x: x['balance'])
        creditors.sort(key=lambda x: x['balance'], reverse=True)

        # Step 5: Greedy flow minimization matching
        simplified_debts = []
        d_idx = 0
        c_idx = 0

        while d_idx < len(debtors) and c_idx < len(creditors):
            debtor = debtors[d_idx]
            creditor = creditors[c_idx]

            debt_to_resolve = abs(debtor['balance'])
            credit_to_resolve = creditor['balance']

            # Resolve the minimum common amount
            transfer = min(debt_to_resolve, credit_to_resolve).quantize(Decimal('0.01'))

            if transfer > 0:
                simplified_debts.append({
                    "debtor": {
                        "id": debtor['user'].id,
                        "username": debtor['user'].username,
                        "email": debtor['user'].email
                    },
                    "creditor": {
                        "id": creditor['user'].id,
                        "username": creditor['user'].username,
                        "email": creditor['user'].email
                    },
                    "amount": float(transfer)
                })

            # Update remaining balances
            debtor['balance'] += transfer
            creditor['balance'] -= transfer

            # Move pointer forward if balance is fully cleared
            if debtor['balance'].quantize(Decimal('0.01')) == 0:
                d_idx += 1
            if creditor['balance'].quantize(Decimal('0.01')) == 0:
                c_idx += 1

        return Response(simplified_debts, status=status.HTTP_200_OK)


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    ModelViewSet handling Expense actions.
    Enforces soft delete on DELETE and filters active expenses.
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Show only active, non-deleted expenses that belong to groups the user is member of.
        user = self.request.user
        queryset = Expense.objects.filter(is_deleted=False, group__memberships__user=user)
        
        # Optional filter by group_id query parameter
        group_id = self.request.query_params.get('group_id')
        if group_id is not None:
            queryset = queryset.filter(group_id=group_id)
        
        # Optimize queries by fetching related fields
        return queryset.select_related('group', 'paid_by').prefetch_related('splits__user')

    def destroy(self, request, *args, **kwargs):
        """
        Overridden DELETE route to execute soft-deletion.
        Path: DELETE /api/expenses/{id}/
        """
        instance = self.get_object()
        
        # Perform soft-deletion
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
