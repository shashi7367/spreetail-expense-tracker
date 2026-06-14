# Decisions Log

This document records the key architectural and design decisions made for the Spreetail Expense Tracker project.

## 1. Django Scaffold Setup (Task 1)

| Decision | Implementation | Rationale |
| :--- | :--- | :--- |
| **Settings Split** | `base.py`, `dev.py`, `prod.py` | Prevents credential leaks, segregates development options (e.g. SQLite database fallback) from production configurations (HSTS, SSL termination, Neon DB connection). |
| **CORS Middleware Location** | Top of `MIDDLEWARE` stack | `CorsMiddleware` must intercept request headers and return preflight requests (`OPTIONS`) before any Django response-altering middleware runs. |
| **PostgreSQL Adapter** | `psycopg` (v3) | Precompiled wheels for Python 3.14 on Windows avoid compiling `psycopg2` from C source, ensuring a seamless local setup. Django 4.2 has native support for `psycopg` (v3). |
| **Decouple for Config** | `python-decouple` | Decouples app logic from configuration secrets, enforcing the 12-factor app model. |

