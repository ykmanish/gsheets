const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mammoth = require("mammoth");
const { createCanvas } = require("@napi-rs/canvas");
const Tesseract = require("tesseract.js");
const { pipeline } = require("@xenova/transformers");

let extractor;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);
const MIN_PAGE_TEXT_LENGTH = 25;

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
function setStage(context, stage) {
  if (context?.statusMap && context?.documentId) {
    context.statusMap[context.documentId] = { stage };
  }
}

async function recognizeImageText(imageInput, context, stage) {
  setStage(context, stage || "Reading Image Text");
  const result = await Tesseract.recognize(imageInput, "eng");
  return result?.data?.text || "";
}

async function renderPdfPageToPng(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const canvasContext = canvas.getContext("2d");

  await page.render({ canvasContext, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function extractPdfText(filePath, context = {}) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let fullText = "";
  let ocrPages = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    setStage(context, `Extracting PDF Text (${pageNum}/${pdf.numPages})`);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");

    if (text.trim().length >= MIN_PAGE_TEXT_LENGTH) {
      fullText += text + "\n";
      continue;
    }

    ocrPages += 1;
    const imageBuffer = await renderPdfPageToPng(page);
    const ocrText = await recognizeImageText(
      imageBuffer,
      context,
      `OCR PDF Page (${pageNum}/${pdf.numPages})`
    );
    fullText += (ocrText.trim() || text) + "\n";
  }

  if (ocrPages > 0) {
    console.log(`OCR used for ${ocrPages}/${pdf.numPages} PDF pages`);
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

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

async function extractImageText(filePath, context = {}) {
  return await recognizeImageText(filePath, context, "Reading Image Text");
}

async function extractText(filePath, context = {}) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") return await extractPdfText(filePath, context);
  if (ext === ".txt") return extractTxtText(filePath);
  if (ext === ".csv") return extractCsvText(filePath);
  if (ext === ".xlsx" || ext === ".xls") return extractExcelText(filePath);
  if (ext === ".docx") return await extractDocxText(filePath);
  if (IMAGE_EXTENSIONS.has(ext)) return await extractImageText(filePath, context);

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

function removeSourceFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Could not delete source file ${filePath}:`, error.message);
    return false;
  }
}

// ── Process Uploaded File ─────────────────────────────────────────────────────
async function processDocument(
  filePath,
  documentId,
  statusMap,
  originalName,
  documents,
  saveDocuments,
  vectorsDir,
  options = {}
) {
  try {
    console.log(`Processing document ${documentId}: ${originalName}`);

    statusMap[documentId] = { stage: "Extracting Content" };
    const fullText = await extractText(filePath, { statusMap, documentId });
    console.log(`Extracted text length: ${fullText.length} characters`);

    if (!fullText.trim()) {
      throw new Error("No readable text found in this document");
    }

    statusMap[documentId] = { stage: "Chunking" };
    const chunks = chunkText(fullText);
    console.log(`Created ${chunks.length} chunks`);

    await generateAndSaveEmbeddings(chunks, documentId, statusMap, vectorsDir);

    const docIndex = documents.findIndex((d) => d.id === documentId);
    if (docIndex !== -1) {
      const sourceDeleted = options.deleteSourceAfterProcessing ? removeSourceFile(filePath) : false;
      documents[docIndex] = {
        ...documents[docIndex],
        chunks: chunks.length,
        isReady: true,
        status: "ready",
        ...(sourceDeleted
          ? {
              filePath: null,
              localFileDeletedAt: new Date().toISOString(),
            }
          : {}),
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
      if (options.deleteSourceOnFailure && removeSourceFile(filePath)) {
        documents[docIndex].filePath = null;
        documents[docIndex].localFileDeletedAt = new Date().toISOString();
      }
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
  extractText,
};
