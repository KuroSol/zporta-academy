# lessons/export_utils.py
"""
Utilities for exporting lesson content to various formats (PDF, DOCX)
"""

from io import BytesIO
from django.conf import settings
from bs4 import BeautifulSoup
import re

def clean_html_for_export(html_content):
    """Remove custom CSS/JS and clean HTML for export"""
    if not html_content:
        return ""
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove style and script tags
    for tag in soup.find_all(['style', 'script']):
        tag.decompose()
    
    # Remove contenteditable attributes
    for tag in soup.find_all(attrs={"contenteditable": True}):
        del tag['contenteditable']
    
    return str(soup)


def generate_lesson_pdf(lesson):
    """
    Generate a PDF from lesson content
    Requires: pip install reportlab
    """
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.pdfgen import canvas
    except ImportError:
        return None, "ReportLab not installed. Run: pip install reportlab"
    
    buffer = BytesIO()
    
    # Create PDF
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                           rightMargin=72, leftMargin=72,
                           topMargin=72, bottomMargin=18)
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER))
    
    # Title
    title_style = styles['Heading1']
    title_style.alignment = TA_CENTER
    elements.append(Paragraph(lesson.title, title_style))
    elements.append(Spacer(1, 12))
    
    # Metadata
    meta_text = f"Created by: {lesson.created_by.username}<br/>"
    meta_text += f"Created: {lesson.created_at.strftime('%Y-%m-%d')}<br/>"
    if lesson.subject:
        meta_text += f"Subject: {lesson.subject.name}<br/>"
    if lesson.course:
        meta_text += f"Course: {lesson.course.title}<br/>"
    
    elements.append(Paragraph(meta_text, styles['Normal']))
    elements.append(Spacer(1, 24))
    
    # Content
    clean_content = clean_html_for_export(lesson.content)
    
    # Convert HTML to plain text for PDF (simple approach)
    soup = BeautifulSoup(clean_content, 'html.parser')
    text_content = soup.get_text()
    
    # Split into paragraphs and add to PDF
    for para in text_content.split('\n'):
        if para.strip():
            elements.append(Paragraph(para, styles['Normal']))
            elements.append(Spacer(1, 12))
    
    # Video URL if exists
    if lesson.video_url:
        elements.append(Spacer(1, 24))
        elements.append(Paragraph(f"Video: {lesson.video_url}", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF data
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return pdf_data, None


def generate_lesson_docx(lesson):
    """
    Generate a DOCX from lesson content
    Requires: pip install python-docx
    """
    try:
        from docx import Document
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
    except ImportError:
        return None, "python-docx not installed. Run: pip install python-docx"
    
    buffer = BytesIO()
    
    # Create document
    document = Document()
    
    # Title
    title = document.add_heading(lesson.title, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Metadata
    document.add_paragraph(f"Created by: {lesson.created_by.username}")
    document.add_paragraph(f"Created: {lesson.created_at.strftime('%Y-%m-%d')}")
    if lesson.subject:
        document.add_paragraph(f"Subject: {lesson.subject.name}")
    if lesson.course:
        document.add_paragraph(f"Course: {lesson.course.title}")
    
    document.add_paragraph()  # Empty line
    
    # Content
    clean_content = clean_html_for_export(lesson.content)
    soup = BeautifulSoup(clean_content, 'html.parser')
    
    # Extract text with basic formatting
    for element in soup.descendants:
        if element.name == 'h1':
            document.add_heading(element.get_text(), level=1)
        elif element.name == 'h2':
            document.add_heading(element.get_text(), level=2)
        elif element.name == 'h3':
            document.add_heading(element.get_text(), level=3)
        elif element.name == 'p':
            text = element.get_text().strip()
            if text:
                document.add_paragraph(text)
        elif element.name == 'li':
            text = element.get_text().strip()
            if text:
                document.add_paragraph(text, style='List Bullet')
    
    # Video URL if exists
    if lesson.video_url:
        document.add_paragraph()
        p = document.add_paragraph(f"Video: {lesson.video_url}")
        p.runs[0].font.color.rgb = RGBColor(0, 0, 255)
    
    # Save to buffer
    document.save(buffer)
    
    # Get DOCX data
    docx_data = buffer.getvalue()
    buffer.close()
    
    return docx_data, None
