# lessons/content_filters.py
from bs4 import BeautifulSoup

def mask_restricted_sections(html, request_user, bound_course=None):
    """
    Process lesson HTML and mask any inline-tagged premium sections.

    Author can wrap any block with one of these attributes:
      - data-required-course-permalink="<creator>/<date>/<subject>/<slug>"
      - data-required-course-id="<course_id>"

    If the current user is not enrolled in that premium course, replace the inner
    content with a placeholder that links to the course page.

    Owners and staff can always view full content. Ownership checks for the lesson
    are handled by the caller; this function only evaluates user enrollment for
    the required course and will mask sections otherwise.

    If bound_course is provided (e.g., the lesson is attached to a specific course),
    then any inline gating will be treated as referring to that bound course. This
    prevents cross-course gating from within a lesson that already belongs to a
    particular course.
    """
    if not html or not html.strip():
        return html
    try:
        from courses.models import Course
        from enrollment.models import Enrollment
        from django.contrib.contenttypes.models import ContentType
    except Exception:
        # If imports fail, don't break rendering
        return html

    try:
        soup = BeautifulSoup(html, "html.parser")

        def user_can_access(course_obj):
            """
            Check if user can view gated content for a specific course.
            Returns True if user is staff OR enrolled in the premium course.
            """
            # Staff sees everything
            if getattr(request_user, 'is_authenticated', False) and getattr(request_user, 'is_staff', False):
                return True
            # Anonymous users cannot access premium content
            if not getattr(request_user, 'is_authenticated', False):
                return False
            # Check enrollment
            course_ct = ContentType.objects.get_for_model(Course)
            return Enrollment.objects.filter(
                user=request_user,
                content_type=course_ct,
                object_id=course_obj.id,
                enrollment_type="course"
            ).exists()

        # Find all elements with gating attributes
        candidates = soup.select('[data-required-course-permalink], [data-required-course-id]')
        if not candidates:
            return str(soup)

        resolved_courses = {}
        for node in candidates:
            # Resolve which course this node refers to
            # If a bound_course is provided (lesson attached to a course), force gating to that course
            if bound_course is not None:
                course = bound_course
            else:
                course = None
                permalink = node.get('data-required-course-permalink')
                course_id = node.get('data-required-course-id')

                key = None
                if permalink:
                    key = f"p:{permalink}"
                    if key in resolved_courses:
                        course = resolved_courses[key]
                    else:
                        try:
                            course = Course.all_objects.select_related('created_by', 'subject').only('id','title','permalink','course_type','is_draft').get(permalink=permalink)
                        except Course.DoesNotExist:
                            course = None
                        resolved_courses[key] = course
                elif course_id:
                    key = f"i:{course_id}"
                    if key in resolved_courses:
                        course = resolved_courses[key]
                    else:
                        try:
                            course = Course.all_objects.only('id','title','permalink','course_type','is_draft').get(id=int(course_id))
                        except Exception:
                            course = None
                        resolved_courses[key] = course

            if not course:
                # Unknown course: render a compact placeholder without a course link
                placeholder = soup.new_tag('div', **{'class': 'gated-content gc-compact'})
                blur = soup.new_tag('span', **{'class': 'gc-blur-line', 'aria-hidden': 'true'})
                label = soup.new_tag('span', **{'class': 'gc-label'})
                label.string = 'Premium section'
                placeholder.append(blur)
                placeholder.append(label)
                node.clear()
                node.append(placeholder)
                continue

            # Gate only for premium published courses; skip free or draft
            if course.course_type != 'premium' or course.is_draft:
                continue

            # Check if user has access (enrolled or staff)
            if user_can_access(course):
                continue

            # User does not have access, mask this section
            link = f"/courses/{course.permalink}" if course.permalink else None
            placeholder = soup.new_tag('div', **{'class': 'gated-content gc-compact'})
            title = course.title or 'this course'
            # Optional custom message from author – use as link title if provided
            custom_msg = node.get('data-gated-message')

            blur = soup.new_tag('span', **{'class': 'gc-blur-line', 'aria-hidden': 'true'})
            placeholder.append(blur)
            if link:
                a = soup.new_tag('a', href=link, **{'class': 'gc-link'})
                a.string = f'Unlock with “{title}”'
                if custom_msg:
                    a['title'] = custom_msg
                placeholder.append(a)
            else:
                label = soup.new_tag('span', **{'class': 'gc-label'})
                label.string = 'Unlock to view'
                if custom_msg:
                    label['title'] = custom_msg
                placeholder.append(label)
            node.clear()
            node.append(placeholder)

        return str(soup)
    except Exception:
        return html
