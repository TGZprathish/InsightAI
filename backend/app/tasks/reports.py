"""Celery report tasks: ReportLab PDF report generation and file export."""

import datetime
import io
import uuid
from typing import Dict

from celery import shared_task
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.report import Report
from app.services.storage import storage_service


def generate_pdf_report(report_title: str, content_json: Dict) -> bytes:
    """Generate a styled PDF document using ReportLab."""
    pdf_buf = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buf,
        pagesize=letter,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    teal = colors.HexColor("#14b8a6")
    purple = colors.HexColor("#a855f7")
    dark_bg = colors.HexColor("#0a0f1a")
    surface_bg = colors.HexColor("#111827")
    card_bg = colors.HexColor("#1f2937")
    text_light = colors.HexColor("#f9fafb")
    text_muted = colors.HexColor("#9ca3af")
    border_color = colors.HexColor("#374151")

    # Title style
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=teal,
        spaceAfter=6,
    )

    h2_style = ParagraphStyle(
        "DocH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=purple,
        spaceBefore=12,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#374151"),
        spaceAfter=6,
    )

    elements = []

    # Title Banner
    elements.append(Paragraph(report_title, title_style))
    elements.append(Paragraph(f"Generated on {datetime.datetime.now().strftime('%B %d, %Y')} | InsightAI Intelligence", body_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=teal, spaceAfter=12))

    # Executive Summary
    if "executive_summary" in content_json:
        elements.append(Paragraph("Executive Summary", h2_style))
        elements.append(Paragraph(content_json["executive_summary"], body_style))
        elements.append(Spacer(1, 10))

    # Key Metrics Table
    if "key_metrics" in content_json and content_json["key_metrics"]:
        elements.append(Paragraph("Key Metrics", h2_style))
        metrics = content_json["key_metrics"]

        table_data = [["Metric Label", "Value", "Trend"]]
        for m in metrics:
            table_data.append([m.get("label", ""), m.get("value", ""), m.get("trend", "").upper()])

        t = Table(table_data, colWidths=[3.0 * inch, 2.5 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), teal),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))

    # Notable Trends
    if "notable_trends" in content_json and content_json["notable_trends"]:
        elements.append(Paragraph("Notable Trends", h2_style))
        for item in content_json["notable_trends"]:
            title_p = Paragraph(f"<b>{item.get('title', '')}</b>", body_style)
            desc_p = Paragraph(item.get("narrative", ""), body_style)
            elements.append(title_p)
            elements.append(desc_p)
            elements.append(Spacer(1, 6))

    # Recommendations
    if "recommendations" in content_json and content_json["recommendations"]:
        elements.append(Paragraph("Strategic Recommendations", h2_style))
        for r in content_json["recommendations"]:
            rec_p = Paragraph(f"• <b>{r.get('title', '')}:</b> {r.get('rationale', '')}", body_style)
            elements.append(rec_p)

    doc.build(elements)
    pdf_bytes = pdf_buf.getvalue()
    return pdf_bytes


@shared_task(name="app.tasks.reports.export_report_pdf_task")
def export_report_pdf_task(report_id: str) -> Dict:
    """Celery task to generate a ReportLab PDF file and save to storage."""
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        report = session.get(Report, uuid.UUID(report_id))
        if not report:
            return {"error": "Report not found"}

        content = report.content_json or {}
        pdf_bytes = generate_pdf_report(report.title, content)

        storage_key = f"reports/{report.id}/export.pdf"
        export_uri = storage_service.upload_file(storage_key, pdf_bytes, "application/pdf")

        if not report.export_uris:
            report.export_uris = {}
        report.export_uris["pdf"] = export_uri
        session.commit()

        return {"status": "complete", "export_uri": export_uri}
