import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

# Choices for categorizing group expenses. Used for summary statistics/reports.
CATEGORY_CHOICES = [
    ('FOOD', 'Food & Dining'),
    ('TRAVEL', 'Travel & Transport'),
    ('STAY', 'Accommodation'),
    ('ENTERTAINMENT', 'Entertainment'),
    ('UTILITIES', 'Utilities'),
    ('OTHER', 'Other'),
]

# Source tracking for expenses.
IMPORT_SOURCES = [
    ('MANUAL', 'Manual Entry'),
    ('CSV', 'CSV Bulk Import'),
]

# Log processing status choices.
IMPORT_LOG_STATUS = [
    ('IMPORTED', 'Imported'),
    ('SKIPPED', 'Skipped'),
    ('WARNING', 'Warning'),
    ('ERROR', 'Error'),
]


class CustomUser(AbstractUser):
    """
    Extends Django's default AbstractUser.
    
    Why: By default, Django users have username, email, first/last names. We extend it
    to include contact details ('phone') to allow user search/invitation by phone number.
    It is defined immediately so the migrations use our custom user model from day one,
    preventing foreign key reference breakage later.
    """
    phone = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.username


class Group(models.Model):
    """
    Represents a shared expense group (e.g., Roommates, Trip).
    
    Why: Users group their shared transactions. We track who created the group for potential
    administrative controls, and the base currency for calculating aggregated balances.
    """
    name = models.CharField(max_length=255)
    # SET_NULL: If the group creator deletes their account, the group and its transaction
    # history are preserved. The creator field is simply set to Null.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_groups'
    )
    # Default currency to INR as requested.
    base_currency = models.CharField(max_length=3, default='INR')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Member(models.Model):
    """
    Explicit through table linking CustomUser and Group.
    
    Why: Django's default many-to-many intermediate table lacks metadata fields. By defining
    Member explicitly, we can log when the user joined the group and add status flags later.
    """
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevent duplicate memberships (e.g., adding user X to group Y multiple times).
        # Enables indexing to quickly verify group membership before making API requests.
        constraints = [
            models.UniqueConstraint(fields=['group', 'user'], name='unique_group_membership')
        ]

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"


class Expense(models.Model):
    """
    Represents an expense paid by one member on behalf of the group.
    
    Why: Expenses hold parent information (total cost, category, paid_by, date).
    Splits refer to this parent to divide the cost.
    """
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    # PROTECT: Prevents deleting the paying user if they have active expenses.
    # Keeps financial auditing logs consistent.
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='paid_expenses'
    )
    # DecimalField: Essential for financial values. Never use FloatField (floats cause rounding errors).
    # 12 digits total with 2 decimal places allows values up to 9,999,999,999.99 (9.9 Billion).
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    # Normalized amount in INR to compute sum total of balances across multi-currency expenses.
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2)
    
    description = models.CharField(max_length=500)
    category = models.CharField(max_length=100, choices=CATEGORY_CHOICES, default='OTHER')
    expense_date = models.DateField()
    import_source = models.CharField(max_length=10, choices=IMPORT_SOURCES, default='MANUAL')
    
    # Soft Delete configuration: Hide from UI but preserve in database for consistent split logs.
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description} ({self.amount} {self.currency})"


class ExpenseSplit(models.Model):
    """
    Represents a specific participant's share of an Expense.
    
    Why: For any expense, we need to know exactly how much each user owes.
    An Expense of 100 INR paid by User A can have splits: User A (50 INR), User B (50 INR).
    """
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    # PROTECT: A user cannot be deleted if they have unpaid/active debt logs.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='expense_splits'
    )
    share_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        # A participant can only have one split record per expense.
        constraints = [
            models.UniqueConstraint(fields=['expense', 'user'], name='unique_expense_split')
        ]

    def __str__(self):
        return f"{self.user.username} share: {self.share_amount} for {self.expense.description}"


class Settlement(models.Model):
    """
    Records a payment transaction between two users to resolve debts.
    
    Why: When User B pays User A 50 INR to settle, it is stored as a Settlement.
    Subtracting settlements from splits gives the net current balance.
    """
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='settlements')
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='sent_settlements'
    )
    paid_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='received_settlements'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    settled_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.paid_by.username} paid {self.amount} to {self.paid_to.username}"


class ImportLog(models.Model):
    """
    Audit and diagnostic log for CSV batch imports.
    
    Why: Allows engineers to trace failures during bulk CSV uploads (e.g. invalid user IDs,
    imbalanced splits). Enables display of detailed anomaly lists back to the user.
    """
    # UUID: Groups multiple rows uploaded in the same CSV file into a single batch ID.
    import_batch_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    row_number = models.IntegerField()
    status = models.CharField(max_length=20, choices=IMPORT_LOG_STATUS)
    # Anomaly tracking codes (e.g., 'IMBALANCED_SPLIT', 'USER_NOT_FOUND').
    anomaly_code = models.CharField(max_length=100, blank=True, null=True)
    anomaly_type = models.CharField(max_length=255, blank=True, null=True)
    # Stores the raw row payload to reproduce/debug parsing issues.
    raw_data = models.JSONField()
    # Narrative text describing actions taken (e.g., 'Row skipped due to validation failure').
    action_taken = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Batch {self.import_batch_id} | Row {self.row_number} | {self.status}"
