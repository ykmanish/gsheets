const fs = require("fs");
const { pipeline } = require("@xenova/transformers");

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

  const text =
    fs.readFileSync(
      "./data/extracted.txt",
      "utf8"
    );

  const chunks =
    chunkText(text);

  const extractor =
    await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

  const records = [];

  for (
    let i = 0;
    i < chunks.length;
    i++
  ) {

    console.log(
      `Embedding ${i+1}/${chunks.length}`
    );

    const embedding =
      await extractor(
        chunks[i],
        {
          pooling:"mean",
          normalize:true
        }
      );

    records.push({
      id:i,
      text:chunks[i],
      embedding:Array.from(
        embedding.data
      )
    });

  }

  fs.writeFileSync(
    "./data/vectors.json",
    JSON.stringify(
      records,
      null,
      2
    )
  );

  console.log(
    "Vectors Saved!"
  );
}

main();