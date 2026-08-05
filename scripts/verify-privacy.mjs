#!/usr/bin/env node
/**
 * Public-release privacy scan for the publishable dashboard tree.
 * Rejects contact details, absolute home paths, credentials and personal
 * source filenames from the offline package that can open from file:// or a
 * public mirror.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TEXT_EXT = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".svg", ".csv", ".tsv",
]);

// Science dumps contain long numeric IDs that look like phone numbers if the
// regex is too greedy. Still scan them for emails, home paths and credentials.
const SCIENCE_RAW = /(?:^|\/)(?:assets\/data\/environmental\/raw|assets\/data\/(?:independent-verification|site-analysis-data|unified-site-data)\.json)/i;

const RULES = [
  {
    id: "email",
    // Require a plausible local-part rather than matching every @ in prose.
    re: /\b[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@(?:gmail|yahoo|outlook|hotmail|icloud|proton|me)\.[A-Za-z]{2,}\b/g,
    allow: () => false,
    scope: "all",
  },
  {
    id: "email-generic",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    // Allow citation-style organisation emails only if they are not personal
    // providers; still flag anything with a person-like local part later.
    allow: (sample) => /@(usgs|nasa|noaa|ecmwf|openstreetmap|wikipedia)\./i.test(sample),
    scope: "surface",
  },
  {
    id: "phone",
    // Formatted numbers only — pure digit runs are coordinates, event IDs, hashes.
    re: /(?:\+\d{1,3}[\s.-]|\(\d{2,4}\)[\s.-]?)\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?\b/g,
    allow: () => false,
    scope: "surface",
  },
  {
    id: "absolute-home-path",
    re: /\/(?:Users|home)\/[A-Za-z0-9._-]+\//g,
    allow: () => false,
    scope: "all",
  },
  {
    id: "private-key-block",
    re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g,
    allow: () => false,
    scope: "all",
  },
  {
    id: "aws-access-key",
    re: /\bAKIA[0-9A-Z]{16}\b/g,
    allow: () => false,
    scope: "all",
  },
  {
    // Private document class filenames with an extension. Examples live only
    // in this comment as spaced tokens so the scanner does not self-match.
    id: "personal-source-filename",
    re: /(?:^|[\\"/\s])(?:[A-Za-z]{3,}[-_])?(?:passport|deed|title-deed|id-card|national-id)(?:[-_][A-Za-z0-9.]+)?\.(?:pdf|dwg|dxf|jpg|jpeg|png)\b/gi,
    allow: (_sample, relative) => relative.endsWith("verify-privacy.mjs"),
    scope: "surface",
  },
];

const OSM_CONTACT = /\b(?:email|phone|contact:email|contact:phone|contact:name)\s*=\s*[^\n\r,"]{2,80}/gi;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function isTextFile(filePath) {
  return TEXT_EXT.has(path.extname(filePath).toLowerCase());
}

function scanFile(filePath) {
  const relative = path.relative(dashboard, filePath).split(path.sep).join("/");
  if (relative.startsWith("screenshots/")) return [];
  if (relative.includes("/vendor/")) return [];
  if (!isTextFile(filePath)) return [];

  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const isScience = SCIENCE_RAW.test(relative);
  const hits = [];
  for (const rule of RULES) {
    if (rule.scope === "surface" && isScience) continue;
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(text))) {
      if (rule.allow(match[0], relative)) continue;
      hits.push({
        file: relative,
        rule: rule.id,
        sample: match[0].slice(0, 80),
      });
    }
  }

  if (/raw\/.*\.json$/i.test(relative) || /openstreetmap/i.test(relative)) {
    OSM_CONTACT.lastIndex = 0;
    let match;
    while ((match = OSM_CONTACT.exec(text))) {
      hits.push({
        file: relative,
        rule: "osm-contact-tag",
        sample: match[0].slice(0, 80),
      });
    }
  }

  return hits;
}

export function verifyPrivacy(root = dashboard) {
  const files = walk(root);
  const findings = files.flatMap(scanFile);
  return {
    ok: findings.length === 0,
    scanned: files.length,
    findings,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyPrivacy();
  if (!result.ok) {
    console.error(`Privacy scan failed: ${result.findings.length} hit(s) in ${result.scanned} files`);
    for (const hit of result.findings.slice(0, 40)) {
      console.error(`  ${hit.file}: ${hit.rule} → ${hit.sample}`);
    }
    process.exit(1);
  }
  console.log(`Privacy scan passed: ${result.scanned} files, 0 contact/path/credential hits.`);
}
