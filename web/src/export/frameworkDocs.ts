// Writes the policy pages' review copies under docs/ (see lib/frameworkDocs.ts). Run: npm run docs:framework
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { frameworkDocs } from "../lib/frameworkDocs";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
for (const [path, text] of Object.entries(frameworkDocs())) {
  writeFileSync(join(ROOT, path), text);
  console.log(`wrote ${path}`);
}
