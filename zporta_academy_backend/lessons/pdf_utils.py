# lessons/pdf_utils.py
"""
Text-first PDF export utilities for lessons.
Removes all media (images, audio, video) and produces clean, printable PDFs.
"""

from io import BytesIO
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger(__name__)


def build_print_html_from_lesson(lesson):
    """
    Parse lesson HTML and create a text-first version suitable for PDF export.
    
    - Keeps all English and Japanese text
    - Removes images, audio, video, iframes
    - Flattens accordions (details/summary elements)
    - Strips scripts and event handlers
    - Preserves tables, headings, paragraphs, lists
    
    Args:
        lesson: Lesson model instance
        
    Returns:
        str: Sanitized HTML string
    """
    if not lesson.content:
        return ""
    
    soup = BeautifulSoup(lesson.content, 'html.parser')
    
    # Remove all media elements
    for tag in soup.find_all(['img', 'audio', 'video', 'iframe', 'script', 'style']):
        tag.decompose()
    
    # Remove all event handler attributes
    for tag in soup.find_all():
        attrs_to_remove = [attr for attr in tag.attrs if attr.startswith('on')]
        for attr in attrs_to_remove:
            del tag[attr]
        
        # Remove contenteditable
        if tag.has_attr('contenteditable'):
            del tag['contenteditable']
    
    # Flatten accordions (details/summary -> heading + content)
    for details in soup.find_all('details', class_='zporta-acc-item'):
        # Get the summary text
        summary = details.find('summary', class_='zporta-acc-title')
        summary_text = summary.get_text(strip=True) if summary else 'Japanese Explanation'
        
        # Clean up the summary text (remove "Show" prefix if present)
        summary_text = re.sub(r'^Show\s+', '', summary_text, flags=re.IGNORECASE)
        
        # Get the panel content
        panel = details.find('div', class_='zporta-acc-panel')
        
        # Create new structure: heading + paragraphs
        new_section = soup.new_tag('div', **{'class': 'explanation-section'})
        
        heading = soup.new_tag('h3')
        heading.string = summary_text
        new_section.append(heading)
        
        if panel:
            # Extract all paragraphs from panel
            for child in panel.children:
                if child.name:  # Skip text nodes
                    new_section.append(child.extract())
        
        # Replace the details element with our new section
        details.replace_with(new_section)
    
    # Flatten column layouts (convert grid to single column)
    for columns_div in soup.find_all('div', class_='zporta-columns'):
        # Simply remove the wrapper, keep children in sequence
        columns_div.unwrap()
    
    for column_div in soup.find_all('div', class_='zporta-column'):
        column_div.unwrap()
    
    # Whitelist of safe tags to keep
    safe_tags = {
        'html', 'head', 'body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'strong', 'em', 'b', 'i', 'u', 'span', 'div', 'br',
        'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'pre', 'code', 'a'
    }
    
    # Remove unknown tags but keep their text content
    for tag in soup.find_all():
        if tag.name not in safe_tags:
            tag.unwrap()
    
    return str(soup)


def render_lesson_pdf_bytes(lesson):
    """
    Generate PDF bytes from lesson content using WeasyPrint.
    Falls back to ReportLab on Windows if WeasyPrint dependencies aren't available.
    
    Args:
        lesson: Lesson model instance
        
    Returns:
        bytes: PDF file content
        
    Raises:
        Exception: If PDF generation fails
    """
    # Try WeasyPrint first (best quality)
    try:
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration
        
        # Get sanitized HTML
        clean_content = build_print_html_from_lesson(lesson)
        
        # Build complete HTML document with styling
        html_doc = _build_pdf_html_document(lesson, clean_content)
        
        # Configure fonts for Japanese support
        font_config = FontConfiguration()
        
        # Generate PDF
        pdf_buffer = BytesIO()
        
        try:
            html_obj = HTML(string=html_doc)
            html_obj.write_pdf(pdf_buffer, font_config=font_config)
            pdf_bytes = pdf_buffer.getvalue()
        finally:
            pdf_buffer.close()
        
        return pdf_bytes
        
    except (ImportError, OSError) as e:
        # WeasyPrint not available (common on Windows without GTK)
        # Fall back to ReportLab
        logger.warning(
            f"WeasyPrint unavailable ({str(e)}), falling back to ReportLab for lesson {lesson.id}"
        )
        return _render_lesson_pdf_reportlab(lesson)


def _build_pdf_html_document(lesson, content):
    """
    Build a complete HTML document with CSS for PDF rendering.
    
    Args:
        lesson: Lesson model instance
        content: Sanitized HTML content string
        
    Returns:
        str: Complete HTML document
    """
    accent_color = lesson.accent_color or '#3498db'
    
    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{_escape_html(lesson.title)}</title>
    <style>
        @page {{
            size: A4;
            margin: 1.5cm 2cm;
        }}
        
        body {{
            font-family: "Noto Sans", "Noto Sans JP", "Segoe UI", "Yu Gothic", "Meiryo", sans-serif;
            line-height: 1.8;
            color: #2c3e50;
            font-size: 11pt;
        }}
        
        h1 {{
            color: {accent_color};
            font-size: 20pt;
            margin-top: 0;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }}
        
        h2 {{
            color: {accent_color};
            font-size: 16pt;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }}
        
        h3 {{
            color: {accent_color};
            font-size: 13pt;
            margin-top: 1.2em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }}
        
        h4, h5, h6 {{
            color: {accent_color};
            font-size: 11pt;
            margin-top: 1em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }}
        
        p {{
            margin: 0 0 0.8em 0;
            line-height: 1.8;
        }}
        
        ul, ol {{
            margin: 0.5em 0 1em 0;
            padding-left: 2em;
        }}
        
        li {{
            margin-bottom: 0.3em;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            page-break-inside: avoid;
        }}
        
        th, td {{
            border: 1px solid #bdc3c7;
            padding: 0.5em;
            text-align: left;
        }}
        
        th {{
            background-color: {accent_color};
            color: white;
            font-weight: 600;
        }}
        
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        
        strong, b {{
            font-weight: 600;
        }}
        
        em, i {{
            font-style: italic;
        }}
        
        .lesson-header {{
            border-bottom: 3px solid {accent_color};
            padding-bottom: 0.8em;
            margin-bottom: 1.5em;
        }}
        
        .lesson-meta {{
            color: #7f8c8d;
            font-size: 9pt;
            margin-top: 0.3em;
        }}
        
        .explanation-section {{
            margin: 1em 0;
            padding: 0.8em;
            background-color: #f8f9fa;
            border-left: 4px solid {accent_color};
        }}
        
        .explanation-section h3 {{
            margin-top: 0;
            font-size: 12pt;
        }}
        
        blockquote {{
            border-left: 4px solid {accent_color};
            padding-left: 1em;
            margin: 1em 0;
            color: #555;
            font-style: italic;
        }}
        
        code {{
            background-color: #ecf0f1;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: "Courier New", monospace;
            font-size: 9pt;
        }}
        
        pre {{
            background-color: #ecf0f1;
            padding: 0.8em;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 9pt;
            page-break-inside: avoid;
        }}
        
        pre code {{
            background: none;
            padding: 0;
        }}
        
        a {{
            color: {accent_color};
            text-decoration: none;
        }}
        
        .lesson-content {{
            margin-top: 1em;
        }}
    </style>
</head>
<body>
    <div class="lesson-header">
        <h1>{_escape_html(lesson.title)}</h1>
        <div class="lesson-meta">
            Created by: {_escape_html(lesson.created_by.username)} | 
            Date: {lesson.created_at.strftime('%B %d, %Y')}
            {f' | Subject: {_escape_html(lesson.subject.name)}' if lesson.subject else ''}
            {f' | Course: {_escape_html(lesson.course.title)}' if lesson.course else ''}
        </div>
    </div>
    
    <div class="lesson-content">
        {content}
    </div>
</body>
</html>
    """
    
    return html


def _escape_html(text):
    """Simple HTML escaping for safety."""
    if not text:
        return ""
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#x27;'))


def get_or_generate_lesson_pdf(lesson):
    """
    Get cached PDF or generate new one if needed.
    
    Uses lesson.export_pdf and lesson.export_generated_at for caching.
    Regenerates if:
    - No cached PDF exists
    - Lesson was updated after PDF was generated
    
    Args:
        lesson: Lesson model instance
        
    Returns:
        bytes: PDF file content
    """
    from django.utils import timezone
    from django.core.files.base import ContentFile
    
    # Check if we have a valid cached PDF
    if lesson.export_pdf:
        # Check if lesson was updated after PDF generation
        if lesson.export_generated_at and lesson.export_generated_at >= lesson.updated_at:
            # Use cached PDF
            try:
                with lesson.export_pdf.open('rb') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to read cached PDF for lesson {lesson.id}: {e}")
                # Fall through to regenerate
    
    # Generate new PDF
    logger.info(f"Generating PDF for lesson {lesson.id}")
    pdf_bytes = render_lesson_pdf_bytes(lesson)
    
    # Save to cache
    try:
        filename = f"{lesson.permalink}.pdf".replace('/', '_')
        lesson.export_pdf.save(filename, ContentFile(pdf_bytes), save=False)
        lesson.export_generated_at = timezone.now()
        lesson.save(update_fields=['export_pdf', 'export_generated_at'])
    except Exception as e:
        logger.error(f"Failed to cache PDF for lesson {lesson.id}: {e}")
        # Continue anyway - return the generated PDF
    
    return pdf_bytes


def _render_lesson_pdf_reportlab(lesson):
    """
    Fallback PDF renderer using ReportLab (works on Windows without GTK).
    Uses Arial Unicode MS for multi-language support (Japanese, Chinese, Arabic, etc.)
    
    Args:
        lesson: Lesson model instance
        
    Returns:
        bytes: PDF file content
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.lib import colors
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        raise Exception(
            "ReportLab is not installed. "
            "Run: pip install reportlab"
        )
    
    buffer = BytesIO()
    
    # Register Unicode font for multi-language support
    # Try to find a Unicode font on the system
    unicode_font_name = 'UnicodeFallback'
    try:
        # Windows: Try common Unicode fonts
        import os
        import sys
        
        windows_fonts = [
            'C:/Windows/Fonts/ARIALUNI.TTF',  # Arial Unicode MS (best for all languages)
            'C:/Windows/Fonts/msgothic.ttc',  # MS Gothic (Japanese)
            'C:/Windows/Fonts/YuGothM.ttc',   # Yu Gothic Medium
            'C:/Windows/Fonts/msmincho.ttc',  # MS Mincho
            'C:/Windows/Fonts/meiryo.ttc',    # Meiryo
            'C:/Windows/Fonts/seguiemj.ttf',  # Segoe UI Emoji
        ]
        
        # Also try downloading a free Unicode font if none exist
        font_registered = False
        for font_path in windows_fonts:
            if os.path.exists(font_path):
                try:
                    pdfmetrics.registerFont(TTFont(unicode_font_name, font_path))
                    font_registered = True
                    logger.info(f"Registered Unicode font: {font_path}")
                    break
                except Exception as e:
                    logger.warning(f"Failed to register font {font_path}: {e}")
                    continue
        
        if not font_registered:
            # Last resort: use reportlab's built-in CID fonts (limited Japanese support)
            from reportlab.pdfbase.cidfonts import UnicodeCIDFont
            try:
                pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))  # Japanese font
                unicode_font_name = 'HeiseiMin-W3'
                font_registered = True
                logger.info("Using built-in Japanese CID font: HeiseiMin-W3")
            except Exception as e:
                logger.warning(f"CID font registration failed: {e}")
        
        if not font_registered:
            # Final fallback: use Helvetica (Latin only)
            unicode_font_name = 'Helvetica'
            logger.warning("No Unicode font found, Japanese/CJK characters will not display correctly")
    except Exception as e:
        unicode_font_name = 'Helvetica'
        logger.warning(f"Font registration failed: {e}, using Helvetica")
    
    # Create PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm
    )
    
    # Build content
    elements = []
    styles = getSampleStyleSheet()
    
    # Title - use Unicode font
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=unicode_font_name,
        fontSize=18,
        textColor=colors.HexColor(lesson.accent_color or '#3498db'),
        spaceAfter=12,
        alignment=TA_CENTER,
        leading=22
    )
    elements.append(Paragraph(lesson.title, title_style))
    elements.append(Spacer(1, 0.3*cm))
    
    # Metadata - use Unicode font
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName=unicode_font_name,
        fontSize=9,
        textColor=colors.grey,
        alignment=TA_CENTER,
        leading=12
    )
    meta_parts = [f"Created by: {lesson.created_by.username}"]
    meta_parts.append(f"Date: {lesson.created_at.strftime('%B %d, %Y')}")
    if lesson.subject:
        meta_parts.append(f"Subject: {lesson.subject.name}")
    if lesson.course:
        meta_parts.append(f"Course: {lesson.course.title}")
    
    elements.append(Paragraph(" | ".join(meta_parts), meta_style))
    elements.append(Spacer(1, 0.8*cm))
    
    # Get cleaned HTML content
    clean_content = build_print_html_from_lesson(lesson)
    
    # Parse HTML and convert to paragraphs
    soup = BeautifulSoup(clean_content, 'html.parser')
    
    # Process content elements
    for element in soup.descendants:
        if not element.name:  # Skip text nodes
            continue
            
        if element.name == 'h2':
            text = element.get_text(strip=True)
            if text:
                h2_style = ParagraphStyle(
                    'CustomH2',
                    parent=styles['Heading2'],
                    fontName=unicode_font_name,
                    fontSize=14,
                    textColor=colors.HexColor(lesson.accent_color or '#3498db'),
                    spaceBefore=12,
                    spaceAfter=6,
                    leading=18
                )
                elements.append(Paragraph(text, h2_style))
                
        elif element.name == 'h3':
            text = element.get_text(strip=True)
            if text:
                h3_style = ParagraphStyle(
                    'CustomH3',
                    parent=styles['Heading3'],
                    fontName=unicode_font_name,
                    fontSize=12,
                    textColor=colors.HexColor(lesson.accent_color or '#3498db'),
                    spaceBefore=10,
                    spaceAfter=4,
                    leading=16
                )
                elements.append(Paragraph(text, h3_style))
                
        elif element.name == 'p' and element.parent.name != 'td':
            text = element.get_text(strip=True)
            if text and not element.find_parent(['h1', 'h2', 'h3', 'h4', 'li']):
                try:
                    para_style = ParagraphStyle(
                        'UnicodePara',
                        parent=styles['Normal'],
                        fontName=unicode_font_name,
                        fontSize=11,
                        leading=16
                    )
                    para = Paragraph(text, para_style)
                    elements.append(para)
                    elements.append(Spacer(1, 0.2*cm))
                except Exception as e:
                    # If Paragraph fails, use Preformatted with Unicode font
                    logger.warning(f"Paragraph render failed, using Preformatted: {e}")
                    try:
                        pre_style = ParagraphStyle(
                            'UnicodePreformatted',
                            parent=styles['Normal'],
                            fontName=unicode_font_name,
                            fontSize=10,
                            leading=14
                        )
                        elements.append(Preformatted(text, pre_style))
                        elements.append(Spacer(1, 0.2*cm))
                    except Exception:
                        pass  # Skip if even preformatted fails
                    
        elif element.name == 'table':
            try:
                # Extract table data
                rows = []
                for tr in element.find_all('tr'):
                    row = []
                    for cell in tr.find_all(['th', 'td']):
                        row.append(cell.get_text(strip=True))
                    if row:
                        rows.append(row)
                
                if rows:
                    # Create table with Unicode font
                    table = Table(rows)
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(lesson.accent_color or '#3498db')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 0), (-1, -1), unicode_font_name),  # Use Unicode font for all cells
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('FONTSIZE', (0, 1), (-1, -1), 9),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    elements.append(table)
                    elements.append(Spacer(1, 0.5*cm))
            except Exception as e:
                logger.warning(f"Failed to render table in PDF: {e}")
    
    # Build PDF
    try:
        doc.build(elements)
    except Exception as e:
        # If build fails (often due to Japanese characters in ReportLab),
        # create a plain text version using Preformatted
        logger.warning(f"PDF build failed ({e}), creating plain text version")
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                               rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=1.5*cm, bottomMargin=1.5*cm)
        
        # Get all text content
        clean_content = build_print_html_from_lesson(lesson)
        soup = BeautifulSoup(clean_content, 'html.parser')
        all_text = soup.get_text(separator='\n', strip=True)
        
        # Create simple plain text output with UTF-8 encoding
        simple_elements = []
        
        # Title and metadata
        title_lines = [
            lesson.title,
            '=' * 60,
            f"Created by: {lesson.created_by.username}",
            f"Date: {lesson.created_at.strftime('%B %d, %Y')}",
        ]
        if lesson.subject:
            title_lines.append(f"Subject: {lesson.subject.name}")
        if lesson.course:
            title_lines.append(f"Course: {lesson.course.title}")
        title_lines.append('=' * 60)
        title_lines.append('')
        
        # Add all text lines
        text_lines = title_lines + all_text.split('\n')
        
        # Use Preformatted for plain text (handles UTF-8)
        from reportlab.lib.styles import getSampleStyleSheet
        plain_style = getSampleStyleSheet()['Code']
        plain_style.fontSize = 10
        plain_style.leading = 14
        
        for line in text_lines:
            if line.strip():
                try:
                    # Encode as UTF-8 for proper handling
                    simple_elements.append(Preformatted(line, plain_style))
                except Exception:
                    # Skip lines that can't be rendered
                    pass
        
        try:
            doc.build(simple_elements)
        except Exception as e2:
            # Ultimate fallback: ASCII-only
            logger.error(f"Plain text PDF also failed ({e2}), creating minimal PDF")
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            minimal_elements = [
                Paragraph(f"Lesson: {lesson.id}", title_style),
                Spacer(1, 0.5*cm),
                Paragraph("Content contains special characters that cannot be rendered in PDF.", meta_style),
                Spacer(1, 0.3*cm),
                Paragraph("Please view this lesson in your web browser for full content.", meta_style)
            ]
            doc.build(minimal_elements)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
