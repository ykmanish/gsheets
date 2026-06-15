const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { pipeline } = require("@xenova/transformers");

let extractor;

// ── Chunk Text ────────────────────────────────────────────────────────────────
function chunkText(text, chunkSize = 1000) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      while (end < text.length && text[end] !== " " && text[end] !== "\n") {
        end++;
      }
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

// ── Text Extractors ───────────────────────────────────────────────────────────
async function extractPdfText(filePath) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    fullText += text + "\n";
  }

  return fullText;
}

function extractTxtText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractCsvText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractExcelText(filePath) {
  const workbook = XLSX.readFile(filePath);
  let text = "";

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    text += `Sheet: ${sheetName}\n`;
    rows.forEach((row) => {
      if (row && row.length > 0) {
        text += row.join(" | ") + "\n";
      }
    });
    text += "\n";
  });

  return text;
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") return await extractPdfText(filePath);
  if (ext === ".txt") return extractTxtText(filePath);
  if (ext === ".csv") return extractCsvText(filePath);
  if (ext === ".xlsx" || ext === ".xls") return extractExcelText(filePath);

  throw new Error(`Unsupported file type: ${ext}`);
}

// ── Core Embed + Save ─────────────────────────────────────────────────────────
async function generateAndSaveEmbeddings(chunks, documentId, statusMap, vectorsDir) {
  if (!extractor) {
    if (statusMap) statusMap[documentId] = { stage: "Loading Embedding Model" };
    console.log("Loading embedding model...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Embedding model loaded");
  }

  const records = [];

  for (let i = 0; i < chunks.length; i++) {
    if (statusMap) {
      statusMap[documentId] = {
        stage: `Generating Embeddings (${i + 1}/${chunks.length})`,
      };
    }

    if ((i + 1) % 10 === 0) {
      console.log(`Processed ${i + 1}/${chunks.length} chunks`);
    }

    const embedding = await extractor(chunks[i], {
      pooling: "mean",
      normalize: true,
    });

    records.push({
      id: i,
      text: chunks[i],
      embedding: Array.from(embedding.data),
    });
  }

  const savePath = path.join(vectorsDir, `${documentId}.json`);
  fs.writeFileSync(savePath, JSON.stringify(records, null, 2));
  console.log(`Saved vectors to ${savePath}`);

  return records;
}

// ── Process Uploaded File ─────────────────────────────────────────────────────
async function processDocument(
  filePath,
  documentId,
  statusMap,
  originalName,
  documents,
  saveDocuments,
  vectorsDir
) {
  try {
    console.log(`Processing document ${documentId}: ${originalName}`);

    statusMap[documentId] = { stage: "Extracting Content" };
    const fullText = await extractText(filePath);
    console.log(`Extracted text length: ${fullText.length} characters`);

    statusMap[documentId] = { stage: "Chunking" };
    const chunks = chunkText(fullText);
    console.log(`Created ${chunks.length} chunks`);

    await generateAndSaveEmbeddings(chunks, documentId, statusMap, vectorsDir);

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex] = {
        ...documents[docIndex],
        chunks: chunks.length,
        isReady: true,
        status: "ready",
      };
      saveDocuments();
      console.log(`Updated document ${documentId} as ready`);
    }

    statusMap[documentId] = { stage: "Ready", ready: true };
    console.log(`Document ${documentId} processing complete`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    statusMap[documentId] = { stage: "Failed", error: error.message };

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex].status = "failed";
      documents[docIndex].error = error.message;
      saveDocuments();
    }
  }
}

// ── Process Google Sheet Text ─────────────────────────────────────────────────
async function processSheetText(
  text,
  documentId,
  statusMap,
  documents,
  saveDocuments,
  vectorsDir,
  modifiedTime
) {
  try {
    console.log(`Processing sheet ${documentId}`);

    statusMap[documentId] = { stage: "Chunking" };
    const chunks = chunkText(text);
    console.log(`Created ${chunks.length} chunks from sheet`);

    await generateAndSaveEmbeddings(chunks, documentId, statusMap, vectorsDir);

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex] = {
        ...documents[docIndex],
        chunks: chunks.length,
        isReady: true,
        status: "ready",
        lastModifiedTime: modifiedTime || null,
        lastSyncedAt: new Date().toISOString(),
      };
      saveDocuments();
      console.log(`Sheet ${documentId} synced and ready`);
    }

    statusMap[documentId] = { stage: "Ready", ready: true };
  } catch (error) {
    console.error(`Error processing sheet ${documentId}:`, error);
    statusMap[documentId] = { stage: "Failed", error: error.message };

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex].status = "failed";
      documents[docIndex].error = error.message;
      saveDocuments();
    }
  }
}

module.exports = {
  processDocument,
  processSheetText,
  chunkText,
};