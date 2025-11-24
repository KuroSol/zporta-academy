# Lesson PDF Export System - Implementation Complete

## Overview
Successfully migrated lesson PDF export from frontend Puppeteer-based system to backend Django/WeasyPrint system. The new system is text-first, removing all media while preserving English and Japanese text content.

## What Was Implemented

### Backend (Django)

#### 1. PDF Utility Module (`lessons/pdf_utils.py`)
New module with three main functions:

- **`build_print_html_from_lesson(lesson)`**
  - Sanitizes lesson HTML for PDF export
  - Removes: images, audio, video, iframes, scripts, event handlers
  - Keeps: all text (English + Japanese), tables, headings, paragraphs, lists
  - Flattens accordions (details/summary → h3 + paragraphs)
  - Converts multi-column layouts to single-column reading order
  - Returns clean HTML string

- **`render_lesson_pdf_bytes(lesson)`**
  - Generates PDF bytes using WeasyPrint
  - Creates complete HTML document with A4 page size, proper margins
  - Includes CSS styling for Japanese font support (Noto Sans JP)
  - Configures fonts for CJK character rendering
  - Returns PDF bytes

- **`get_or_generate_lesson_pdf(lesson)`**
  - Caching layer for PDF generation
  - Checks if cached PDF exists and is up-to-date
  - Regenerates only if lesson.updated_at > lesson.export_generated_at
  - Saves generated PDF to lesson.export_pdf FileField
  - Returns PDF bytes

#### 2. DRF API Endpoint (`lessons/views.py`)
**`LessonExportPDFView`**
- URL: `GET /api/lessons/<lesson_id>/export-pdf/`
- Authentication: Required (IsAuthenticated)
- Authorization logic:
  - Public lessons: any authenticated user can export
  - Premium lessons: requires enrollment in course (unless creator/staff)
  - Draft lessons: only creator or staff can export
- Returns: PDF file with proper Content-Disposition header
- Error handling: Logs errors, returns safe 500 response without stack traces
- Throttling: Ready for throttle_scope configuration

#### 3. URL Configuration (`lessons/urls.py`)
- Added route: `path('<int:pk>/export-pdf/', LessonExportPDFView.as_view(), name='lesson-export-pdf')`
- Uses lesson ID (pk) for direct access

#### 4. Dependencies (`requirements.txt`)
- Added: `weasyprint==62.3`

#### 5. Comprehensive Tests (`lessons/tests/test_pdf_export.py`)
Created 18 test cases covering:

**PDF Utility Tests:**
- Media removal (images, audio, video, iframes, scripts)
- Text preservation (English + Japanese)
- Accordion flattening
- Table preservation
- Event handler removal
- PDF rendering (mocked WeasyPrint)
- Caching behavior
- Cache invalidation on lesson update

**API Endpoint Tests:**
- Authentication requirement
- Public lesson export
- Premium lesson authorization (with/without enrollment)
- Creator access to premium lessons
- Draft lesson privacy
- Error handling (no stack trace leaks)
- Non-existent lesson (404)
- Japanese text handling (no exceptions)

All tests use mocking to avoid actual PDF generation during test runs.

### Frontend (Next.js/React)

#### 1. Removed Legacy Code
- **Deleted:** `src/pages/api/lessons/export.js` (entire Puppeteer API route)
- **Removed from package.json:** `puppeteer` dependency

#### 2. Updated LessonDetail Component (`src/components/LessonDetail.js`)

**Added `handleDownloadPDF` function:**
```javascript
const handleDownloadPDF = async () => {
  // Calls backend: GET /api/lessons/{id}/export-pdf/
  // Receives PDF as blob (responseType: 'blob')
  // Creates object URL and triggers download
  // Proper cleanup of URLs and temp elements
  // Shows success/error messages
}
```

**Updated Download Section:**
- Changed from `<a href="/api/lessons/export?...">` (Puppeteer route)
- To: `<button onClick={handleDownloadPDF}>` (backend API)
- Uses existing apiClient with automatic authentication
- Disabled during isSubmitting state
- Proper user feedback

## Text-First Export Behavior

### What's Kept
✅ All English text  
✅ All Japanese text (kanji, hiragana, katakana)  
✅ Headings (h1-h6)  
✅ Paragraphs, bold, italic  
✅ Lists (ul, ol, li)  
✅ Tables with all content  
✅ Blockquotes, code blocks  
✅ Lesson metadata (title, creator, date, subject, course)

### What's Removed
❌ Images (`<img>`)  
❌ Audio (`<audio>`)  
❌ Video (`<video>`)  
❌ Iframes (`<iframe>`)  
❌ Scripts (`<script>`)  
❌ Event handlers (onclick, onload, etc.)  
❌ contenteditable attributes  
❌ Multi-column grid layouts (flattened to single column)  
❌ Collapsible accordions (expanded inline with h3 headers)

### Example Transformation

**Before (Lesson HTML):**
```html
<div class="lesson-content">
  <h2>Day 1: Introduction</h2>
  <p>Key phrase: <strong>Hello</strong> (こんにちは)</p>
  <img src="diagram.jpg">
  <audio src="pronunciation.mp3"></audio>
  <details class="zporta-acc-item">
    <summary>Show Japanese Explanation</summary>
    <div class="zporta-acc-panel">
      <p>これは挨拶です。</p>
    </div>
  </details>
  <table>
    <tr><th>English</th><th>日本語</th></tr>
    <tr><td>Hello</td><td>こんにちは</td></tr>
  </table>
</div>
```

**After (PDF Content):**
```html
<h2>Day 1: Introduction</h2>
<p>Key phrase: <strong>Hello</strong> (こんにちは)</p>
<h3>Japanese Explanation</h3>
<p>これは挨拶です。</p>
<table>
  <tr><th>English</th><th>日本語</th></tr>
  <tr><td>Hello</td><td>こんにちは</td></tr>
</table>
```

## Caching Strategy

### Model Fields (Already Existed)
- `Lesson.export_pdf` - FileField storing cached PDF
- `Lesson.export_generated_at` - DateTimeField tracking generation time
- `Lesson.updated_at` - Auto-updated on save

### Cache Logic
1. **First Request:** Generate PDF → Save to export_pdf → Set export_generated_at
2. **Subsequent Requests:** 
   - If export_generated_at >= updated_at: Return cached PDF
   - Else: Regenerate (lesson was edited)
3. **Cache Invalidation:** Automatic via updated_at field

## Security Measures

### Input Sanitization
1. Remove all `<script>` tags
2. Remove all event handler attributes (onclick, onload, etc.)
3. Remove contenteditable attributes
4. Whitelist safe HTML tags only
5. Unknown tags are unwrapped (text preserved, tag removed)

### Authorization
1. Authentication required for all exports
2. Premium lessons: enrollment check (unless creator/staff)
3. Draft lessons: only creator/staff
4. No stack traces in error responses (logged server-side only)

### Output Safety
- Generated PDF contains only sanitized HTML
- No external resources loaded (images, CSS, JS)
- No JavaScript execution in PDF renderer

## Setup Instructions

### Backend Setup

1. **Install Dependencies:**
```bash
cd zporta_academy_backend
pip install -r requirements.txt
```

WeasyPrint has system dependencies:
- **Windows:** Install GTK3 runtime (automatic via pip on Windows)
- **Linux:** `sudo apt-get install libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info`
- **macOS:** `brew install pango gdk-pixbuf libffi`

2. **Run Migrations** (if needed):
```bash
python manage.py migrate
```
(No new migrations needed - export fields already exist)

3. **Run Tests:**
```bash
python manage.py test lessons.tests.test_pdf_export
```

### Frontend Setup

1. **Remove old dependency:**
```bash
cd zporta_academy_frontend/next-frontend
npm uninstall puppeteer
```

2. **Clean install:**
```bash
npm install
```

3. **Test:**
- Start backend: `python manage.py runserver`
- Start frontend: `npm run dev`
- Log in, open a lesson, click "PDF" download button
- Verify PDF downloads with text content, no media

## API Usage

### Endpoint
```
GET /api/lessons/<lesson_id>/export-pdf/
```

### Headers
```
Authorization: Token <auth_token>
```

### Response
- **Success (200):** PDF file download
  - Content-Type: application/pdf
  - Content-Disposition: attachment; filename="lesson-{id}.pdf"
  
- **Errors:**
  - 401: Not authenticated
  - 403: Not enrolled (premium) or no access (draft)
  - 404: Lesson not found
  - 500: PDF generation failed

### Frontend Usage Example
```javascript
const response = await apiClient.get(`/lessons/${lessonId}/export-pdf/`, {
  responseType: 'blob',
});

const blob = new Blob([response.data], { type: 'application/pdf' });
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `lesson-${lessonId}.pdf`;
link.click();
window.URL.revokeObjectURL(url);
```

## Testing Checklist

### Backend Tests
- [x] Media elements removed from HTML
- [x] English text preserved
- [x] Japanese text preserved
- [x] Accordions flattened
- [x] Tables preserved
- [x] Event handlers removed
- [x] PDF rendering works (mocked)
- [x] Caching works correctly
- [x] Cache invalidates on update
- [x] Authentication required
- [x] Public lesson export works
- [x] Premium lesson requires enrollment
- [x] Creator can always export
- [x] Draft lessons are private
- [x] Error handling (safe messages)
- [x] Non-existent lesson returns 404
- [x] Japanese characters don't cause errors

### Frontend Tests (Manual)
- [ ] PDF button appears for enrolled users
- [ ] PDF button appears for public lessons
- [ ] PDF button hidden for non-enrolled premium lessons
- [ ] Clicking button downloads PDF
- [ ] Success message appears
- [ ] Error message on failure (e.g., network error)
- [ ] Button disabled during download
- [ ] Downloaded PDF opens correctly
- [ ] PDF contains lesson text (English + Japanese)
- [ ] PDF does NOT contain images/audio/video
- [ ] Accordions are expanded in PDF
- [ ] Tables render correctly

## Future Enhancements (Not Implemented)

### Potential V2 Features
1. **Async Generation for Large Lessons:**
   - Move `render_lesson_pdf_bytes` to Celery task
   - Add polling endpoint for generation status
   - Show progress indicator in frontend

2. **Optional Media Inclusion:**
   - Add `?include_images=true` query parameter
   - Embed images as base64 or download and include
   - Add audio/video metadata as text placeholders

3. **Custom Styling:**
   - Allow users to choose PDF template/theme
   - Custom fonts, colors, layouts

4. **Batch Export:**
   - Export entire course as single PDF
   - Table of contents, page numbers

5. **Advanced Caching:**
   - Pre-generate PDFs on lesson publish
   - Store multiple versions (with/without media)

6. **Analytics:**
   - Track PDF downloads per lesson
   - Popular lessons for export

## Migration Notes

### What Changed
- **OLD:** Frontend calls `/api/lessons/export?permalink=...` → Puppeteer in Next.js
- **NEW:** Frontend calls `/api/lessons/{id}/export-pdf/` → WeasyPrint in Django

### Breaking Changes
- Old permalink-based export endpoint removed
- Puppeteer dependency removed from frontend
- Export now requires lesson ID instead of permalink

### Backward Compatibility
- None needed - this is a complete replacement
- Old export URLs will 404 (endpoint removed)

## Troubleshooting

### "WeasyPrint not installed" Error
**Solution:** Install WeasyPrint with system dependencies
```bash
pip install weasyprint
# On Linux:
sudo apt-get install libpango-1.0-0 libpangocairo-1.0-0
```

### "PDF generation failed" Error
**Check:**
1. Server logs for actual error
2. Lesson HTML is valid
3. WeasyPrint installed correctly
4. System has enough memory

### Japanese Characters Not Rendering
**Solution:** Ensure system has CJK fonts installed
- Linux: `sudo apt-get install fonts-noto-cjk`
- WeasyPrint will use Noto Sans JP font from system

### PDF Download Not Working in Frontend
**Check:**
1. Backend endpoint returns 200
2. Response type is 'blob'
3. Content-Type header is 'application/pdf'
4. Browser allows downloads
5. apiClient includes auth token

## File Summary

### New Files
- `zporta_academy_backend/lessons/pdf_utils.py` - PDF generation utilities
- `zporta_academy_backend/lessons/tests/__init__.py` - Tests package
- `zporta_academy_backend/lessons/tests/test_pdf_export.py` - Comprehensive tests

### Modified Files
- `zporta_academy_backend/lessons/views.py` - Added LessonExportPDFView
- `zporta_academy_backend/lessons/urls.py` - Added export-pdf route
- `zporta_academy_backend/requirements.txt` - Added weasyprint
- `zporta_academy_frontend/next-frontend/src/components/LessonDetail.js` - Updated download button
- `zporta_academy_frontend/next-frontend/package.json` - Removed puppeteer

### Deleted Files
- `zporta_academy_frontend/next-frontend/src/pages/api/lessons/export.js` - Puppeteer API route

## Conclusion

The lesson PDF export system has been successfully migrated from a frontend Puppeteer-based solution to a backend Django/WeasyPrint solution. The new system is more maintainable, secure, and produces clean, text-first PDFs suitable for printing and study. All English and Japanese text is preserved, while media is removed to focus on content.

The implementation follows Django best practices, includes comprehensive tests, and provides a solid foundation for future enhancements.
