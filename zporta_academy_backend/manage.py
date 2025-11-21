# manage.py
#!/usr/bin/env python
import os
import sys

def main():
    """Run administrative tasks.

    Default to production settings unless DJANGO_SETTINGS_MODULE is explicitly provided.
    This prevents accidental use of DEBUG/local DB on the live server. For local dev,
    export DJANGO_SETTINGS_MODULE=zporta.settings.local before running manage.py.
    """
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'zporta.settings.production'))
    os.environ.setdefault('DJANGO_ENV', 'production') # Ensure production settings are respected by __init__.py
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
