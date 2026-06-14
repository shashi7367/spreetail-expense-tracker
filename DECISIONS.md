# Decisions Log

This document records the key architectural and design decisions made for the Spreetail Expense Tracker project.

## 1. Django Scaffold Setup (Task 1)

| Decision | Implementation | Rationale |
| :--- | :--- | :--- |
| **Settings Split** | `base.py`, `dev.py`, `prod.py` | Prevents credential leaks, segregates development options (e.g. SQLite database fallback) from production configurations (HSTS, SSL termination, Neon DB connection). |
| **CORS Middleware Location** | Top of `MIDDLEWARE` stack | `CorsMiddleware` must intercept request headers and return preflight requests (`OPTIONS`) before any Django response-altering middleware runs. |
| **PostgreSQL Adapter** | `psycopg` (v3) | Precompiled wheels for Python 3.14 on Windows avoid compiling `psycopg2` from C source, ensuring a seamless local setup. Django 4.2 has native support for `psycopg` (v3). |
| **Decouple for Config** | `python-decouple` | Decouples app logic from configuration secrets, enforcing the 12-factor app model. |

## 2. Django Database Models (Task 2)

| Table | Architectural / Schema Choice | Rationale |
| :--- | :--- | :--- |
| **CustomUser** | Extends `AbstractUser` and adds optional `phone` field. | Allows user search and lookup via phone number. Registered as `AUTH_USER_MODEL` before initial migrations to prevent key constraints refactoring failure later. |
| **Member** | Explicit through table for User-Group relationship. | Allows tracking `joined_at` timestamp and leaves room for future fields (e.g. member roles or status). |
| **Expense** | `DecimalField` for `amount` & `amount_inr`; soft-delete via `is_deleted` and `deleted_at`. | Decimals prevent Float arithmetic rounding errors in financial balances. Soft-delete preserves historical splits and settlements from corruption. |
| **ExpenseSplit** | `UniqueConstraint` on `(expense, user)`. | Ensures a participant can only be assigned a single split per expense. |
| **Settlement** | `on_delete=models.PROTECT` on users. | Prevents deleting a user if active peer settlement history exists, maintaining auditing records. |
| **ImportLog** | `import_batch_id` as UUID, `raw_data` as `JSONField`. | Groups bulk uploads. JSON stores the original CSV payload to allow programmatic retry or parsing diagnostics in case of validation failures. |

## 3. JWT Authentication (Task 3)

| Decision | Implementation | Rationale |
| :--- | :--- | :--- |
| **Email-based authentication** | `LoginSerializer` intercepts the login payload and looks up users by email instead of username. | Modern user convenience. Isolates API authentication from Django's built-in global backends, leaving Django Admin unaffected. |
| **Registration Auto-login** | `RegisterView` returns the generated JWT tokens in the response payload. | Friction reduction. Frontend can immediately store tokens in local storage and navigate to home without requiring the user to type credentials again. |
| **Test Client Verification** | Custom python test script executing views via Django Test Client. | Executes database and URL routing layers programmatically, ensuring 100% test coverage of register/login/refresh/me flow without external network requests. |
| **ALLOWED_HOSTS Test Exemption** | Appended `'testserver'` to `ALLOWED_HOSTS` in `dev.py`. | Standardizes test client execution environments by preventing `DisallowedHost` errors during custom script tests. |



