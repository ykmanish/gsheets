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
TMP = ROOT / 'tmp' / 'pdfs' / 'manish_resume'
FONT_DIR = ROOT / 'tmp' / 'ey_resume' / 'fonts'
OUT = ROOT / 'output' / 'pdf' / 'Manishkumar_Yadav_Cyber_Consulting_Resume.pdf'
pdfmetrics.registerFont(TTFont('Inter', str(FONT_DIR/'Inter_18pt_Regular.ttf')))
pdfmetrics.registerFont(TTFont('Inter-Bold', str(FONT_DIR/'Inter_18pt_Bold.ttf')))
pdfmetrics.registerFontFamily('Inter',normal='Inter',bold='Inter-Bold',italic='Inter',boldItalic='Inter-Bold')

W,H=612,792
L,R=22.7,589.3
BLUE='#1A56B0'
GREY='#666666'
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Manishkumar Yadav | Cyber Security and Technology Consulting')
c.setAuthor('Manishkumar Yadav')
c.setSubject('Application security, access controls, information protection and software delivery')
c.setFont('Inter',9.3)
style=ParagraphStyle('Body',fontName='Inter',fontSize=9.3,leading=11.4,textColor=colors.HexColor('#303030'))
slots=[]
y=0

def p(text,top,x=L,width=R-L,size=9.3,leading=11.4,color='#303030'):
    s=ParagraphStyle('slot',parent=style,fontSize=size,leading=leading,textColor=colors.HexColor(color))
    para=Paragraph(text,s)
    _,height=para.wrap(width,H)
    if top+height>777:
        raise ValueError(f'Content below bottom margin: {top+height:.1f} {text}')
    para.drawOn(c,x,H-top-height)
    slots.append({'text':re.sub('<[^>]+>','',text),'top':top,'bottom':top+height,'size':size})
    return top+height

def section(label):
    global y
    y+=8.1
    c.setFillColor(colors.HexColor(BLUE))
    c.setFont('Inter-Bold',9.5)
    c.drawString(L,H-(y+7.3),label)
    c.setStrokeColor(colors.HexColor(BLUE))
    c.setLineWidth(.65)
    c.line(21.25,H-(y+10.5),590.75,H-(y+10.5))
    y+=14.2

def bullet(text):
    global y
    top=y
    p('&#8226;',top,x=27.7,width=7,size=9.3)
    y=p(text,top,x=37.7,width=R-37.7)+2.2

def entry(label,context,date,link=None):
    global y
    end=R-pdfmetrics.stringWidth(date,'Inter',8.5)
    left=f'<b>{label}</b> <font color="{BLUE}">| {context}</font>'
    if link:
        left += f' - <link href="{link}" color="{BLUE}"><u>GitHub</u></link>'
    height=p(left,y,width=end-L-10,size=9.5,leading=11.5)
    c.setFillColor(colors.HexColor(GREY));c.setFont('Inter',8.5)
    c.drawRightString(R,H-(y+9.3),date)
    slots.append({'text':date,'top':y,'bottom':y+11.4,'size':8.5})
    y=height+3.3

def stack(text):
    global y
    y=p(text,y,size=8.1,leading=10.2,color=GREY)+3.0

def skill(label,text):
    global y
    y=p(f'<b>{label}</b> {text}',y)+1.8

# Retain the reference's centered name, contact line, blue rules and single-column flow.
c.setFont('Inter-Bold',19)
c.setFillColor(colors.HexColor('#111111'))
c.drawCentredString(W/2,H-31.5,'Manishkumar Yadav')
contact = ('Pune, India  |  +91 7972587822  |  '
           '<link href="mailto:ymanishkumar9790@gmail.com">ymanishkumar9790@gmail.com</link>  |  '
           f'<link href="https://github.com/ykmanish" color="{BLUE}"><u>github.com/ykmanish</u></link>  |  '
           f'<link href="https://linkedin.com/in/ykmanish" color="{BLUE}"><u>linkedin.com/in/ykmanish</u></link>')
cs=ParagraphStyle('Contact',parent=style,fontSize=8.3,leading=10.2,alignment=1,textColor=colors.HexColor(GREY))
cp=Paragraph(contact,cs);_,ch=cp.wrap(R-L,H);cp.drawOn(c,L,H-39-ch)
slots.append({'text':re.sub('<[^>]+>','',contact),'top':39,'bottom':39+ch,'size':8.3})
y=39+ch

section('SUMMARY')
y=p('Software engineer with 2+ years of experience and an ongoing MBA in Cybersecurity Management. Hands-on project experience with access controls, authentication, audit logging and data protection. Independently built a 42-module ERP covering HR, Finance and Operations, and worked with design, backend and QA teams to deliver client dashboards and resolve application issues.',y)

section('SKILLS')
skill('Access &amp; Application Security:', 'RBAC, 2FA, OAuth2, JWT, AES encryption, audit logging, secure API design, secure coding.')
skill('Cloud &amp; DevOps:', 'AWS (EC2, S3, CodePipeline), Docker, GitHub Actions, CI/CD, Linux, automated backups.')
skill('Programming &amp; APIs:', 'JavaScript, TypeScript, Python, SQL, Node.js, Express.js, REST APIs, microservices, Socket.IO.')
skill('Frontend &amp; UI:', 'React.js, Next.js, Redux Toolkit, Tailwind CSS, HTML5, CSS3, responsive design, Figma.')
skill('Databases:', 'MongoDB, PostgreSQL, MySQL, Firebase, SQLite3.')
skill('Tools &amp; Delivery:', 'Git, Postman, Jira, Confluence, Agile/Scrum, code reviews, root-cause analysis, team coordination.')

section('WORK EXPERIENCE')
entry('Jr. Software Development Engineer','Quantafile, Pune (Remote)','Jun 2023 - Jul 2025')
for text in [
    'Investigated issues across application interfaces, API responses and Redux state, working with developers and QA to identify root causes and resolve defects.',
    'Worked with design and backend teams on <b>5+ client dashboards</b>, translating Figma designs into working features and coordinating release handoffs with QA within Agile sprint cycles.',
    'Contributed to <b>10+ production React modules</b> and a shared component library adopted across three projects, reducing reported UI bugs by approximately 20%.',
    'Built a shared data-fetching layer with lazy loading and memoization, improving page load times by approximately 25% and standardising how the team handled API responses.',
    'Followed Git branching, pull request and code review workflows, and supported CI/CD pipelines using Docker and GitHub Actions to keep releases moving across client projects.',
]: bullet(text)

section('PROJECTS')
entry('SMB ERP Portal','Independent Full-Stack Project','Oct 2025 - Mar 2026','https://github.com/ykmanish/smb-erp')
stack('Next.js | TypeScript | Node.js | Express.js | MongoDB | Docker | AWS EC2 | GitHub Actions | Gemini')
for text in [
    'Independently built and deployed a <b>42-module ERP</b> covering HR, Finance and Operations, including business workflows, database design, REST APIs, the application interface and cloud infrastructure.',
    'Implemented <b>role-based access control (RBAC), Google Authenticator 2FA and activity audit logs</b> to manage user permissions, strengthen sign-in security and record system actions.',
    'Configured automated OneDrive backups and event notifications, and automated builds and deployments using GitHub Actions, AWS CodePipeline, Docker and EC2.',
    'Built a Gemini-powered assistant for employee HR queries and summaries of attendance, expenses and operational activity, connecting technical features to day-to-day business needs.',
]: bullet(text)
y+=4.0
entry('Goodish','Social Productivity Platform','Jan 2026 - Mar 2026','https://github.com/ykmanish/projectpos')
stack('Next.js | Express.js | MongoDB | Socket.IO | JWT | AES Encryption | Gemini')
for text in [
    'Implemented <b>JWT-based session management, AES encryption for chat and secure API integration</b> in a platform with individual and group messaging, task tracking, rewards and file sharing.',
    'Improved interface performance using React Hooks, Context API, lazy loading and reusable components while managing authentication and API integration across the application.',
]: bullet(text)

section('EDUCATION')
entry('MBA in Cybersecurity Management','National Forensic Sciences University, Gujarat','Aug 2025 - Present')
entry('B.E. Electronics &amp; Communication','Zeal College of Engineering, Pune | CGPA: 7.55','Aug 2019 - Jun 2023')

section('CERTIFICATIONS & PUBLICATIONS')
certs=[
    '<b>Foundations of Cybersecurity</b> | Google | Aug 2023 | <link href="https://www.coursera.org/account/accomplishments/verify/DXCB9FWB8NR2" color="#1A56B0"><u>View Certificate</u></link>',
    '<b>Full Stack Web Development MERN</b> | Almabetter | May 2023 | <link href="https://verified.sertifier.com/en/verify/87270180189321/" color="#1A56B0"><u>View Certificate</u></link>',
    '<b>Co-authored:</b> Surveillance Robot using Optical Communication | IJIRCCE | Mar 2023 | <link href="https://ijircce.com/admin/main/storage/app/pdf/u5wq2Oakk4FGUUC2LjpTgGV5NYwrWvZjcecA8dob.pdf" color="#1A56B0"><u>View Paper</u></link>',
]
for text in certs: y=p(text,y,size=8.8,leading=10.8)+1.5

section('HOBBIES')
y=p('Chess | Technical Reading | Open Source | Music',y,size=9,leading=11)

c.showPage();c.save()
(TMP/'draft.txt').write_text('\n'.join(s['text'] for s in slots),encoding='utf-8')
(TMP/'layout.json').write_text(json.dumps(slots,indent=2),encoding='utf-8')
print('Created:',OUT)
print('Last content bottom:',round(y,2))
