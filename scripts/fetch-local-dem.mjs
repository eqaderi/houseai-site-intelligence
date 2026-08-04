/**
 * Local hillside sampling. REQUIRES INTERNET. Overwrites its own raw manifest.
 *
 * Separate from fetch-horizon-dem.mjs, which samples a 27 km polar ring for
 * skyline angles. This one samples the single landform the parcel sits on: a
 * square grid, 800 m across at 40 m spacing, centred on the site. That box was
 * chosen from the ring data already on disk — ground tops out about 10 m above
 * the parcel's road edge some 150–330 m to the south, and drops roughly 40 m
 * into the valley about 100–150 m to the north, so the whole flank the survey
 * sits on fits inside ±400 m.
 *
 * A regular grid rather than more polar rings: the grid has no convergence
 * seams at the centre and no hole around the origin, which is what the polar
 * sampling produced at this scale.
 *
 * 40 m spacing does NOT add detail to a 90 m DEM. One GLO-90 cell is wider than
 * the whole 25 m parcel, so the extra points are interpolation between the same
 * cells — they buy a smooth surface, not a better-resolved one. That is stated
 * in the published data, not just here.
 *
 * The raw file is a REQUEST MANIFEST, not the bare response, for the same
 * reason as the horizon ring: the elevation endpoint answers with a bare
 * {"elevation":[…]} and echoes no coordinates, so a stored response alone
 * destroys the mapping between elevation and place.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.resolve(scriptDir, "../assets/data/environmental/raw");
const outputFile = path.join(rawDir, "openmeteo-elevation-local-grid.json");

const site = { latitude: 34.97131638, longitude: 46.35559359 };
// Same figure as fetch-horizon-dem.mjs and haversineKm in environmental-data.mjs.
const EARTH_RADIUS_M = 6371008.8;
const HALF_EXTENT_M = 400;
const SPACING_M = 40;
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

/** Grid offsets are metres east and north of the site; convert via bearing. */
function offsetPoint(eastM, northM) {
  const distance = Math.hypot(eastM, northM);
  if (distance === 0) return { ...site };
  const azimuth = (Math.atan2(eastM, northM) * 180 / Math.PI + 360) % 360;
  return destination(azimuth, distance);
}

const axis = [];
for (let offset = -HALF_EXTENT_M; offset <= HALF_EXTENT_M; offset += SPACING_M) {
  axis.push(offset);
}

const requested = [];
// Row-major, north to south, so the stored order matches the grid the
// generator rebuilds. east_m / north_m are survey-frame metres from the site.
for (const north of [...axis].reverse()) {
  for (const east of axis) {
    requested.push({ east_m: east, north_m: north, ...offsetPoint(east, north) });
  }
}

const batches = [];
for (let start = 0; start < requested.length; start += BATCH_SIZE) {
  batches.push(requested.slice(start, start + BATCH_SIZE));
}

console.log(
  `${axis.length}×${axis.length} = ${requested.length} coordinates `
  + `(${HALF_EXTENT_M * 2} m box at ${SPACING_M} m) in ${batches.length} requests`,
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
    half_extent_m: HALF_EXTENT_M,
    spacing_m: SPACING_M,
    axis_m: axis,
    order: "row-major, north row first, west to east within a row",
    earth_radius_m: EARTH_RADIUS_M,
    point_count: requested.length,
    resolution_note:
      "The underlying DEM cell is 90 m. Sampling it at 40 m interpolates between "
      + "the same cells; it produces a smooth surface, not additional detail.",
  },
  batches: [],
};

await fs.mkdir(rawDir, { recursive: true });

for (const [index, batch] of batches.entries()) {
  const url = "https://api.open-meteo.com/v1/elevation"
    + `?latitude=${batch.map((point) => point.latitude).join(",")}`
    + `&longitude=${batch.map((point) => point.longitude).join(",")}`;
  // Same rate-limit handling as the horizon ring: a burst of requests to the
  // public endpoint comes back 429.
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
