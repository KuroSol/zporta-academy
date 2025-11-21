from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone
from .models import Lesson
from .export_utils import generate_lesson_pdf, generate_lesson_docx

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=5, retry_kwargs={"max_retries": 3})
def generate_lesson_exports(self, lesson_id: int, force: bool = False):
    """Generate PDF & DOCX artifacts for a lesson.

    Stores files in FileFields on Lesson and updates export_generated_at.
    Returns dict summarizing outcome.
    """
    lesson = Lesson.objects.filter(pk=lesson_id).first()
    if not lesson:
        return {"status": "not_found", "lesson_id": lesson_id}

    # Skip if recent and not forced
    if (not force and lesson.export_generated_at and (timezone.now() - lesson.export_generated_at).total_seconds() < 6*3600):
        return {"status": "fresh", "lesson_id": lesson_id}

    pdf_bytes, pdf_err = generate_lesson_pdf(lesson)
    docx_bytes, docx_err = generate_lesson_docx(lesson)

    changed = False
    if pdf_bytes and not pdf_err:
        lesson.export_pdf.save(f"{lesson.permalink}.pdf", ContentFile(pdf_bytes), save=False)
        changed = True
    if docx_bytes and not docx_err:
        lesson.export_docx.save(f"{lesson.permalink}.docx", ContentFile(docx_bytes), save=False)
        changed = True

    if changed:
        lesson.export_generated_at = timezone.now()
        lesson.save(update_fields=["export_pdf", "export_docx", "export_generated_at", "updated_at"])
        return {"status": "generated", "lesson_id": lesson_id, "pdf_error": pdf_err, "docx_error": docx_err}
    else:
        return {"status": "errors", "lesson_id": lesson_id, "pdf_error": pdf_err, "docx_error": docx_err}
