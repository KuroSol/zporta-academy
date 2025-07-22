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

        # Save user's timezone if available
        if timezone_str:
            now_local = timezone.now().astimezone(pytz.timezone(timezone_str))
            print(f"[Login] {user.username} local time: {now_local}")
            pref.timezone = timezone_str

        # Save location string
        pref.location = f"{city}, {country}" if city else country

        # 🌍 Auto-detect language based on country
        country_to_lang = {
            "Japan": "ja",
            "France": "fr",
            "Germany": "de",
            "Italy": "it",
            "Spain": "es",
            "Portugal": "pt",
            "China": "zh",
            "Taiwan": "zh",
            "Korea, Republic of": "ko",
            "Vietnam": "vi",
            "Thailand": "th",
            "Russia": "ru",
            "Ukraine": "uk",
            "India": "hi",
            "Pakistan": "ur",
            "Iran": "fa",
            "Turkey": "tr",
            "Saudi Arabia": "ar",
            "United Arab Emirates": "ar",
            "Kuwait": "ar",
            "Egypt": "ar",
            "Morocco": "ar",
            "Tunisia": "ar",
            "Indonesia": "id",
            "Philippines": "tl",
            "Malaysia": "ms",
            "Bangladesh": "bn",
            "Brazil": "pt",
            "Argentina": "es",
            "Mexico": "es",
            "Colombia": "es",
            "Chile": "es",
            "Peru": "es",
            "Venezuela": "es",
            "Canada": "fr",  # fallback — could be 'fr' or 'en', but we always add 'en' anyway
            "United States": "en",
            "United Kingdom": "en",
            "Australia": "en",
            "South Africa": "en",
            # Add more countries as needed
        }

        detected_lang = country_to_lang.get(country)

        # Always include English; add local lang if found
        if detected_lang and detected_lang != "en":
            pref.languages_spoken = list(set(["en", detected_lang]))
        else:
            pref.languages_spoken = ["en"]

        pref.save()

    except Exception as e:
        print(f"[GeoIP ERROR] {e}")
