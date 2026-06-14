# AI Usage Log

This document tracks how AI tools were used during the development of the Spreetail Expense Tracker.

## Task 1: Django Project Scaffold Setup
- **Role**: AI assistant acting as Tech Lead.
- **Actions**: Scaffolded backend folder structure, created python requirements, implemented settings split, configured Django settings, set up environment-specific options, and resolved psycopg compilation issue on Python 3.14 by introducing psycopg3.

## Task 2: Database Model Configuration
- **Role**: Database Architect.
- **Actions**: Configured custom user model registry, implemented 7 interconnected database tables in expenses/models.py with custom constraints, ran database migration commands, and verified core CRUD operations via the Django shell.

## Task 3: JWT Authentication Setup
- **Role**: Security & API Engineer.
- **Actions**: Implemented RegisterSerializer, LoginSerializer (with custom email lookup), and UserSerializer in serializers.py. Created RegisterView, LoginView, and MeView in views.py, and mapped routing in urls.py. Designed and ran a python-based Django Test Client script to verify registration, login, token refresh, and profile endpoints. Modified development settings to allow 'testserver' host header for test suite compatibility.

## Task 4: Group and Expense CRUD with Debt Simplification
- **Role**: Tech Lead & Database Architect.
- **Actions**: Implemented Group and Expense CRUD serializers with auto-join on group creation, auto-split equally, and division remainder adjustment. Coded GroupViewSet and ExpenseViewSet with custom actions (`join`, `balances`). Implemented the greedy flow-minimization (simplified debt) algorithm. Ran local verification scripts against the Django Test Client to verify group joins, auto-splits, settlements, soft delete, and balance calculations.

## Task 5: React Frontend Scaffold Configuration
- **Role**: Senior UI/UX & Frontend Engineer.
- **Actions**: Initialized Vite React template. Installed and configured Tailwind CSS v4, Axios, React Router, and hot toast indicators. Implemented global AuthProvider context, created ProtectedRoute guards, structured page routes in App.jsx, and designed fully styled LoginPage and RegisterPage forms with violet-slate glassmorphism components.





