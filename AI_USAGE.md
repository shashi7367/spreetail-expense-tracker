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



