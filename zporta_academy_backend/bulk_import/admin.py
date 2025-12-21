from django.contrib import admin, messages
from django import forms
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
import json
from .models import BulkImportJob, BulkImportQuizMenu
from .import_handler import BulkImportHandler
from .quiz_import_handler import QuizBulkImportHandler


def decode_file_content(file_obj):
    """Decode file with smart encoding detection: UTF-8 BOM, UTF-8, then fallback encodings."""
    raw = file_obj.read()
    
    # Try UTF-8 with BOM removal
    if raw.startswith(b'\xef\xbb\xbf'):
        return raw[3:].decode('utf-8', errors='replace')
    
    # Try UTF-8
    try:
        return raw.decode('utf-8')
    except (UnicodeDecodeError, AttributeError):
        pass
    
    # Try common encodings
    for enc in ['utf-8-sig', 'latin-1', 'cp1252', 'utf-16']:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            pass
    
    # Fallback with error replacement
    return raw.decode('utf-8', errors='replace')


class BulkImportJobForm(forms.ModelForm):
    upload = forms.FileField(help_text="Upload JSON file containing courses/lessons/quizzes")
    dry_run = forms.BooleanField(required=False, initial=False, help_text="Validate only; do not save data")

    class Meta:
        model = BulkImportJob
        fields = []


@admin.register(BulkImportJob)
class BulkImportJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_by', 'status', 'processed_courses', 'processed_lessons', 'processed_quizzes', 'processed_questions', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['created_by__username']
    readonly_fields = ['id', 'created_at', 'completed_at', 'errors', 'warnings']

    def get_form(self, request, obj=None, **kwargs):
        # Use the custom upload form only on add; default form on change
        if obj is None:
            kwargs['form'] = BulkImportJobForm
        return super().get_form(request, obj, **kwargs)

    # --- Custom admin view: quiz-only upload with preview ---
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('quiz-upload/', self.admin_site.admin_view(self.quiz_upload_view), name='bulk_import_quiz_upload'),
        ]
        return custom + urls

    def quiz_upload_view(self, request):
        context = dict(
            self.admin_site.each_context(request),
            title='Quiz Import (JSON with preview)',
            preview=None,
            errors=[],
            warnings=[],
        )

        if request.method == 'POST':
            # Final confirmation
            if request.POST.get('confirm') == 'yes':
                try:
                    data = json.loads(request.POST.get('json_payload', '{}'))
                except Exception as exc:
                    context['errors'] = [f'Invalid JSON payload: {exc}']
                    return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

                # Attach uploaded files to corresponding questions
                for q_idx, quiz in enumerate(data.get('quizzes', [])):
                    for idx, q in enumerate(quiz.get('questions', [])):
                        img_key = f'q{q_idx}_img_{idx}'
                        audio_key = f'q{q_idx}_aud_{idx}'
                        if img_key in request.FILES:
                            q['question_image_file'] = request.FILES[img_key]
                        if audio_key in request.FILES:
                            q['question_audio_file'] = request.FILES[audio_key]

                handler = QuizBulkImportHandler(request.user, dry_run=False)
                result = handler.process(data)

                if result['success']:
                    messages.success(request, f"Created {result['created_quizzes']} quizzes / {result['created_questions']} questions")
                    # Redirect to quizzes changelist so user can edit
                    return HttpResponseRedirect(reverse('admin:quizzes_quiz_changelist'))
                else:
                    context['errors'] = result.get('errors', [])
                    context['warnings'] = result.get('warnings', [])
                    return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

            # First pass: upload + preview
            upload = request.FILES.get('json_file')
            if not upload:
                context['errors'] = ['Please choose a JSON file.']
                return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

            try:
                content = decode_file_content(upload)
                data = json.loads(content)
            except Exception as exc:
                context['errors'] = [f'Invalid JSON or encoding issue: {exc}']
                return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

            handler = QuizBulkImportHandler(request.user, dry_run=True)
            result = handler.process(data)
            context['errors'] = result.get('errors', [])
            context['warnings'] = result.get('warnings', [])

            if context['errors']:
                return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

            context['preview'] = {
                'quizzes': data.get('quizzes', []),
                'counts': {
                    'quizzes': len(data.get('quizzes', [])),
                    'questions': sum(len(q.get('questions', [])) for q in data.get('quizzes', [])),
                }
            }
            context['json_payload'] = json.dumps(data)
            return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

        # GET request
        return TemplateResponse(request, 'bulk_import/quiz_admin_upload.html', context)

    def save_model(self, request, obj, form, change):
        # Only handle creation via the custom upload form
        if change:
            return super().save_model(request, obj, form, change)

        upload = form.cleaned_data.get('upload')
        dry_run = form.cleaned_data.get('dry_run')

        # Initialize job
        obj.created_by = request.user
        obj.status = 'processing'
        obj.save()

        try:
            content = decode_file_content(upload)
            data = json.loads(content)
        except Exception as exc:
            obj.status = 'failed'
            obj.errors = [f'Invalid JSON or encoding issue: {exc}']
            obj.save()
            messages.error(request, f'Bulk import failed: {exc}')
            return

        handler = BulkImportHandler(request.user, obj, dry_run=dry_run)
        try:
            handler.process(data)
            obj.refresh_from_db()
            messages.success(request, f'Bulk import {"validated" if dry_run else "completed"} successfully.')
        except Exception as exc:
            obj.status = 'failed'
            obj.errors = obj.errors + [f'Critical error: {exc}'] if obj.errors else [f'Critical error: {exc}']
            obj.save()
            messages.error(request, f'Bulk import failed: {exc}')


@admin.register(BulkImportQuizMenu)
class BulkImportQuizMenuAdmin(admin.ModelAdmin):
    """
    Admin entry that appears as 'Bulk import quiz' and redirects to the
    quiz-upload page under BulkImportJob.
    """
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        # Build the BulkImportJob changelist URL and append the quiz-upload path
        base = reverse('admin:bulk_import_bulkimportjob_changelist')
        return HttpResponseRedirect(f"{base}quiz-upload/")
