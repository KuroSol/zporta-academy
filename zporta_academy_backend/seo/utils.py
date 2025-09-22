# C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend\seo\utils.py
def noindex(fn):
    def wrapped(request, *args, **kwargs):
        # Neutralized: do not set X-Robots-Tag at all
        return fn(request, *args, **kwargs)
    return wrapped
