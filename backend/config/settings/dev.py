from .base import *
import dj_database_url

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# Allow 'testserver' for Django Test Client in development
ALLOWED_HOSTS = ALLOWED_HOSTS + ['testserver']

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
# Fallback to local SQLite if DATABASE_URL is not set in the environment/dotenv file.
DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR}/db.sqlite3"
    )
}

# Development CORS configuration
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173',
    cast=lambda v: [s.strip() for s in v.split(',') if s.strip()]
)

# Email Backend for local development (prints to standard console output)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
