import fs from "node:fs";
import { PDFParse } from "pdf-parse";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Missing PDF file path.");
  process.exit(1);
}

const parser = new PDFParse({ data: fs.readFileSync(filePath) });
const result = await parser.getText();
await parser.destroy();

process.stdout.write(result.text || "");
