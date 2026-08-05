#!/usr/bin/env node
/**
 * Broken-link and downloadable-file validation (P2-18).
 * Checks every local href/src under the dashboard package resolves on disk.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

// Scan static markup and data registries only — not JS template literals.
const scanFiles = [
  path.join(dashboard, "index.html"),
  path.join(dashboard, "styles.css"),
  ...walk(path.join(dashboard, "data")).filter((f) => f.endsWith(".json")),
  ...walk(path.join(dashboard, "assets/documents")).filter((f) => /\.(md|html|txt)$/i.test(f)),
];
const refRe = /(?:href|src)=["']([^"'#?$]+)(?:[?#][^"']*)?["']/g;
const missing = [];
const checked = new Set();

for (const file of scanFiles) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  let match;
  refRe.lastIndex = 0;
  while ((match = refRe.exec(text))) {
    const ref = match[1];
    if (/^(https?:|mailto:|data:)/i.test(ref)) continue;
    if (ref.startsWith("//") || ref.includes("${")) continue;
    const base = path.dirname(file);
    const target = path.resolve(base, decodeURIComponent(ref));
    const key = `${path.relative(dashboard, file)} -> ${ref}`;
    if (checked.has(key)) continue;
    checked.add(key);
    if (!target.startsWith(dashboard)) {
      missing.push(`${key} (outside package)`);
      continue;
    }
    if (!fs.existsSync(target)) missing.push(key);
  }
}

// Explicit document registry + downloadable raw files
const documents = JSON.parse(fs.readFileSync(path.join(dashboard, "data/documents.json"), "utf8"));
for (const item of documents.items || []) {
  if (!item.href) continue;
  const target = path.resolve(dashboard, item.href);
  if (!fs.existsSync(target)) missing.push(`documents.json -> ${item.href}`);
}
const raw = JSON.parse(fs.readFileSync(path.join(dashboard, "data/raw-environmental-files.json"), "utf8"));
for (const file of raw.files || []) {
  if (file.role !== "downloadable") continue;
  const target = path.resolve(dashboard, file.path);
  if (!fs.existsSync(target)) missing.push(`raw-environmental-files.json -> ${file.path}`);
}
// Species image paths
const species = JSON.parse(fs.readFileSync(path.join(dashboard, "data/species.json"), "utf8"));
for (const entry of [...(species.species || []), ...(species.do_not_plant || []), ...(species.ask_locally || [])]) {
  const src = entry.image?.src;
  if (!src || /^(https?:)/i.test(src)) continue;
  const target = path.resolve(dashboard, src);
  if (!fs.existsSync(target)) missing.push(`species image -> ${src}`);
}

if (missing.length) {
  console.error(`verify-links.mjs: ${missing.length} missing local link(s)`);
  for (const row of missing.slice(0, 40)) console.error(`  ${row}`);
  process.exit(1);
}
console.log(`verify-links.mjs: ${checked.size} local references OK, documents registry OK.`);
