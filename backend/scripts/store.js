const fs = require("fs");
const { pipeline } = require("@xenova/transformers");
const { ChromaClient } = require("chromadb");

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

  console.log(
    "Loading PDF..."
  );

  const text =
    fs.readFileSync(
      "./data/extracted.txt",
      "utf8"
    );

  const chunks =
    chunkText(text);

  console.log(
    "Chunks:",
    chunks.length
  );

  console.log(
    "Loading Embedding Model..."
  );

  const extractor =
    await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

  const client =
    new ChromaClient();

  const collection =
    await client
      .getOrCreateCollection({
        name:
        "technology-book"
      });

  for (
    let i = 0;
    i < chunks.length;
    i++
  ) {

    console.log(
      `Embedding ${i + 1}/${chunks.length}`
    );

    const embedding =
      await extractor(
        chunks[i],
        {
          pooling: "mean",
          normalize: true
        }
      );

    await collection.add({
      ids: [String(i)],
      documents: [chunks[i]],
      embeddings: [
        Array.from(
          embedding.data
        )
      ]
    });

  }

  console.log(
    "\nDONE!"
  );

}

main();