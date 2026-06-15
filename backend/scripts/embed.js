const {
  pipeline
} = require(
  "@xenova/transformers"
);

async function main() {

  console.log(
    "Loading embedding model..."
  );

  const extractor =
    await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

  console.log(
    "Model Loaded!"
  );

  const text =
    "Artificial Intelligence and Machine Learning";

  const embedding =
    await extractor(
      text,
      {
        pooling: "mean",
        normalize: true
      }
    );

  console.log(
    "\nVector Size:"
  );

  console.log(
    embedding.data.length
  );

  console.log(
    "\nFirst 10 Values:"
  );

  console.log(
    Array.from(
      embedding.data
    ).slice(0, 10)
  );

}

main();