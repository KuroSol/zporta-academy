# Lesson Export Setup Guide (PDF & Word)

## Overview
Your lessons can now be exported to **PDF** and **Word** documents with **full HTML styling** preserved, including:
- ✅ Custom accent colors
- ✅ Images and formatting
- ✅ Custom CSS styles
- ✅ Columns, buttons, accordions
- ✅ Tables, lists, headings

## How It Works

### Frontend
The download buttons in `LessonDetail.js` link to:
- **PDF**: `${API_URL}/api/lessons/${permalink}/export/?format=pdf`
- **Word**: `${API_URL}/api/lessons/${permalink}/export/?format=docx`

### Backend
The export uses two approaches:

1. **PDF Generation** (uses WeasyPrint - BEST QUALITY):
   - Renders full HTML/CSS to PDF
   - Preserves all styling, colors, layout
   - Includes images and custom components

2. **Word Generation** (uses python-docx + htmldocx):
   - Converts HTML to Word format
   - Preserves headings, paragraphs, lists
   - Maintains basic formatting

## Installation Steps

### 1. Install Python Packages

On your production server, activate your Python environment and install:

```bash
cd ~/zporta-academy/zporta_academy_backend

# Activate your virtual environment
source env/bin/activate  # or whatever your venv is called

# Install export packages
pip install weasyprint reportlab python-docx htmldocx
```

### 2. Install System Dependencies (Linux Only)

WeasyPrint requires some system libraries:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install python3-dev python3-pip python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```

**CentOS/RHEL:**
```bash
sudo yum install python3-devel cairo pango gdk-pixbuf2 libffi-devel
```

### 3. Test the Export

After installation, test by visiting a lesson detail page and clicking the **PDF** or **Word** buttons.

## Testing Locally

To test on your local Windows machine:

```powershell
cd C:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend
.\env\Scripts\activate
pip install weasyprint reportlab python-docx htmldocx
```

Then start your Django server and visit any lesson page to test the downloads.

## Troubleshooting

### Error: "Module not found"
- Make sure packages are installed: `pip list | grep -E "weasyprint|reportlab|python-docx|htmldocx"`
- Restart your Django/Gunicorn server after installation

### PDF shows plain text only
- WeasyPrint not installed - it's falling back to simple reportlab
- Install WeasyPrint: `pip install weasyprint`

### Word document formatting is basic
- Install htmldocx for better HTML parsing: `pip install htmldocx`

### Images not showing in PDF
- Check that image URLs are accessible from the server
- WeasyPrint needs to fetch images - ensure proper network access

## What Gets Exported?

✅ **Included:**
- Lesson title and metadata (author, date, subject, course)
- Full HTML content with styling
- Custom CSS (accent colors, buttons, columns)
- Images (if URLs are accessible)
- Tables, lists, headings
- Video URL (as clickable link)

❌ **Not Included:**
- JavaScript functionality
- Interactive elements (they become static)
- Quizzes (only lesson content is exported)

## File Naming
- PDFs: `{lesson-permalink}.pdf`
- Word: `{lesson-permalink}.docx`

Example: `week-2-scheduling-a-meeting.pdf`

## Security Note
The export respects lesson permissions:
- Premium lessons require authentication
- Course lessons require enrollment
- Public lessons are accessible to all

---

**Need help?** Check the error messages in Django logs or browser console.
