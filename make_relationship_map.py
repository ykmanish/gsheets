from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches


ROOT = Path(r"C:\Users\my792\Desktop\raga")
SRC = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2.docx")
OUT = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_with_relationship_map.docx")
PNG = ROOT / "EV-017_Relationship_Map.png"


def font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
    ]
    for item in candidates:
        if Path(item).exists():
            return ImageFont.truetype(item, size)
    return ImageFont.load_default()


def centered_box(draw, xy, text, fill, outline, text_fill, width=260, height=72, radius=18, fnt=None):
    x, y = xy
    box = (x - width // 2, y - height // 2, x + width // 2, y + height // 2)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=3)
    lines = text.split("\n")
    line_h = sum(draw.textbbox((0, 0), line, font=fnt)[3] - draw.textbbox((0, 0), line, font=fnt)[1] for line in lines)
    y0 = y - (line_h + (len(lines)-1) * 6) / 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=fnt)
        draw.text((x - (bbox[2]-bbox[0])/2, y0), line, font=fnt, fill=text_fill)
        y0 += (bbox[3]-bbox[1]) + 6
    return box


def line(draw, start, end, color, width=4, dotted=False):
    if not dotted:
        draw.line((start, end), fill=color, width=width)
        return
    x1, y1 = start
    x2, y2 = end
    steps = 48
    for i in range(0, steps, 2):
        a = i / steps
        b = min((i + 1) / steps, 1)
        draw.line(
            (
                (x1 + (x2 - x1) * a, y1 + (y2 - y1) * a),
                (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b),
            ),
            fill=color,
            width=width,
        )


def make_png():
    img = Image.new("RGB", (1600, 900), "white")
    d = ImageDraw.Draw(img)
    title = font(42, True)
    label = font(28, True)
    small = font(24, False)
    legend = font(22, False)

    d.text((80, 58), "EV-017 OSINT Relationship Map", font=title, fill="#111827")
    d.text((80, 112), "Evidence-supported relationships only; unsupported claims are shown separately.", font=small, fill="#4B5563")

    center = (800, 455)
    nodes = [
        ((420, 245), "LinkedIn\nverified platform", "#DCFCE7", "#16A34A", False),
        ((800, 205), "Instagram\nverified platform", "#DCFCE7", "#16A34A", False),
        ((1180, 245), "YouTube\nverified platform", "#DCFCE7", "#16A34A", False),
        ((1180, 665), "X / Twitter\nverified platform", "#DCFCE7", "#16A34A", False),
        ((420, 665), "rajshamani.com\nmoderate support", "#FEF3C7", "#D97706", False),
        ((620, 810), "rajshamani.org\nunsupported claim", "#FEE2E2", "#DC2626", True),
        ((980, 810), "rajshamani.life\nunsupported claim", "#FEE2E2", "#DC2626", True),
    ]

    for pos, _, _, outline, dotted in nodes:
        line(d, center, pos, outline, width=5, dotted=dotted)

    centered_box(d, center, "Raj Shamani\nsubject", "#E0F2FE", "#0284C7", "#0F172A", 285, 92, 24, label)
    for pos, text, fill, outline, _ in nodes:
        centered_box(d, pos, text, fill, outline, "#111827", 270, 82, 18, small)

    lx, ly = 86, 760
    d.rounded_rectangle((lx, ly, lx + 370, ly + 90), radius=12, outline="#D1D5DB", fill="#F9FAFB", width=2)
    d.line((lx + 22, ly + 30, lx + 92, ly + 30), fill="#16A34A", width=5)
    d.text((lx + 108, ly + 17), "verified or independently supported", font=legend, fill="#374151")
    d.line((lx + 22, ly + 64, lx + 92, ly + 64), fill="#DC2626", width=5)
    for x in range(lx + 22, lx + 92, 18):
        d.line((x, ly + 64, x + 9, ly + 64), fill="#F9FAFB", width=6)
    d.text((lx + 108, ly + 51), "claimed but not supported", font=legend, fill="#374151")

    img.save(PNG, "PNG", optimize=True)


def insert_png():
    shutil.copy2(SRC, OUT)
    doc = Document(OUT)

    for table in list(doc.tables):
        if "EV-017_Relationship_Map.png" in "\n".join(cell.text for row in table.rows for cell in row.cells):
            table._element.getparent().remove(table._element)

    target_idx = None
    for i, para in enumerate(doc.paragraphs):
        if para.text.startswith("EV-017:"):
            target_idx = max(0, i - 1)
            break
    if target_idx is None:
        raise RuntimeError("Could not find EV-017 caption.")

    para = doc.paragraphs[target_idx]
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in list(para.runs):
        run._element.getparent().remove(run._element)
    run = para.add_run()
    run.add_picture(str(PNG), width=Inches(6.9))

    doc.save(OUT)


if __name__ == "__main__":
    make_png()
    insert_png()
    print(PNG)
    print(OUT)
