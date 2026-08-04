/**
 * Terrain horizon derived from the sampled DEM ring, and what it does to the
 * precomputed solar day.
 *
 * This replaces the dashboard's previous "flat astronomical horizon" assumption
 * with a measured one — but only where the DEM can actually see. A Copernicus
 * GLO-90 cell is about 90 m across, wider than the entire 25 m-wide parcel, so
 * the near field is published separately and is never presented as if it
 * resolved the site's own 34.5–44% self-shading.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { solarPosition } from "./solar-math.mjs";

const bi = (en, fa) => ({ en, fa });
const round = (value, digits = 2) => Number(value.toFixed(digits));

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(
  scriptDir,
  "../assets/data/environmental/raw/openmeteo-elevation-horizon-ring.json",
);

// Standard terrestrial refraction coefficient. Light bends toward the earth, so
// a distant ridge appears higher than pure geometry places it; the usual
// treatment is an effective radius rather than a per-ray correction.
const REFRACTION_COEFFICIENT = 0.13;
// Below this the DEM cell is wider than the feature it would have to resolve.
const NEAR_FIELD_LIMIT_M = 500;

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const points = manifest.batches.flatMap((batch) => batch.requested.map((point, index) => ({
    ...point,
    elevation_m: batch.response.elevation[index],
  })));
  const observer = points.find((point) => point.role === "observer");
  if (!observer) throw new Error("horizon: the manifest has no observer point");
  return { manifest, points: points.filter((point) => point.role === "ring"), observer };
}

/**
 * Elevation angle of one sampled point above the observer, with earth curvature
 * and refraction folded into an effective radius. The sign is kept: a downslope
 * horizon is legitimately negative, and clamping it at zero would quietly
 * reinstate the flat-horizon assumption on the side of the site that falls away.
 */
function elevationAngle(deltaZ, distanceM, effectiveRadiusM) {
  const drop = (distanceM * distanceM) / (2 * effectiveRadiusM);
  return Math.atan2(deltaZ - drop, distanceM) * 180 / Math.PI;
}

function profileFor(points, observerZ, effectiveRadius, predicate) {
  const byAzimuth = new Map();
  for (const point of points) {
    if (!predicate(point.radius_m)) continue;
    const angle = elevationAngle(point.elevation_m - observerZ, point.radius_m, effectiveRadius);
    const current = byAzimuth.get(point.azimuth_deg);
    if (!current || angle > current.horizon_deg) {
      byAzimuth.set(point.azimuth_deg, {
        azimuth_deg: point.azimuth_deg,
        horizon_deg: round(angle, 2),
        // Lets a reader tell a real ridge from one noisy near cell.
        controlling_distance_m: point.radius_m,
        controlling_elevation_m: point.elevation_m,
      });
    }
  }
  return [...byAzimuth.values()].sort((a, b) => a.azimuth_deg - b.azimuth_deg);
}

/** Linear interpolation around the ring, which wraps at 360°. */
function horizonAt(profile, azimuthDeg) {
  if (!profile.length) return 0;
  const step = 360 / profile.length;
  const wrapped = ((azimuthDeg % 360) + 360) % 360;
  const lower = Math.floor(wrapped / step) % profile.length;
  const upper = (lower + 1) % profile.length;
  const fraction = (wrapped - lower * step) / step;
  return profile[lower].horizon_deg
    + fraction * (profile[upper].horizon_deg - profile[lower].horizon_deg);
}

/**
 * Where the sun clears and re-meets the terrain on a given day. Never called
 * sunrise or sunset: those are astronomical, already published, and unchanged.
 */
function dayAccess(profile, positions) {
  const annotated = positions.map((position) => {
    const horizon = round(horizonAt(profile, position.azimuth_deg), 2);
    return {
      ...position,
      horizon_deg: horizon,
      above_horizon: position.altitude_deg > horizon,
    };
  });
  const lit = annotated.filter((position) => position.above_horizon);
  const intervals = [];
  let open = null;
  for (const position of annotated) {
    if (!position.above_horizon && open === null) open = position.clock_hour;
    if (position.above_horizon && open !== null) {
      intervals.push({ from_hour: open, to_hour: position.clock_hour });
      open = null;
    }
  }
  if (open !== null) {
    intervals.push({ from_hour: open, to_hour: annotated[annotated.length - 1].clock_hour });
  }
  const step = annotated.length > 1
    ? annotated[1].clock_hour - annotated[0].clock_hour
    : 0;
  return {
    positions: annotated,
    effective_first_sun: lit.length ? lit[0].clock_hour : null,
    effective_last_sun: lit.length ? lit[lit.length - 1].clock_hour : null,
    solar_access_hours: round(lit.length * step, 2),
    terrain_shaded_hours: round((annotated.length - lit.length) * step, 2),
    shaded_intervals: intervals,
  };
}

export function buildHorizon(site, solar) {
  const { manifest, points, observer } = readManifest();
  const effectiveRadius = manifest.sampling.earth_radius_m / (1 - REFRACTION_COEFFICIENT);
  const observerZ = observer.elevation_m;

  const farField = profileFor(
    points,
    observerZ,
    effectiveRadius,
    (radius) => radius > NEAR_FIELD_LIMIT_M,
  );
  const nearField = profileFor(
    points,
    observerZ,
    effectiveRadius,
    (radius) => radius <= NEAR_FIELD_LIMIT_M,
  );
  const combined = profileFor(points, observerZ, effectiveRadius, () => true);

  const seasons = solar.seasons.map((season) => ({
    id: season.id,
    label: season.label,
    date: season.date,
    // Astronomical, unchanged, and republished here only so the contrast with
    // the effective figures is visible in one place.
    astronomical_sunrise: season.sunrise,
    astronomical_sunset: season.sunset,
    ...dayAccess(combined, season.positions),
  }));

  return {
    availability: "available-derived",
    confidence: "regional-data",
    dataset: "Copernicus GLO-90 via the Open-Meteo Elevation API",
    method:
      "72 azimuths at 5° spacing, 15 geometric radii from 100 m to 27 km. "
      + "Elevation angles use an effective earth radius of R/(1 − 0.13) for "
      + "curvature and standard refraction; the maximum angle along each azimuth "
      + "is the horizon.",
    observer: {
      // Mixing datums biases near-field angles worst where sensitivity is
      // highest, so both elevations and their difference are published rather
      // than one being silently substituted for the other.
      dem_elevation_m: observerZ,
      survey_elevation_min_m: site.elevation.min_m,
      survey_elevation_max_m: site.elevation.max_m,
      dem_minus_survey_min_m: round(observerZ - site.elevation.min_m, 3),
      note: bi(
        "Angles are measured from the DEM's own value at the site, not from the surveyed elevations. The two datums differ, and that difference is stated here rather than resolved.",
        "زاویه‌ها از مقدار خود مدل رقومی ارتفاع در سایت اندازه‌گیری شده‌اند، نه از ترازهای برداشت‌شده. این دو مبنا اختلاف دارند و این اختلاف اینجا بیان شده، نه برطرف.",
      ),
    },
    resolution: {
      dem_cell_m: 90,
      parcel_width_m: 25,
      near_field_limit_m: NEAR_FIELD_LIMIT_M,
      note: bi(
        "One DEM cell is wider than the whole parcel, so this cannot see the site's own 34.5–44% self-shading. The near field is published separately and is a preliminary inference, not a measurement of the site.",
        "یک سلول مدل رقومی از کل قطعه پهن‌تر است؛ بنابراین خودسایه‌اندازی ۳۴٫۵ تا ۴۴ درصدی خود سایت را نمی‌بیند. میدان نزدیک جداگانه منتشر شده و استنباط اولیه است، نه اندازه‌گیری سایت.",
      ),
    },
    far_field: { status: "regional-data", from_m: NEAR_FIELD_LIMIT_M, profile: farField },
    near_field: {
      status: "preliminary-inference",
      from_m: 100,
      to_m: NEAR_FIELD_LIMIT_M,
      profile: nearField,
    },
    combined: { status: "preliminary-inference", profile: combined },
    seasons,
    warning: bi(
      "Terrain horizon only. Neighbouring buildings, walls and vegetation are not modelled, and the DEM cannot resolve the parcel's own slope.",
      "فقط افق زمین. ساختمان‌های مجاور، دیوارها و پوشش گیاهی مدل نشده‌اند و مدل رقومی شیب خود قطعه را تفکیک نمی‌کند.",
    ),
  };
}

/** Re-exported for the validator, which re-derives one angle independently. */
export const horizonInternals = {
  REFRACTION_COEFFICIENT,
  NEAR_FIELD_LIMIT_M,
  elevationAngle,
  horizonAt,
  readManifest,
  solarPosition,
};
