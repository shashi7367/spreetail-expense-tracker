<!-- Public deployed app URL
What to paste in the form after deployment:

https://spreetail-expense-tracker.vercel.app copy
Steps to build & deploy
Create a new React app:
npm create vite@latest spreetail-expense-tracker -- --template react
Build the frontend (login, groups, expenses, CSV import, balance view) — use the master prompt below
Create Django backend:
django-admin startproject backend
— add DRF + models
Create a free PostgreSQL DB on
Neon.tech
— copy the connection string
Deploy backend to
Render.com
(free tier, Python/Django) — get backend URL
Deploy frontend to
Vercel.com
— connect your GitHub repo, set VITE_API_URL to your Render backend
Copy the Vercel URL — paste it into the form field
Master build prompt — paste this into Claude or ChatGPT
You are a Senior Full Stack Engineer. Build a complete Shared Expense Tracker app.

Tech stack:
- Frontend: React + Vite + Tailwind CSS
- Backend: Django REST Framework
- Database: PostgreSQL (Neon)
- Deploy: Vercel (frontend) + Render (backend)

Features required:
1. User login / registration (JWT auth)
2. Groups — create and join expense groups
3. Add expenses with: payer, amount, currency, date, category, participants
4. CSV import with anomaly detection and import report generation
5. Balance calculation — who owes whom
6. Settlement tracking
7. Dashboard with summary

CSV anomalies to detect:
- Duplicate rows (same payer/amount/date)
- Currency mismatches (USD vs INR)
- Settlement entries logged as expenses
- Missing required fields
- Future-dated expenses
- Membership conflicts (person not in group)
- Negative amounts

For EVERY anomaly detected during CSV import:
- Log it to ImportLog table
- Generate a structured import report (JSON + readable)
- Never silently change data — always flag

Generate:
1. Django models (Users, Groups, Members, Expenses, Settlements, ImportLogs)
2. DRF serializers and API views
3. React components for each feature
4. CSV import pipeline with anomaly detection
5. Balance calculation logic
6. README, SCOPE, DECISIONS, AI_USAGE stubs -->