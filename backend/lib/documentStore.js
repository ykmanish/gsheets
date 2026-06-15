const fs = require("fs");
const path = require("path");

const DOCUMENTS_FILE = path.join(
  __dirname,
  "..",
  "documents.json"
);

function ensureStore() {

  if (
    !fs.existsSync(
      DOCUMENTS_FILE
    )
  ) {

    fs.writeFileSync(
      DOCUMENTS_FILE,
      JSON.stringify(
        [],
        null,
        2
      )
    );

  }

}

function getDocuments() {

  ensureStore();

  return JSON.parse(
    fs.readFileSync(
      DOCUMENTS_FILE,
      "utf8"
    )
  );

}

function saveDocuments(
  documents
) {

  fs.writeFileSync(
    DOCUMENTS_FILE,
    JSON.stringify(
      documents,
      null,
      2
    )
  );

}

function addDocument(
  document
) {

  const docs =
    getDocuments();

  docs.push(
    document
  );

  saveDocuments(
    docs
  );

}

function getDocumentById(
  id
) {

  const docs =
    getDocuments();

  return docs.find(
    doc =>
      doc.id === id
  );

}

function deleteDocument(
  id
) {

  const docs =
    getDocuments();

  const target =
    docs.find(
      doc =>
        doc.id === id
    );

  if (!target) {

    return false;

  }

  const updated =
    docs.filter(
      doc =>
        doc.id !== id
    );

  saveDocuments(
    updated
  );

  return target;

}

module.exports = {
  getDocuments,
  saveDocuments,
  addDocument,
  getDocumentById,
  deleteDocument,
};