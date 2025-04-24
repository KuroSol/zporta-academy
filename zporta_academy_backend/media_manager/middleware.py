from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

class UpdateDomainMiddleware(MiddlewareMixin):
    def process_request(self, request):
        protocol = 'https://' if request.is_secure() else 'http://'
        settings.CURRENT_DOMAIN = f"{protocol}{request.get_host()}"
