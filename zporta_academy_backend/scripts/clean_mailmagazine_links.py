import re
from django.db import transaction
from mailmagazine.models import TeacherMailMagazine

BROKEN_PATTERN = re.compile(r'https://zportaacademy\.com/(courses|lessons|quizzes)/undefined/undefined/1/([^"<]+)')

def fix_href(match):
    # match group 1 is type, group 2 is the real tail permalink (username/date/subject/slug)
    link_type = match.group(1)
    tail = match.group(2).rstrip('/')
    return f'https://zportaacademy.com/{link_type}/{tail}'

def clean_body(html: str) -> str:
    return BROKEN_PATTERN.sub(lambda m: fix_href(m), html)

@transaction.atomic
def run():
    updated = 0
    for mag in TeacherMailMagazine.objects.all():
        original = mag.body or ''
        cleaned = clean_body(original)
        if cleaned != original:
            mag.body = cleaned
            mag.save(update_fields=['body'])
            updated += 1
    print(f"MailMagazine link cleanup complete. Updated {updated} records.")

if __name__ == '__main__':
    run()