/**
 * The hillside the parcel sits on: the surveyed slope carried outwards, easing
 * into the local DEM further out.
 *
 * This is deliberately small. The surveyed field is one bench on a single
 * flank: ground tops out a short way south, past the road edge, and falls into
 * a valley floor a short way north. The published surface stops just past both,
 * so the layer answers "what is this field standing on" and nothing wider.
 *
 * The near field is NOT the DEM. A least-squares plane through all eight
 * surveyed points fits to within ±0.45 m and gives 38.27% at azimuth 41.7°,
 * which is the survey's own certified "steepest descent toward the northeast".
 * That plane is what the hillside runs at where it meets the parcel, so the two
 * surfaces are continuous and the field is part of the slope rather than a patch
 * inset into a gentler one. A smoothed 90 m DEM reads about 17% here; one of its
 * cells is wider than the whole parcel, so it cannot resolve the grade the
 * surveyor measured. The DEM still supplies the shape further out — the crest
 * past the road, the valley floor below — and the two are blended, with the
 * blend distances published.
 *
 * Four transforms happen here, in this order, and each is published:
 *
 * 1. Smoothing. The elevation endpoint answers with the DEM cell value, not an
 *    interpolation, so a 40 m sampling of a 90 m raster comes back in blocks —
 *    the raw manifest has whole rows repeating. Two passes of a 3x3 binomial
 *    kernel turn that staircase back into a landform. It moves no ridge and
 *    invents no relief; it removes a sampling artefact.
 * 2. Clipping. Smoothing runs on the full sampled box and only then is the
 *    surface cut back to the published extent, so no edge of what you see was
 *    smoothed against a missing neighbour.
 * 3. Resampling. The drawn grid is a bilinear resample at a finer spacing. That
 *    buys a snug opening around the surveyed parcel — on the sampled spacing the
 *    smallest possible opening would be four times the width of the field — and
 *    a smooth surface. It adds no detail: one DEM cell is still wider than the
 *    whole parcel.
 *
 * 4. Blending. Inside `plane_only_m` of the site the surface is the fitted plane
 *    alone. From there to `blend_to_m` it eases to the DEM on a smoothstep. The
 *    near field is therefore surveyed slope, the far field is sampled landform,
 *    and neither is presented as the other.
 *
 * Elevations are published in metres above sea level on the survey's datum,
 * because the plane fit is. The DEM is brought onto that datum by one constant,
 * published in `datum` rather than folded in silently.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(
  scriptDir,
  "../assets/data/environmental/raw/openmeteo-elevation-local-grid.json",
);

// How far the drawn surface reaches from the site. 100 m square is about twenty
// times the 487.428568 m² parcel — enough ground to read the slope the field sits
// on, and no more. A wider surface at this DEM resolution buys landform nobody
// asked about.
const PUBLISHED_HALF_EXTENT_M = 50;
// 2.5 m: this surface has to meet a 25 m parcel without a facet crossing its
// boundary, and it has to resolve a 4 m road corridor carved into it. At 5 m the
// carriageway fell between nodes and the bench came out as fragments.
const DRAW_SPACING_M = 2.5;
const SMOOTHING_PASSES = 2;
// Out to here the surface is the surveyed plane alone, so the ground leaving the
// parcel keeps the grade the surveyor measured.
const PLANE_ONLY_M = 20;
// And by here it is the DEM alone.
const BLEND_TO_M = 50;
// The plane sits above four of the eight points by up to 0.31 m. Dropping the
// near-field surface by more than that keeps the surveyed TIN above it
// everywhere, so no facet of measured ground is ever buried by an inference.
const PLANE_DROP_M = 0.6;

const round = (value, places = 2) => Number(value.toFixed(places));

/** One 3x3 binomial pass, edges clamped to the nearest sampled row/column. */
function smoothOnce(grid) {
  const rows = grid.length;
  const columns = grid[0].length;
  const weights = [[1, 2, 1], [2, 4, 2], [1, 2, 1]];
  const output = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < columns; c += 1) {
      let total = 0;
      let weight = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = Math.min(rows - 1, Math.max(0, r + dr));
          const cc = Math.min(columns - 1, Math.max(0, c + dc));
          const w = weights[dr + 1][dc + 1];
          total += grid[rr][cc] * w;
          weight += w;
        }
      }
      row.push(total / weight);
    }
    output.push(row);
  }
  return output;
}

/** Bilinear sample of a regular grid indexed by the shared axis in metres. */
function sampleGrid(grid, axis, eastM, northM) {
  const spacing = axis[1] - axis[0];
  const first = axis[0];
  const last = axis[axis.length - 1];
  const east = Math.min(last, Math.max(first, eastM));
  const north = Math.min(last, Math.max(first, northM));
  const cx = (east - first) / spacing;
  // Rows run north-first, so a higher northing is a lower row index.
  const cy = (last - north) / spacing;
  const x0 = Math.min(axis.length - 2, Math.floor(cx));
  const y0 = Math.min(axis.length - 2, Math.floor(cy));
  const fx = cx - x0;
  const fy = cy - y0;
  const top = grid[y0][x0] * (1 - fx) + grid[y0][x0 + 1] * fx;
  const bottom = grid[y0 + 1][x0] * (1 - fx) + grid[y0 + 1][x0 + 1] * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Least-squares plane z = a + b·east + c·north through the surveyed points,
 * solved by Gaussian elimination on the 3x3 normal equations. Eight points for
 * three unknowns, so the residuals are a real goodness-of-fit statement and are
 * published alongside the coefficients.
 */
function fitPlane(samples) {
  let n = 0;
  let sumE = 0;
  let sumN = 0;
  let sumZ = 0;
  let sumEE = 0;
  let sumNN = 0;
  let sumEN = 0;
  let sumEZ = 0;
  let sumNZ = 0;
  for (const [east, north, z] of samples) {
    n += 1;
    sumE += east;
    sumN += north;
    sumZ += z;
    sumEE += east * east;
    sumNN += north * north;
    sumEN += east * north;
    sumEZ += east * z;
    sumNZ += north * z;
  }
  const matrix = [
    [n, sumE, sumN, sumZ],
    [sumE, sumEE, sumEN, sumEZ],
    [sumN, sumEN, sumNN, sumNZ],
  ];
  for (let i = 0; i < 3; i += 1) {
    let pivot = i;
    for (let j = i + 1; j < 3; j += 1) {
      if (Math.abs(matrix[j][i]) > Math.abs(matrix[pivot][i])) pivot = j;
    }
    [matrix[i], matrix[pivot]] = [matrix[pivot], matrix[i]];
    for (let j = 0; j < 3; j += 1) {
      if (j === i) continue;
      const factor = matrix[j][i] / matrix[i][i];
      for (let k = i; k < 4; k += 1) matrix[j][k] -= factor * matrix[i][k];
    }
  }
  return matrix.map((row, i) => row[3] / matrix[i][i]);
}

/** Ray casting, on coordinates already relative to the grid origin. */
function insidePolygon(polygon, eastM, northM) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > northM) !== (yj > northM)
      && eastM < ((xj - xi) * (northM - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Smoothstep, so the join carries no visible crease in either direction. */
function ease(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * @param {object} site   Site block, for the boundary ring and the aspect note.
 * @param {Array}  points All eight survey points, including the interior hub.
 * @param {object} roads  Published road benches, carved into the surface.
 * @returns {object|null} null when the manifest has not been fetched.
 */
export function buildLocalTerrain(site, points, roads) {
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const sampledAxis = manifest.sampling.axis_m;
  const spacing = manifest.sampling.spacing_m;

  const values = new Map();
  for (const batch of manifest.batches) {
    batch.requested.forEach((point, index) => {
      values.set(`${point.east_m}|${point.north_m}`, batch.response.elevation[index]);
    });
  }
  const northFirst = [...sampledAxis].reverse();
  const sampled = northFirst.map((north) =>
    sampledAxis.map((east) => {
      const value = values.get(`${east}|${north}`);
      if (typeof value !== "number") throw new Error(`missing sample ${east},${north}`);
      return value;
    }));

  let smoothed = sampled;
  for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) smoothed = smoothOnce(smoothed);

  // The grid was fetched about the site's published coordinate, which is Pt8.
  const origin = points.find((point) => point.id === "Pt8");
  const [planeZ0, planeE, planeN] = fitPlane(points.map((point) => [
    point.x_m - origin.x_m,
    point.y_m - origin.y_m,
    point.elevation_m,
  ]));
  const plane = (eastM, northM) => planeZ0 + planeE * eastM + planeN * northM;
  const residuals = points.map((point) => round(
    plane(point.x_m - origin.x_m, point.y_m - origin.y_m) - point.elevation_m,
    3,
  ));

  // The DEM's own value at the site, and the constant that brings the sampled
  // surface onto the survey's datum. Measured against the smoothed surface, not
  // the raw cell: smoothing moves the site's own node, and matching the raw value
  // would leave the far field a dozen metres off.
  const demAtSite = round(sampleGrid(sampled, sampledAxis, 0, 0), 2);
  const drawnAtSite = round(sampleGrid(smoothed, sampledAxis, 0, 0), 2);
  const datumOffset = round(plane(0, 0) - drawnAtSite, 3);

  const drawAxis = [];
  for (let offset = -PUBLISHED_HALF_EXTENT_M; offset <= PUBLISHED_HALF_EXTENT_M;
    offset += DRAW_SPACING_M) {
    drawAxis.push(offset);
  }
  const drawRows = [...drawAxis].reverse();

  // Surveyed plane near the parcel, sampled DEM further out, eased between. The
  // near field is dropped by a constant so the measured TIN is never buried by
  // the inference underneath it; the drop eases out with the same weight.
  const blend = (eastM, northM) => {
    const distance = Math.hypot(eastM, northM);
    const weight = ease((distance - PLANE_ONLY_M) / (BLEND_TO_M - PLANE_ONLY_M));
    const surveyed = plane(eastM, northM) - PLANE_DROP_M * (1 - weight);
    const sampledZ = sampleGrid(smoothed, sampledAxis, eastM, northM) + datumOffset;
    return surveyed + weight * (sampledZ - surveyed);
  };
  // Roads are cut into the hill, not laid over it: a level bench on a 38% slope
  // is buried on its uphill side unless the ground is actually taken away. The
  // carriageway corridor is flattened to the road's published level and a batter
  // runs out from each edge until it meets natural ground. This is geometry for
  // the drawing — no earthwork quantity is derived from it, and an eight-point TIN
  // could not support one.
  const benches = (roads?.roads || []).map((road) => {
    const [from, to] = road.centreline;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return {
      from,
      to,
      length,
      ux: (to[0] - from[0]) / length,
      uy: (to[1] - from[1]) / length,
      half: road.width_m / 2,
      level: road.level_elevation_m,
      batter: road.batter_ratio ?? 1.2,
      limit: road.max_cut_or_fill_drawn_m ?? 6,
    };
  });
  const ring = site.outer_boundary_points
    .map((point) => [point.x_m - origin.x_m, point.y_m - origin.y_m]);
  const carve = (eastM, northM, naturalZ) => {
    // Never inside the parcel. A bench's downhill batter is an embankment, and an
    // embankment laid across surveyed ground would be this drawing inventing fill
    // on the one part of the site that was measured.
    if (insidePolygon(ring, eastM, northM)) return naturalZ;
    let z = naturalZ;
    for (const bench of benches) {
      const alongDistance = (eastM - bench.from[0]) * bench.ux
        + (northM - bench.from[1]) * bench.uy;
      if (alongDistance < 0 || alongDistance > bench.length) continue;
      const perpendicular = Math.abs(
        (eastM - bench.from[0]) * -bench.uy + (northM - bench.from[1]) * bench.ux,
      );
      const drop = bench.level - z;
      if (Math.abs(drop) > bench.limit) continue;
      const outside = Math.max(0, perpendicular - bench.half);
      // Within the carriageway the ground is the road level; outside it, the
      // batter climbs or falls at the published ratio until natural ground wins.
      const reach = Math.sign(drop) * Math.min(Math.abs(drop), outside / bench.batter);
      const carved = bench.level - reach;
      // Cut wins over fill where two benches overlap: taking ground away can
      // never be undone by another strip putting it back.
      z = drop < 0 ? Math.min(z, carved) : carved;
    }
    return z;
  };
  const elevations = drawRows.map((north) =>
    drawAxis.map((east) => round(carve(east, north, blend(east, north)), 2)));

  const flat = elevations.flat();
  const sorted = [...flat].sort((a, b) => a - b);
  const percentile = (fraction) => sorted[Math.round(fraction * (sorted.length - 1))];

  // Crest and floor inside the published box, reported with where they are, so
  // the caption can say what the viewer is looking at.
  let crest = null;
  let floor = null;
  drawRows.forEach((north, r) => {
    drawAxis.forEach((east, c) => {
      const entry = { east_m: east, north_m: north, elevation_m: elevations[r][c] };
      if (!crest || entry.elevation_m > crest.elevation_m) crest = entry;
      if (!floor || entry.elevation_m < floor.elevation_m) floor = entry;
    });
  });
  const bearing = (point) => round((Math.atan2(point.east_m, point.north_m) * 180 / Math.PI + 360) % 360, 1);
  const describe = (point) => ({
    ...point,
    distance_m: round(Math.hypot(point.east_m, point.north_m), 1),
    bearing_deg: bearing(point),
  });

  // Steepest descent at the site, from the smoothed grid. Published beside the
  // surveyed aspect rather than reconciled with it: a 90 m cell straddles the
  // whole parcel, so a disagreement of a few tens of degrees is the resolution
  // limit showing, not a correction to the survey.
  const step = DRAW_SPACING_M;
  const dzdE = (sampleGrid(smoothed, sampledAxis, step, 0)
    - sampleGrid(smoothed, sampledAxis, -step, 0)) / (2 * step);
  const dzdN = (sampleGrid(smoothed, sampledAxis, 0, step)
    - sampleGrid(smoothed, sampledAxis, 0, -step)) / (2 * step);
  const demAspect = round((Math.atan2(-dzdE, -dzdN) * 180 / Math.PI + 360) % 360, 1);

  return {
    status: "surveyed-slope-extended-into-regional-dem",
    dataset: manifest.source,
    retrieved_at: manifest.retrieved_at,
    cell_m: 90,
    sampled_spacing_m: spacing,
    sampled_half_extent_m: manifest.sampling.half_extent_m,
    published_half_extent_m: PUBLISHED_HALF_EXTENT_M,
    grid_spacing_m: DRAW_SPACING_M,
    origin: {
      point_id: origin.id,
      x_m: origin.x_m,
      y_m: origin.y_m,
      latitude: origin.latitude,
      longitude: origin.longitude,
    },
    axis_m: drawAxis,
    row_order: "north first",
    // Metres above sea level on the survey's datum, blended per `blend` below.
    elevations_m: elevations,
    smoothing: {
      kernel: "3x3 binomial",
      passes: SMOOTHING_PASSES,
      note: {
        en: "The elevation endpoint returns the DEM cell value rather than an interpolation, so sampling a 90 m raster at 40 m comes back as flat blocks. Two binomial passes remove that staircase. No ridge moves and no relief is added.",
        fa: "سرویس ارتفاع مقدار خودِ سلول مدل رقومی را برمی‌گرداند، نه درون‌یابی؛ پس نمونه‌برداری ۴۰ متری از شبکه ۹۰ متری به‌صورت پله‌های تخت بازمی‌گردد. دو گذر هموارسازی دوجمله‌ای این پله‌ها را برمی‌دارد. هیچ یالی جابه‌جا و هیچ برجستگی افزوده نمی‌شود.",
      },
    },
    // The surveyed slope, measured rather than assumed: eight points, three
    // unknowns, and the residuals are published so the fit can be judged.
    surveyed_plane: {
      form: "z = intercept_m + east_per_m·east_m + north_per_m·north_m",
      intercept_m: round(planeZ0, 4),
      east_per_m: round(planeE, 6),
      north_per_m: round(planeN, 6),
      slope_percent: round(Math.hypot(planeE, planeN) * 100, 2),
      downslope_azimuth_deg: round(
        (Math.atan2(-planeE, -planeN) * 180 / Math.PI + 360) % 360, 1,
      ),
      residuals_m: residuals,
      residual_range_m: [Math.min(...residuals), Math.max(...residuals)],
      note: {
        en: "A least-squares plane through all eight surveyed points, fitting to within 0.45 m. Its 38.27% grade toward azimuth 41.7° is the survey's own certified steepest descent toward the northeast, and it is what the hillside runs at where it meets the parcel. Carrying it outwards is inference, but the slope itself is measured.",
        fa: "صفحه‌ای به روش کمترین مربعات از میان هر هشت نقطهٔ برداشت‌شده، با برازش بهتر از ۰٫۴۵ متر. شیب ۳۸٫۲۷ درصدی آن به سمت آزیموت ۴۱٫۷ درجه همان تندترین نزول تأییدشدهٔ نقشه‌برداری به سوی شمال‌شرق است و دامنه در محل تماس با قطعه با همین شیب پیش می‌رود. امتداد دادن آن به بیرون استنباط است، اما خودِ شیب اندازه‌گیری شده است.",
      },
    },
    roads_carved: benches.length,
    blend: {
      plane_only_m: PLANE_ONLY_M,
      blend_to_m: BLEND_TO_M,
      easing: "smoothstep",
      plane_drop_m: PLANE_DROP_M,
      note: {
        en: "Out to 20 m the surface is the surveyed plane alone, so ground leaving the parcel keeps the measured grade and the two surfaces are continuous. From 20 m to 50 m it eases to the DEM, which supplies the crest and the valley floor. The near field is dropped 0.6 m — more than the plane's largest positive residual — so no facet of measured ground is ever buried by the inference beneath it.",
        fa: "تا ۲۰ متر سطح تنها همان صفحهٔ برداشت‌شده است، پس زمینی که از قطعه بیرون می‌رود شیب اندازه‌گیری‌شده را نگه می‌دارد و دو سطح پیوسته‌اند. از ۲۰ تا ۵۰ متر به‌آرامی به مدل رقومی می‌رسد که تاج و کف دره را می‌دهد. میدان نزدیک ۰٫۶ متر پایین آورده شده — بیش از بزرگ‌ترین باقی‌ماندهٔ مثبت صفحه — تا هیچ سطحی از زمین اندازه‌گیری‌شده زیر استنباطِ پایین آن پنهان نشود.",
      },
    },
    datum: {
      dem_elevation_at_site_m: demAtSite,
      smoothed_dem_at_site_m: drawnAtSite,
      matched_point: origin.id,
      survey_elevation_m: origin.elevation_m,
      offset_m: datumOffset,
      note: {
        en: "The DEM and the survey do not share a datum. This one constant brings the sampled surface onto the survey's, matched at the site so the blend has nothing to step over. A constant shift changes no relative relief, and the amount is stated here rather than hidden.",
        fa: "مدل رقومی و برداشت مبنای مشترک ندارند. همین یک مقدار ثابت سطح نمونه‌برداری‌شده را روی مبنای برداشت می‌آورد و در سایت منطبق می‌شود تا آمیختن پله‌ای برای عبور نداشته باشد. جابه‌جایی ثابت هیچ اختلاف ارتفاع نسبی را تغییر نمی‌دهد و مقدارش اینجا بیان شده، نه پنهان.",
      },
    },
    min_elevation_m: round(Math.min(...flat), 2),
    max_elevation_m: round(Math.max(...flat), 2),
    ramp_low_m: round(percentile(0.02), 2),
    ramp_high_m: round(percentile(0.98), 2),
    crest: describe(crest),
    valley_floor: describe(floor),
    aspect: {
      dem_downslope_deg: demAspect,
      survey_downslope: site.terrain_direction ?? null,
      note: {
        en: "The DEM's downslope direction at the site and the surveyed steepest descent are stated separately. One DEM cell is wider than the whole parcel, so the two are not measuring the same thing and the difference is left standing.",
        fa: "جهت شیب پایین‌رونده مدل رقومی در سایت و تندترین نزول برداشت‌شده جداگانه بیان شده‌اند. یک سلول مدل رقومی از کل قطعه پهن‌تر است، پس این دو یک چیز را اندازه نمی‌گیرند و اختلافشان باقی گذاشته شده.",
      },
    },
    note: {
      en: "The hillside the field sits on, drawn out to 50 m: the surveyed 38.27% slope carried outwards near the parcel, easing into a 90 m DEM further out. It is continuous with the surveyed ground, and it is still context rather than survey — it casts no shadow, receives none, and takes no part in the solar study.",
      fa: "دامنه‌ای که زمین روی آن قرار دارد، ترسیم‌شده تا ۵۰ متر: شیب برداشت‌شدهٔ ۳۸٫۲۷ درصدی در نزدیکی قطعه به بیرون امتداد یافته و دورتر به‌آرامی به مدل رقومی ۹۰ متری می‌رسد. با زمین برداشت‌شده پیوسته است و همچنان زمینه است نه برداشت — سایه نمی‌اندازد، سایه نمی‌پذیرد و در مطالعهٔ خورشیدی شرکت نمی‌کند.",
    },
  };
}
