/**
 * Species photographs from Wikipedia. REQUIRES INTERNET. Overwrites its own
 * manifest and the image files under assets/images/species/.
 *
 * The dashboard opens from file:// with no network, so a remote <img src> is not
 * an option: every photograph has to be bundled. That makes licensing a build
 * concern rather than a display concern, and this script is where it is handled.
 *
 * Filenames are never guessed. Each species is resolved from its own Wikipedia
 * article — `prop=pageimages` gives the article's own lead image, so the picture
 * is the one an editor chose for that taxon rather than whatever a filename
 * search returned. The same query walks `langlinks` to the Persian article, so
 * the two reader-facing links come from the encyclopaedia's own mapping instead
 * of a transliteration guess.
 *
 * A second request asks Commons for `extmetadata` on the resolved file and the
 * licence is checked against an allowlist before the bytes are written. A file
 * whose licence does not match is refused and recorded as refused; it does not
 * ship. Author, licence, licence URL and the file's description page all land in
 * the manifest and are carried through into data/species.json, because an
 * attribution that lives only in a build log is not an attribution.
 *
 * The stored manifest is a request manifest — same convention as the elevation
 * fetchers, and for a stronger reason here: the response is a binary image, so
 * the provenance of the bytes cannot live inside them.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SPECIES, DO_NOT_PLANT, ASK_LOCALLY } from "./species-register.mjs";

// The refused species and the ask-locally ones get photographs too: recognising
// the tree somebody is about to sell you matters most when the answer is no.
const WANTED = [...SPECIES, ...DO_NOT_PLANT, ...ASK_LOCALLY];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const imageDir = path.resolve(scriptDir, "../assets/images/species");
const rawDir = path.resolve(scriptDir, "../assets/data/environmental/raw");
const manifestFile = path.join(rawDir, "wikipedia-species-images.json");

const THUMB_WIDTH = 700;
const USER_AGENT = "HouseAI site analysis/1.0 (offline architectural dashboard)";

// Free licences only. Matched case-insensitively against the licence short name
// Commons publishes for the file. Anything else — fair use, "permission",
// non-commercial, no-derivatives — is refused rather than downscaled or cropped
// into compliance.
const ALLOWED_LICENCES = [
  /^cc0/i,
  /^cc\s?by(\s|-)?\d/i,
  /^cc\s?by(-|\s)?sa/i,
  /^public\s?domain/i,
  /^pd([\s-]|$)/i,
  /^gfdl$/i,
];

const query = async (host, parameters) => {
  const url = `https://${host}/w/api.php?${new URLSearchParams({
    format: "json",
    formatversion: "2",
    ...parameters,
  })}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (response.ok) return { url, body: await response.json() };
    if (response.status !== 429 || attempt === 5) {
      throw new Error(`${url} → ${response.status} ${response.statusText}`);
    }
    const wait = 20000 * attempt;
    console.log(`api rate limited, waiting ${wait / 1000}s`);
    await new Promise((resolve) => { setTimeout(resolve, wait); });
  }
  throw new Error(`${url}: exhausted retries`);
};

const text = (value) => String(value ?? "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

await fs.mkdir(imageDir, { recursive: true });
await fs.mkdir(rawDir, { recursive: true });

const manifest = {
  source: "Wikipedia (article lead images) and Wikimedia Commons (file metadata)",
  endpoints: [
    "https://en.wikipedia.org/w/api.php (action=query, prop=pageimages|langlinks)",
    "https://commons.wikimedia.org/w/api.php (action=query, prop=imageinfo, iiprop=extmetadata|url)",
  ],
  retrieved_at: new Date().toISOString(),
  storage_note:
    "The response is a binary image, so provenance cannot live inside the stored "
    + "bytes. Each entry below records the two API URLs, the resolved Commons file, "
    + "the licence and author as published, and the SHA-256 of the file written "
    + "into assets/images/species/. This is a deliberate deviation from "
    + "raw-response-only storage, for the same reason as the elevation manifests.",
  licence_policy: {
    allowed: ALLOWED_LICENCES.map((pattern) => pattern.source),
    note:
      "A file whose licence short name does not match the allowlist is refused and "
      + "recorded as refused. Refused species ship without a photograph rather than "
      + "with an unlicensed one.",
  },
  thumbnail_width_px: THUMB_WIDTH,
  entries: [],
};

for (const species of WANTED) {
  const title = species.wikipedia.en;
  const article = await query("en.wikipedia.org", {
    action: "query",
    titles: title,
    prop: "pageimages|langlinks",
    piprop: "original|name",
    lllang: "fa",
    redirects: "1",
  });
  const page = article.body?.query?.pages?.[0];
  if (!page || page.missing) {
    throw new Error(`${species.id}: no English Wikipedia article for "${title}"`);
  }
  const entry = {
    species_id: species.id,
    latin: species.latin,
    requested_title: title,
    resolved_title: page.title,
    article_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    persian_title: page.langlinks?.[0]?.title ?? null,
    persian_article_url: page.langlinks?.[0]
      ? `https://fa.wikipedia.org/wiki/${encodeURIComponent(page.langlinks[0].title.replace(/ /g, "_"))}`
      : null,
    article_query_url: article.url,
    file: page.pageimage ? `File:${page.pageimage}` : null,
  };

  if (!entry.file) {
    entry.status = "no-lead-image";
    manifest.entries.push(entry);
    console.log(`${species.id}: article has no lead image`);
    continue;
  }

  const info = await query("commons.wikimedia.org", {
    action: "query",
    titles: entry.file,
    prop: "imageinfo",
    iiprop: "extmetadata|url|size|mime",
    iiurlwidth: String(THUMB_WIDTH),
  });
  entry.file_query_url = info.url;
  const imageInfo = info.body?.query?.pages?.[0]?.imageinfo?.[0];
  if (!imageInfo) {
    entry.status = "no-file-metadata";
    manifest.entries.push(entry);
    console.log(`${species.id}: no Commons metadata for ${entry.file}`);
    continue;
  }
  const meta = imageInfo.extmetadata ?? {};
  entry.licence = text(meta.LicenseShortName?.value) || null;
  entry.licence_url = meta.LicenseUrl?.value ?? null;
  entry.author = text(meta.Artist?.value) || text(meta.Credit?.value) || null;
  entry.description_page = imageInfo.descriptionurl ?? null;
  entry.mime = imageInfo.mime ?? null;

  const allowed = entry.licence
    && ALLOWED_LICENCES.some((pattern) => pattern.test(entry.licence));
  if (!allowed) {
    entry.status = "refused-licence";
    manifest.entries.push(entry);
    console.log(`${species.id}: REFUSED licence "${entry.licence}"`);
    continue;
  }
  // Attribution by name is a condition of CC BY, CC BY-SA and GFDL, so a file
  // under one of those with no author recorded cannot be used — there is nothing
  // to render. Public domain and CC0 impose no such condition and pass without.
  const needsAuthor = /^(cc\s?by|gfdl)/i.test(entry.licence);
  if (needsAuthor && !entry.author) {
    entry.status = "refused-no-author";
    manifest.entries.push(entry);
    console.log(`${species.id}: REFUSED, licence ${entry.licence} with no named author`);
    continue;
  }

  const download = imageInfo.thumburl ?? imageInfo.url;
  // The thumbnail host rate-limits a burst harder than the API does, and it
  // answers 429 rather than queueing, so the wait has to grow.
  const bytes = await (async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetch(download, { headers: { "User-Agent": USER_AGENT } });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (response.status !== 429 || attempt === 5) {
        throw new Error(`${species.id}: ${download} → ${response.status}`);
      }
      const wait = 20000 * attempt;
      console.log(`${species.id}: rate limited, waiting ${wait / 1000}s`);
      await new Promise((resolve) => { setTimeout(resolve, wait); });
    }
    throw new Error(`${species.id}: exhausted retries`);
  })();
  const extension = (entry.mime === "image/png" && ".png")
    || (entry.mime === "image/svg+xml" && ".svg")
    || ".jpg";
  const filename = `${species.id}${extension}`;
  await fs.writeFile(path.join(imageDir, filename), bytes);

  entry.status = "bundled";
  entry.download_url = download;
  entry.thumbnail_width_px = imageInfo.thumbwidth ?? null;
  entry.thumbnail_height_px = imageInfo.thumbheight ?? null;
  entry.bundled_as = `assets/images/species/${filename}`;
  entry.bytes = bytes.length;
  entry.sha256 = createHash("sha256").update(bytes).digest("hex");
  manifest.entries.push(entry);
  console.log(
    `${species.id}: ${filename} ${(bytes.length / 1024).toFixed(0)} kB · ${entry.licence}`,
  );

  await new Promise((resolve) => { setTimeout(resolve, 3000); });
}

const bundled = manifest.entries.filter((entry) => entry.status === "bundled").length;
await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(
  `\n${bundled}/${WANTED.length} photographs bundled. `
  + `Wrote ${path.basename(manifestFile)}. Run: node scripts/generate-data.mjs`,
);
