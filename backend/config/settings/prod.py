from .base import *
import dj_database_url

# Production settings: Debug must always be False
DEBUG = False

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
# Production requires a valid DATABASE_URL environment variable.
# Neon PostgreSQL requires SSL connections, which we enforce with ssl_require=True.
DATABASES = {
    'default': dj_database_url.config(
        conn_max_age=600,
        ssl_require=True
    )
}

# Production CORS configuration
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    cast=lambda v: [s.strip() for s in v.split(',') if s.strip()]
)

# HTTPS and Cookie Security settings
# Render uses a proxy/load-balancer that terminates SSL before routing to Django.
# We must inform Django to look at the 'X-Forwarded-Proto' header to recognize HTTPS.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True

# Secure cookies to prevent session/CSRF tokens from being transmitted over insecure HTTP
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# HTTP Strict Transport Security (HSTS)
# Informs browsers to only access this site using HTTPS.
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
