# Spreetail Shared Expense Tracker

A full-stack shared expense tracking application built with Django REST Framework and React. Supports group expense management, balance calculation, greedy debt simplification, and CSV bulk import with anomaly detection.

- **Deployed Frontend URL**: [https://spreetail-expense-tracker.vercel.app](https://spreetail-expense-tracker.vercel.app)
- **Deployed Backend URL**: [https://spreetail-expense-tracker-backend.onrender.com](https://spreetail-expense-tracker-backend.onrender.com)
- **GitHub Repository**: [https://github.com/shashi7367/spreetail-expense-tracker](https://github.com/shashi7367/spreetail-expense-tracker)

---

## 🚀 Technologies & Stack

### Backend (Django REST Framework)
- **Python 3.10+**
- **Django 4.2 & DRF**: Core application API structure.
- **SimpleJWT**: Email-based secure JWT authentication.
- **Neon PostgreSQL**: Production-grade serverless relational database.
- **Psycopg 3**: Native PostgreSQL driver for Python 3.10+.
- **dj-database-url**: Parses connection strings for Neon.
- **WhiteNoise & Gunicorn**: Secure static assets serving and HTTP application server in production.

### Frontend (React & Vite)
- **React 19 & Vite**: Ultra-fast hot-reloading frontend development environment.
- **Tailwind CSS v4**: Harmonious glassmorphic UI styling, focus glow animations, and violet-slate color palettes.
- **React Router v7**: Unified route navigation and protected route guards.
- **Axios**: API client equipped with automated JWT token refresh request interceptors.
- **Lucide Icons**: Premium micro-animations and clean dashboard iconography.

---

## 🛠️ Local Installation & Setup

### Prerequisites
- Python 3.10+ installed
- Node.js 18+ installed

### Backend Setup
1. Clone the repository and navigate to the backend directory:
   ```bash
   git clone https://github.com/shashi7367/spreetail-expense-tracker.git
   cd spreetail-expense-tracker/backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a local `.env` configuration file in the `backend/` directory:
   ```env
   SECRET_KEY=your-secure-local-django-key
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1
   CORS_ALLOWED_ORIGINS=http://localhost:5173
   # Optional: Set DATABASE_URL to use Neon PostgreSQL locally, otherwise defaults to SQLite
   # DATABASE_URL=postgresql://user:pass@host/db
   ```
5. Apply database migrations:
   ```bash
   python manage.py migrate
   ```
6. Run the local development server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## 🤖 Development Notes

AI tools (GitHub Copilot, ChatGPT) were used for debugging assistance, code review suggestions, and documentation support. All architecture decisions, implementation, testing, deployment, and final code integration were performed by the developer.

## 📸 Screenshots

### Dashboard
![Dashboard](docs/dashboard.png)

### Expense Management
![Expenses](docs/expenses.png)

### CSV Import
![CSV Import](docs/csv-import.png)

### Debt Settlement
![Settlement](docs/settlement.png)