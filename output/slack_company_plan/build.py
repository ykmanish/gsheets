"""Fills the placeholders in plan.html (brand logos, the WhatsApp -> Slack rows, the
automation and tool cards), prints it to PDF with headless Chrome and renders each page
to PNG for review."""
import math
import re
import subprocess
from pathlib import Path

import pypdfium2 as pdfium

HERE = Path(__file__).resolve().parent
ICONS = HERE / "icons"
OUT_PDF = HERE.parent / "pdf" / "UIPL_Slack_Company_Plan.pdf"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
LOGO = "../../frontend/public/logo.png"


def simple_icon(name, color, size=None):
    path = re.search(r'd="([^"]+)"', (ICONS / f"{name}.svg").read_text(encoding="utf-8")).group(1)
    dims = f' width="{size}" height="{size}"' if size else ""
    return f'<svg viewBox="0 0 24 24"{dims} xmlns="http://www.w3.org/2000/svg"><path fill="{color}" d="{path}"/></svg>'


def slack(size=None):
    dims = f' width="{size}" height="{size}"' if size else ""
    return (
        f'<svg viewBox="0 0 54 54"{dims} xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd">'
        '<path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/>'
        '<path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/>'
        '<path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/>'
        '<path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336-.001v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>'
        "</g></svg>"
    )


WA = simple_icon("whatsapp", "#25D366")
SHEETS = simple_icon("googlesheets", "#0F9D58")
OPENAI = simple_icon("openai", "#000000")
OPENAI_WHITE = simple_icon("openai", "#FFFFFF")
MAPS = simple_icon("googlemaps", "#EA4335")
UIPL = f'<img src="{LOGO}" alt="">'


def line_icon(body, color="#0f0f10", size=20, width=1.8):
    return (
        f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="{color}" '
        f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{body}</svg>'
    )


GLYPHS = {
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "command": '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M14 7l-4 10"/>',
    "emoji": '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
    "headphones": '<path d="M3 15v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="2"/><rect x="16.5" y="14" width="4.5" height="7" rx="2"/>',
    "canvas": '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    "list": '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5"/><circle cx="5.2" cy="18" r="1.4"/>',
    "link": '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    "video": '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/>',
}

EXTRA_CSS = """
  .maprow { display: grid; grid-template-columns: 26px 1fr 12px 1.08fr 46px; align-items: center; gap: 8px; height: 58px; padding: 0 10px; border-radius: 16px; background: #f7f7f9; }
  .maprow .mini { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #fff; }
  .maprow .mini svg, .maprow .mini img { width: 15px; height: 15px; }
  .maprow .t { font-size: 11px; line-height: 1.15; }
  .maprow .s { font-size: 8.6px; color: var(--muted); margin-top: 2px; line-height: 1.2; }
  .maprow .to .t { color: var(--blue); }
  .maprow .tag { justify-content: center; padding: 0; }
  .auto { padding: 14px 16px; height: 196px; display: flex; flex-direction: column; }
  .kind { font-size: 8.6px; letter-spacing: .06em; color: var(--soft); }
  .flowline { display: flex; align-items: center; gap: 0; margin: 14px 0 12px; }
  .flowline .c { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; flex: none; }
  .flowline .c svg, .flowline .c img { width: 20px; height: 20px; }
  .flowline .bar { flex: 1; height: 2px; background: repeating-linear-gradient(90deg, #c9c9d1 0 5px, transparent 5px 9px); position: relative; }
  .flowline .bar::after { content: ""; position: absolute; right: -1px; top: -4px; border: 5px solid transparent; border-left: 7px solid #c9c9d1; border-right: 0; }
  .tool { padding: 16px; height: 145px; }
  .tool .g { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; margin-bottom: 10px; }
  .chan { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 999px; background: #fff; font-size: 10.2px; }
  .chan .d { width: 7px; height: 7px; border-radius: 50%; }
  .chan span.p { color: var(--muted); }
"""

TAGS = {"live": "LIVE", "built": "BUILT", "next": "NEXT", "stays": "STAYS"}

# WhatsApp today -> where it goes in Slack.
MAP = [
    ("uipl", "Daily status for the CEO", "collected by hand", "#uipl-updates", "12:00 · 16:00 · 21:45, colour-coded", "live"),
    ("wa", "PRN approvals", "250 a month · Approve / Decline", "#prn-notification", "card with buttons and a thread", "built"),
    ("wa", "MRN approvals", "38 a month · Approve / Decline", "#mrn-notification", "card with buttons and a thread", "built"),
    ("wa", "Employee report reminder", "18:50 · one phone at a time", "Direct message", "to each person, with the report link", "built"),
    ("wa", "DMR reminders to sites", "11:00 · 14:00 · 18:00", "#site-manpower", "one post the sites tick off", "built"),
    ("uipl", "Who has reported today", "nobody sees it together", "#employee-report", "19:00 digest for the team", "built"),
    ("uipl", "Clock-in and clock-out", "open the platform each time", "Direct message", "Clock in / Clock out buttons", "next"),
    ("uipl", "Leave requests", "HR checks the platform", "HR approval card", "answer goes back by DM", "next"),
    ("wa", "Vendors and site staff", "no Slack account", "WhatsApp, unchanged", "same number and templates", "stays"),
]


def map_rows():
    arrow = line_icon('<path d="M5 12h14M13 6l6 6-6 6"/>', "#b5b5bd", 12, 2.2)
    rows = []
    for icon, frm, frm_sub, to, to_sub, tag in MAP:
        mini = WA if icon == "wa" else UIPL
        bg = "#fff" if icon == "wa" else "#0b1035"
        to_icon = "" if tag == "stays" else ""
        rows.append(
            f'<div class="maprow"><div class="mini" style="background:{bg}">{mini}</div>'
            f'<div><div class="t">{frm}</div><div class="s">{frm_sub}</div></div>{arrow}'
            f'<div class="to"><div class="t"{" style=\"color:#128a46\"" if tag == "stays" else ""}>{to}{to_icon}</div><div class="s">{to_sub}</div></div>'
            f'<span class="tag {tag}">{TAGS[tag]}</span></div>'
        )
    return "\n".join(rows)


KINDS = {
    "TIME": ("clock", "#e8efff", "#2f6bf2"),
    "EVENT": ("bolt", "#e3f6ec", "#11804b"),
    "COMMAND": ("command", "#f1f1f3", "#0f0f10"),
    "EMOJI": ("emoji", "#fff6dc", "#b7860b"),
}
DEST = {
    "slack": ('<div class="c" style="background:#fff;border:1px solid #e9e9ee">' + slack() + "</div>"),
    "uipl": f'<div class="c" style="background:#0b1035">{UIPL}</div>',
    "dm": '<div class="c" style="background:#4a154b">' + line_icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', "#fff") + "</div>",
}

AUTOMATIONS = [
    ("TIME", "12:00", "DMR cut-off", "Posts whether every site filled its DMR, with actual against planned manpower.", "slack", "live"),
    ("TIME", "16:00", "Tomorrow's plan", "Checks each site added tomorrow's manpower plan and names the ones that haven't.", "slack", "live"),
    ("TIME", "21:45", "Evening report", "Colour-coded day, AI “Do first” priorities and both PDF reports for the CEO.", "slack", "live"),
    ("EVENT", "New MRN / PRN", "Approval card", "The request lands in its channel with Approve, Decline and Comment. The first decision wins.", "slack", "built"),
    ("TIME", "18:50", "Report missing", "A DM to everyone who hasn't filed today's report, with the link to fill it.", "dm", "built"),
    ("TIME", "09:30", "Not clocked in", "A DM with a Clock in button; the GPS check runs in UIPL Docs.", "dm", "next"),
    ("COMMAND", "/report", "Report from Slack", "A Slack form for today's tasks that saves straight into UIPL Docs.", "uipl", "next"),
    ("EMOJI", "📌 reaction", "Make it a task", "Pin a message with 📌 and it becomes a task in Project Control, linked back.", "uipl", "next"),
    ("EVENT", "Low stock", "Stock alert", "Items below their level in Stock are posted to #procurement once a day.", "slack", "next"),
]


def automations():
    cards = []
    for kind, when, title, text, dest, tag in AUTOMATIONS:
        glyph, bg, fg = KINDS[kind]
        cards.append(
            f'<div class="card auto"><div class="row" style="justify-content:space-between">'
            f'<span class="kind">{kind} · {when}</span><span class="tag {tag}">{TAGS[tag]}</span></div>'
            f'<div class="flowline"><div class="c" style="background:{bg}">{line_icon(GLYPHS[glyph], fg)}</div>'
            f'<div class="bar"></div><div style="width:8px"></div>{DEST[dest]}</div>'
            f'<div class="h3">{title}</div><p class="small" style="margin-top:5px">{text}</p></div>'
        )
    return "\n".join(cards)


TOOLS = [
    ("headphones", "#f3e8f4", "#4a154b", "Huddles", "One tap for voice or screen share inside the channel, instead of a WhatsApp call nobody else hears."),
    ("canvas", "#e8efff", "#2f6bf2", "Canvases", "A pinned page in each site channel: contacts, drawings, vendor list and the SOP."),
    ("list", "#e3f6ec", "#11804b", "Lists", "Snags and pending items with an owner and due date; a change can start a workflow."),
    ("link", "#fff6dc", "#b7860b", "Slack Connect", "Shared channels with consultants or clients who use Slack. Everyone else stays on WhatsApp."),
    ("search", "#f1f1f3", "#0f0f10", "Search", "Type PRN-1207 or a site name and find the card, the thread, the PDF and who decided."),
    ("video", "#fde7ee", "#e01e5a", "Clips", "Short video or voice clips from a site walk, kept in the thread instead of lost in a chat."),
]


def tools():
    return "\n".join(
        f'<div class="card tool"><div class="g" style="background:{bg}">{line_icon(GLYPHS[g], fg, 22)}</div>'
        f'<div class="h3">{title}</div><p class="small" style="margin-top:5px">{text}</p></div>'
        for g, bg, fg, title, text in TOOLS
    )


CHANNELS = [
    ("#uipl-updates", "CEO report", "#0f0f10"),
    ("#prn-notification", "payments", "#2f6bf2"),
    ("#mrn-notification", "materials", "#2f6bf2"),
    ("#site-manpower", "DMR", "#21b46b"),
    ("#employee-report", "daily reports", "#21b46b"),
    ("#attendance", "HR", "#ecb22e"),
    ("#procurement", "stock", "#ecb22e"),
    ("#general", "everyone", "#8a8a92"),
    ("#site-paramdham", "", "#e01e5a"),
    ("#site-kalhaar", "", "#e01e5a"),
    ("#site-devsharnam", "", "#e01e5a"),
    ("#site-silver-white", "", "#e01e5a"),
]

# The 1,239 WhatsApp messages of the last 30 days, by kind.
SPLIT = [
    ("Employee report reminders", 390, "#2f6bf2", "#fff"),
    ("PRN approval requests", 250, "#0f0f10", "#fff"),
    ("DMR reminders to sites", 176, "#21b46b", "#fff"),
    ("MRN approval requests", 38, "#ecb22e", "#0f0f10"),
    ("Updates and other notices", 385, "#d9d9df", "#0f0f10"),
]


def split_bar(width=706, height=48):
    total = sum(n for _, n, _, _ in SPLIT)
    assert total == 1239, total
    parts, x = [f'<clipPath id="splitclip"><rect width="{width}" height="{height}" rx="14"/></clipPath><g clip-path="url(#splitclip)">'], 0.0
    for _, n, color, ink in SPLIT:
        w = width * n / total
        parts.append(f'<rect x="{x:.1f}" y="0" width="{max(w - 3, 1):.1f}" height="{height}" fill="{color}"/>')
        if w > 60:
            parts.append(f'<text x="{x + 14:.1f}" y="{height / 2 + 7:.1f}" font-family="Regular, Fill, sans-serif" font-size="20" fill="{ink}">{n}</text>')
        x += w
    parts.append("</g>")
    return "".join(parts)


def split_legend():
    return "".join(
        f'<span class="row" style="gap:6px"><span class="dot" style="background:{color}"></span>'
        f'<span class="small" style="color:var(--ink)">{label} <span style="color:var(--muted)">{n}</span></span></span>'
        for label, n, color, _ in SPLIT
    )


def channels():
    return "".join(
        f'<span class="chan"><span class="d" style="background:{color}"></span>{name}'
        + (f' <span class="p">{purpose}</span>' if purpose else "")
        + "</span>"
        for name, purpose, color in CHANNELS
    )


def wave():
    bars = []
    for i in range(40):
        x = 4 + i * 8
        h = 14 + 120 * abs(math.sin(i * 0.55) * math.cos(i * 0.21)) * (0.45 + 0.55 * math.sin(i / 39 * math.pi))
        bars.append(f'<rect x="{x}" y="{85 - h / 2:.1f}" width="3.5" height="{h:.1f}" rx="1.75"/>')
    return "".join(bars)


html = (HERE / "plan.html").read_text(encoding="utf-8")
html = html.replace("</style>", EXTRA_CSS + "</style>", 1)
fills = {
    "{{ASTERISK}}": f'<img src="{LOGO}" alt="" style="width:18px;height:18px">',
    "{{ASTERISK_WHITE}}": f'<img src="{LOGO}" alt="" style="width:76px;height:76px">',
    "{{WA}}": WA,
    "{{SHEETS}}": SHEETS,
    "{{OPENAI}}": OPENAI,
    "{{OPENAI_WHITE}}": OPENAI_WHITE,
    "{{MAPS}}": MAPS,
    "{{SLACK}}": slack(),
    "{{SLACK_SM}}": f'<span style="display:inline-flex">{slack(18)}</span>',
    "{{MAP_ROWS}}": map_rows(),
    "{{AUTOMATIONS}}": automations(),
    "{{TOOLS}}": tools(),
    "{{CHANNELS}}": channels(),
    "{{WAVE}}": wave(),
    "{{SPLIT}}": split_bar(),
    "{{SPLIT_LEGEND}}": split_legend(),
}
for key, value in fills.items():
    html = html.replace(key, value)
left = re.findall(r"\{\{[A-Z_]+\}\}", html)
assert not left, f"unfilled placeholders: {left}"
built = HERE / "plan.built.html"
built.write_text(html, encoding="utf-8")

OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(
    [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
     f"--print-to-pdf={OUT_PDF}", built.as_uri()],
    check=True,
    capture_output=True,
)

pdf = pdfium.PdfDocument(str(OUT_PDF))
print("pages:", len(pdf), "size(pt):", [round(v) for v in pdf[0].get_size()])
preview = HERE / "preview"
preview.mkdir(exist_ok=True)
for old in preview.glob("page-*.png"):
    old.unlink()
for i, page in enumerate(pdf):
    page.render(scale=1.4).to_pil().save(preview / f"page-{i + 1}.png")
print("pdf:", OUT_PDF)
