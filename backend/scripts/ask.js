require("dotenv").config();

const fs = require("fs");
const { pipeline } = require("@xenova/transformers");
const Groq = require("groq-sdk");

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {

  const readline =
  require("readline");

const rl =
  readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

const question =
  await new Promise(resolve =>
    rl.question(
      "Ask: ",
      resolve
    )
  );

rl.close();

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

  const groq =
    new Groq({
      apiKey:
        process.env.GROQ_API_KEY
    });

  const response =
    await groq.chat.completions.create({
      model:
        "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Answer only from the provided context."
        },
        {
          role: "user",
          content: `
Context:
${bestMatch.text}

Question:
${question}
`
        }
      ]
    });

  console.log(
    "\nQuestion:"
  );

  console.log(question);

  console.log(
    "\nAnswer:"
  );

  console.log(
    response.choices[0]
      .message.content
  );

}

main();