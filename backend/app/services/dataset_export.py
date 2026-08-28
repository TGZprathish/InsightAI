"""Dataset export service: ReportLab styled executive PDF generation."""

import io
from typing import Any, Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_dataset_pdf(report_data: Dict[str, Any]) -> bytes:
    """Generate a styled executive PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    PRIMARY = colors.HexColor("#0f172a")
    ACCENT = colors.HexColor("#6366f1")
    SUCCESS = colors.HexColor("#10b981")
    WARNING = colors.HexColor("#f59e0b")
    TEXT_DARK = colors.HexColor("#1e293b")
    BG_LIGHT = colors.HexColor("#f8fafc")
    BORDER_COLOR = colors.HexColor("#cbd5e1")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=PRIMARY,
        fontName='Helvetica-Bold',
        spaceAfter=4,
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=12,
    )

    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=PRIMARY,
        fontName='Helvetica-Bold',
        spaceBefore=12,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=TEXT_DARK,
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=TEXT_DARK,
        leftIndent=12,
        spaceAfter=4,
    )

    story = []

    # Title Banner
    story.append(Paragraph("<b>InsightAI Analytics Executive Report</b>", title_style))
    story.append(Paragraph(f"Dataset: <b>{report_data['dataset_name']}</b> | Version {report_data['version_number']} ({report_data['stage'].upper()}) | Generated: {report_data['created_at'][:10]}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceAfter=14))

    # Executive Summary Box
    summary_text = f"<b>Executive Briefing:</b> {report_data['executive_summary']}"
    summary_p = Paragraph(summary_text, body_style)
    summary_table = Table([[summary_p]], colWidths=[540])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # KPI Key Metrics Table
    kpi_header_style = ParagraphStyle('KPIH', fontSize=8, leading=10, textColor=colors.HexColor("#64748b"), fontName='Helvetica-Bold')
    kpi_val_style = ParagraphStyle('KPIV', fontSize=12, leading=14, textColor=PRIMARY, fontName='Helvetica-Bold')

    kpi_data = [
        [
            Paragraph("TOTAL RECORDS", kpi_header_style),
            Paragraph("ATTRIBUTES", kpi_header_style),
            Paragraph("COMPLETENESS", kpi_header_style),
            Paragraph("QUALITY SCORE", kpi_header_style),
            Paragraph("OUTLIERS", kpi_header_style),
        ],
        [
            Paragraph(f"{report_data['total_rows']:,}", kpi_val_style),
            Paragraph(f"{report_data['total_columns']}", kpi_val_style),
            Paragraph(f"{report_data['completeness_pct']}%", ParagraphStyle('P1', parent=kpi_val_style, textColor=ACCENT)),
            Paragraph(f"{report_data['quality_score']}%", ParagraphStyle('P2', parent=kpi_val_style, textColor=SUCCESS if report_data['quality_score'] >= 90 else WARNING)),
            Paragraph(f"{report_data['outlier_total']:,}", ParagraphStyle('P3', parent=kpi_val_style, textColor=WARNING if report_data['outlier_total'] > 0 else TEXT_DARK)),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[108, 108, 108, 108, 108])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # Visual Charts
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from reportlab.platypus import Image as RLImage

        fig1, ax1 = plt.subplots(figsize=(4.2, 2.2), dpi=150)
        sizes1 = [report_data['valid_cells'], max(0, report_data['null_cells'])]
        labels1 = ['Valid Data Cells', 'Missing Cells']
        colors1 = ['#10b981', '#ef4444']
        if sum(sizes1) == 0:
            sizes1 = [1, 0]

        wedges, texts, autotexts = ax1.pie(
            sizes1, labels=labels1, autopct='%1.1f%%', startangle=140,
            colors=colors1, wedgeprops=dict(width=0.45, edgecolor='w')
        )
        for t in texts:
            t.set_fontsize(7)
        for at in autotexts:
            at.set_fontsize(7)
            at.set_color('white')
            at.set_weight('bold')

        ax1.set_title("Data Quality Completeness Breakdown", fontsize=9, fontweight='bold', pad=8)
        buf1 = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf1, format='png', transparent=True)
        plt.close(fig1)
        buf1.seek(0)

        buf2 = None
        num_features = [fi for fi in report_data.get('feature_insights', []) if fi['type'] == 'numerical'][:5]
        if num_features:
            fig2, ax2 = plt.subplots(figsize=(4.8, 2.2), dpi=150)
            f_names = [f['feature'][:12] for f in num_features]
            f_means = [f['mean'] for f in num_features]

            bars = ax2.bar(f_names, f_means, color='#6366f1', width=0.45, edgecolor='#4f46e5')
            ax2.set_title("Numerical Feature Means", fontsize=9, fontweight='bold', pad=8)
            ax2.tick_params(axis='x', labelsize=7, rotation=12)
            ax2.tick_params(axis='y', labelsize=7)
            ax2.grid(axis='y', linestyle='--', alpha=0.5)

            for bar in bars:
                h = bar.get_height()
                ax2.annotate(f'{h}', xy=(bar.get_x() + bar.get_width() / 2, h),
                             xytext=(0, 2), textcoords="offset points",
                             ha='center', va='bottom', fontsize=6.5, fontweight='bold')

            buf2 = io.BytesIO()
            plt.tight_layout()
            plt.savefig(buf2, format='png', transparent=True)
            plt.close(fig2)
            buf2.seek(0)

        img1 = RLImage(buf1, width=250, height=130)
        img2 = RLImage(buf2, width=270, height=130) if buf2 else Paragraph("Categorical dataset overview", body_style)

        chart_table = Table([[img1, img2]], colWidths=[270, 270])
        chart_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(chart_table)
        story.append(Spacer(1, 14))
    except Exception as ex:
        print(f"PDF Chart embedding note: {ex}")

    # Key Findings Section
    story.append(Paragraph("Key Statistical Findings (Python Pandas Engine)", heading_style))
    for find in report_data.get('key_findings', []):
        story.append(Paragraph(f"• {find}", bullet_style))
    story.append(Spacer(1, 10))

    # Strategic Recommendations Section
    story.append(Paragraph("Strategic Data Recommendations", heading_style))
    for rec in report_data.get('recommendations', []):
        story.append(Paragraph(f"• {rec}", bullet_style))
    story.append(Spacer(1, 14))

    # Feature Metrics Table Section
    if report_data.get('feature_insights'):
        story.append(Paragraph("Full Feature Statistical Breakdown", heading_style))

        th_style = ParagraphStyle('TH', fontSize=8, leading=10, textColor=colors.white, fontName='Helvetica-Bold')
        td_style = ParagraphStyle('TD', fontSize=8, leading=10, textColor=TEXT_DARK)

        feature_table_data = [
            [
                Paragraph("Feature Name", th_style),
                Paragraph("Type", th_style),
                Paragraph("Statistical Metrics", th_style),
                Paragraph("Range / Unique", th_style),
                Paragraph("Outliers", th_style),
            ]
        ]

        for fi in report_data['feature_insights']:
            f_name = fi['feature']
            f_type = fi['type'].upper()
            if fi['type'] == 'numerical':
                metrics = f"Mean: {fi['mean']} (Std: {fi['std']})"
                rng = f"{fi['min']} / {fi['max']}"
                out_str = str(fi['outliers_count'])
            else:
                metrics = f"Top: '{fi['top_category']}' ({fi['dominance_pct']}%)"
                rng = f"{fi['unique_count']} Unique"
                out_str = "-"

            feature_table_data.append([
                Paragraph(f"<b>{f_name}</b>", td_style),
                Paragraph(f_type, td_style),
                Paragraph(metrics, td_style),
                Paragraph(rng, td_style),
                Paragraph(out_str, td_style),
            ])

        ft_table = Table(feature_table_data, colWidths=[120, 70, 180, 100, 70])
        ft_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ]))
        story.append(ft_table)

    # Predictive Recommendations Section
    pred_recs = report_data.get('predictive_recommendations', [])
    if pred_recs:
        story.append(Spacer(1, 14))
        story.append(Paragraph("Predictive Recommendations &amp; Future Data Strategy", heading_style))
        story.append(Spacer(1, 4))

        priority_colors = {
            "critical": colors.HexColor("#ef4444"),
            "high": colors.HexColor("#f59e0b"),
            "medium": colors.HexColor("#3b82f6"),
            "low": colors.HexColor("#10b981"),
        }

        for pr in pred_recs:
            pr_color = priority_colors.get(pr.get("priority", "medium"), ACCENT)
            header_text = (
                f"<b>{pr['category']}</b> &nbsp; "
                f"<font color=\"{pr_color.hexval()}\">[{pr['priority'].upper()}]</font> &nbsp; "
                f"Impact: <b>{pr['predicted_impact_pct']}%</b> | "
                f"Confidence: <b>{pr['confidence'].capitalize()}</b> | "
                f"Timeline: <i>{pr['timeline']}</i>"
            )
            story.append(Paragraph(header_text, ParagraphStyle(
                'PredHeader', parent=body_style, fontSize=9, leading=13, spaceAfter=2, spaceBefore=8
            )))
            story.append(Paragraph(pr['summary'], ParagraphStyle(
                'PredSummary', parent=body_style, fontSize=8.5, leading=12, textColor=colors.HexColor("#475569"), spaceAfter=3
            )))
            for step in pr.get('steps', []):
                story.append(Paragraph(f"▸ {step}", ParagraphStyle(
                    'PredStep', parent=bullet_style, fontSize=8, leading=11, leftIndent=16, spaceAfter=2
                )))
            story.append(Spacer(1, 6))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
