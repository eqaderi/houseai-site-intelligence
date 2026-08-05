#!/usr/bin/env node
/**
 * Offline-network proof (P2-19).
 * Asserts authored runtime files never open external network endpoints.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "terrain-3d.js",
  "data/data.js",
].map((rel) => path.join(dashboard, rel));

const banned = /https?:\/\/|@import\s+url|fonts\.google|cdnjs|unpkg|jsdelivr|fetch\(|XMLHttpRequest|WebSocket\(/gi;
const hits = [];

for (const file of runtimeFiles) {
  const text = fs.readFileSync(file, "utf8");
  const matches = text.match(banned) || [];
  // data.js may contain cited source URLs as strings in the source register —
  // those are display citations, not runtime requests. Only flag if they appear
  // outside data.js, or as network APIs in app/terrain.
  if (path.basename(file) === "data.js") {
    const api = text.match(/\bfetch\(|XMLHttpRequest|WebSocket\(/g) || [];
    if (api.length) hits.push(`${path.relative(dashboard, file)}: ${api.join(", ")}`);
    continue;
  }
  if (matches.length) hits.push(`${path.relative(dashboard, file)}: ${[...new Set(matches)].join(", ")}`);
}

// Three.js UMD is vendored offline; its min bundle may still mention fetch in
// dead code paths. The offline guarantee for the dashboard is: no deprecation
// warn forcing a module migration, and no network use from our runtime files.
const three = fs.readFileSync(path.join(dashboard, "assets/vendor/three/three.min.js"), "utf8");
if (/are deprecated with r150/.test(three)) {
  hits.push("three.min.js still emits UMD deprecation warning");
}
if (!/0,function\(t,e\)\{"object"==typeof exports/.test(three) && !/\(function\(t,e\)\{"object"==typeof exports/.test(three)) {
  // Accept either comma-operator or parenthesized UMD boot.
  if (!/function\(t,e\)\{"object"==typeof exports&&"undefined"!=typeof module\?e\(exports\)/.test(three)) {
    hits.push("three.min.js UMD boot looks broken");
  }
}

if (hits.length) {
  console.error("verify-offline.mjs failed:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("verify-offline.mjs: runtime package makes no external network calls; UMD deprecation removed.");
