from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

BASE = Path(r'C:\Users\my792\Desktop\raga')
OUT = BASE / 'output' / 'ey_resume'
OUT.mkdir(parents=True, exist_ok=True)
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.top_margin, sec.bottom_margin = Inches(0.56), Inches(0.56)
sec.left_margin = sec.right_margin = Inches(0.65)
sec.header_distance = sec.footer_distance = Inches(0.2)

normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)
normal.font.color.rgb = RGBColor.from_string('111111')
normal.paragraph_format.line_spacing = 1.02
normal.paragraph_format.space_after = Pt(2.5)
normal.paragraph_format.widow_control = True
for name in ['Title', 'Heading 1']:
    st = doc.styles[name]
    st.font.name = 'Calibri'
    st.font.color.rgb = RGBColor.from_string('000000')
    st.font.bold = True
    st.paragraph_format.keep_with_next = True
    st.paragraph_format.space_after = Pt(4)
doc.styles['Title'].font.size = Pt(23)
doc.styles['Title'].paragraph_format.space_before = Pt(0)
doc.styles['Title'].paragraph_format.space_after = Pt(2)
doc.styles['Heading 1'].font.size = Pt(11)
doc.styles['Heading 1'].paragraph_format.space_before = Pt(9)
doc.styles['Heading 1'].paragraph_format.space_after = Pt(4)

def para(text='', bold=False, size=None, before=0, after=None, keep=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(before)
    if after is not None: p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.keep_with_next = keep
    r = p.add_run(text)
    r.bold = bold
    if size: r.font.size = Pt(size)
    return p

def section(text):
    return doc.add_paragraph(text.upper(), 'Heading 1')

def bullet(text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.14)
    p.paragraph_format.first_line_indent = Inches(-0.14)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.02
    p.paragraph_format.keep_together = True
    p.add_run(text)
    return p

def labeled(label, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.add_run(label + ' ').bold = True
    p.add_run(text)
    return p

def hyperlink(p, label, url):
    h = OxmlElement('w:hyperlink')
    h.set(qn('r:id'), p.part.relate_to(url, RT.HYPERLINK, is_external=True))
    r = OxmlElement('w:r')
    rp = OxmlElement('w:rPr')
    color = OxmlElement('w:color'); color.set(qn('w:val'), '111111'); rp.append(color)
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'), '21'); rp.append(sz)
    r.append(rp)
    t = OxmlElement('w:t'); t.text = label; r.append(t)
    h.append(r); p._p.append(h)

doc.add_paragraph('SRISHTI MEENA', 'Title')
p = para(after=1, keep=True)
hyperlink(p, 'srishtimeenaoffical25@gmail.com', 'mailto:srishtimeenaoffical25@gmail.com')
p.add_run('  |  +91 91167 98518').font.size = Pt(10.5)
p = para(after=1, keep=True)
hyperlink(p, 'linkedin.com/in/srishtimeena', 'https://www.linkedin.com/in/srishtimeena')

section('Summary')
para('MBA student in Cyber Security Management with internship experience reviewing IT service management processes, identifying gaps and preparing process documentation for audit review. Completed ISO/IEC 27001:2022 Lead Auditor training and built an ISMS GRC platform linking audit findings, risks and corrective actions. Seeking an Associate Consultant role in Cyber Security at EY.')

section('Education')
para('MBA in Cyber Security Management', bold=True, after=1, keep=True)
para('National Forensic Sciences University, Gandhinagar | 2025 - Present | CGPI: 8.50', after=3)
para('Bachelor of Computer Applications', bold=True, after=1, keep=True)
para('University of Rajasthan, Jaipur | 2022 - 2025 | 80.7%', after=0)

section('Internship Experience')
para('Cyber Security Compliance Intern', bold=True, after=1, keep=True)
para('Tectona Software Solutions Pvt. Ltd., Ahmedabad | Jun 2026 - Jul 2026', after=4, keep=True)
bullet('Reviewed and improved documentation for six ITSM processes: Service Level, IT Asset, Incident, Monitoring and Alerting, Release and Deployment, and Service Catalog Management.')
bullet('Compared process documentation with ITIL 4 practices, PinkVERIFY requirements and ISO/IEC 20000 guidance to identify gaps and recommend improvements.')
bullet('Participated in requirements discussions and turned team inputs into structured process documentation for audit review.')

section('Project')
para('ISMS Governance, Risk and Compliance (GRC) Platform', bold=True, after=3, keep=True)
bullet('Built a platform to manage ISO 27001 internal audit findings, risks and corrective actions through a central dashboard.')
bullet('Linked control assessments to findings, risk ratings, action owners, ITSM tickets and closure records, making each issue traceable through remediation.')
bullet('Added SLA-based due dates and overdue-action tracking to help review pending corrective actions and follow up on closure.')

section('Relevant Skills')
labeled('IT audit and risk:', 'Process reviews, gap analysis, evidence and work paper preparation, risk assessment and treatment, control evaluation, audit observation reporting and corrective-action tracking.')
labeled('Standards and frameworks:', 'ISO/IEC 27001:2022, ISO/IEC 20000-1:2018, ITIL 4, PinkVERIFY requirements and NIST Cybersecurity Framework.')
labeled('Security foundations:', 'Identity and Access Management (IAM), Business Continuity Management (BCM), network security, TCP/IP, Wireshark and Nmap.')
labeled('Communication:', 'Technical writing, requirements analysis, stakeholder discussions and teamwork.')

section('Training and Professional Development')
para('ISO/IEC 27001:2022 Lead Auditor Training', bold=True, after=1, keep=True)
para('Bureau Veritas | CQI and IRCA certified course PR373 | Jun 2026', after=3)
labeled('CISSP course:', 'INE | In progress')

doc.core_properties.title = 'Srishti Meena Resume for EY Associate Consultant Cyber Security'
doc.core_properties.subject = 'Cyber Security and IT Risk'
doc.core_properties.author = 'Srishti Meena'
doc.core_properties.keywords = 'Cyber Security, IT Audit, GRC, ISO 27001, ITSM'
doc.core_properties.comments = ''
doc.save(OUT / 'Srishti_Meena_EY_Cyber_Resume.docx')
text = '\n'.join(p.text for p in doc.paragraphs)
(BASE / 'tmp' / 'ey_resume' / 'draft_resume.txt').write_text(text, encoding='utf-8')
print('Created DOCX:', OUT / 'Srishti_Meena_EY_Cyber_Resume.docx')
print('Body word count:', len(text.split()))
