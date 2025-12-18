# C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend\seo\utils.py
import re
from urllib.parse import urlparse

CANONICAL_ORIGIN = "https://zportaacademy.com"
CANONICAL_HOST = "zportaacademy.com"
TRAILING_SLASH = True
EXCLUDE_PATHS = ("/login", "/register", "/password-reset", "/reset-password-confirm")
EXCLUDE_PREFIXES = ("/api/",)
FORBIDDEN_TOKENS = ("[", "]")


def noindex(fn):
    def wrapped(request, *args, **kwargs):
        # Neutralized: do not set X-Robots-Tag at all
        return fn(request, *args, **kwargs)

    return wrapped


def canonical_path(raw_path: str | None) -> str:
    """Normalize any input (URL or path) into a canonical path.

    - strips scheme/host and query/fragment
    - removes /api/ prefix
    - enforces leading slash and trailing-slash policy
    - collapses duplicate slashes
    """

    parsed = urlparse(raw_path or "")
    path = parsed.path or "/"

    # strip accidental scheme/host prefixes (including www)
    path = "/" + path.lstrip("/")

    # remove /api prefix if present
    if path.startswith("/api/"):
        path = path[len("/api") :]

    # collapse duplicate slashes
    path = re.sub(r"/{2,}", "/", path)

    # enforce leading slash once more after transformations
    path = "/" + path.lstrip("/")

    # trailing slash policy
    if TRAILING_SLASH:
        if path != "/" and not path.endswith("/"):
            path += "/"
    else:
        if path.endswith("/") and path != "/":
            path = path.rstrip("/")

    return path or "/"


def canonical_url(raw_path_or_url: str | None) -> str:
    """Return the absolute canonical URL under the single site origin."""

    path = canonical_path(raw_path_or_url)
    return f"{CANONICAL_ORIGIN.rstrip('/')}{path}"


def is_public_indexable_path(raw_path_or_url: str | None) -> bool:
    """Business rules for sitemap/indexable pages."""

    parsed = urlparse(raw_path_or_url or "")
    if "redirect_to" in (parsed.query or ""):
        return False

    # Reject any /api paths before canonicalization strips the prefix
    if (parsed.path or "").startswith("/api/"):
        return False

    path = canonical_path(raw_path_or_url)

    if any(path.startswith(prefix) for prefix in EXCLUDE_PREFIXES):
        return False
    if any(path == p or path.startswith(p + "/") for p in EXCLUDE_PATHS):
        return False
    if any(token in path for token in FORBIDDEN_TOKENS):
        return False
    return True
