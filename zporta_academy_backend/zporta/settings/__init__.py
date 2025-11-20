import os

# Decide which settings module to load based on DJANGO_ENV.
# Defaults to 'local' for developer machines.
env = os.environ.get('DJANGO_ENV', 'local').lower()
if env == 'production':
	from .production import *  # noqa
else:
	from .local import *  # noqa