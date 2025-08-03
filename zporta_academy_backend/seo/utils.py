# seo/utils.py
def noindex(fn):
    def wrapped(request, *args, **kwargs):
        response = fn(request, *args, **kwargs)
        response['X-Robots-Tag'] = 'noindex, nofollow'
        return response
    return wrapped
