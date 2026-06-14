# Decisions Log

This document records the key architectural and design decisions made for the Spreetail Expense Tracker project.

---

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
| **Email-based authentication** | `LoginSerializer` looks up users by email instead of username. | Modern user convenience. Case-insensitive lookup prevents authentication friction. |
| **Registration Auto-login** | `RegisterView` returns the generated JWT tokens in the response payload. | Friction reduction. Frontend can immediately store tokens in local storage and navigate to home without requiring the user to type credentials again. |
| **Test Client Verification** | Custom python test script executing views via Django Test Client. | Executes database and URL routing layers programmatically, ensuring 100% test coverage of register/login/refresh/me flow without external network requests. |

## 4. Group and Expense CRUD (Task 4 & 6)

| Decision / Feature | Implementation | Rationale |
| :--- | :--- | :--- |
| **ModelViewSet pattern** | `GroupViewSet` and `ExpenseViewSet`. | Bundles standard REST CRUD actions into unified structures, reducing route definitions and keeping APIs uniform. |
| **Membership Filtering** | `get_queryset` limits standard actions to groups where the user is a member. | Enforces strict multi-tenant boundary security so users cannot query or edit groups they are not members of. |
| **Auto-Split Remainder Distribution** | Division remainder assigned to the payer. | Ensures that division splits (e.g. 10.00 / 3) sum *exactly* to the total amount (3.33 + 3.33 + 3.34 = 10.00) without float/rounding discrepancies. |
| **Greedy Flow-Minimization** | Greedy matching between sorted list of creditors and debtors. | Minimizes the total volume and count of actual peer payments required. E.g. collapses multiple indirect debts into single direct ones (Aisha's "one number per person"). |
| **Soft Delete override** | View overrides `destroy()` to set `is_deleted=True` and `deleted_at = now()`. | Preserves historical ledger integrity in splits and settlements while hiding the expense from standard queries (Meera's "approve changes"). |

## 5. React Frontend Scaffold (Task 5)

| Decision / Feature | Implementation | Rationale |
| :--- | :--- | :--- |
| **Token Refresh Interceptor** | Axios response interceptor intercepts `401 Unauthorized` responses and silently requests new access tokens. | Preserves active user sessions seamlessly without interrupting workflows or forcing frequent re-logins. |
| **Global Auth Loading Guard** | `loading` state in `AuthContext` gates rendering in `ProtectedRoute`. | Prevents flashing of content or premature redirects to `/login` during initial mounting while checking token validity. |
| **Premium Theme Styling** | Tailwind v4 dark-slate color palette combined with blur backdrops and radial glow gradients. | Delivers a state-of-the-art aesthetic and visual experience. |

## 6. CSV Importing & Anomaly Audits (Task 7 & 8)

| Decision / Feature | Implementation | Rationale |
| :--- | :--- | :--- |
| **Atomic Row Transactions** | Wrap each row's database transactions inside `transaction.atomic()` savepoints. | Ensures that a database save exception in one row does not crash the entire import batch, allowing valid rows to succeed and errors to be reported individually. |
| **Aggregated Anomalies Table** | Aggregates results in React by anomaly code. | Allows users to see at a glance what problems occurred, their frequency, which rows triggered them, and what action was taken (Aisha/Meera audits). |
| **Local Downloader** | Trigger standard browser anchor element with dataURI for JSON report. | Offline-capable and fast way to export results without needing an additional download API call. |

## 7. PostgreSQL & Render Deployments (Task 9)

| Decision / Feature | Implementation | Rationale |
| :--- | :--- | :--- |
| **Render Blueprint (render.yaml)** | Declarative deployment structure in repo root. | Automatically maps environment setups and allows one-click service duplication. |
| **Decouple DATABASE_URL locally** | Updated `dev.py` database settings to read from decouple config. | Allows running standard Django CLI migrations to Neon PostgreSQL locally without changing settings files. |
| **WhiteNoise Serving** | Injected `WhiteNoiseMiddleware` right after SecurityMiddleware. | Serving admin panel CSS assets directly from Gunicorn eliminates the need for separate Nginx servers in production. |
