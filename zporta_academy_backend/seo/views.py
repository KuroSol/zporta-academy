from django.http import HttpResponse

def robots_txt(request):
    lines = [
        "User-Agent: *",
        "Disallow: /api/",
        "Disallow: /admin/",
        "Sitemap: https://zportaacademy.com/sitemap.xml"
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")
