const fs = require("fs");
const { pipeline } = require("@xenova/transformers");

function cosineSimilarity(a, b) {

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {

    dot += a[i] * b[i];

    normA += a[i] * a[i];

    normB += b[i] * b[i];

  }

  return (
    dot /
    (
      Math.sqrt(normA) *
      Math.sqrt(normB)
    )
  );
}

async function main() {

  const question =
    "What is Artificial Intelligence?";

  const vectors =
    JSON.parse(
      fs.readFileSync(
        "./data/vectors.json",
        "utf8"
      )
    );

  const extractor =
    await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

  const queryEmbedding =
    await extractor(
      question,
      {
        pooling: "mean",
        normalize: true
      }
    );

  const queryVector =
    Array.from(
      queryEmbedding.data
    );

  let bestMatch = null;

  let bestScore = -1;

  for (const record of vectors) {

    const score =
      cosineSimilarity(
        queryVector,
        record.embedding
      );

    if (score > bestScore) {

      bestScore = score;

      bestMatch = record;

    }

  }

  console.log(
    "\nBest Score:",
    bestScore
  );

  console.log(
    "\nBest Match:\n"
  );

  console.log(
    bestMatch.text
  );

}

main();