from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT = "output/pdf/Srishti_Meena_EY_Associate_Consultant_Cyber_Resume.pdf"


def p(text, style):
    return Paragraph(text, style)


def bullets(items, style):
    flow = []
    for item in items:
        flow.append(Paragraph(f"- {item}", style))
    return flow


styles = getSampleStyleSheet()
name = ParagraphStyle(
    "Name",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=16,
    leading=18,
    alignment=TA_CENTER,
    spaceAfter=3,
)
contact = ParagraphStyle(
    "Contact",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.8,
    leading=10,
    alignment=TA_CENTER,
    textColor=colors.HexColor("#333333"),
    spaceAfter=8,
)
section = ParagraphStyle(
    "Section",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9.6,
    leading=11,
    textColor=colors.HexColor("#111111"),
    borderWidth=0,
    borderPadding=0,
    spaceBefore=6,
    spaceAfter=3,
)
body = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=10.2,
    alignment=TA_LEFT,
    spaceAfter=2,
)
body_tight = ParagraphStyle(
    "BodyTight",
    parent=body,
    fontSize=8.2,
    leading=9.7,
    spaceAfter=1.5,
)
role = ParagraphStyle(
    "Role",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8.8,
    leading=10.5,
    spaceBefore=2,
    spaceAfter=2,
)
small = ParagraphStyle(
    "Small",
    parent=body,
    fontSize=8.0,
    leading=9.4,
)


doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    rightMargin=0.48 * inch,
    leftMargin=0.48 * inch,
    topMargin=0.36 * inch,
    bottomMargin=0.36 * inch,
)

story = []

story.append(p("SRISHTI MEENA", name))
story.append(
    p(
        "srishtimeenaoffical25@gmail.com | +91 91167 98518 | linkedin.com/in/srishtimeena",
        contact,
    )
)

story.append(p("SUMMARY", section))
story.append(
    p(
        "MBA Cyber Security Management student and ISO/IEC 27001:2022 Lead Auditor trained fresher with internship exposure to ITSM documentation review, IT/IS audit readiness, ISO/IEC 20000 alignment and compliance evidence preparation. Comfortable supporting client interviews, process walkthroughs, workpapers, gap analysis, risk assessment and remediation tracking under senior guidance. Interested in EY Cyber/Tech Risk engagements across IT audit, IAM, BCM, security program management and service management controls.",
        body,
    )
)

story.append(p("CORE SKILLS", section))
skills_data = [
    [
        p("<b>Cyber, Risk & Compliance</b>", body_tight),
        p(
            "ISO/IEC 27001:2022, ISO/IEC 20000-1:2018, NIST CSF, ISMS audit, risk assessment and treatment, control evaluation, CAPA tracking, compliance reporting",
            body_tight,
        ),
    ],
    [
        p("<b>Tech Risk & ITSM</b>", body_tight),
        p(
            "ITIL 4, PinkVERIFY, Incident Management, Service Level Management, IT Asset Management, Release & Deployment, Service Catalog, Monitoring & Alerting, SLA tracking",
            body_tight,
        ),
    ],
    [
        p("<b>EY-Relevant Areas</b>", body_tight),
        p(
            "IT and IS audit support, workpaper preparation, process documentation review, IAM basics, BCM basics, vendor risk awareness, audit observation tracking",
            body_tight,
        ),
    ],
    [
        p("<b>Technical Foundation</b>", body_tight),
        p(
            "Network security, TCP/IP, Wireshark, Nmap, traffic analysis, digital forensics fundamentals, applied cryptography basics, static and dynamic malware analysis",
            body_tight,
        ),
    ],
    [
        p("<b>Consulting Strengths</b>", body_tight),
        p(
            "Client discussion support, requirement analysis, technical writing, clear documentation, teamwork, analytical problem solving, deadline-based multitasking",
            body_tight,
        ),
    ],
]
tbl = Table(skills_data, colWidths=[1.42 * inch, 6.05 * inch], hAlign="LEFT")
tbl.setStyle(
    TableStyle(
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]
    )
)
story.append(tbl)

story.append(p("EXPERIENCE", section))
story.append(
    p(
        "Cyber Security Compliance Intern | Tectona Software Solutions Pvt. Ltd., Ahmedabad | Jun 2026 - Jul 2026",
        role,
    )
)
story.extend(
    bullets(
        [
            "Reviewed and improved ITSM process documentation across Service Level, IT Asset, Incident, Monitoring & Alerting, Release & Deployment and Service Catalog Management.",
            "Checked process documents against ITIL 4 practices, PinkVERIFY requirements and ISO/IEC 20000 guidance to identify gaps and suggest practical improvements.",
            "Supported audit-readiness work by preparing structured documentation, evidence references and clear process write-ups suitable for review by senior team members.",
            "Participated in requirement discussions and team meetings to understand current-state IT processes, convert discussion points into workpapers and track open clarification items.",
            "Built a practical understanding of how findings move from observation to risk rating, corrective action, owner assignment, SLA tracking and closure verification.",
        ],
        body_tight,
    )
)

story.append(p("PROJECT", section))
story.append(p("ISMS GRC Platform | ISO 27001 Internal Audit, Risk and Remediation Management", role))
story.extend(
    bullets(
        [
            "Developed a centralized ISMS GRC platform concept to manage ISO 27001 internal audit findings, risk treatment and IT remediation from one dashboard.",
            "Mapped the compliance lifecycle from ISO control assessment to finding, risk, corrective action, ITSM ticket, SLA tracking and verified closure.",
            "Included risk rating, corrective action ownership, due dates and overdue visibility so management can identify delayed remediation before repeat audit observations occur.",
            "Designed the project around practical consulting needs: traceability, evidence visibility, accountability and simple status reporting for audit and cyber risk teams.",
        ],
        body_tight,
    )
)

story.append(p("CERTIFICATIONS", section))
story.extend(
    bullets(
        [
            "CQI & IRCA Certified PR373: ISO/IEC 27001:2022 Lead Auditor Training | Bureau Veritas | June 2026 - covered ISMS implementation, risk assessment, compliance evaluation, audit planning and audit reporting.",
            "Certified Information Systems Security Professional (CISSP) Course | INE | In Progress",
        ],
        body_tight,
    )
)

story.append(p("EDUCATION", section))
story.append(
    p(
        "<b>MBA Cyber Security Management</b> | National Forensic Sciences University, Gandhinagar | CGPI 8.50 | 2025 - Present",
        body_tight,
    )
)
story.append(
    p(
        "<b>Bachelor of Computer Applications (BCA)</b> | University of Rajasthan, Jaipur | 80.7% | 2022 - 2025",
        body_tight,
    )
)

doc.build(story)
print(OUTPUT)
