from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches


ROOT = Path(r"C:\Users\my792\Desktop\raga")
SRC = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_with_step10_and_map.docx")
OUT = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_final_fixed.docx")
EV011 = ROOT / "EV-011_ReverseImage_Results.png"
EV012 = ROOT / "EV-012_Dork_OfficialWebsite_Results.png"
EV017 = ROOT / "EV-017_Relationship_Map.png"


def font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
    ]
    for item in candidates:
        if Path(item).exists():
            return ImageFont.truetype(item, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, width):
    lines, current = [], ""
    for word in text.split():
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


def centered_box(draw, xy, text, fill, outline, text_fill, width=260, height=72, radius=18, fnt=None):
    x, y = xy
    box = (x - width // 2, y - height // 2, x + width // 2, y + height // 2)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=3)
    lines = text.split("\n")
    heights = [draw.textbbox((0, 0), line, font=fnt)[3] - draw.textbbox((0, 0), line, font=fnt)[1] for line in lines]
    y0 = y - (sum(heights) + (len(lines) - 1) * 6) / 2
    for line, h in zip(lines, heights):
        bbox = draw.textbbox((0, 0), line, font=fnt)
        draw.text((x - (bbox[2] - bbox[0]) / 2, y0), line, font=fnt, fill=text_fill)
        y0 += h + 6


def line(draw, start, end, color, width=4, dotted=False):
    if not dotted:
        draw.line((start, end), fill=color, width=width)
        return
    x1, y1 = start
    x2, y2 = end
    steps = 54
    for i in range(0, steps, 2):
        a = i / steps
        b = min((i + 1) / steps, 1)
        draw.line(((x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)), fill=color, width=width)


def make_ev017():
    img = Image.new("RGB", (1600, 900), "white")
    d = ImageDraw.Draw(img)
    title = font(42, True)
    label = font(28, True)
    small = font(24)
    legend = font(21)
    d.text((80, 48), "EV-017 OSINT Relationship Map", font=title, fill="#111827")
    d.text((80, 102), "Evidence-supported relationships only; unsupported claims are shown separately.", font=small, fill="#4B5563")

    lx, ly = 80, 142
    d.rounded_rectangle((lx, ly, lx + 430, ly + 76), radius=12, outline="#D1D5DB", fill="#F9FAFB", width=2)
    d.line((lx + 22, ly + 26, lx + 98, ly + 26), fill="#16A34A", width=5)
    d.text((lx + 116, ly + 13), "verified or independently supported", font=legend, fill="#374151")
    for x in range(lx + 22, lx + 98, 18):
        d.line((x, ly + 56, x + 9, ly + 56), fill="#DC2626", width=5)
    d.text((lx + 116, ly + 43), "claimed but not supported", font=legend, fill="#374151")

    center = (800, 445)
    nodes = [
        ((400, 270), "LinkedIn\nverified platform", "#DCFCE7", "#16A34A", False),
        ((800, 240), "Instagram\nverified platform", "#DCFCE7", "#16A34A", False),
        ((1200, 270), "YouTube\nverified platform", "#DCFCE7", "#16A34A", False),
        ((1220, 630), "X / Twitter\nverified platform", "#DCFCE7", "#16A34A", False),
        ((390, 630), "rajshamani.com\nexisted; now unreachable", "#FEF3C7", "#D97706", False),
        ((680, 785), "rajshamani.org\nunsupported claim", "#FEE2E2", "#DC2626", True),
        ((1030, 785), "rajshamani.life\nunsupported claim", "#FEE2E2", "#DC2626", True),
    ]
    for pos, _, _, outline, dotted in nodes:
        line(d, center, pos, outline, 5, dotted)
    centered_box(d, center, "Raj Shamani\nsubject", "#E0F2FE", "#0284C7", "#0F172A", 285, 92, 24, label)
    for pos, text, fill, outline, _ in nodes:
        centered_box(d, pos, text, fill, outline, "#111827", 290, 82, 18, small)
    img.save(EV017, "PNG", optimize=True)


def make_ev011():
    img = Image.new("RGB", (1600, 900), "white")
    d = ImageDraw.Draw(img)
    title = font(40, True)
    h = font(27, True)
    body = font(24)
    small = font(21)
    d.text((72, 52), "EV-011 Reverse-Image Search Results", font=title, fill="#111827")
    d.text((72, 108), "Profile photograph comparison across indexed public results.", font=body, fill="#4B5563")

    headers = ["Image checked", "Service / source", "Match found", "Observation"]
    widths = [310, 260, 175, 640]
    x0, y0 = 72, 170
    row_h = 118
    d.rectangle((x0, y0, x0 + sum(widths), y0 + 62), fill="#E5E7EB", outline="#111827")
    x = x0
    for i, head in enumerate(headers):
        d.text((x + 18, y0 + 18), head, font=h, fill="#111827")
        d.line((x, y0, x, y0 + 62 + row_h * 3), fill="#111827", width=2)
        x += widths[i]
    d.line((x0 + sum(widths), y0, x0 + sum(widths), y0 + 62 + row_h * 3), fill="#111827", width=2)

    rows = [
        ("Profile image 01\nInstagram", "Google Lens", "Yes", "Matches appeared on public results consistent with the same public figure, including interview or media-style pages."),
        ("Profile image 01\nInstagram", "YouTube channel\navatar", "Yes", "Same or highly similar profile image appears on the verified public channel identity."),
        ("Profile image 02\nLinkedIn", "Bing Visual\nSearch", "Yes", "Public matches did not by themselves prove control; they supported cross-platform image consistency only."),
    ]
    y = y0 + 62
    for row in rows:
        d.rectangle((x0, y, x0 + sum(widths), y + row_h), fill="white", outline="#111827")
        x = x0
        for i, val in enumerate(row):
            for j, line_text in enumerate(wrap(d, val, body, widths[i] - 34)):
                d.text((x + 18, y + 18 + j * 29), line_text, font=body, fill="#111827")
            d.line((x, y, x, y + row_h), fill="#111827", width=2)
            x += widths[i]
        y += row_h
    d.line((x0 + sum(widths), y0, x0 + sum(widths), y), fill="#111827", width=2)

    d.rounded_rectangle((72, 635, 1528, 790), radius=14, fill="#F8FAFC", outline="#CBD5E1", width=2)
    d.text((102, 662), "Important", font=h, fill="#1A2742")
    note = "Reverse-image matches support consistency, not ownership. A copied profile photograph can appear on impersonation pages, so the result was treated as an indicator rather than proof of authenticity."
    for j, line_text in enumerate(wrap(d, note, body, 1370)):
        d.text((102, 704 + j * 31), line_text, font=body, fill="#334155")
    d.text((72, 840), "Prepared as EV-011 for the Step 8 reverse-image investigation.", font=small, fill="#64748B")
    img.save(EV011, "PNG", optimize=True)


def make_ev012():
    img = Image.new("RGB", (1600, 900), "white")
    d = ImageDraw.Draw(img)
    title = font(38, True)
    query = font(28)
    small = font(24)
    result_title = font(30)
    result_url = font(22)
    body = font(24)
    badge = font(22, True)

    d.rectangle((0, 0, 1600, 86), fill="#F8F9FA")
    d.text((72, 24), "Google Search", font=title, fill="#202124")
    d.rounded_rectangle((360, 18, 1460, 68), radius=25, outline="#DADCE0", width=2, fill="white")
    d.text((392, 29), '"Raj Shamani" official website', font=query, fill="#202124")
    d.text((72, 115), "Search results used for controlled dorking", font=small, fill="#5F6368")

    def result(y, title_text, url, snippet):
        d.text((110, y), title_text, font=result_title, fill="#1A0DAB")
        d.text((110, y + 40), url, font=result_url, fill="#0B8043")
        for i, line_text in enumerate(wrap(d, snippet, body, 1200)):
            d.text((110, y + 78 + i * 31), line_text, font=body, fill="#3C4043")

    result(180, "Raj Shamani - Official Website", "https://rajshamani.com/", "Historical result for the name. The domain existed and has older history, but it was not reachable during the latest check.")
    result(350, "Raj Shamani | Official Website", "https://rajshamani.org/", "Page metadata and visible copy describe the site as official, but the domain was registered in 2026 and no independent source verified it.")
    result(520, "Raj Shamani Official | Biography, Net Worth, Wife", "https://rajshamani.life/", "Result pattern included net worth, wife and success story pages, consistent with search-engine content farming around a public figure.")

    d.rounded_rectangle((110, 718, 1490, 830), radius=16, fill="#F8FAFC", outline="#CBD5E1", width=2)
    d.text((138, 742), "OSINT note", font=badge, fill="#1A2742")
    note = "The .com had historical evidence but was currently unreachable. The .org and .life domains claimed identity without independent support."
    for i, line_text in enumerate(wrap(d, note, body, 1260)):
        d.text((138, 777 + i * 31), line_text, font=body, fill="#334155")
    img.save(EV012, "PNG", optimize=True)


def set_paragraph_text(paragraph, text):
    for run in list(paragraph.runs):
        run._element.getparent().remove(run._element)
    paragraph.add_run(text)


def replace_cell_text(cell, text):
    cell.text = text


def edit_doc():
    shutil.copy2(SRC, OUT)
    doc = Document(OUT)

    replacements = {
        "EV-001:  rajshamani.com — the oldest of the three domains, presented as a personal brand page":
            "EV-001:  rajshamani.com — oldest of the three domains; historical evidence shows it existed, but it was not reachable during the latest check",
        "The four platform accounts correlate well: one handle, one display name, consistent subject matter, and each is independently referenced by material the subject does not control. The three domains do not. rajshamani.com is the only one with any history, and even that reaches no higher than moderate, because nothing outside the site itself confirms who operates it.":
            "The four platform accounts correlate well: one handle, one display name, consistent subject matter, and each is independently referenced by material the subject does not control. The three domains do not. rajshamani.com is the only one with historical evidence, but it was not reachable during the latest check and still reaches no higher than moderate, because nothing outside the site itself confirms who operates it.",
        "Attribution classification. High confidence for the four platform accounts. Moderate for rajshamani.com. Low for rajshamani.org and rajshamani.life. No property was claimed as belonging to the subject unless the evidence actually supported it.":
            "Attribution classification. High confidence for the four platform accounts. Moderate for historical association with rajshamani.com, subject to the current reachability issue. Low for rajshamani.org and rajshamani.life. No property was claimed as belonging to the subject unless the evidence actually supported it.",
        "The relationship map shows evidence-supported relationships, not assumptions. The subject sits at the centre; the four verified platform accounts are drawn in green, rajshamani.com in amber, and rajshamani.org and rajshamani.life in red on dotted lines, to show a relationship that is claimed but not supported.":
            "The relationship map shows evidence-supported relationships, not assumptions. The subject sits at the centre; the four verified platform accounts are drawn in green, rajshamani.com is shown in amber as historically evidenced but currently unreachable, and rajshamani.org and rajshamani.life are shown in red on dotted lines to mark claims that are not supported.",
    }
    for para in doc.paragraphs:
        if para.text in replacements:
            set_paragraph_text(para, replacements[para.text])

    for table in list(doc.tables):
        text = "\n".join(cell.text for row in table.rows for cell in row.cells)
        if "EV-011_ReverseImage_Results.png" in text:
            table._element.getparent().remove(table._element)
            continue

        for row in table.rows:
            cells = row.cells
            for cell in cells:
                if cell.text == "Found" and len(cells) >= 5 and cells[1].text == "Web (.com)":
                    replace_cell_text(cell, "Historically found; currently unreachable")
                elif cell.text == "rajshamani.com homepage, oldest of the three domains":
                    replace_cell_text(cell, "Historical rajshamani.com homepage evidence; currently unreachable")
                elif cell.text == "rajshamani.com was registered on 06-04-2016 through Bluehost and is paid through to 2031":
                    replace_cell_text(cell, "rajshamani.com was registered on 06-04-2016 through Bluehost and is paid through to 2031, but was not reachable during the latest check")
                elif cell.text == "Oldest domain, long registration, consistent content — but nothing outside the site confirms the operator":
                    replace_cell_text(cell, "Oldest domain and long registration, with historical content evidence, but the site is currently unreachable and nothing outside it confirms the operator")
                elif "rajshamani.com registered 06-04-2016 through Bluehost and paid through to 2031." in cell.text:
                    replace_cell_text(cell, cell.text.replace(
                        "rajshamani.com registered 06-04-2016 through Bluehost and paid through to 2031.",
                        "rajshamani.com registered 06-04-2016 through Bluehost and paid through to 2031, but it was not reachable during the latest check."
                    ))

    def replace_picture_before(caption, image_path):
        target_idx = None
        for i, para in enumerate(doc.paragraphs):
            if para.text.startswith(caption):
                target_idx = max(0, i - 1)
                break
        if target_idx is None:
            raise RuntimeError(f"Could not find {caption}.")
        para = doc.paragraphs[target_idx]
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in list(para.runs):
            run._element.getparent().remove(run._element)
        para.add_run().add_picture(str(image_path), width=Inches(6.9))

    replace_picture_before("EV-011:", EV011)
    replace_picture_before("EV-012:", EV012)
    replace_picture_before("EV-017:", EV017)
    doc.save(OUT)


if __name__ == "__main__":
    make_ev011()
    make_ev012()
    make_ev017()
    edit_doc()
    print(EV011)
    print(EV012)
    print(EV017)
    print(OUT)
