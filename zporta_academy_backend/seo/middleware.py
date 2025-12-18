from django.shortcuts import redirect

from seo.utils import canonical_url

from .models import SEOSetting, Redirect

class SEOMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check for a redirect
        redirect_obj = Redirect.objects.filter(old_path=request.path).first()
        if redirect_obj:
            return redirect(redirect_obj.new_path, permanent=redirect_obj.permanent)

        # Get the response from the view
        response = self.get_response(request)

        # Apply SEO settings if they exist
        seo_settings = SEOSetting.objects.filter(path=request.path).first()
        if seo_settings:
            response['X-SEO-Title'] = seo_settings.title
            response['X-SEO-Description'] = seo_settings.description
            if seo_settings.canonical_url:
                response['Link'] = f'<{canonical_url(seo_settings.canonical_url)}>; rel="canonical"'

        return response
