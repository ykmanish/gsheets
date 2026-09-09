import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/my792/Desktop/raga/outputs/dmr-demo";
const workbook = Workbook.create();
const dmr = workbook.worksheets.add("09 09 DMR");
const report = workbook.worksheets.add("Today Report");

const sites = ["Paramdham", "Kalhaar", "Devsharnam"];
const trades = [
  { name: "Tiles", planned: [4, 2, 0], actual: [3, 2, 0], remark: ["", "", ""] },
  { name: "Waterproofing", planned: [2, 0, 1], actual: [2, 0, 1], remark: ["", "", ""] },
  { name: "Window Fixture.", planned: [1, 1, 0], actual: [0, 1, 0], remark: ["", "", ""] },
  { name: "Land scapping", planned: [0, 2, 1], actual: [0, 1, 1], remark: ["", "", ""] },
  {
    name: "Others",
    planned: [0, 1, 0],
    actual: [2, 1, 3],
    remark: [
      "Two helpers used for site cleaning and material shifting.",
      "One person assigned for temporary barricade repair.",
      "Three people helped unload urgent plywood material.",
    ],
  },
  { name: "Depart Labour", planned: [0, 0, 0], actual: [2, 0, 0], remark: ["", "", ""] },
  { name: "Farming", planned: [0, 0, 0], actual: [0, 0, 0], remark: ["", "", ""] },
];

dmr.getRange("A1:H1").values = [["PROJECT DMR - DEMO SITEWISE MANPOWER", "", "", "", "", "", "", ""]];
dmr.mergeCells("A1:H1");
dmr.getRange("A2:H2").values = [["Name of Agency / Trade", "Paramdham", "", "Kalhaar", "", "Devsharnam", "", "Remarks"]];
dmr.getRange("A3:H3").values = [["", "Planned", "Actual", "Planned", "Actual", "Planned", "Actual", ""]];

const dmrRows = trades.map((trade) => [
  trade.name,
  trade.planned[0],
  trade.actual[0],
  trade.planned[1],
  trade.actual[1],
  trade.planned[2],
  trade.actual[2],
  trade.remark.filter(Boolean).join("\n"),
]);
dmr.getRange("A4:H10").values = dmrRows;
dmr.getRange("A11:H11").values = [[
  "Total Manpower",
  "=SUM(B4:B10)",
  "=SUM(C4:C10)",
  "=SUM(D4:D10)",
  "=SUM(E4:E10)",
  "=SUM(F4:F10)",
  "=SUM(G4:G10)",
  "",
]];

dmr.getRange("A14:H14").values = [["PROJECT STAFF ATTENDENCE", "", "", "", "", "", "", ""]];
dmr.mergeCells("A14:H14");
dmr.getRange("A15:H15").values = [["1.Jay Panchal", "2.Prakash Luhar", "3.Jay Suthar", "4.Sanjay Jadhav", "5.Deepak", "6.Vipul Shah", "", ""]];
dmr.getRange("A16:H16").values = [["P", "P", "A", "P", "L", "P", "", ""]];

report.getRange("A1:E1").values = [["TODAY DMR REPORT - DEMO", "", "", "", ""]];
report.mergeCells("A1:E1");
report.getRange("A3:E3").values = [["Site", "Planned", "Actual", "Variance", "Status"]];
report.getRange("A4:E6").values = [
  ["Paramdham", "=SUM('09 09 DMR'!B4:B10)", "=SUM('09 09 DMR'!C4:C10)", "=C4-B4", '=IF(C4>=B4,"OK","Short")'],
  ["Kalhaar", "=SUM('09 09 DMR'!D4:D10)", "=SUM('09 09 DMR'!E4:E10)", "=C5-B5", '=IF(C5>=B5,"OK","Short")'],
  ["Devsharnam", "=SUM('09 09 DMR'!F4:F10)", "=SUM('09 09 DMR'!G4:G10)", "=C6-B6", '=IF(C6>=B6,"OK","Short")'],
];
report.getRange("A8:D8").values = [["Other Remarks", "", "", ""]];
report.mergeCells("A8:D8");
report.getRange("A9:D9").values = [["Date", "Site", "Actual", "Remark"]];
report.getRange("A10:D12").values = [
  ["2026-09-09", "Paramdham", 2, "Two helpers used for site cleaning and material shifting."],
  ["2026-09-09", "Kalhaar", 1, "One person assigned for temporary barricade repair."],
  ["2026-09-09", "Devsharnam", 3, "Three people helped unload urgent plywood material."],
];

report.getRange("A14:C14").values = [["Staff Attendance", "", ""]];
report.mergeCells("A14:C14");
report.getRange("A15:C15").values = [["Present", "Absent", "Leave"]];
report.getRange("A16:C16").values = [[4, 1, 1]];

for (const sheet of [dmr, report]) {
  sheet.showGridLines = false;
  sheet.getRange("A1:H30").format.font = { name: "Arial", size: 11, color: "#171714" };
}

dmr.getRange("A1:H1").format = { fill: "#a9d18e", font: { name: "Arial", bold: true, color: "#000000" }, horizontalAlignment: "center" };
dmr.getRange("A2:H3").format = { fill: "#00b050", font: { name: "Arial", bold: true, color: "#000000" }, horizontalAlignment: "center" };
dmr.getRange("A4:H11").format.borders = { preset: "all", style: "thin", color: "#000000" };
dmr.getRange("A11:G11").format.font = { name: "Arial", bold: true };
dmr.getRange("H4:H10").format.wrapText = true;
dmr.getRange("A14:H15").format = { fill: "#00b050", font: { name: "Arial", bold: true, color: "#000000" }, horizontalAlignment: "center" };
dmr.getRange("A16:H16").format = { fill: "#ff0000", font: { name: "Arial", bold: true, color: "#000000" }, horizontalAlignment: "center" };
dmr.getRange("A14:H16").format.borders = { preset: "all", style: "thin", color: "#000000" };
dmr.getRange("A:H").format.autofitColumns();
dmr.getRange("H4:H10").format.columnWidth = 42;
dmr.getRange("4:10").format.rowHeight = 36;

report.getRange("A1:E1").format = { fill: "#171714", font: { name: "Arial", bold: true, color: "#ffffff" }, horizontalAlignment: "center" };
report.getRange("A3:E3").format = { fill: "#e8f5ee", font: { name: "Arial", bold: true, color: "#0f6b49" } };
report.getRange("A8:D9").format = { fill: "#fff2cc", font: { name: "Arial", bold: true, color: "#171714" } };
report.getRange("A14:C15").format = { fill: "#e8f0fe", font: { name: "Arial", bold: true, color: "#171714" } };
report.getRange("A3:E6").format.borders = { preset: "all", style: "thin", color: "#d9d9d9" };
report.getRange("A9:D12").format.borders = { preset: "all", style: "thin", color: "#d9d9d9" };
report.getRange("A15:C16").format.borders = { preset: "all", style: "thin", color: "#d9d9d9" };
report.getRange("D10:D12").format.wrapText = true;
report.getRange("A:E").format.autofitColumns();
report.getRange("D10:D12").format.columnWidth = 58;
report.getRange("10:12").format.rowHeight = 36;

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: "Today Report", autoCrop: "all", scale: 2, format: "png" });
await fs.writeFile(`${outputDir}/demo-dmr-report-preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/demo-dmr-with-other-remarks.xlsx`);
