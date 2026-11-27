from pathlib import Path
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches

DOCX = Path(r"C:\Users\my792\Downloads\Srishti_Meena_OSINT_Practical_2_FINAL.docx")
EV017 = Path(r"C:\Users\my792\Desktop\raga\EV-017_Relationship_Map.png")


def paragraph_has_picture(paragraph):
    return bool(paragraph._element.xpath(".//w:drawing"))


def clear_paragraph(paragraph):
    for run in list(paragraph.runs):
        run._element.getparent().remove(run._element)


def main():
    doc = Document(DOCX)

    # Replace [rec] shorthand with readable entries.
    for table in doc.tables:
        for row in table.rows:
            cells = row.cells
            vals = [c.text for c in cells]
            if vals and vals[0] == "Platform verification badge":
                for cell in cells[1:5]:
                    cell.text = "Verified"
            elif vals and vals[0] == "Long-term domain investment":
                if len(cells) >= 8:
                    cells[7].text = "No"
            else:
                for cell in cells:
                    if "[rec]" in cell.text:
                        cell.text = cell.text.replace("[rec]", "Recorded")

    # Remove duplicate relationship-map pictures in the Step 12 block.
    start = end = None
    for i, para in enumerate(doc.paragraphs):
        if "Step 12" in para.text:
            start = i
        if para.text.startswith("EV-017:"):
            end = i
            break
    if start is not None and end is not None:
        for para in doc.paragraphs[start + 1:end]:
            if paragraph_has_picture(para):
                clear_paragraph(para)
        target = doc.paragraphs[end - 1]
        clear_paragraph(target)
        target.alignment = WD_ALIGN_PARAGRAPH.CENTER
        target.add_run().add_picture(str(EV017), width=Inches(6.9))

    doc.save(DOCX)
    print(DOCX)


if __name__ == "__main__":
    main()
