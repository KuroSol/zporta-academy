# WeasyPrint Installation Guide for Lesson PDF Export

## Quick Start

### Windows
```powershell
cd zporta_academy_backend
pip install weasyprint
```

WeasyPrint should work out-of-the-box on Windows 10/11 with the GTK runtime automatically installed via pip.

### Linux (Ubuntu/Debian)
```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info

# Install Python package
cd zporta_academy_backend
pip install weasyprint

# Optional: Install Japanese fonts for better rendering
sudo apt-get install fonts-noto-cjk
```

### macOS
```bash
# Install system dependencies via Homebrew
brew install pango gdk-pixbuf libffi

# Install Python package
cd zporta_academy_backend
pip install weasyprint
```

## Verification

Test that WeasyPrint is installed correctly:

```python
python -c "from weasyprint import HTML; print('WeasyPrint OK')"
```

Expected output: `WeasyPrint OK`

## Testing PDF Generation

Run the test suite:
```bash
cd zporta_academy_backend
python manage.py test lessons.tests.test_pdf_export
```

All tests should pass.

## Manual Test

1. Start Django server:
```bash
python manage.py runserver
```

2. Create a test lesson (or use existing one)

3. Test the endpoint with curl:
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
     http://127.0.0.1:8000/api/lessons/1/export-pdf/ \
     -o test.pdf
```

4. Open `test.pdf` - should contain lesson text without images/media

## Troubleshooting

### Issue: "ImportError: No module named weasyprint"
**Solution:** Install weasyprint in the correct virtual environment
```bash
# Activate your venv first
cd zporta_academy_backend
source env/bin/activate  # Linux/Mac
# or
env\Scripts\activate  # Windows

pip install weasyprint
```

### Issue: "OSError: cannot load library" (Linux)
**Solution:** Install system dependencies
```bash
sudo apt-get install libpango-1.0-0 libpangocairo-1.0-0
```

### Issue: Japanese characters render as boxes
**Solution:** Install CJK fonts
```bash
# Linux
sudo apt-get install fonts-noto-cjk

# macOS
brew tap homebrew/cask-fonts
brew install font-noto-sans-cjk-jp
```

### Issue: "PDF generation failed" in production
**Checklist:**
1. WeasyPrint installed in production environment
2. System dependencies installed on server
3. Sufficient memory (WeasyPrint can be memory-intensive)
4. File permissions for writing to MEDIA_ROOT/lesson_exports/pdf/

## Performance Notes

- First PDF generation: ~2-5 seconds (depending on lesson size)
- Cached PDF retrieval: <100ms
- Memory usage: ~50-200MB per PDF generation
- Recommended: Use Celery for async generation if lessons are very large

## Production Deployment

### Gunicorn Workers
Increase timeout for PDF generation:
```bash
gunicorn --timeout 120 zporta.wsgi:application
```

### Nginx
Increase proxy timeouts:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_read_timeout 120s;
    proxy_connect_timeout 120s;
}
```

### Celery (Optional)
For very large lessons, consider moving PDF generation to background task:
```python
# lessons/tasks.py
from celery import shared_task
from .pdf_utils import render_lesson_pdf_bytes

@shared_task
def generate_pdf_async(lesson_id):
    lesson = Lesson.objects.get(id=lesson_id)
    pdf_bytes = render_lesson_pdf_bytes(lesson)
    # Save to lesson.export_pdf...
```

## Font Configuration (Advanced)

To use specific fonts, create a custom CSS file:

```python
# In pdf_utils.py _build_pdf_html_document()
@font-face {
    font-family: 'Custom Japanese Font';
    src: url('/path/to/font.ttf');
}

body {
    font-family: 'Custom Japanese Font', sans-serif;
}
```

## Resources

- WeasyPrint Documentation: https://doc.courtbouillon.org/weasyprint/
- GitHub: https://github.com/Kozea/WeasyPrint
- Font Configuration: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#fonts
