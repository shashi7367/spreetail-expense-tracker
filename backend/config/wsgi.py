import os
from django.core.wsgi import get_wsgi_application

# Default settings module is set to dev; production hosts will override DJANGO_SETTINGS_MODULE in their environment.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

application = get_wsgi_application()
