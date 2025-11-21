import time
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)

class SlowRequestLoggingMiddleware(MiddlewareMixin):
    """Log requests that exceed a latency threshold.

    Lightweight middleware to surface backend bottlenecks without enabling full profiling.
    Adjust SLOW_THRESHOLD_SECONDS as needed. Writes to standard logging; ensure console/file
    handler is configured in production settings.
    """

    SLOW_THRESHOLD_SECONDS = 1.2  # seconds

    def process_request(self, request):
        request._start_time = time.monotonic()

    def process_response(self, request, response):
        start = getattr(request, '_start_time', None)
        if start is not None:
            duration = time.monotonic() - start
            if duration >= self.SLOW_THRESHOLD_SECONDS:
                logger.warning(
                    "SLOW_REQUEST path=%s method=%s status=%s duration=%.3fs user=%s", 
                    request.path,
                    request.method,
                    getattr(response, 'status_code', 'NA'),
                    duration,
                    getattr(getattr(request, 'user', None), 'id', None)
                )
        return response
