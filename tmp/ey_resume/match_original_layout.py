from pathlib import Path
import json
import re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph

ROOT = Path(r'C:\Users\my792\Desktop\raga')
TMP = ROOT / 'tmp' / 'ey_resume'
OUTPUT = ROOT / 'output' / 'pdf' / 'Srishti_Meena_Cyber_Security_Resume.pdf'
WIDTH, HEIGHT = 595.30398, 841.8898
LEFT, RIGHT = 34.05, 561.25
pdfmetrics.registerFont(TTFont('Inter', str(TMP / 'fonts' / 'Inter_18pt_Regular.ttf')))
pdfmetrics.registerFont(TTFont('Inter-Bold', str(TMP / 'fonts' / 'Inter_18pt_Bold.ttf')))
pdfmetrics.registerFontFamily('Inter', normal='Inter', bold='Inter-Bold', italic='Inter', boldItalic='Inter-Bold')

c = canvas.Canvas(str(OUTPUT), pagesize=(WIDTH, HEIGHT), pageCompression=1)
c.setTitle('Srishti Meena | Cyber Security Resume')
c.setAuthor('Srishti Meena')
c.setSubject('Cyber Security, IT Audit and Governance Risk and Compliance')
body_style = ParagraphStyle('Body', fontName='Inter', fontSize=9.5, leading=11.15, textColor=colors.HexColor('#252525'))
measurements = []

def para(text, top, x=LEFT, width=RIGHT-LEFT, size=9.5, leading=11.15, max_bottom=None):
    style = ParagraphStyle('slot', parent=body_style, fontSize=size, leading=leading)
    p = Paragraph(text, style)
    _, height = p.wrap(width, HEIGHT)
    if max_bottom is not None and top + height > max_bottom + 0.1:
        raise ValueError(f'Overflow: {top + height:.2f} > {max_bottom}: {text}')
    p.drawOn(c, x, HEIGHT-top-height)
    measurements.append({'top':top,'bottom':top+height,'lines':round(height/leading), 'text':re.sub('<[^>]+>', '', text)})
    return top+height

def heading(text, line_top):
    obj = c.beginText(LEFT, HEIGHT-(line_top-4.8))
    obj.setFont('Inter-Bold', 10.5)
    obj.setCharSpace(0.8)
    obj.setFillColor(colors.HexColor('#171717'))
    obj.textOut(text)
    obj.setCharSpace(0)
    c.drawText(obj)
    c.setStrokeColor(colors.HexColor('#BFBFBF'))
    c.setLineWidth(0.5)
    c.line(LEFT, HEIGHT-line_top, RIGHT, HEIGHT-line_top)

def bullet(text, top, max_bottom):
    para('&#8226;',top,x=37.05,width=8)
    return para(text,top,x=44.05,width=RIGHT-44.05,max_bottom=max_bottom)

# The reference's centered name and blue underlined one-line contact strip.
name = 'SRISHTI MEENA'
font_size, tracking = 22, 1.1
name_width = pdfmetrics.stringWidth(name,'Inter-Bold',font_size) + (len(name)-1)*tracking
obj = c.beginText((WIDTH-name_width)/2, HEIGHT-48.4)
obj.setFont('Inter-Bold',font_size)
obj.setCharSpace(tracking)
obj.setFillColor(colors.HexColor('#111111'))
obj.textLine(name)
obj.setCharSpace(0)
c.drawText(obj)

contacts = [
    ('srishtimeenaoffical25@gmail.com','mailto:srishtimeenaoffical25@gmail.com'),
    ('+91 91167 98518','tel:+919116798518'),
    ('linkedin.com/in/srishtimeena','https://www.linkedin.com/in/srishtimeena'),
]
separator = '   |   '
contact_size = 9
strip_width = sum(pdfmetrics.stringWidth(t,'Inter',contact_size) for t,_ in contacts) + 2*pdfmetrics.stringWidth(separator,'Inter',contact_size)
x = (WIDTH-strip_width)/2
for i,(text,url) in enumerate(contacts):
    tw = pdfmetrics.stringWidth(text,'Inter',contact_size)
    c.setFont('Inter', contact_size)
    c.setFillColor(colors.HexColor('#1A4D8F'))
    c.drawString(x,HEIGHT-65.8,text)
    c.setStrokeColor(colors.HexColor('#1A4D8F'))
    c.setLineWidth(0.5)
    c.line(x,HEIGHT-67.2,x+tw,HEIGHT-67.2)
    c.linkURL(url,(x,HEIGHT-68,x+tw,HEIGHT-56),relative=0,thickness=0)
    x += tw
    if i < 2:
        c.setFillColor(colors.HexColor('#333333'))
        c.drawString(x,HEIGHT-65.8,separator)
        x += pdfmetrics.stringWidth(separator,'Inter',contact_size)

heading('SUMMARY',107.4008)
para('MBA student in Cyber Security Management with internship experience reviewing IT service management processes, identifying gaps and preparing documentation for audit review. Completed ISO/IEC 27001:2022 Lead Auditor training and built an ISMS GRC platform connecting findings, risks and corrective actions.',112.3,max_bottom=159)

heading('CORE SKILLS',183.8008)
skills = [
    (188.7,213.5,'Governance, Risk &amp; Compliance:', 'ISO/IEC 27001:2022, ISO/IEC 20000-1:2018, NIST CSF; IAM &amp; BCM; ISMS internal audit, risk assessment &amp; treatment, control evaluation.'),
    (215.9,240.7,'IT Service Management:', 'ITIL 4, PinkVERIFY requirements; Incident, Service Level &amp; IT Asset Management; Release &amp; Deployment, Service Catalog, Monitoring &amp; Alerting, SLA tracking.'),
    (243.1,267.9,'IT Audit &amp; Assurance:', 'Process documentation review, gap analysis, audit evidence &amp; work papers, observation reporting, nonconformities &amp; corrective actions, remediation ownership &amp; closure verification.'),
    (270.3,295.1,'Security &amp; Technical:', 'Network security &amp; digital forensics fundamentals; Wireshark, Nmap, traffic analysis; applied cryptography basics; static &amp; dynamic malware analysis.'),
    (297.5,325,'Communication &amp; Delivery:', 'Technical writing &amp; documentation, risk communication, requirements analysis, stakeholder discussions, analytical problem solving &amp; teamwork.'),
]
for top,bottom,label,text in skills:
    para(f'<b>{label}</b> {text}',top,max_bottom=bottom)

heading('EXPERIENCE',349.4008)
para('<b>Cyber Security Compliance Intern</b> | Tectona Software Solutions Pvt. Ltd. Ahmedabad | Jun 2026 - Jul 2026',354.7,size=10,leading=11.7,max_bottom=368)
internship = [
    (368.5,393.8,'Reviewed, validated and improved ITSM process documentation across six areas: Service Level, IT Asset, Incident, Monitoring &amp; Alerting, Release &amp; Deployment and Service Catalog Management.'),
    (393.9,419.2,'Compared process documentation with <b>ITIL 4 practices, PinkVERIFY requirements and ISO/IEC 20000</b> guidance, identifying documentation gaps and recommending practical process improvements.'),
    (419.3,444.6,'Studied ITIL 4 practices and PinkVERIFY certification criteria to assess process maturity and readiness, building an understanding of how service management controls and supporting evidence are reviewed.'),
    (444.7,470.0,'Participated in requirements analysis sessions and team discussions, turning discussion outcomes into clear, structured process documentation suitable for audit review.'),
    (470.1,519.0,'Gained exposure to information security, ISO-related compliance, audit requirements and remediation processes. Learned how findings connect to risk ratings, corrective actions, responsible owners and closure verification, and applied this understanding when building the ISMS GRC platform.'),
]
for top,bottom,text in internship:
    bullet(text,top,bottom)

heading('PROJECTS',542.4008)
para('<b>ISMS GRC Platform</b> | ISO 27001 Internal Audit, Risk and Remediation Management',547.7,size=10,leading=11.7,max_bottom=561)
projects = [
    (561.5,598.0,'Built a centralised ISMS GRC platform to manage <b>ISO 27001 internal audit findings, risk management and IT remediation</b> through one dashboard, bringing control assessments, risk ratings, corrective actions and remediation status into a single place for review.'),
    (598.2,623.5,'Connected the compliance lifecycle from ISO control assessment to finding, risk rating, corrective action, ITSM ticket, SLA tracking and final resolution.'),
    (623.6,648.9,'Built <b>end-to-end traceability</b> so each issue can be followed from the ISO control where it was raised through the related risk, assigned corrective action, remediation and formal closure.'),
    (649.0,674.5,'Modelled risk ratings, corrective action ownership and SLA-based due dates for each finding, making overdue remediation visible and helping users review pending actions and follow up on closure.'),
]
for top,bottom,text in projects:
    bullet(text,top,bottom)

heading('CERTIFICATIONS',698.7008)
bullet('<b>ISO/IEC 27001:2022 Lead Auditor Training</b> | Bureau Veritas | June 2026',703.6,716)
para('CQI &amp; IRCA certified course PR373; covered ISMS implementation, risk assessment, audit planning and reporting.',715.2,x=44.05,width=RIGHT-44.05,max_bottom=728)
bullet('<b>Certified Information Systems Security Professional (CISSP) Course</b> | INE | In Progress',729.2,742)

heading('EDUCATION',767.75082)
para('<b>MBA Cyber Security Management</b> | National Forensic Sciences University | Gandhinagar | CGPI 8.50 | 2025 - Present',772.8,size=9,leading=10.5,max_bottom=785)
para('<b>Bachelor of Computer Applications (BCA)</b> | University of Rajasthan | Jaipur | 80.7% | 2022 - 2025',786,size=9,leading=10.5,max_bottom=799)

c.showPage()
c.save()
(TMP/'original_layout_metrics.json').write_text(json.dumps(measurements,indent=2),encoding='utf-8')
print('Created',OUTPUT)
print('Content slots',len(measurements))
