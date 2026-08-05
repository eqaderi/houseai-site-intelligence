/**
 * Plan area against surface area, and how much level ground either one buys.
 *
 * The verified 487.428568 m² is a **plan** area — a horizontal projection, which is
 * what a shoelace calculation on surveyed coordinates gives and what planning
 * coverage is measured in. The ground's own skin is larger, because it is tilted:
 * 522.4189 m², 7.18% more.
 *
 * That 7.18% is not extra buildable land, and this module exists mostly to say so.
 * A level platform cut into a slope occupies plan area: a 10 m by 10 m slab is
 * 100 m² of plan whatever the ground under it was doing beforehand. The surface
 * excess is real — it is more topsoil to strip, more area to drain, more retaining
 * to hold — but it never becomes floor.
 *
 * What actually limits a level platform here is depth. Every facet of this parcel
 * lies in the 33–50% band, so there is no gentle corner: cutting a level bench
 * costs vertical metres immediately. So the useful figure is not an area, it is a
 * pairing — for a chosen platform level, how much plan area sits within a given
 * depth of it.
 *
 * Method: the parcel is rasterised in plan at 0.25 m and each cell's elevation is
 * interpolated on the surveyed TIN. Cell count times cell area is compared against
 * the verified plan area and the difference is published as `raster_error_m2`, so
 * the discretisation is inspectable rather than assumed.
 *
 * Deliberately absent: cubic metres. Depths and areas are published; multiplying
 * them is an earthwork quantity, and `terrain-metrics.json` already records why an
 * eight-point TIN cannot support one.
 */

const CELL_M = 0.25;
const DEPTH_BANDS_M = [1, 1.5, 2, 3];
const LEVEL_STEP_M = 0.5;

const round = (value, places = 2) => Number(value.toFixed(places));

/** Barycentric interpolation on one triangle; null when the point is outside it. */
function heightIn(triangle, x, y) {
  const [a, b, c] = triangle;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (!denominator) return null;
  const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
  const wc = 1 - wa - wb;
  const tolerance = -1e-9;
  if (wa < tolerance || wb < tolerance || wc < tolerance) return null;
  return wa * a.z + wb * b.z + wc * c.z;
}

/**
 * @param {object} site      Site block, for the verified plan area and the ring.
 * @param {Array}  points    All eight survey points.
 * @param {Array}  triangles TIN facets as point-id triples.
 * @param {object} metrics   terrain-metrics.json, for the surface area already derived.
 */
export function buildPlatform(site, points, triangles, metrics) {
  const byId = new Map(points.map((point) => [point.id, point]));
  const facets = triangles
    .map((triangle) => triangle.points.map((id) => {
      const point = byId.get(id);
      return point && { x: point.x_m, y: point.y_m, z: point.elevation_m };
    }))
    .filter((triangle) => triangle.every(Boolean));
  if (!facets.length) return null;

  // The TIN covers the parcel exactly, so a cell is inside the parcel when some
  // facet contains it. No separate polygon test, and no chance of the two
  // disagreeing at the boundary.
  const sample = (x, y) => {
    for (const facet of facets) {
      const z = heightIn(facet, x, y);
      if (z !== null) return z;
    }
    return null;
  };

  const xs = points.map((point) => point.x_m);
  const ys = points.map((point) => point.y_m);
  const cells = [];
  for (let x = Math.min(...xs) + CELL_M / 2; x < Math.max(...xs); x += CELL_M) {
    for (let y = Math.min(...ys) + CELL_M / 2; y < Math.max(...ys); y += CELL_M) {
      const z = sample(x, y);
      if (z !== null) cells.push(z);
    }
  }
  const cellArea = CELL_M * CELL_M;
  const rasterArea = cells.length * cellArea;

  const minElevation = Math.min(...cells);
  const maxElevation = Math.max(...cells);
  // Area-weighted mean ground level. A platform here has equal mean cut and mean
  // fill depth, which is the closest thing to a balance point that can be stated
  // without multiplying depth by area.
  const balance = cells.reduce((total, z) => total + z, 0) / cells.length;

  const levels = [];
  const first = Math.ceil(minElevation / LEVEL_STEP_M) * LEVEL_STEP_M;
  for (let level = first; level <= maxElevation; level += LEVEL_STEP_M) {
    let cutArea = 0;
    let fillArea = 0;
    let maxCut = 0;
    let maxFill = 0;
    const withinBand = DEPTH_BANDS_M.map(() => 0);
    for (const ground of cells) {
      const difference = ground - level;
      if (difference > 0) {
        cutArea += cellArea;
        maxCut = Math.max(maxCut, difference);
      } else if (difference < 0) {
        fillArea += cellArea;
        maxFill = Math.max(maxFill, -difference);
      }
      DEPTH_BANDS_M.forEach((band, index) => {
        if (Math.abs(difference) <= band) withinBand[index] += cellArea;
      });
    }
    levels.push({
      level_m: round(level, 2),
      cut_area_m2: round(cutArea, 1),
      fill_area_m2: round(fillArea, 1),
      max_cut_depth_m: round(maxCut, 2),
      max_fill_depth_m: round(maxFill, 2),
      // How much plan area lies within each depth of this level — the honest
      // answer to "how big a level platform do I get here".
      area_within_depth_m2: Object.fromEntries(
        DEPTH_BANDS_M.map((band, index) => [band, round(withinBand[index], 1)]),
      ),
    });
  }

  const bestWithin = (band) => levels
    .reduce((best, entry) => (
      entry.area_within_depth_m2[band] > best.area_within_depth_m2[band] ? entry : best
    ), levels[0]);

  return {
    status: "preliminary-engineering-inference",
    design_use: {
      status: "exploratory-not-for-pricing",
      label: {
        en: "Exploratory terrain reading — not for quantities or pricing",
        fa: "خوانش اکتشافی زمین — نامناسب برای متره یا قیمت‌گذاری",
      },
      note: {
        en: "This eight-point, seven-facet TIN has no surveyed breaklines. Its one-metre contours, 0.5 m platform-level steps, areas rounded to 0.1 m², and cut/fill depths are exploratory sensitivity outputs only. They cannot establish construction levels, retaining geometry, earthwork quantities, tender quantities or price.",
        fa: "این مدل فقط هشت نقطه و هفت وجه دارد و شکست‌خط‌های واقعی زمین در آن نیست. خطوط تراز یک‌متری، گام ۰٫۵ متری سکو، مساحت‌های ۰٫۱ مترمربعی و عمق برداشت یا خاک‌ریزی فقط برای مقایسه اولیه‌اند. از این اعداد برای تعیین تراز ساخت، دیوار حائل، حجم خاک، متره یا قیمت استفاده نکنید.",
      },
    },
    plan_area_m2: site.verified_area_m2,
    surface_area_m2: metrics.surface_area_m2,
    surface_excess_m2: round(metrics.surface_area_m2 - site.verified_area_m2, 4),
    surface_excess_percent: round(
      (metrics.surface_area_m2 / site.verified_area_m2 - 1) * 100, 2,
    ),
    level_platform_area_basis: "plan",
    difference_note: {
      en: "The verified 487.428568 m² is a plan area — a horizontal projection, which is what planning coverage is measured in and what a level slab occupies. The ground's own tilted skin is 522.4189 m², 7.18% more. That excess is not extra buildable land: a level platform cut into a slope has plan area only. It is real in other ways — more topsoil to strip, more area to drain and to retain — but it never becomes floor.",
      fa: "مساحت ۴۸۷٫۴۲۸۵۶۸ مترمربع، مساحت افقی قطعه است؛ همان عددی که برای سطح اشغال استفاده می‌شود. سطح شیب‌دار زمین ۵۲۲٫۴۱۸۹ مترمربع است، یعنی ۷٫۱۸ درصد بیشتر. این تفاوت به معنی زمین قابل ساخت بیشتر نیست. فقط نشان می‌دهد سطح بیشتری برای خاک‌برداری سطحی، زهکشی و حفاظت وجود دارد.",
    },
    raster: {
      cell_m: CELL_M,
      cell_count: cells.length,
      area_m2: round(rasterArea, 3),
      raster_error_m2: round(rasterArea - site.verified_area_m2, 3),
      note: {
        en: "Areas below are counted on a 0.25 m plan raster whose elevations are interpolated on the surveyed TIN. The raster's own total is published against the verified plan area so the discretisation error is visible.",
        fa: "مساحت‌های زیر روی شبکه‌ای افقی با سلول ۰٫۲۵ متر شمرده شده‌اند که ترازهایش روی TIN برداشت‌شده درون‌یابی می‌شود. جمع خود شبکه در برابر مساحت افقی تأییدشده منتشر شده تا خطای گسسته‌سازی دیده شود.",
      },
    },
    ground_range_m: [round(minElevation, 3), round(maxElevation, 3)],
    balance_level_m: round(balance, 3),
    balance_note: {
      en: "The area-weighted mean ground level. A platform at this height has equal mean cut and mean fill depth. It is not a recommendation and it carries no volume: cut and fill quantities need a survey this TIN's eight points cannot stand in for.",
      fa: "این عدد، میانگین تراز زمین با در نظر گرفتن مساحت است. در این تراز، میانگین عمق برداشت و خاک‌ریزی برابر می‌شود. این تراز پیشنهادی نیست و حجم خاک را نشان نمی‌دهد. برای محاسبه حجم به نقشه‌برداری دقیق‌تری نیاز است.",
    },
    depth_bands_m: DEPTH_BANDS_M,
    level_step_m: LEVEL_STEP_M,
    published_area_precision_m2: 0.1,
    levels,
    best_level_for_band: Object.fromEntries(DEPTH_BANDS_M.map((band) => {
      const entry = bestWithin(band);
      return [band, { level_m: entry.level_m, area_m2: entry.area_within_depth_m2[band] }];
    })),
    limits: {
      en: "Every facet of this parcel is in the 33–50% slope band, so a level platform is a cut-and-fill decision at any position. These figures bound the depth involved; they are not a foundation design, a retaining design, or an earthwork estimate, and none of the three can be read out of them.",
      fa: "شیب همه وجه‌های مدل بین ۳۳ تا ۵۰ درصد است. هر سکوی تراز به برداشت و خاک‌ریزی نیاز دارد. جدول فقط اندازه تقریبی عمق‌ها را نشان می‌دهد؛ از آن نمی‌توان پی، دیوار حائل یا مقدار عملیات خاکی را طراحی و محاسبه کرد.",
    },
  };
}
