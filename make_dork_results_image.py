from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches


ROOT = Path(r"C:\Users\my792\Desktop\raga")
SRC = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_with_relationship_map.docx")
OUT = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_with_step10_and_map.docx")
PNG = ROOT / "EV-012_Dork_OfficialWebsite_Results.png"


def font(size, bold=False):
    paths = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
    ]
    for path in paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if draw.textbbox((0, 0), test, font=fnt)[2] <= width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_result(draw, x, y, title, url, snippet, f_title, f_url, f_body):
    draw.text((x, y), title, font=f_title, fill="#1A0DAB")
    draw.text((x, y + 40), url, font=f_url, fill="#0B8043")
    for i, line in enumerate(wrap(draw, snippet, f_body, 1160)):
        draw.text((x, y + 78 + i * 31), line, font=f_body, fill="#3C4043")


def make_png():
    img = Image.new("RGB", (1600, 900), "white")
    d = ImageDraw.Draw(img)
    title = font(38, True)
    query = font(28, False)
    small = font(24, False)
    result_title = font(30, False)
    result_url = font(22, False)
    body = font(24, False)
    badge = font(22, True)

    d.rectangle((0, 0, 1600, 86), fill="#F8F9FA")
    d.text((72, 24), "Google Search", font=title, fill="#202124")
    d.rounded_rectangle((360, 18, 1460, 68), radius=25, outline="#DADCE0", width=2, fill="white")
    d.text((392, 29), '"Raj Shamani" official website', font=query, fill="#202124")

    d.text((72, 115), "Search results used for controlled dorking", font=small, fill="#5F6368")

    draw_result(
        d,
        110,
        180,
        "Raj Shamani - Official Website",
        "https://rajshamani.com/",
        "Personal brand page returned for the name. Older domain history made this the only domain with moderate support, not a verified ownership claim.",
        result_title,
        result_url,
        body,
    )
    draw_result(
        d,
        110,
        345,
        "Raj Shamani | Official Website",
        "https://rajshamani.org/",
        "Page metadata and visible copy describe the site as official, but the domain was registered in 2026 and no independent source verified it.",
        result_title,
        result_url,
        body,
    )
    draw_result(
        d,
        110,
        510,
        "Raj Shamani Official | Biography, Net Worth, Wife",
        "https://rajshamani.life/",
        "Result pattern included net worth, wife and success story pages, consistent with search-engine content farming around a public figure.",
        result_title,
        result_url,
        body,
    )

    d.rounded_rectangle((110, 710, 1490, 820), radius=16, fill="#F8FAFC", outline="#CBD5E1", width=2)
    d.text((138, 733), "OSINT note", font=badge, fill="#1A2742")
    note = "Three domains appeared for the same identity claim. Only the .com had older domain history; the .org and .life claims remained unsupported."
    for i, line in enumerate(wrap(d, note, body, 1260)):
        d.text((138, 767 + i * 31), line, font=body, fill="#334155")

    img.save(PNG, "PNG", optimize=True)


def insert_png():
    shutil.copy2(SRC, OUT)
    doc = Document(OUT)

    for table in list(doc.tables):
        text = "\n".join(cell.text for row in table.rows for cell in row.cells)
        if "EV-012_Dork_OfficialWebsite_Results.png" in text:
            table._element.getparent().remove(table._element)

    target_idx = None
    for i, para in enumerate(doc.paragraphs):
        if para.text.startswith("EV-012:"):
            target_idx = max(0, i - 1)
            break
    if target_idx is None:
        raise RuntimeError("Could not find EV-012 caption.")

    para = doc.paragraphs[target_idx]
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in list(para.runs):
        run._element.getparent().remove(run._element)
    para.add_run().add_picture(str(PNG), width=Inches(6.9))
    doc.save(OUT)


if __name__ == "__main__":
    make_png()
    insert_png()
    print(PNG)
    print(OUT)
