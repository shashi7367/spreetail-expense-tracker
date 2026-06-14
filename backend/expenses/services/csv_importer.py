import csv
import io
import hashlib
import uuid
from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from django.db import transaction, models
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model

from expenses.models import (
    Group, Member, Expense, ExpenseSplit, Settlement, ImportLog
)

CustomUser = get_user_model()

# Exchange rates using INR as the anchor currency:
# 1 USD = 83.5 INR
# 1 EUR = 90.2 INR
# 1 INR = 1.0 INR
RATES_TO_INR = {
    'INR': Decimal('1.0'),
    'USD': Decimal('83.5'),
    'EUR': Decimal('90.2')
}


def parse_decimal(value):
    """
    Safely parse a string or number into a Decimal.
    """
    if value is None:
        return None
    cleaned = str(value).strip().replace(',', '')
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def parse_date(date_str):
    """
    Tries multiple date formats to parse the string into a datetime.date object.
    Returns None if parsing fails.
    """
    if not date_str:
        return None
    
    cleaned_date = str(date_str).strip()
    formats = [
        '%Y-%m-%d',
        '%d/%m/%Y',
        '%m/%d/%Y',
        '%Y/%m/%d',
        '%d-%m-%Y',
        '%m-%d-%Y',
        '%Y.%m.%d',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(cleaned_date, fmt).date()
        except ValueError:
            continue
    return None


def calculate_sha256(payer_email, amount, date_str, description):
    """
    Calculates a unique SHA-256 hash of the key row identifier fields.
    Format: lowercase(payer_email) + normalized_amount + date_str + trimmed_description
    """
    email_clean = str(payer_email).strip().lower()
    
    # Format amount to exactly 2 decimal places for consistency
    try:
        amt_decimal = Decimal(str(amount)).quantize(Decimal('0.01'))
        amt_str = f"{amt_decimal:.2f}"
    except Exception:
        amt_str = str(amount).strip()
        
    date_clean = str(date_str).strip()
    desc_clean = str(description).strip()
    
    input_str = f"{email_clean}{amt_str}{date_clean}{desc_clean}"
    return hashlib.sha256(input_str.encode('utf-8')).hexdigest()


class CSVImporter:
    @staticmethod
    def import_csv(file_content, group_id):
        """
        Parses the CSV data row-by-row and imports transaction records into the group.
        Detects anomalies ANO-001 through ANO-007.
        Runs each row in an atomic transaction savepoint so that row-level failures
        do not corrupt the rest of the batch or DB state.
        
        Args:
            file_content (bytes or str): CSV file data.
            group_id (int): ID of the destination expense Group.
            
        Returns:
            dict: The import_report JSON object summarizing results.
        """
        # Validate that group exists
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return {
                "error": f"Group with ID {group_id} does not exist.",
                "import_batch_id": str(uuid.uuid4()),
                "total_rows": 0,
                "imported_count": 0,
                "skipped_count": 0,
                "failed_count": 0,
                "warnings_count": 0,
                "rows": []
            }
            
        batch_id = uuid.uuid4()
        today_date = timezone.localdate()
        
        # Read file string
        if isinstance(file_content, bytes):
            csv_str = file_content.decode('utf-8-sig', errors='replace')
        else:
            csv_str = file_content
            
        reader = csv.DictReader(io.StringIO(csv_str))
        
        # Normalize field names to lowercase & trimmed for resilient matching
        if reader.fieldnames:
            reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
        else:
            reader.fieldnames = []
            
        # Compile existing active expense hashes to check for duplicate row (ANO-001)
        existing_hashes = set()
        active_expenses = Expense.objects.filter(group=group, is_deleted=False).select_related('paid_by')
        for exp in active_expenses:
            h = calculate_sha256(
                exp.paid_by.email,
                exp.amount,
                exp.expense_date.strftime('%Y-%m-%d'),
                exp.description
            )
            existing_hashes.add(h)
            
        # Keep track of hashes processed in this current batch to prevent intra-batch duplicates
        batch_processed_hashes = set()
        
        # Keep track of existing settlements for duplicate detection in reclassifications
        # A settlement duplicate is defined by: same paid_by (sender), paid_to (receiver), amount, and date.
        existing_settlements = list(Settlement.objects.filter(group=group).select_related('paid_by', 'paid_to'))
        
        import_report = {
            "import_batch_id": str(batch_id),
            "total_rows": 0,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "warnings_count": 0,
            "rows": []
        }
        
        # Keywords for settlement reclassification (ANO-003)
        settlement_keywords = ['settled', 'paid back', 'reimbursed', 'cleared', 'transfer', 'returning']
        
        row_number = 0
        for raw_row in reader:
            row_number += 1
            import_report["total_rows"] += 1
            
            # Map raw row keys to normalize access
            # Support alternative column names for developer/user convenience
            payer_email_raw = (
                raw_row.get('payer_email') or 
                raw_row.get('payer') or 
                raw_row.get('email') or 
                raw_row.get('paid_by') or 
                ''
            ).strip()
            
            amount_raw = (
                raw_row.get('amount') or 
                raw_row.get('value') or 
                raw_row.get('cost') or 
                ''
            ).strip()
            
            date_raw = (
                raw_row.get('date') or 
                raw_row.get('expense_date') or 
                raw_row.get('time') or 
                ''
            ).strip()
            
            currency_raw = (
                raw_row.get('currency') or 
                raw_row.get('curr') or 
                ''
            ).strip()
            
            description_raw = (
                raw_row.get('description') or 
                raw_row.get('desc') or 
                raw_row.get('memo') or 
                ''
            ).strip()
            
            participants_raw = (
                raw_row.get('participants') or 
                raw_row.get('splits') or 
                raw_row.get('members') or 
                ''
            ).strip()
            
            # Initialize row state tracking
            row_errors = []
            row_warnings = []
            row_anomalies = []
            row_status = 'IMPORTED'
            action_taken_list = []
            
            # 1. ANO-004: MISSING_REQUIRED_FIELD check
            missing_fields = []
            if not payer_email_raw:
                missing_fields.append('payer_email')
            if not amount_raw:
                missing_fields.append('amount')
            if not date_raw:
                missing_fields.append('date')
                
            if missing_fields:
                error_msg = f"Missing required fields: {', '.join(missing_fields)}"
                row_errors.append(error_msg)
                row_status = 'ERROR'
                row_anomalies.append('ANO-004')
                action_taken_list.append(f"Rejected row: {error_msg}")
                
                # Log to DB immediately
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='ANO-004',
                    anomaly_type='MISSING_REQUIRED_FIELD',
                    raw_data=raw_row,
                    action_taken=f"Rejected row: {error_msg}"
                )
                
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["ANO-004"],
                    "action_taken": f"Rejected row: {error_msg}",
                    "errors": [error_msg],
                    "original_data": raw_row
                })
                continue
                
            # 2. ANO-007: NEGATIVE_AMOUNT check
            amount = parse_decimal(amount_raw)
            if amount is None:
                error_msg = f"Invalid decimal amount: '{amount_raw}'"
                row_errors.append(error_msg)
                row_status = 'ERROR'
                row_anomalies.append('ANO-004') # Treating bad formatting as invalid/missing numerical value
                action_taken_list.append(f"Rejected row: {error_msg}")
                
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='ANO-004',
                    anomaly_type='MISSING_REQUIRED_FIELD',
                    raw_data=raw_row,
                    action_taken=f"Rejected row: {error_msg}"
                )
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["ANO-004"],
                    "action_taken": f"Rejected row: {error_msg}",
                    "errors": [error_msg],
                    "original_data": raw_row
                })
                continue
                
            if amount <= Decimal('0.00'):
                error_msg = f"Transaction amount must be positive. Found: {amount}"
                row_errors.append(error_msg)
                row_status = 'ERROR'
                row_anomalies.append('ANO-007')
                action_taken_list.append(f"Rejected row: {error_msg}")
                
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='ANO-007',
                    anomaly_type='NEGATIVE_AMOUNT',
                    raw_data=raw_row,
                    action_taken=f"Rejected row: {error_msg}"
                )
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["ANO-007"],
                    "action_taken": f"Rejected row: {error_msg}",
                    "errors": [error_msg],
                    "original_data": raw_row
                })
                continue
                
            # 3. Parse and Validate Date
            parsed_date = parse_date(date_raw)
            if not parsed_date:
                error_msg = f"Unable to parse date string: '{date_raw}'"
                row_errors.append(error_msg)
                row_status = 'ERROR'
                row_anomalies.append('ANO-004') # Bad format treated as missing valid field value
                action_taken_list.append(f"Rejected row: {error_msg}")
                
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='ANO-004',
                    anomaly_type='MISSING_REQUIRED_FIELD',
                    raw_data=raw_row,
                    action_taken=f"Rejected row: {error_msg}"
                )
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["ANO-004"],
                    "action_taken": f"Rejected row: {error_msg}",
                    "errors": [error_msg],
                    "original_data": raw_row
                })
                continue
                
            # 4. Look up Payer User Profile
            try:
                payer_user = CustomUser.objects.get(email__iexact=payer_email_raw)
            except CustomUser.DoesNotExist:
                error_msg = f"Payer email '{payer_email_raw}' does not exist in the system database."
                row_errors.append(error_msg)
                row_status = 'ERROR'
                row_anomalies.append('USER_NOT_FOUND')
                action_taken_list.append(f"Rejected row: {error_msg}")
                
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='USER_NOT_FOUND',
                    anomaly_type='USER_NOT_FOUND',
                    raw_data=raw_row,
                    action_taken=f"Rejected row: {error_msg}"
                )
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["USER_NOT_FOUND"],
                    "action_taken": f"Rejected row: {error_msg}",
                    "errors": [error_msg],
                    "original_data": raw_row
                })
                continue

            # Parse participant email addresses
            participant_emails = []
            if participants_raw:
                # Semicolon-separated list of emails
                participant_emails = [e.strip() for e in participants_raw.split(';') if e.strip()]
            
            # Resolve participant User Profiles
            participant_users = []
            found_all_participants = True
            for email in participant_emails:
                try:
                    p_user = CustomUser.objects.get(email__iexact=email)
                    participant_users.append(p_user)
                except CustomUser.DoesNotExist:
                    error_msg = f"Participant email '{email}' does not exist in the system database."
                    row_errors.append(error_msg)
                    row_status = 'ERROR'
                    row_anomalies.append('USER_NOT_FOUND')
                    action_taken_list.append(f"Rejected row: {error_msg}")
                    found_all_participants = False
                    break
                    
            if not found_all_participants:
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='USER_NOT_FOUND',
                    anomaly_type='USER_NOT_FOUND',
                    raw_data=raw_row,
                    action_taken=f"Rejected row: {error_msg}"
                )
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["USER_NOT_FOUND"],
                    "action_taken": f"Rejected row: {error_msg}",
                    "errors": [error_msg],
                    "original_data": raw_row
                })
                continue

            # 5. ANO-003: SETTLEMENT_AS_EXPENSE check
            desc_lower = description_raw.lower()
            is_settlement = any(keyword in desc_lower for keyword in settlement_keywords)
            
            # 6. ANO-001: DUPLICATE_ROW check
            row_date_str = parsed_date.strftime('%Y-%m-%d')
            row_hash = calculate_sha256(payer_user.email, amount, row_date_str, description_raw)
            
            is_duplicate = False
            if is_settlement:
                # For settlements, check duplicate against DB Settlements
                # First participant from CSV row is the receiver.
                # If no participants list is provided, but it is a settlement:
                # check if group has 2 members to resolve receiver.
                resolved_receiver = None
                if participant_users:
                    resolved_receiver = participant_users[0]
                else:
                    members = group.memberships.select_related('user')
                    if members.count() == 2:
                        resolved_receiver = next(m.user for m in members if m.user != payer_user)
                
                if resolved_receiver:
                    for s in existing_settlements:
                        # Convert both dates to ISO format comparison
                        s_date_str = s.settled_at.date().strftime('%Y-%m-%d') if hasattr(s.settled_at, 'date') else s.settled_at.strftime('%Y-%m-%d')
                        if (s.paid_by == payer_user and 
                                s.paid_to == resolved_receiver and 
                                s.amount == amount and 
                                s_date_str == row_date_str):
                            is_duplicate = True
                            break
            else:
                # For normal expenses, check duplicate using SHA-256 hash
                if row_hash in existing_hashes or row_hash in batch_processed_hashes:
                    is_duplicate = True

            if is_duplicate:
                row_status = 'SKIPPED'
                row_anomalies.append('ANO-001')
                action_msg = f"Skipped duplicate transaction row."
                action_taken_list.append(action_msg)
                
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='SKIPPED',
                    anomaly_code='ANO-001',
                    anomaly_type='DUPLICATE_ROW',
                    raw_data=raw_row,
                    action_taken=action_msg
                )
                import_report["skipped_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "SKIPPED",
                    "anomalies": ["ANO-001"],
                    "action_taken": action_msg,
                    "errors": [],
                    "original_data": raw_row
                })
                continue
                
            # Process non-duplicate transaction inside an atomic sub-transaction savepoint
            # This ensures any database integrity issues roll back just this row.
            try:
                with transaction.atomic():
                    # 7. ANO-006: MEMBERSHIP_CONFLICT checks
                    # Verify payer is a member of the group
                    is_payer_member = Member.objects.filter(group=group, user=payer_user).exists()
                    if not is_payer_member:
                        Member.objects.create(group=group, user=payer_user)
                        row_warnings.append(f"Auto-joined payer '{payer_user.email}' to group.")
                        if 'ANO-006' not in row_anomalies:
                            row_anomalies.append('ANO-006')
                            
                    # Verify all participants are members
                    for u in participant_users:
                        if not Member.objects.filter(group=group, user=u).exists():
                            Member.objects.create(group=group, user=u)
                            row_warnings.append(f"Auto-joined participant '{u.email}' to group.")
                            if 'ANO-006' not in row_anomalies:
                                row_anomalies.append('ANO-006')
                                
                    # 8. ANO-002: CURRENCY_MISMATCH checks and conversions
                    row_currency = currency_raw.upper() if currency_raw else group.base_currency.upper()
                    base_currency = group.base_currency.upper()
                    
                    original_amount = amount
                    original_currency = row_currency
                    
                    # Convert to base currency
                    converted_amount = amount
                    if row_currency != base_currency:
                        # Convert from row_currency to base_currency using rates anchored to INR
                        if row_currency in RATES_TO_INR and base_currency in RATES_TO_INR:
                            inr_amount = amount * RATES_TO_INR[row_currency]
                            converted_amount = (inr_amount / RATES_TO_INR[base_currency]).quantize(Decimal('0.01'))
                            row_warnings.append(
                                f"Currency mismatch: Converted {original_amount} {original_currency} to "
                                f"{converted_amount} {base_currency} (Base Currency)."
                            )
                            if 'ANO-002' not in row_anomalies:
                                row_anomalies.append('ANO-002')
                        else:
                            # Unsupported currency, cannot convert
                            raise ValueError(
                                f"Unsupported currency conversion from '{row_currency}' to '{base_currency}'."
                            )
                            
                    # Calculate amount in INR for the database model (amount_inr)
                    # Note: amount_inr is required for the Expense model.
                    if row_currency in RATES_TO_INR:
                        amount_inr = (amount * RATES_TO_INR[row_currency]).quantize(Decimal('0.01'))
                    else:
                        amount_inr = amount # fallback
                        
                    # 9. ANO-005: FUTURE_DATED check
                    if parsed_date > today_date:
                        row_warnings.append(f"Future dated transaction: {parsed_date} is after today ({today_date}).")
                        if 'ANO-005' not in row_anomalies:
                            row_anomalies.append('ANO-005')
                            
                    # 10. Perform DB Insertion depending on reclassification
                    if is_settlement:
                        # Log ANO-003 reclassification
                        if 'ANO-003' not in row_anomalies:
                            row_anomalies.append('ANO-003')
                            
                        # Find receiver
                        receiver = None
                        if participant_users:
                            receiver = participant_users[0]
                        else:
                            # Fallback: if exactly 2 members, receiver is the non-payer
                            memberships = group.memberships.select_related('user')
                            if memberships.count() == 2:
                                receiver = next(m.user for m in memberships if m.user != payer_user)
                                
                        if not receiver:
                            raise ValueError(
                                f"Cannot reclassify description '{description_raw}' as Settlement: "
                                "No participant email was listed to designate as the receiver."
                            )
                            
                        # Log reclassification actions
                        action_msg = (
                            f"Reclassified expense description '{description_raw}' as Settlement. "
                            f"Sender: {payer_user.email}, Receiver: {receiver.email}, "
                            f"Amount: {converted_amount} {base_currency}."
                        )
                        action_taken_list.append(action_msg)
                        
                        # Create Settlement record
                        settlement_dt = datetime.combine(parsed_date, datetime.min.time())
                        settlement_dt = timezone.make_aware(settlement_dt)
                        
                        settlement = Settlement.objects.create(
                            group=group,
                            paid_by=payer_user,
                            paid_to=receiver,
                            amount=converted_amount,
                            currency=base_currency,
                            settled_at=settlement_dt
                        )
                        
                        # Keep cached list updated for intra-batch duplicate checks
                        existing_settlements.append(settlement)
                        
                    else:
                        # Import as standard Expense
                        action_msg = f"Imported expense: '{description_raw}' of {converted_amount} {base_currency}."
                        action_taken_list.append(action_msg)
                        
                        expense = Expense.objects.create(
                            group=group,
                            paid_by=payer_user,
                            amount=converted_amount,
                            currency=base_currency,
                            amount_inr=amount_inr,
                            description=description_raw,
                            expense_date=parsed_date,
                            import_source='CSV'
                        )
                        
                        # Add splits
                        splits_to_create = []
                        if participant_users:
                            # Divide among explicitly listed participants
                            participants_list = participant_users
                        else:
                            # Auto-split equally among all members currently in the group
                            memberships = group.memberships.all()
                            participants_list = [m.user for m in memberships]
                            
                        part_count = len(participants_list)
                        if part_count == 0:
                            raise ValueError("Cannot divide splits: group has no members.")
                            
                        # Quantized division to 2 decimal places to avoid remainder errors
                        share = (converted_amount / Decimal(str(part_count))).quantize(Decimal('0.01'))
                        total_shares = share * Decimal(str(part_count))
                        remainder = converted_amount - total_shares
                        
                        for idx, p_user in enumerate(participants_list):
                            user_share = share
                            # Resolve remainder by assigning it to the payer if they are in the split,
                            # or else the first participant.
                            if idx == 0:
                                user_share += remainder
                                
                            splits_to_create.append(
                                ExpenseSplit(expense=expense, user=p_user, share_amount=user_share)
                            )
                            
                        ExpenseSplit.objects.bulk_create(splits_to_create)
                        
                        # Add hash to processed set
                        batch_processed_hashes.add(row_hash)
                        
                    # Final status determination
                    if row_warnings:
                        row_status = 'WARNING'
                        import_report["warnings_count"] += 1
                        log_action = "Imported with warnings: " + "; ".join(row_warnings)
                    else:
                        row_status = 'IMPORTED'
                        import_report["imported_count"] += 1
                        log_action = "Imported successfully."
                        
                    # Create ImportLog entry for successful/warning imports
                    ImportLog.objects.create(
                        import_batch_id=batch_id,
                        row_number=row_number,
                        status=row_status,
                        anomaly_code=",".join(row_anomalies) if row_anomalies else None,
                        anomaly_type=",".join(row_anomalies) if row_anomalies else None,
                        raw_data=raw_row,
                        action_taken=log_action + " | " + " | ".join(action_taken_list)
                    )
                    
                    import_report["rows"].append({
                        "row_number": row_number,
                        "status": row_status,
                        "anomalies": row_anomalies,
                        "action_taken": log_action + " | " + " | ".join(action_taken_list),
                        "errors": [],
                        "original_data": raw_row
                    })
                    
            except Exception as e:
                # Something failed inside the row import database transactions
                error_msg = f"Failed to save row: {str(e)}"
                row_errors.append(error_msg)
                
                # Create ImportLog entry for failure
                ImportLog.objects.create(
                    import_batch_id=batch_id,
                    row_number=row_number,
                    status='ERROR',
                    anomaly_code='SAVE_ERROR',
                    anomaly_type='DATABASE_SAVE_FAILURE',
                    raw_data=raw_row,
                    action_taken=error_msg
                )
                
                import_report["failed_count"] += 1
                import_report["rows"].append({
                    "row_number": row_number,
                    "status": "ERROR",
                    "anomalies": ["DATABASE_SAVE_FAILURE"],
                    "action_taken": error_msg,
                    "errors": row_errors,
                    "original_data": raw_row
                })
                
        return import_report
