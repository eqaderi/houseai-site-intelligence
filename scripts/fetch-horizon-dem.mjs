/**
 * Terrain horizon sampling. REQUIRES INTERNET. Overwrites the raw manifest.
 *
 * Kept separate from fetch-environmental-data.mjs so a routine environmental
 * refresh cannot re-run this by accident, and so this one file documents the
 * whole sampling design in one place.
 *
 * Design: 72 azimuths every 5°, 15 geometric radii from 100 m to 27 km, giving
 * 1,080 points in 11 requests of at most 100 coordinates each.
 *
 * The raw file is a REQUEST MANIFEST, not the bare response. This is a
 * deliberate, stated deviation from this project's usual "store the response
 * exactly as returned" rule: the Open-Meteo elevation endpoint answers with a
 * bare {"elevation":[…]} and echoes none of the requested coordinates, so a
 * stored response on its own destroys the mapping between elevation and place
 * and cannot be re-derived. Each batch is therefore wrapped with the URL and the
 * ordered list of coordinates that produced it, and the response is stored
 * verbatim inside that wrapper.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.resolve(scriptDir, "../assets/data/environmental/raw");
const outputFile = path.join(rawDir, "openmeteo-elevation-horizon-ring.json");

const site = { latitude: 34.97131638, longitude: 46.35559359 };
// Same figure as haversineKm in environmental-data.mjs, so distances computed
// here and there cannot disagree.
const EARTH_RADIUS_M = 6371008.8;
const AZIMUTH_STEP_DEG = 5;
const RADII_M = [
  100, 150, 220, 330, 480, 700, 1000, 1500,
  2200, 3300, 4800, 7000, 10000, 15000, 27000,
];
const BATCH_SIZE = 100;

/** Great-circle destination from the site, spherical earth. */
function destination(azimuthDeg, distanceM) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const toDegrees = (radians) => radians * 180 / Math.PI;
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = toRadians(azimuthDeg);
  const latitude = toRadians(site.latitude);
  const longitude = toRadians(site.longitude);
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angular)
      + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing),
  );
  const destinationLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude),
    Math.cos(angular) - Math.sin(latitude) * Math.sin(destinationLatitude),
  );
  return {
    latitude: Number(toDegrees(destinationLatitude).toFixed(7)),
    longitude: Number(toDegrees(destinationLongitude).toFixed(7)),
  };
}

const requested = [];
// The observer's own elevation must come from the DEM, not the survey: mixing
// datums biases near-field angles worst where sensitivity is highest.
requested.push({ azimuth_deg: null, radius_m: 0, role: "observer", ...site });
for (let azimuth = 0; azimuth < 360; azimuth += AZIMUTH_STEP_DEG) {
  for (const radius of RADII_M) {
    requested.push({
      azimuth_deg: azimuth,
      radius_m: radius,
      role: "ring",
      ...destination(azimuth, radius),
    });
  }
}

const batches = [];
for (let start = 0; start < requested.length; start += BATCH_SIZE) {
  batches.push(requested.slice(start, start + BATCH_SIZE));
}

console.log(
  `${requested.length} coordinates (1 observer + ${(360 / AZIMUTH_STEP_DEG) * RADII_M.length} ring) `
  + `in ${batches.length} requests`,
);

const manifest = {
  source: "Open-Meteo Elevation API (Copernicus GLO-90)",
  endpoint: "https://api.open-meteo.com/v1/elevation",
  retrieved_at: new Date().toISOString(),
  storage_note:
    "The endpoint returns a bare elevation array and echoes no coordinates, so "
    + "storing the response alone would destroy the mapping. Each batch below "
    + "records the URL and the ordered coordinates that produced its response, "
    + "with the response stored exactly as returned. This is a deliberate "
    + "deviation from raw-response-only storage.",
  sampling: {
    observer: site,
    azimuth_step_deg: AZIMUTH_STEP_DEG,
    azimuth_count: 360 / AZIMUTH_STEP_DEG,
    radii_m: RADII_M,
    earth_radius_m: EARTH_RADIUS_M,
    point_count: requested.length,
  },
  batches: [],
};

await fs.mkdir(rawDir, { recursive: true });

for (const [index, batch] of batches.entries()) {
  const url = "https://api.open-meteo.com/v1/elevation"
    + `?latitude=${batch.map((point) => point.latitude).join(",")}`
    + `&longitude=${batch.map((point) => point.longitude).join(",")}`;
  // The public endpoint rate-limits a burst of eleven requests: batch 7 came
  // back 429 on the first run. Space them out and retry with a growing wait.
  const body = await (async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetch(url, {
        headers: { "User-Agent": "HouseAI site analysis/1.0", Accept: "application/json" },
      });
      if (response.ok) return response.json();
      if (response.status !== 429 || attempt === 5) {
        throw new Error(`batch ${index + 1}: ${response.status} ${response.statusText}`);
      }
      const wait = 15000 * attempt;
      console.log(`batch ${index + 1}: rate limited, waiting ${wait / 1000}s`);
      await new Promise((resolve) => { setTimeout(resolve, wait); });
    }
    throw new Error(`batch ${index + 1}: exhausted retries`);
  })();
  if (!Array.isArray(body.elevation) || body.elevation.length !== batch.length) {
    throw new Error(
      `batch ${index + 1}: expected ${batch.length} elevations, got ${body.elevation?.length}`,
    );
  }
  manifest.batches.push({ url, requested: batch, response: body });
  console.log(`batch ${index + 1}/${batches.length}: ${body.elevation.length} elevations`);
  if (index < batches.length - 1) {
    await new Promise((resolve) => { setTimeout(resolve, 4000); });
  }
}

await fs.writeFile(outputFile, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`Wrote ${path.basename(outputFile)}. Run: node scripts/generate-data.mjs`);
