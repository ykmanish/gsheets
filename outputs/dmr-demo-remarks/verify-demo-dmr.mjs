import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const path = "C:/Users/my792/Desktop/raga/outputs/dmr-demo-remarks/demo-dmr-with-other-remarks.xlsx";
const input = await FileBlob.load(path);
const workbook = await SpreadsheetFile.importXlsx(input);
const report = await workbook.inspect({
  kind: "table",
  range: "Today Report!A1:E16",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(report.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula errors",
});
console.log(errors.ndjson);
