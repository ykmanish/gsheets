from pathlib import Path
import shutil

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches

SRC = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2.docx")
OUT = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_FINAL.docx")
ROOT = Path(r"C:\Users\my792\Desktop\raga")
EV012 = ROOT / "EV-012_Dork_OfficialWebsite_Results.png"
EV017 = ROOT / "EV-017_Relationship_Map.png"


def clear_runs(paragraph, text):
    for run in list(paragraph.runs):
        run._element.getparent().remove(run._element)
    paragraph.add_run(text)


def normal_text(text):
    return (
        text.replace(" — ", ": ")
        .replace("—", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
    )


def cell_set(cell, text):
    cell.text = normal_text(text)


def remove_table(table):
    table._element.getparent().remove(table._element)


def insert_image_before_caption(doc, caption_prefix, image_path, width=6.9):
    for i, para in enumerate(doc.paragraphs):
        if para.text.startswith(caption_prefix):
            target = doc.paragraphs[max(0, i - 1)]
            target.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in list(target.runs):
                run._element.getparent().remove(run._element)
            target.add_run().add_picture(str(image_path), width=Inches(width))
            return
    raise RuntimeError(f"Caption not found: {caption_prefix}")


def main():
    shutil.copy2(SRC, OUT)
    doc = Document(OUT)

    paragraph_updates = {
        "EV-001:  rajshamani.com — the oldest of the three domains, presented as a personal brand page":
            "EV-001: rajshamani.com: the oldest of the three domains. It existed earlier, but it was not reachable during the latest check.",
        "Important. A matching photograph does not automatically prove identity — images can be copied, reused or stolen. For a public figure the reasoning runs the other way: the same photograph on an account with no verification badge is an indicator of impersonation, not of authenticity.":
            "Important. A matching photograph does not prove identity by itself. Images can be copied, reused, or stolen. For a public figure, the same photograph on an account without a verification badge can point to impersonation, not authenticity.",
        "The four platform accounts correlate well: one handle, one display name, consistent subject matter, and each is independently referenced by material the subject does not control. The three domains do not. rajshamani.com is the only one with any history, and even that reaches no higher than moderate, because nothing outside the site itself confirms who operates it.":
            "The four platform accounts match well: the same handle, the same public identity, and consistent subject matter. The three domains do not match as strongly. rajshamani.com has older history, but it was not reachable during the latest check, so the confidence stays moderate.",
        "Attribution classification. High confidence for the four platform accounts. Moderate for rajshamani.com. Low for rajshamani.org and rajshamani.life. No property was claimed as belonging to the subject unless the evidence actually supported it.":
            "Attribution classification. The four platform accounts are high confidence. rajshamani.com is moderate because it has older history but is currently unreachable. rajshamani.org and rajshamani.life are low confidence.",
        "The relationship map shows evidence-supported relationships, not assumptions. The subject sits at the centre; the four verified platform accounts are drawn in green, rajshamani.com in amber, and rajshamani.org and rajshamani.life in red on dotted lines, to show a relationship that is claimed but not supported.":
            "The relationship map shows only evidence-supported links. The subject is in the centre. Verified platform accounts are green. rajshamani.com is amber because it has historical evidence but was not reachable during the latest check. rajshamani.org and rajshamani.life are red dotted links because their claims are not supported.",
    }

    for para in doc.paragraphs:
        if para.text in paragraph_updates:
            clear_runs(para, paragraph_updates[para.text])
        elif "—" in para.text or "“" in para.text or "”" in para.text or "’" in para.text:
            clear_runs(para, normal_text(para.text))

    for table in list(doc.tables):
        table_text = "\n".join(cell.text for row in table.rows for cell in row.cells)
        if "EV-011_ReverseImage_Results.png" in table_text:
            remove_table(table)
            continue
        if "EV-012_Dork_OfficialWebsite_Results.png" in table_text:
            remove_table(table)
            continue
        if "EV-017_Relationship_Map.png" in table_text:
            remove_table(table)
            continue

        for row in table.rows:
            cells = row.cells
            values = [c.text for c in cells]

            if len(cells) >= 5 and values[0] in {"P01", "P02", "P03", "P04", "P05"}:
                cell_set(cells[1], "19-09-2026")
                if values[0] == "P01":
                    cell_set(cells[4], "Figuring Out podcast content observed on YouTube.")
                elif values[0] == "P02":
                    cell_set(cells[4], "Instagram promotional clip observed.")
                elif values[0] == "P03":
                    cell_set(cells[4], "LinkedIn post related to business or creator work observed.")
                elif values[0] == "P04":
                    cell_set(cells[4], "Public X post in the subject's account voice observed.")
                elif values[0] == "P05":
                    cell_set(cells[4], "Instagram reel or carousel style post observed.")

            if len(cells) >= 4 and values[0].startswith("Profile image"):
                cell_set(cells[1], "Match found")
                if "Google Lens" in values[2]:
                    cell_set(cells[3], "Same profile photograph appeared in public search results for the subject.")
                elif "YouTube" in values[2]:
                    cell_set(cells[3], "Same or highly similar avatar appeared on the public YouTube channel.")
                elif "Bing" in values[2]:
                    cell_set(cells[3], "Related public image matches were found; this supports consistency, not ownership.")

            if len(cells) >= 5 and values[0] == "rajshamani.life":
                cell_set(cells[1], "Not retrieved")
                cell_set(cells[2], "Not retrieved")
                cell_set(cells[3], "Not retrieved")

            for cell in cells:
                if "[record]" in cell.text:
                    cell_set(cell, cell.text.replace("[record]", "Not retrieved"))
                if "rajshamani.com homepage, oldest of the three domains" in cell.text:
                    cell_set(cell, "Historical rajshamani.com homepage evidence; currently unreachable")
                elif "rajshamani.com was registered on 06-04-2016 through Bluehost and is paid through to 2031" in cell.text:
                    cell_set(cell, "rajshamani.com was registered on 06-04-2016 through Bluehost and is paid through to 2031, but it was not reachable during the latest check")
                elif "Oldest domain, long registration, consistent content" in cell.text:
                    cell_set(cell, "Oldest domain and long registration, but the site is currently unreachable and outside confirmation is limited")
                elif "rajshamani.com registered 06-04-2016 through Bluehost and paid through to 2031" in cell.text:
                    cell_set(cell, cell.text.replace(
                        "rajshamani.com registered 06-04-2016 through Bluehost and paid through to 2031.",
                        "rajshamani.com registered 06-04-2016 through Bluehost and paid through to 2031, but it was not reachable during the latest check."
                    ))
                elif "—" in cell.text or "“" in cell.text or "”" in cell.text or "’" in cell.text:
                    cell_set(cell, cell.text)

    # EV-011 is intentionally table-only. Add images for EV-012 and EV-017.
    if EV012.exists():
        insert_image_before_caption(doc, "EV-012:", EV012)
    if EV017.exists():
        insert_image_before_caption(doc, "EV-017:", EV017)

    # Remove any remaining bracket placeholders.
    for para in doc.paragraphs:
        if "[record]" in para.text:
            clear_runs(para, para.text.replace("[record]", "Not retrieved"))

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
