import { rm } from "node:fs/promises";
import path from "node:path";

const targets = [
  path.join(process.cwd(), ".opencrab"),
  path.join(process.cwd(), ".playwright-cli"),
  path.join(process.cwd(), "output"),
  path.join(process.cwd(), "tmp"),
];

for (const target of targets) {
  await rm(target, { recursive: true, force: true }).catch(() => undefined);
}

process.stdout.write("Cleaned local runtime directories.\n");
