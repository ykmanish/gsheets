const fs = require("fs");

function chunkText(text, chunkSize = 1000) {
  const chunks = [];

  let start = 0;

  while (start < text.length) {

    let end = start + chunkSize;

    if (end < text.length) {
      while (
        end < text.length &&
        text[end] !== " "
      ) {
        end++;
      }
    }

    chunks.push(
      text.slice(start, end)
    );

    start = end;
  }

  return chunks;
}

async function main() {

  const pdfjsLib =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  const data =
    new Uint8Array(
      fs.readFileSync(
        "./docs/Sample_Document.pdf"
      )
    );

  const pdf =
    await pdfjsLib
      .getDocument({ data })
      .promise;

  let fullText = "";

  for (
    let pageNum = 1;
    pageNum <= pdf.numPages;
    pageNum++
  ) {

    const page =
      await pdf.getPage(pageNum);

    const textContent =
      await page.getTextContent();

    const text =
      textContent.items
        .map(item => item.str)
        .join(" ");

    fullText += text + "\n";
  }

  fs.writeFileSync(
    "./data/extracted.txt",
    fullText
  );

  const chunks =
    chunkText(fullText);

  console.log(
    "Total Chunks:",
    chunks.length
  );

  console.log(
    "\nText Saved!"
  );
}

main();