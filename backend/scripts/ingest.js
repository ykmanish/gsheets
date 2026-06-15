const fs = require("fs");
const pdf = require("pdf-parse");

async function main() {
  const buffer = fs.readFileSync("./docs/interior.pdf");

  const data = await pdf(buffer);

  console.log("Pages:", data.numpages);
  console.log(data.text);
}

main();