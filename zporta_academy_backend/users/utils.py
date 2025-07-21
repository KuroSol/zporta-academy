# users/utils.py
from users.models import UserPreference
import pytz
import geoip2.database
from django.utils import timezone

def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0]
    return request.META.get('REMOTE_ADDR')

def enrich_user_preference(user, request):
    pref, _ = UserPreference.objects.get_or_create(user=user)

    ip = get_client_ip(request)

    # Allow testing locally with dummy IP
    if ip.startswith("127.") or ip == "localhost":
        ip = "8.8.8.8"  # fallback to Google DNS for location

    try:
        reader = geoip2.database.Reader('geo/GeoLite2-City.mmdb')  # Make sure this path exists
        response = reader.city(ip)
        country = response.country.name
        city = response.city.name
        timezone_str = response.location.time_zone

        if timezone_str:
            now_local = timezone.now().astimezone(pytz.timezone(timezone_str))
            print(f"[Login] {user.username} local time: {now_local}")
            pref.timezone = timezone_str  # ✅ now it's defined

        pref.location = f"{city}, {country}" if city else country
        pref.save()
    except Exception as e:
        print(f"[GeoIP ERROR] {e}")
