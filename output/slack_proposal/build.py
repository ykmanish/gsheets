"""Fills the logo placeholders in report.html, prints it to PDF with headless Chrome,
and renders each page to PNG for review."""
import re
import subprocess
import sys
from pathlib import Path

import pypdfium2 as pdfium

HERE = Path(__file__).resolve().parent
ICONS = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "icons"
OUT_PDF = HERE.parent / "pdf" / "UIPL_Slack_Communication_Proposal.pdf"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def icon_path(name):
    svg = (ICONS / f"{name}.svg").read_text(encoding="utf-8")
    return re.search(r'd="([^"]+)"', svg).group(1)


# Slack's four-colour mark.
SLACK = (
    '<svg viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd">'
    '<path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/>'
    '<path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/>'
    '<path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/>'
    '<path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336-.001v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>'
    "</g></svg>"
)
WA = f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#25D366" d="{icon_path("whatsapp")}"/></svg>'
DISCORD = f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#5865F2" d="{icon_path("discord")}"/></svg>'
SHEETS = f'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0F9D58" d="{icon_path("googlesheets")}"/></svg>'
WA_BADGE = f'<span class="chip" style="height:36px;padding:0 14px 0 10px">{WA}On WhatsApp today</span>'
# Story reply-bar icons, drawn in the page's text colour.
HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="M10 13l4-4"/></svg>'

html = (HERE / "report.html").read_text(encoding="utf-8")
html = (
    html.replace("{{SLACK_ICON}}", SLACK)
    .replace("{{WA_ICON}}", WA)
    .replace("{{SHEETS_ICON}}", SHEETS)
    .replace("{{WA_BADGE}}", WA_BADGE)
    .replace("{{DISCORD_ICON}}", DISCORD)
    .replace("{{HEART}}", HEART)
    .replace("{{SEND}}", SEND)
)
assert "{{" not in html, "unfilled placeholder"
built = HERE / "report.built.html"
built.write_text(html, encoding="utf-8")

OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(
    [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--allow-file-access-from-files",
        f"--print-to-pdf={OUT_PDF}",
        built.as_uri(),
    ],
    check=True,
    capture_output=True,
)

pdf = pdfium.PdfDocument(str(OUT_PDF))
print("pages:", len(pdf), "size(pt):", [round(v) for v in pdf[0].get_size()])
preview = HERE / "preview"
preview.mkdir(exist_ok=True)
for i, page in enumerate(pdf):
    page.render(scale=1.6).to_pil().save(preview / f"page-{i + 1}.png")
print("pdf:", OUT_PDF)
