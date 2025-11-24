# manage.py
#!/usr/bin/env python
import os
import sys

def main():
    """Run administrative tasks.

    Use zporta.settings which will auto-detect local vs production via DJANGO_ENV.
    For production, the systemd service sets DJANGO_ENV=production.
    For local dev, it defaults to local.
    """
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
    # Do NOT force DJANGO_ENV here - let it default naturally (local for dev, production on server)
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
