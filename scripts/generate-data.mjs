import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConcepts } from "./concepts-data.mjs";
import { buildHorizon } from "./horizon-data.mjs";
import { buildLocalTerrain } from "./local-terrain-data.mjs";
import { buildPlatform } from "./platform-data.mjs";
import { buildSpecies } from "./species-data.mjs";
import {
  climateEvidence,
  derivedEvidence,
  environmentalSources,
  geographyEvidence,
  hazardEvidence,
  siteGeolocation,
  solarEvidence,
  utmToWgs84,
  windEvidence,
} from "./environmental-data.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(dashboardDir, "../../..");
const sourceDir = path.join(projectRoot, "site-base/versions/v1-three-fields");
const dataDir = path.join(dashboardDir, "data");
const docsDir = path.join(dashboardDir, "assets/documents");
const environmentalDataDir = path.join(dashboardDir, "assets/data/environmental");

const readJson = (relativePath) =>
  JSON.parse(
    fs
      .readFileSync(path.join(sourceDir, relativePath), "utf8")
      .replace(/\bNaN\b/g, "null"),
  );
const writeJson = (name, value) =>
  fs.writeFileSync(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);
const bi = (en, fa) => ({ en, fa });

const version = readJson("VERSION.json");
const survey = readJson("analysis/site-analysis-data.json");
const unified = readJson("analysis/unified-site-data.json");
const independent = readJson("analysis/unified-independent-verification.json");
const originalIndependent = readJson("analysis/independent-verification.json");

const points = survey.survey_points.map((point) => ({
  id: point.name,
  number: point.number,
  x_m: point.x,
  y_m: point.y,
  ...utmToWgs84(point.x, point.y),
  elevation_m: point.z,
  role: point.name === "Pt8" ? "interior-terrain" : "outer-boundary",
  association_distance_m: point.association_distance,
  source_layer: point.source_layer,
  source_type: point.source_object_type,
  source_handle: point.source_handle,
}));

const pointsByName = Object.fromEntries(points.map((point) => [point.id, point]));
const ringNames = version.outer_boundary_order.slice(0, -1);
const outerEdges = ringNames.map((from, index) => {
  const to = ringNames[(index + 1) % ringNames.length];
  const a = pointsByName[from];
  const b = pointsByName[to];
  return {
    from,
    to,
    length_m: Math.hypot(b.x_m - a.x_m, b.y_m - a.y_m),
    role: from === "Pt2" && to === "Pt1" ? "road-boundary" : "property-boundary",
  };
});

const originalPolygons = survey.polygons.map((polygon) => ({
  id: polygon.id,
  name: polygon.name,
  point_order: polygon.vertices.map((vertex) => vertex[3]),
  area_m2: polygon.plan_area,
  perimeter_m: polygon.horizontal_perimeter,
  side_lengths_m: polygon.horizontal_sides,
  source_handle: polygon.handle,
  source_layer: polygon.layer,
  source_type: polygon.source_object_type,
  source_closed_flag: polygon.source_closed_flag,
  repeated_endpoint_closure: polygon.source_repeated_endpoint,
  embedded_area_label_m2: polygon.embedded_area_label,
  embedded_area_delta_m2: polygon.embedded_area_delta,
}));

const project = {
  id: "design-001-family-house",
  title: bi("Family House 001 — Site Intelligence", "خانه خانوادگی ۰۰۱ — شناخت سایت"),
  subtitle: bi(
    "Verified drawing geometry with traceable mountain-climate, solar, wind and hazard context",
    "هندسه ترسیمی تأییدشده با زمینه قابل‌ردیابی اقلیم کوهستانی، خورشید، باد و مخاطرات",
  ),
  site_version: version.site_version,
  generated_on: "2026-07-30",
  status: "pre-design-environmental-analysis-complete",
  status_label: bi(
    "Pre-design environmental analysis complete · parcel-scale verification remains open",
    "تحلیل محیطی پیش‌طراحی تکمیل شده · راستی‌آزمایی در مقیاس قطعه همچنان باز است",
  ),
  geolocation_status: "probable",
  geolocation_confidence: "strong-probable",
  geolocation_note: bi(
    "Interpreting the survey as WGS 84 / UTM zone 38N places every point coherently near Baneh Verdeh, Paveh County. This is a strong-probable project location for regional analysis; the CRS is not surveyor-certified.",
    "تفسیر نقشه به‌صورت WGS 84 / UTM زون ۳۸ شمالی، همه نقاط را به‌طور منسجم در نزدیکی بانه‌ورده شهرستان پاوه قرار می‌دهد. این موقعیت پروژه برای تحلیل منطقه‌ای با اطمینان قوی محتمل است؛ CRS توسط نقشه‌بردار تأیید نشده است.",
  ),
  probable_project_location: geographyEvidence.probable_project_location,
  coordinates: {
    latitude: siteGeolocation.latitude,
    longitude: siteGeolocation.longitude,
    epsg: siteGeolocation.utm.epsg,
  },
  design_scope: bi(
    "This interface supports site understanding. It does not recommend a final floor plan.",
    "این رابط برای شناخت سایت است و هیچ پلان نهایی را توصیه نمی‌کند.",
  ),
  evidence_counts: {
    verified_geometry: 8,
    survey_points: 8,
    outer_boundary_points: 7,
    terrain_facets: unified.triangles.length,
    regional_environmental_modules: 5,
    unresolved_environmental_modules: 5,
    unresolved_environmental_note: bi(
      "All five regional environmental modules still require parcel-scale verification before design decisions rely on them.",
      "هر پنج ماژول محیطی منطقه‌ای پیش از اتکای تصمیم‌های طراحی به راستی‌آزمایی در مقیاس قطعه نیاز دارند.",
    ),
  },
};

const site = {
  verified_area_m2: version.site_area_m2,
  calculated_area_m2: unified.area_m2,
  parcel_sum_m2: unified.parcel_area_sum_m2,
  area_verification_passed: independent.passed,
  property_verification: {
    scope: bi(
      "Verification applies to geometry extracted from the supplied survey drawing and to its plan-area calculation. It does not establish a legal interest in land.",
      "راستی‌آزمایی فقط به هندسه استخراج‌شده از نقشه برداشت ارائه‌شده و محاسبه مساحت پلان آن مربوط است و هیچ حق قانونی نسبت به زمین را اثبات نمی‌کند.",
    ),
    items: [
      {
        id: "drawing-geometry",
        label: bi("Drawing geometry", "هندسه ترسیمی"),
        status: "verified",
      },
      {
        id: "plan-area-calculation",
        label: bi("Plan-area calculation", "محاسبه مساحت پلان"),
        status: "verified",
      },
      {
        id: "legal-ownership",
        label: bi("Legal ownership", "مالکیت قانونی"),
        status: "unresolved",
      },
      {
        id: "cadastral-boundary",
        label: bi("Cadastral boundary", "مرز ثبتی"),
        status: "unresolved",
      },
      {
        id: "easements",
        label: bi("Easements", "حقوق ارتفاقی"),
        status: "unresolved",
      },
      {
        id: "rights-of-way",
        label: bi("Rights-of-way", "حقوق عبور"),
        status: "unresolved",
      },
    ],
  },
  outer_boundary_order: version.outer_boundary_order,
  outer_boundary_points: ringNames.map((name) => pointsByName[name]),
  interior_terrain_points: version.interior_terrain_points,
  perimeter_m: unified.perimeter_m,
  outer_edges: outerEdges,
  north: {
    direction: version.north_direction,
    label: bi("Drawing +Y (confirmed project assumption)", "جهت ‎+Y نقشه (فرض تأییدشده پروژه)"),
    survey_certified: false,
  },
  road: {
    edge: version.road_boundary.replace("-", "–"),
    length_m: version.road_boundary_length_m,
    access: bi(
      "South frontage; exact gate position not selected",
      "برِ جنوبی؛ محل دقیق دروازه انتخاب نشده است",
    ),
  },
  elevation: {
    min_m: version.elevation_min_m,
    max_m: version.elevation_max_m,
    relief_m: version.total_relief_m,
  },
  terrain_direction: bi(
    "Steepest descent is consistently toward the northeast",
    "جهت تندترین نزول در تمام سطوح به سوی شمال‌شرق است",
  ),
};

const surveyPoints = {
  coordinate_units: "metres",
  coordinate_reference_system: {
    status: "strong-probable",
    epsg: siteGeolocation.utm.epsg,
    name: "WGS 84 / UTM zone 38N",
    note: project.geolocation_note,
  },
  points,
  original_polygons: originalPolygons,
  unified_edges: outerEdges,
  methodology: bi(
    "Eight SurveyPoint MTEXT labels were uniquely associated with their nearest boundary vertices. Plan areas use translated-origin shoelace calculations; distances use independent Euclidean checks.",
    "هشت برچسب MTEXT از نوع SurveyPoint به نزدیک‌ترین رأس مرز به‌طور یکتا مرتبط شدند. مساحت‌ها با فرمول بندکفش و مبدأ انتقال‌یافته و فاصله‌ها با کنترل مستقل اقلیدسی محاسبه شدند.",
  ),
  integrity: {
    dwg_sha256: survey.source.dwg_sha256,
    dxf_sha256: survey.source.dxf_sha256,
    version_manifest: "assets/data/site-base-SHA256SUMS.txt",
    original_verification_passed: originalIndependent.passed,
    unified_verification_passed: independent.passed,
  },
};

// Concept massing from the design workspace. Kept out of the document library
// and out of every evidence section; see scripts/concepts-data.mjs.
const conceptMassing = buildConcepts(points);

const sectionLabelsFa = {
  longitudinal: "مقطع طولی L–L (جنوب–شمال)",
  transverse: "مقطع عرضی T–T (غرب–شرق)",
};

const terrain = {
  model: "piecewise-linear TIN",
  triangulation: "Pt8 interior hub with seven outer boundary points",
  min_elevation_m: unified.min_elevation_m,
  max_elevation_m: unified.max_elevation_m,
  relief_m: unified.relief_m,
  contour_interval_m: 1,
  contour_levels_m: unified.contour_levels_m,
  contour_segments: unified.contour_segments,
  triangles: unified.triangles.map((triangle, index) => ({
    id: index + 1,
    points: triangle.points,
    slope_percent: triangle.slope_percent,
    slope_degrees: triangle.slope_degrees,
    aspect_degrees_from_north: triangle.aspect_degrees_from_north,
    aspect: "northeast",
  })),
  sections: Object.fromEntries(
    Object.entries(unified.sections).map(([key, section]) => [
      key,
      {
        // The immutable site data carries English only, and app.js used to hold
        // the Persian pair as a hardcoded ternary.
        label: bi(section.label, sectionLabelsFa[key] ?? section.label),
        distance_m: section.distance_m,
        elevation_m: section.elevation_m,
      },
    ]),
  ),
  drainage: bi(
    "Preliminary surface tendency toward Pt5/Pt6 on the northeast side; a legal discharge point is not established.",
    "گرایش اولیه رواناب به سوی Pt5/Pt6 در ضلع شمال‌شرقی است؛ نقطه قانونی تخلیه مشخص نشده است.",
  ),
  limitations: [
    bi(
      "Only eight labelled spot elevations define the surface.",
      "سطح فقط با هشت تراز نقطه‌ای برچسب‌دار تعریف شده است.",
    ),
    bi(
      "No surveyed breaklines, walls, curbs or local grade changes are represented.",
      "شکست‌خط‌های نقشه‌برداری، دیوارها، جدول‌ها و تغییرات موضعی شیب نمایش داده نشده‌اند.",
    ),
    bi(
      "The TIN is not suitable for construction cut-and-fill quantities.",
      "این TIN برای محاسبه اجرایی خاک‌برداری و خاک‌ریزی مناسب نیست.",
    ),
  ],
  risks: [
    {
      level: "high",
      title: bi("Grading sensitivity", "حساسیت بالای تسطیح"),
      detail: bi(
        "Facet slopes range from 34.52% to 44.03%; a level platform would likely require cut, fill, retaining or a stepped response.",
        "شیب سطوح بین ۳۴٫۵۲٪ تا ۴۴٫۰۳٪ است؛ سکوی تراز احتمالاً نیازمند خاک‌برداری، خاک‌ریزی، حائل یا راه‌حل پلکانی است.",
      ),
    },
    {
      level: "high",
      title: bi("Downslope fill risk", "خطر خاک‌ریزی در پایین‌دست"),
      detail: bi(
        "The lowest terrain is around Pt5/Pt6; unengineered fill here is sensitive to settlement, drainage and slope stability.",
        "پایین‌ترین زمین پیرامون Pt5/Pt6 است؛ خاک‌ریزی مهندسی‌نشده در این ناحیه به نشست، زهکشی و پایداری شیب حساس است.",
      ),
    },
    {
      level: "medium",
      title: bi("Road-edge excavation", "گودبرداری کنار راه"),
      detail: bi(
        "Pt1/Pt2 are high points at the road frontage; deep excavation may require retaining and groundwater management.",
        "Pt1/Pt2 نقاط بلند در برِ راه هستند؛ گودبرداری عمیق ممکن است به حائل و مدیریت آب زیرزمینی نیاز داشته باشد.",
      ),
    },
  ],
};

/*
  Facet geometry of the verified TIN. Plan area is a shoelace on the surveyed
  x/y; 3D area is the true triangle area including fall, so the ratio says how
  much more surface there is than the plan implies.

  Deliberately NOT here: cut and fill quantities, or a balance-elevation curve.
  Both are earthwork numbers, and an eight-point TIN cannot carry them — the
  moment a volume appears in cubic metres it gets priced.
*/
const pointById = new Map(points.map((point) => [point.id, point]));
const facetGeometry = terrain.triangles.map((triangle) => {
  const [a, b, c] = triangle.points.map((id) => pointById.get(id));
  const planArea = Math.abs(
    (b.x_m - a.x_m) * (c.y_m - a.y_m) - (c.x_m - a.x_m) * (b.y_m - a.y_m),
  ) / 2;
  const u = [b.x_m - a.x_m, b.y_m - a.y_m, b.elevation_m - a.elevation_m];
  const v = [c.x_m - a.x_m, c.y_m - a.y_m, c.elevation_m - a.elevation_m];
  const cross = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const surfaceArea = Math.hypot(...cross) / 2;
  return {
    id: triangle.id,
    points: triangle.points,
    plan_area_m2: Number(planArea.toFixed(4)),
    surface_area_m2: Number(surfaceArea.toFixed(4)),
    slope_percent: triangle.slope_percent,
    aspect: triangle.aspect,
  };
});
const planAreaTotal = facetGeometry.reduce((total, facet) => total + facet.plan_area_m2, 0);
const surfaceAreaTotal = facetGeometry.reduce((total, facet) => total + facet.surface_area_m2, 0);
const slopeClasses = [
  ["under-15", 0, 15],
  ["15-25", 15, 25],
  ["25-33", 25, 33],
  ["33-50", 33, 50],
  ["over-50", 50, Infinity],
].map(([id, from, to]) => {
  const facets = facetGeometry.filter((facet) => (
    facet.slope_percent >= from && facet.slope_percent < to
  ));
  const area = facets.reduce((total, facet) => total + facet.plan_area_m2, 0);
  return {
    id,
    from_percent: from,
    to_percent: Number.isFinite(to) ? to : null,
    facet_count: facets.length,
    plan_area_m2: Number(area.toFixed(4)),
    share_percent: Number((area / planAreaTotal * 100).toFixed(1)),
  };
});
const terrainMetrics = {
  status: "verified-derived",
  facets: facetGeometry,
  plan_area_m2: Number(planAreaTotal.toFixed(6)),
  surface_area_m2: Number(surfaceAreaTotal.toFixed(4)),
  surface_to_plan_ratio: Number((surfaceAreaTotal / planAreaTotal).toFixed(4)),
  slope_classes: slopeClasses,
  note: bi(
    "Every facet of the parcel falls in one slope band. There is no gentle corner to place a building on, so any platform is a cut-and-fill decision rather than a siting choice.",
    "همه وجه‌های قطعه در یک بازه شیب قرار می‌گیرند. هیچ گوشه ملایمی برای استقرار ساختمان وجود ندارد؛ بنابراین هر سکو یک تصمیم خاک‌برداری و خاک‌ریزی است، نه یک انتخاب مکان‌یابی.",
  ),
  excluded: bi(
    "Cut and fill quantities are deliberately absent. An eight-point TIN cannot support them, and a volume in cubic metres becomes a price.",
    "حجم خاک‌برداری و خاک‌ریزی عمداً ارائه نشده است. یک TIN هشت‌نقطه‌ای پشتیبان آن نیست و حجم برحسب مترمکعب تبدیل به قیمت می‌شود.",
  ),
};


const geography = geographyEvidence;
const climate = {
  ...climateEvidence,
  derived: derivedEvidence,
  // The Persian names used to live in a lookup table inside app.js, keyed on
  // these English strings — invisible to the translation-parity check and one
  // rename away from silently falling back to English.
  fields: [
    ["monthly temperature", "دمای ماهانه", "°C"],
    ["rainfall", "بارش", "mm"],
    ["snowfall", "برف", "cm"],
    ["humidity", "رطوبت", "%"],
    ["solar radiation", "تابش خورشیدی", "kWh/m²/day"],
    ["cloud cover", "پوشش ابر", "%"],
    ["frost", "یخبندان", "days/year"],
    ["heating and cooling seasons", "فصل گرمایش و سرمایش", "months"],
    ["extreme conditions", "شرایط حدی", "1991–2020"],
    ["climate classification", "رده‌بندی اقلیمی", "descriptive"],
    ["future climate scenario", "سناریوی اقلیم آینده", "2 CMIP6 models"],
  ].map(([field, fa, value]) => ({
    field,
    label: bi(field, fa),
    value,
    status: "regional-data",
  })),
  warning: climateEvidence.limitations,
};
// Measured terrain horizon. Every solar position gains horizon_deg and
// above_horizon, so the runtime stays a table lookup.
const horizon = buildHorizon(site, solarEvidence);
// The two roads bounding the field, drawn outside it and carved into it.
//
// The upper one is the surveyed frontage: `version.road_boundary` records the
// Pt2–Pt1 edge and its 10.270569 m length, so its line and its side are measured.
// Its width is not — no source records a carriageway — so 4 m is stated as
// illustrative and the strip is drawn beyond the boundary, never over it.
//
// The lower one is client-reported. The survey records one road edge, and a second
// one along the downhill boundary appears in no bundled source; it is here because
// the client says it is there. That is a different kind of evidence from a survey
// and it is labelled as one, not folded in beside it.
const roads = (() => {
  const hub = pointsByName[version.interior_terrain_points[0]] ?? points.find((p) => p.id === "Pt8");
  const local = (name) => [
    pointsByName[name].x_m - hub.x_m,
    pointsByName[name].y_m - hub.y_m,
  ];
  const centre = ringNames.reduce((total, name) => {
    const [east, north] = local(name);
    return [total[0] + east / ringNames.length, total[1] + north / ringNames.length];
  }, [0, 0]);

  const fix = (value, places) => Number(value.toFixed(places));
  const strip = (id, fromName, toName, widthM, status, label, note) => {
    const [ax, ay] = local(fromName);
    const [bx, by] = local(toName);
    const length = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    // Outward normal: whichever of the two perpendiculars points away from the
    // parcel, so the strip can never be laid over surveyed ground.
    let nx = -uy;
    let ny = ux;
    const midEast = (ax + bx) / 2;
    const midNorth = (ay + by) / 2;
    if ((midEast + nx - centre[0]) ** 2 + (midNorth + ny - centre[1]) ** 2
      < (midEast - centre[0]) ** 2 + (midNorth - centre[1]) ** 2) {
      nx = -nx;
      ny = -ny;
    }
    // A 10 m stub reads as a kerb rather than a road, so the centreline runs the
    // width of the drawn hillside patch. Only the edge it is derived from is surveyed.
    const reach = 30;
    const offset = 1.2 + widthM / 2;
    // A road is a level bench, not a drape: it is cut into the slope, and both of
    // these boundary edges are very nearly contours already — 0.29 m across the
    // 10.270569 m surveyed frontage, 1.09 m across the lower edge — so the level
    // is the mean of the two surveyed point elevations. That number is measured.
    // What is inferred is that a bench exists at all, and how far it cuts.
    const levelM = (pointsByName[fromName].elevation_m + pointsByName[toName].elevation_m) / 2;
    return {
      id,
      derived_from_edge: `${fromName}–${toName}`,
      edge_length_m: fix(length, 6),
      width_m: widthM,
      width_status: "illustrative",
      offset_from_boundary_m: 1.2,
      level_elevation_m: fix(levelM, 3),
      // A level bench diverges from the ground the further it runs, and past a
      // few metres of cut it stops being a road cut and becomes a different
      // engineering problem. The corridor is carved no deeper than this.
      max_cut_or_fill_drawn_m: 6,
      // The batter each side of the carriageway, as horizontal metres per vertical
      // metre. 1:1.2 is an ordinary cut slope in firm ground; it is a drawing
      // convention here, not a geotechnical recommendation.
      batter_ratio: 1.2,
      level_note: bi(
        "The carriageway is drawn level, at the mean of the two surveyed elevations on its own boundary edge. Where the hillside stands above that level the drawing shows a cut face, and where it falls below it shows fill. No earthwork quantity is stated or implied — an eight-point TIN cannot support one.",
        "سواره‌رو تراز ترسیم شده است، در میانگین دو تراز برداشت‌شده روی همان لبهٔ مرزی خودش. جایی که دامنه بالاتر از این تراز باشد، ترسیم یک برش نشان می‌دهد و جایی که پایین‌تر باشد، خاک‌ریز. هیچ حجم خاکی بیان یا القا نمی‌شود — TIN هشت‌نقطه‌ای پشتیبان چنین عددی نیست.",
      ),
      centreline: [
        [fix(midEast + nx * offset - ux * reach, 3), fix(midNorth + ny * offset - uy * reach, 3)],
        [fix(midEast + nx * offset + ux * reach, 3), fix(midNorth + ny * offset + uy * reach, 3)],
      ],
      status,
      label,
      note,
    };
  };

  return {
    origin_point: hub.id,
    coordinates: "metres east and north of the origin point, survey grid",
    roads: [
      strip(
        "road-upper",
        version.road_boundary.split("-")[0],
        version.road_boundary.split("-")[1],
        4,
        "surveyed-edge-illustrative-width",
        bi("Upper road · surveyed frontage", "راه بالایی · برِ برداشت‌شده"),
        bi(
          "The line and the side are surveyed: this is the Pt2–Pt1 road boundary, 10.270569 m of frontage on the high edge of the field. The 4 m width and the length drawn are illustrative — no bundled source records a carriageway — and the strip is laid outside the boundary, never over it.",
          "خط و سمت آن برداشت‌شده است: این همان مرز راه Pt2–Pt1 است، ۱۰٫۲۷۰۵۶۹ متر بر در لبهٔ بالای زمین. عرض ۴ متر و طول ترسیم‌شده نمایشی‌اند — هیچ منبع همراهی سواره‌رو را ثبت نکرده — و نوار بیرون مرز کشیده شده، نه روی آن.",
        ),
      ),
      strip(
        "road-lower",
        "Pt5",
        "Pt6",
        3.5,
        "client-reported",
        bi("Lower road · client-reported", "راه پایینی · به گفتهٔ کارفرما"),
        bi(
          "Reported by the client, not surveyed and not in any bundled source. The survey records exactly one road boundary, the upper one. This strip follows the downhill Pt5–Pt6 boundary because that is the edge described; its position, width and length are all unverified.",
          "به گفتهٔ کارفرما؛ برداشت نشده و در هیچ منبع همراه نیست. نقشه‌برداری تنها یک مرز راه ثبت کرده و آن مرز بالایی است. این نوار مرز سراشیب Pt5–Pt6 را دنبال می‌کند چون همان لبه توصیف شده است؛ موقعیت، عرض و طول آن هیچ‌یک تأیید نشده‌اند.",
        ),
      ),
    ],
  };
})();

// The hillside the parcel sits on, sampled on its own square grid. Separate
// from the horizon ring: that one is angles out to 27 km, this one is the
// single landform under the field.
const localTerrain = buildLocalTerrain(site, points, roads);

// Illustrative planting. Nothing on the parcel has been surveyed as vegetation —
// the OSM extract carries no trees inside it and the DWG carries none either — so
// these are shadow probes, placed to make the sun study legible on a bare TIN.
// Positions are derived rather than typed: candidates on a 7 m lattice about Pt8,
// kept only where they clear the surveyed boundary by 3.5 m, sorted onto the
// downhill end of the fitted survey plane, then thinned so no two stand closer
// than 4.5 m. The 4 m around the origin is skipped — the solar test object stands
// there. Heights cycle through four sizes so the shadows differ.
const planting = (() => {
  const hub = pointsByName[version.interior_terrain_points[0]] ?? points.find((p) => p.id === "Pt8");
  const ring = ringNames.map((name) => [
    pointsByName[name].x_m - hub.x_m,
    pointsByName[name].y_m - hub.y_m,
  ]);
  const inside = (east, north) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > north) !== (yj > north)
        && east < ((xj - xi) * (north - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const clearance = (east, north) => {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const dx = xj - xi;
      const dy = yj - yi;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0
        ? 0
        : Math.min(1, Math.max(0, ((east - xi) * dx + (north - yi) * dy) / lengthSquared));
      best = Math.min(best, Math.hypot(east - (xi + t * dx), north - (yi + t * dy)));
    }
    return best;
  };
  // Height on the fitted survey plane, so "the bottom of the field" is the
  // measured downhill end rather than a corner picked by eye.
  const planeAt = (east, north) => localTerrain.surveyed_plane.intercept_m
    + localTerrain.surveyed_plane.east_per_m * east
    + localTerrain.surveyed_plane.north_per_m * north;
  const candidates = [];
  for (let north = -14; north <= 21; north += 3.5) {
    for (let east = -14; east <= 14; east += 3.5) {
      if (!inside(east, north) || clearance(east, north) < 3.5) continue;
      // The solar test object stands at the origin.
      if (Math.hypot(east, north) < 4) continue;
      const elevation = planeAt(east, north);
      // Only the downhill half. "The bottom of the field" on ground that falls
      // 11.754 m across 25 m means below the parcel's own midpoint.
      if (elevation >= (version.elevation_min_m + version.elevation_max_m) / 2) continue;
      candidates.push({ east, north, elevation });
    }
  }
  // Lowest first: the trees group at the downhill edge, which is where they
  // throw their shadows back across the buildable ground rather than off site.
  candidates.sort((a, b) => a.elevation - b.elevation);
  const heights = [5.5, 4, 7, 5];
  const chosen = [];
  for (const candidate of candidates) {
    if (chosen.length >= 4) break;
    if (chosen.some((tree) => Math.hypot(
      tree.east_m - candidate.east, tree.north_m - candidate.north,
    ) < 4.5)) continue;
    const height = heights[chosen.length % heights.length];
    chosen.push({
      id: `tree-${chosen.length + 1}`,
      east_m: Number(candidate.east.toFixed(2)),
      north_m: Number(candidate.north.toFixed(2)),
      height_m: height,
      // Roughly the crown-to-height ratio of a mature deciduous tree; it sets
      // the shadow's width, which is the only thing this geometry is for.
      crown_radius_m: Number((height * 0.34).toFixed(2)),
    });
  }
  return {
    status: "illustrative-only",
    origin_point: hub.id,
    coordinates: "metres east and north of the origin point, survey grid",
    trees: chosen,
    label: bi("Illustrative planting", "درختان نمایشی"),
    note: bi(
      "These trees are not survey data and not a planting proposal. No vegetation inside the parcel is recorded in any bundled source. They exist so the sun study casts shadows against something of building height, and they are excluded from every measured figure on this page.",
      "این درختان نه داده برداشت‌شده‌اند و نه پیشنهاد کاشت. هیچ پوشش گیاهی درون قطعه در هیچ منبع همراه ثبت نشده است. آن‌ها فقط برای آن‌اند که مطالعه خورشیدی سایه‌ای در ارتفاع ساختمان داشته باشد و از همه اعداد اندازه‌گیری‌شده این صفحه بیرون‌اند.",
    ),
  };
})();


// Plan area against surface area, and how much level ground a platform buys at a
// given depth. Reads the metrics block above for the surface area rather than
// recomputing it, so the two can never disagree.
const platform = buildPlatform(site, points, unified.triangles, terrainMetrics);

const horizonBySeason = new Map(horizon.seasons.map((season) => [season.id, season]));
const solar = {
  ...solarEvidence,
  seasons: solarEvidence.seasons.map((season) => {
    const measured = horizonBySeason.get(season.id);
    return measured
      ? {
        ...season,
        positions: measured.positions,
        effective_first_sun: measured.effective_first_sun,
        effective_last_sun: measured.effective_last_sun,
        solar_access_hours: measured.solar_access_hours,
        terrain_shaded_hours: measured.terrain_shaded_hours,
        shaded_intervals: measured.shaded_intervals,
      }
      : season;
  }),
};
const wind = {
  ...windEvidence,
  // Which wind season each of the three published solar dates falls in, so the
  // 3D view can show the wind that belongs to the day it is drawing rather than
  // the annual average. The March equinox falls in spring, and that is the only
  // one of the three that needs saying.
  season_for_solar_date: {
    winter: "winter",
    equinox: "spring",
    summer: "summer",
  },
  seasons: windEvidence.seasons.map((season) => ({
    ...season,
    // Bilingual, because the 3D wind label names the season it is drawing.
    season_label: {
      annual: bi("Annual", "سالانه"),
      winter: bi("Winter", "زمستان"),
      spring: bi("Spring", "بهار"),
      summer: bi("Summer", "تابستان"),
      autumn: bi("Autumn", "پاییز"),
    }[season.season] ?? bi(season.season, season.season),
  })),
  warning: bi(
    "Regional hourly evidence is available; parcel-scale flow still requires short-term on-site measurement.",
    "شواهد ساعتی منطقه‌ای موجود است؛ جریان باد در مقیاس ملک همچنان به اندازه‌گیری کوتاه‌مدت در محل نیاز دارد.",
  ),
};

// Trees for this parcel, tested against five conditions the site is already
// measured or mapped for. Built after solar and wind because the placement
// zones quote both — the same arcs and the same prevailing directions the other
// sections publish, not a second opinion about them.
// Persian digits for a count interpolated into a UI string. The register's
// length is data, so the heading cannot drift from the number of cards.
const faDigits = (value) => String(value)
  .replace(/[0-9]/g, (digit) => "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[Number(digit)]);

const species = buildSpecies(
  climate,
  {
    ph: hazardEvidence.soils.ph[0].mean,
    clay_percent: hazardEvidence.soils.clay[0].mean,
    silt_percent: hazardEvidence.soils.silt[0].mean,
    sand_percent: hazardEvidence.soils.sand[0].mean,
    geology: hazardEvidence.geology.unit,
  },
  site,
  {
    slope_percent_min: Number(
      Math.min(...terrainMetrics.facets.map((facet) => facet.slope_percent)).toFixed(2),
    ),
    slope_percent_max: Number(
      Math.max(...terrainMetrics.facets.map((facet) => facet.slope_percent)).toFixed(2),
    ),
  },
  solar,
  wind,
);

// The constraints that apply to every species on the list. The frost constraint
// carries `applies_to`, because a shade tree has no flower to lose, so counting
// it in the heading would say every tree was tested against six things.
const siteWideConstraints = Object.values(species.constraints)
  .filter((constraint) => !constraint.applies_to).length;

const hazards = {
  categories: [
    {
      id: "terrain-slope",
      status: "verified",
      title: bi("Terrain slope", "شیب زمین"),
      finding: bi("TIN facets range from 34.52% to 44.03%.", "شیب سطوح TIN بین ۳۴٫۵۲٪ تا ۴۴٫۰۳٪ است."),
    },
    {
      id: "surface-drainage",
      status: "preliminary-inference",
      title: bi("Surface drainage", "زهکشی سطحی"),
      finding: bi(
        "All model facets descend generally northeast; discharge conditions are unknown.",
        "تمام سطوح مدل عموماً به شمال‌شرق نزول دارند؛ شرایط تخلیه ناشناخته است.",
      ),
    },
    {
      id: "seismic",
      status: "regional-data",
      title: bi("Seismic context", "زمینه لرزه‌ای"),
      finding: hazardEvidence.seismic.finding,
    },
    {
      id: "geology",
      status: "regional-data",
      title: bi("Geology", "زمین‌شناسی"),
      finding: hazardEvidence.geology.finding,
    },
    {
      id: "soils",
      status: "regional-data",
      title: bi("Likely soils", "خاک‌های محتمل"),
      finding: hazardEvidence.soils.finding,
    },
    {
      id: "flood",
      status: "preliminary-inference",
      title: bi("Flood and flash-flood", "سیلاب و سیلاب ناگهانی"),
      finding: bi(
        "The parcel is steep and not mapped as a river channel in the local OSM extract, but intense winter–spring rain and snowmelt can create rapid overland flow. Confirm culverts, upstream catchment and legal discharge.",
        "ملک پرشیب است و در برداشت محلی OSM به‌عنوان مجرای رودخانه ثبت نشده؛ با این حال بارش شدید زمستان/بهار و ذوب برف می‌تواند رواناب سریع ایجاد کند. آبروها، حوضه بالادست و تخلیه قانونی بررسی شود.",
      ),
    },
    {
      id: "erosion",
      status: "preliminary-inference",
      title: bi("Erosion", "فرسایش"),
      finding: bi(
        "34.52–44.03% modeled slopes plus concentrated runoff make disturbed soil erosion-sensitive; construction-phase sediment control is warranted.",
        "شیب مدل‌شده ۳۴٫۵۲ تا ۴۴٫۰۳٪ همراه رواناب متمرکز، خاک دست‌خورده را فرسایش‌پذیر می‌کند؛ کنترل رسوب در زمان ساخت لازم است.",
      ),
    },
    {
      id: "landslide",
      status: "requires-field-investigation",
      title: bi("Landslide indicators", "نشانه‌های زمین‌لغزش"),
      finding: bi(
        "Regional limestone/shale and steep relief justify a geomorphology and discontinuity check, but no landslide scar or stability factor is established for the parcel.",
        "سنگ‌آهک/شیل منطقه‌ای و ناهمواری پرشیب، بررسی ژئومورفولوژی و ناپیوستگی را توجیه می‌کند؛ اما هیچ اسکار لغزش یا ضریب پایداری برای ملک مشخص نشده است.",
      ),
    },
    {
      id: "frost-snow",
      status: "regional-data",
      title: bi("Frost and snow", "یخبندان و برف"),
      finding: bi(
        `The 1991–2020 grid averages about ${climate.annual.frost_days} frost days and ${climate.annual.snowfall_cm.toFixed(0)} cm snowfall per year. Verify local roof snow load, drifting and frost depth under Iranian standards.`,
        `شبکه ۱۹۹۱–۲۰۲۰ به‌طور میانگین حدود ${climate.annual.frost_days} روز یخبندان و ${climate.annual.snowfall_cm.toFixed(0)} سانتی‌متر برف سالانه نشان می‌دهد. بار برف بام، انباشت بادرفتی و عمق یخبندان طبق استانداردهای ایران کنترل شود.`,
      ),
    },
    {
      id: "wind",
      status: "regional-data",
      title: bi("Wind exposure", "مواجهه با باد"),
      finding: bi(
        `ERA5-Land indicates ${wind.seasons[0].prevailing_direction} as the annual grid-level prevailing direction with ${wind.seasons[0].mean_speed_ms.toFixed(1)} m/s mean speed; mountain channeling may differ on site.`,
        `ERA5-Land جهت ${wind.seasons[0].prevailing_direction} را جهت غالب سالانه شبکه‌ای با سرعت میانگین ${wind.seasons[0].mean_speed_ms.toFixed(1)} متر بر ثانیه نشان می‌دهد؛ کانالیزه‌شدن کوهستانی ممکن است در محل متفاوت باشد.`,
      ),
    },
    {
      id: "groundwater",
      status: "requires-field-investigation",
      title: bi("Groundwater", "آب زیرزمینی"),
      finding: bi(
        "No borehole, spring interception or seasonal groundwater level exists for the parcel. Investigate before excavation and retaining design.",
        "هیچ گمانه، ثبت برخورد با چشمه یا تراز فصلی آب زیرزمینی برای ملک وجود ندارد. پیش از گودبرداری و طراحی حائل بررسی شود.",
      ),
    },
    {
      id: "wildfire",
      status: "requires-field-investigation",
      title: bi("Wildfire and other hazards", "آتش‌سوزی طبیعی و سایر مخاطرات"),
      finding: bi(
        "Hot, dry summers and mountain vegetation justify defensible-space and emergency-access review; no parcel-scale fuel or fire-history survey is available.",
        "تابستان گرم و خشک و پوشش گیاهی کوهستانی، بررسی حریم ایمن و دسترسی اضطراری را توجیه می‌کند؛ برداشت سوخت یا سابقه آتش در مقیاس ملک موجود نیست.",
      ),
    },
  ],
  evidence: hazardEvidence,
  status_legend: {
    verified: bi("Verified", "تأییدشده"),
    "regional-data": bi("Regional data", "داده منطقه‌ای"),
    "preliminary-inference": bi("Preliminary inference", "استنباط اولیه"),
    "requires-field-investigation": bi("Requires field investigation", "نیازمند بررسی میدانی"),
  },
};

const recommendations = {
  disclaimer: bi(
    "Site-analysis implications only. No final floor plan, structural system or legal approval is recommended.",
    "صرفاً پیامدهای تحلیل سایت؛ هیچ پلان نهایی، سیستم سازه‌ای یا تأیید قانونی توصیه نمی‌شود.",
  ),
  items: [
    ["site-placement", "Site placement", "جانمایی", "strongly-supported", "Study a contour-parallel, stepped placement to reduce cross-slope width and grading exposure.", "جانمایی پلکانی و موازی خطوط تراز بررسی شود تا عرض متقاطع شیب و حجم تسطیح کاهش یابد."],
    ["orientation", "Orientation", "جهت‌گیری", "reasonable-inference", "Test a contour-parallel building with controlled southern solar access; protect west and southwest façades from hot summer afternoon sun.", "ساختمان موازی خطوط تراز با دسترسی کنترل‌شده خورشید جنوب بررسی شود؛ نماهای غرب و جنوب‌غرب از آفتاب داغ عصر تابستان محافظت شوند."],
    ["daylight", "Daylight", "نور روز", "reasonable-inference", "The measured terrain horizon leaves winter southern light available; reserve it, then verify neighbour obstruction and the parcel's own slope before sizing openings.", "افق زمینِ اندازه‌گیری‌شده نور جنوبی زمستان را در دسترس می‌گذارد؛ آن را حفظ و پیش از اندازه‌گذاری بازشو، موانع همسایه و شیب خود قطعه کنترل شود."],
    ["windows", "Windows", "پنجره‌ها", "reasonable-inference", "Prioritise controllable south and east daylight; limit unprotected west glazing and keep openings adjustable until a parcel wind check is complete.", "نور قابل‌کنترل جنوب و شرق در اولویت باشد؛ شیشه غربی بدون حفاظت محدود و بازشوها تا کنترل باد ملک قابل تنظیم بمانند."],
    ["courtyard", "Courtyard", "حیاط", "reasonable-inference", "Any downslope courtyard must preserve positive drainage and avoid becoming a basin against retaining elements.", "هر حیاط پایین‌دست باید زهکشی مثبت داشته باشد و کنار عناصر حائل به حوضچه تبدیل نشود."],
    ["bedrooms", "Bedrooms", "اتاق‌خواب‌ها", "reasonable-inference", "Favour quieter east or southeast exposure for morning light while avoiding exposed downslope fall hazards; confirm views and neighbours on site.", "برای نور صبح، مواجهه آرام‌تر شرق یا جنوب‌شرق ترجیح داده شود و از خطر افت در پایین‌دست دور بماند؛ دید و همسایگی در محل کنترل شود."],
    ["living", "Living areas", "فضاهای نشیمن", "reasonable-inference", "Use later design studies to connect primary living spaces to usable level outdoor terraces.", "در مطالعات بعدی، فضاهای اصلی نشیمن به تراس‌های تراز و قابل استفاده متصل شوند."],
    ["kitchen", "Kitchen", "آشپزخانه", "reasonable-inference", "Combine morning or southern daylight with direct service access and a robust extract system; do not rely on grid-level wind alone for ventilation.", "نور صبح یا جنوب با دسترسی خدماتی مستقیم و هواکش مطمئن ترکیب شود؛ برای تهویه فقط به باد شبکه‌ای تکیه نشود."],
    ["office", "Office", "دفتر کار", "reasonable-inference", "Use north/east diffuse light or controlled south light and avoid low west sun glare; verify nearby road noise in use hours.", "از نور پخشیده شمال/شرق یا نور کنترل‌شده جنوب استفاده و از خیرگی خورشید کم‌ارتفاع غرب پرهیز شود؛ صدای راه نزدیک در ساعات استفاده سنجیده شود."],
    ["garage", "Garage / workshop", "گاراژ / کارگاه", "strongly-supported", "Keep early access studies close to the high southern Pt2–Pt1 road frontage; no exact gate is selected.", "مطالعات اولیه دسترسی نزدیک برِ بلند جنوبی Pt2–Pt1 انجام شود؛ محل دقیق دروازه انتخاب نشده است."],
    ["roof", "Roof", "بام", "reasonable-inference", "Coordinate roof drainage with the strong northeast fall and a confirmed legal discharge route.", "زهکشی بام با افت شدید شمال‌شرقی و مسیر قانونی تخلیه هماهنگ شود."],
    ["ventilation", "Ventilation", "تهویه", "reasonable-inference", "Provide cross-ventilation paths that can use summer westerlies but remain closable for cold easterly winter flow; confirm with on-site anemometry.", "مسیر تهویه متقاطع برای استفاده از باد غربی تابستان فراهم و در برابر جریان سرد شرقی زمستان قابل‌بستن باشد؛ با بادسنجی محلی تأیید شود."],
    ["shading", "Shading", "سایه‌اندازی", "reasonable-inference", "Use horizontal control on south glazing and stronger external vertical or operable protection on west/southwest façades.", "برای شیشه جنوب کنترل افقی و برای نماهای غرب/جنوب‌غرب حفاظت عمودی یا متحرک بیرونی قوی‌تر به‌کار رود."],
    ["drainage", "Drainage", "زهکشی", "strongly-supported", "Intercept and safely convey runoff; avoid concentration toward neighbours or behind retaining walls.", "رواناب مهار و ایمن هدایت شود؛ از تمرکز آن به سمت همسایه یا پشت دیوار حائل جلوگیری شود."],
    ["retaining", "Retaining strategy", "راهبرد حائل", "strongly-supported", "Expect retaining sensitivity and prefer staged geotechnical and civil input before fixing levels.", "حساسیت حائل جدی گرفته شود و پیش از تثبیت ترازها، نظر مرحله‌ای ژئوتکنیک و عمران اخذ شود."],
    ["landscaping", "Landscaping", "محوطه‌سازی", "reasonable-inference", "Use erosion-conscious planting and keep drainage paths inspectable.", "کاشت با توجه به فرسایش انجام و مسیرهای زهکشی قابل بازرسی نگه داشته شوند."],
    ["solar-energy", "Solar energy", "انرژی خورشیدی", "reasonable-inference", `The regional annual resource is about ${climate.annual.solar_radiation_kwh_m2_day.toFixed(2)} kWh/m²/day; reserve an unshaded south-facing roof zone and run a horizon-aware yield model before procurement.`, `منبع منطقه‌ای سالانه حدود ${climate.annual.solar_radiation_kwh_m2_day.toFixed(2)} کیلووات‌ساعت بر مترمربع در روز است؛ بخشی بدون سایه و رو به جنوب روی بام حفظ و پیش از خرید، مدل بازده با افق واقعی اجرا شود.`],
    ["investigations", "Further investigations", "بررسی‌های بعدی", "strongly-supported", "Certify the CRS against a control point; obtain detailed topography, geotechnical boreholes/test pits, retaining/drainage design, legal discharge evidence, local snow/wind confirmation and the applicable Iranian seismic design parameters.", "CRS با نقطه کنترل تأیید شود؛ توپوگرافی دقیق، گمانه/چاهک ژئوتکنیک، طراحی حائل/زهکشی، مدرک تخلیه قانونی، تأیید محلی برف/باد و پارامترهای لرزه‌ای آیین‌نامه ایران تهیه شود."],
  ].map(([id, en, fa, confidence, detailEn, detailFa]) => ({
    id,
    category: bi(en, fa),
    confidence,
    detail: bi(detailEn, detailFa),
  })),
  confidence_legend: {
    "strongly-supported": bi("Strongly supported", "با پشتوانه قوی"),
    "reasonable-inference": bi("Reasonable preliminary inference", "استنباط اولیه معقول"),
    "requires-investigation": bi("Requires additional local investigation", "نیازمند بررسی محلی بیشتر"),
  },
};

const documents = {
  items: [
    ["unified-top", "Unified site top view", "نمای بالای سایت یکپارچه", "Neutral plan showing the seven-point drawing boundary, Pt8 terrain hub, road edge, north and study zones.", "پلان خنثی شامل مرز ترسیمی هفت‌نقطه‌ای، نقطه داخلی Pt8، لبه راه، شمال و محدوده‌های مطالعاتی.", "PNG", "neutral", "phase-1", "verified", "assets/diagrams/unified-site-top-view.png", "image"],
    ["three-polygons", "Original three polygons", "سه چندضلعی اولیه", "Original active survey polygons with point elevations.", "چندضلعی‌های فعال اولیه نقشه‌برداری با تراز نقاط.", "PNG", "neutral", "phase-1", "verified", "assets/diagrams/original-three-polygons.png", "image"],
    ["contours", "Terrain contours", "خطوط تراز زمین", "One-metre contours derived from the eight-point TIN.", "خطوط تراز یک‌متری مشتق‌شده از TIN هشت‌نقطه‌ای.", "PNG", "neutral", "phase-2", "preliminary-inference", "assets/diagrams/site-contours.png", "image"],
    ["sections", "Site sections", "مقاطع سایت", "Analytical south–north and west–east terrain sections.", "مقاطع تحلیلی جنوب–شمال و غرب–شرق زمین.", "PNG", "neutral", "phase-2", "preliminary-inference", "assets/diagrams/site-sections.png", "image"],
    ["site-report-en", "Survey geometry report", "گزارش هندسه نقشه‌برداری", "Sanitized English copy of the geometry extraction and verification report.", "نسخه انگلیسی پالایش‌شده گزارش استخراج و تأیید هندسه.", "MD", "en", "phase-1", "verified", "assets/documents/site-report.en.md", "document"],
    ["slope-report-en", "Slope analysis report", "گزارش تحلیل شیب", "English unified-site terrain and slope report.", "گزارش انگلیسی زمین و شیب سایت یکپارچه.", "MD", "en", "phase-2", "preliminary-inference", "assets/documents/slope-analysis.en.md", "document"],
    ["summary-fa", "Verified drawing-geometry summary — Persian", "خلاصه هندسه ترسیمی تأییدشده — فارسی", "Persian summary generated from verified drawing values and explicit legal and technical limitations.", "خلاصه فارسی تولیدشده از مقادیر ترسیمی تأییدشده و محدودیت‌های صریح قانونی و فنی.", "MD", "fa", "phase-4", "verified-derived", "assets/documents/site-summary.fa.md", "document"],
    ["coordinates", "Coordinates and geometry table", "جدول مختصات و هندسه", "CSV export of polygon corners, survey points, sides, perimeters and areas.", "خروجی CSV گوشه‌ها، نقاط، اضلاع، محیط‌ها و مساحت‌ها.", "CSV", "neutral", "phase-1", "verified", "assets/data/site-coordinates.csv", "data"],
    ["site-json", "Unified site analysis data", "داده تحلیل سایت یکپارچه", "Machine-readable TIN, contours, sections and zones.", "داده ماشین‌خوان TIN، خطوط تراز، مقاطع و محدوده‌ها.", "JSON", "neutral", "phase-2", "verified-derived", "assets/data/unified-site-data.json", "data"],
    ["survey-json", "Survey analysis data", "داده تحلیل نقشه‌برداری", "Machine-readable original polygons, points and source metadata.", "داده ماشین‌خوان چندضلعی‌ها، نقاط و متادیتای منبع.", "JSON", "neutral", "phase-1", "verified", "assets/data/site-analysis-data.json", "data"],
    ["verification", "Independent unified verification", "تأیید مستقل سایت یکپارچه", "Independent area and topology checks.", "کنترل مستقل مساحت و توپولوژی.", "JSON", "neutral", "phase-2", "verified", "assets/data/unified-independent-verification.json", "data"],
    ["hashes", "Source integrity manifest", "فهرست صحت منابع", "SHA-256 manifest for the immutable site snapshot.", "فهرست SHA-256 برای نسخه تغییرناپذیر سایت.", "TXT", "neutral", "phase-1", "verified", "assets/data/site-base-SHA256SUMS.txt", "data"],
    ["unified-fcstd", "Unified FreeCAD model", "مدل یکپارچه FreeCAD", "Validated drawing geometry, TIN, contours, sections and study zones.", "هندسه ترسیمی، TIN، خطوط تراز، مقاطع و محدوده‌های مطالعاتی تأییدشده.", "FCStd", "neutral", "phase-2", "verified-derived", "assets/documents/unified-site.FCStd", "model"],
    ["analysis-fcstd", "Survey analysis FreeCAD model", "مدل تحلیل نقشه‌برداری FreeCAD", "Raw import retained for audit plus validated analysis objects.", "ورودی خام برای ممیزی به همراه اشیای تحلیل تأییدشده.", "FCStd", "neutral", "phase-1", "verified", "assets/documents/site-analysis.FCStd", "model"],
    ["boundaries-dxf", "Validated drawing boundaries", "مرزهای ترسیمی تأییدشده", "ASCII R2013 DXF containing drawing-derived 3D boundaries and survey points; it is not a cadastral record.", "فایل DXF نوع ASCII R2013 شامل مرزهای سه‌بعدی برگرفته از نقشه و نقاط برداشت است؛ این فایل سابقه ثبتی نیست.", "DXF", "neutral", "phase-1", "verified", "assets/documents/site-boundaries.dxf", "model"],
    ["environmental-summary", "Environmental evidence summary", "خلاصه شواهد محیطی", "Machine-readable geolocation, climate, solar, wind and regional-hazard evidence with limitations and source metadata.", "شواهد ماشین‌خوان موقعیت، اقلیم، خورشید، باد و مخاطرات منطقه‌ای همراه محدودیت و متادیتای منبع.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/environmental-summary.json", "data"],
    ["environmental-methodology", "Environmental methodology report", "گزارش روش‌شناسی محیطی", "Bilingual explanation of datasets, periods, resolution, calculations and unresolved field requirements.", "شرح دوزبانه مجموعه‌داده‌ها، دوره‌ها، تفکیک، محاسبات و نیازهای میدانی حل‌نشده.", "MD", "neutral", "phase-4", "regional-data", "assets/documents/environmental-methodology.md", "document"],
    ["era5-climate-raw", "ERA5-Land daily climate source", "منبع اقلیم روزانه ERA5-Land", "Raw 1991–2020 daily regional grid response used for temperature, precipitation, snow, frost and extremes.", "پاسخ خام شبکه منطقه‌ای روزانه ۱۹۹۱–۲۰۲۰ برای دما، بارش، برف، یخبندان و حدها.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/openmeteo-era5land-daily-1991-2020.json", "data"],
    ["era5-wind-raw", "ERA5-Land hourly wind source", "منبع باد ساعتی ERA5-Land", "Raw 2011–2020 hourly 10 m speed and direction response behind the wind roses.", "پاسخ خام سرعت و جهت باد ساعتی ۱۰ متری ۲۰۱۱–۲۰۲۰ برای گل‌بادها.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/openmeteo-era5land-wind-hourly-2011-2020.json", "data"],
    ["nasa-power-raw", "NASA POWER climatology source", "منبع اقلیم‌نمای NASA POWER", "Raw 2001–2020 monthly humidity, cloud, radiation, temperature, precipitation and wind climatology.", "اقلیم‌نمای خام ماهانه ۲۰۰۱–۲۰۲۰ رطوبت، ابر، تابش، دما، بارش و باد.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/nasa-power-climatology-2001-2020.json", "data"],
    ["usgs-earthquakes-raw", "USGS regional earthquake query", "پرس‌وجوی زلزله منطقه‌ای USGS", "Raw M≥4.5 catalog response for 200 km around the site through 30 July 2026.", "پاسخ خام فهرست بزرگی ۴٫۵ و بیشتر در شعاع ۲۰۰ کیلومتر تا ۳۰ ژوئیه ۲۰۲۶.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/usgs-earthquakes-m45-200km-1900-2026.json", "data"],
    ["species-images-raw", "Species photograph provenance", "پیشینه عکس گونه‌های گیاهی", "Request manifest for the bundled tree photographs: resolved Wikipedia article, Commons file, licence, author and the SHA-256 of every image written into the package.", "سند درخواست عکس‌های همراه درختان: مقاله ویکی‌پدیای بازیابی‌شده، فایل ویکی‌انبار، پروانه، پدیدآور و درهم‌ساز SHA-256 هر تصویری که در بسته نوشته شده است.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/wikipedia-species-images.json", "data"],
    ["soilgrids-raw", "SoilGrids site prediction", "پیش‌بینی خاک SoilGrids", "Raw 250 m predicted surface-soil properties and uncertainty intervals.", "ویژگی‌های خام پیش‌بینی‌شده خاک سطحی در تفکیک ۲۵۰ متر همراه بازه عدم‌قطعیت.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/isric-soilgrids-site.json", "data"],
    ["macrostrat-raw", "Macrostrat regional geology query", "پرس‌وجوی زمین‌شناسی Macrostrat", "Raw regional geologic-unit response linked to the Iranian 1:1,000,000 source map.", "پاسخ خام واحد زمین‌شناسی منطقه‌ای مرتبط با نقشه ۱:۱٬۰۰۰٬۰۰۰ ایران.", "JSON", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/macrostrat-geology-site.json", "data"],
    ["osm-context-raw", "OpenStreetMap local context extract", "برداشت زمینه محلی OpenStreetMap", "Raw OSM XML used to draw the offline roads, water and settlements context map.", "XML خام OSM برای ترسیم آفلاین راه‌ها، آب و سکونتگاه‌ها.", "XML", "neutral", "phase-4", "regional-data", "assets/data/environmental/raw/openstreetmap-5km.xml", "data"],
  ].map(([id, en, fa, descriptionEn, descriptionFa, type, language, phase, status, href, kind]) => ({
    id,
    title: bi(en, fa),
    description: bi(descriptionEn, descriptionFa),
    type,
    language,
    phase,
    status,
    href,
    kind,
  })),
  rejected_concepts: {
    included: false,
    note: bi(
      "Early house-plan experiments were rejected and are intentionally excluded from recommendations and the active document library.",
      "آزمایش‌های اولیه پلان خانه رد شده‌اند و عمداً از توصیه‌ها و کتابخانه فعال اسناد کنار گذاشته شده‌اند.",
    ),
  },
};

const sources = {
  generated_on: "2026-07-30",
  items: [
    {
      dataset: bi("Original survey DWG", "نقشه DWG اولیه"),
      organisation: bi("Project-provided survey", "نقشه‌برداری ارائه‌شده پروژه"),
      accessed: "2026-07-29",
      period: bi("single drawing", "یک نقشه"),
      resolution: bi("drawing entities and labelled spot elevations", "عناصر نقشه و ترازهای نقطه‌ای برچسب‌دار"),
      status: "verified-integrity",
      limitation: bi(
        "No certified CRS, UTM zone, datum, north arrow or road label in active model space.",
        "در فضای فعال مدل، CRS معتبر، زون UTM، دیتوم، پیکان شمال یا برچسب راه وجود ندارد.",
      ),
      sha256: survey.source.dwg_sha256,
    },
    {
      dataset: bi("LibreDWG local DXF conversion", "تبدیل محلی DXF با LibreDWG"),
      organisation: bi("GNU LibreDWG 0.14.8547", "GNU LibreDWG 0.14.8547"),
      accessed: "2026-07-29",
      period: bi("single conversion", "یک تبدیل"),
      resolution: bi("ASCII R2013 DXF", "DXF نوع ASCII R2013"),
      status: "verified-integrity",
      limitation: bi(
        "Conversion preserves geometry; semantic site roles require documented interpretation.",
        "تبدیل، هندسه را حفظ می‌کند؛ نقش‌های معنایی سایت نیازمند تفسیر مستند هستند.",
      ),
      sha256: survey.source.dxf_sha256,
    },
    {
      dataset: bi("Site Survey Geometry Analysis", "تحلیل هندسه نقشه‌برداری سایت"),
      organisation: bi("HouseAI local analysis", "تحلیل محلی HouseAI"),
      accessed: "2026-07-29",
      period: bi("project snapshot v1-three-fields", "نسخه پروژه v1-three-fields"),
      resolution: bi("3 polygons, 8 point labels", "۳ چندضلعی، ۸ برچسب نقطه"),
      status: "verified",
      limitation: bi(
        "Point elevations are associated from nearest MTEXT labels; offsets are recorded.",
        "تراز نقاط از نزدیک‌ترین برچسب MTEXT مرتبط شده و فاصله‌ها ثبت شده‌اند.",
      ),
    },
    {
      dataset: bi("Unified Site Slope Analysis", "تحلیل شیب سایت یکپارچه"),
      organisation: bi("HouseAI local analysis", "تحلیل محلی HouseAI"),
      accessed: "2026-07-29",
      period: bi("project snapshot v1-three-fields", "نسخه پروژه v1-three-fields"),
      resolution: bi("8 points, 7 TIN facets, 1 m contours", "۸ نقطه، ۷ سطح TIN، خطوط تراز ۱ متری"),
      status: "preliminary-engineering-inference",
      limitation: bi(
        "No breaklines, soils, groundwater or construction-grade cut/fill model.",
        "شکست‌خط، داده خاک، آب زیرزمینی یا مدل اجرایی خاک‌برداری/خاک‌ریزی وجود ندارد.",
      ),
    },
    {
      dataset: bi("Independent Node.js geometry verification", "تأیید مستقل هندسه با Node.js"),
      organisation: bi("HouseAI reproducibility workflow", "گردش‌کار بازتولیدپذیری HouseAI"),
      accessed: "2026-07-29",
      period: bi("project snapshot v1-three-fields", "نسخه پروژه v1-three-fields"),
      resolution: bi("coordinate-level recomputation", "محاسبه مجدد در سطح مختصات"),
      status: independent.passed ? "passed" : "failed",
      limitation: bi(
        "Verifies exported geometry, not legal title or field monumentation.",
        "هندسه خروجی را تأیید می‌کند، نه مالکیت قانونی یا نشانه‌گذاری میدانی را.",
      ),
    },
    ...environmentalSources,
  ],
  methods: [
    bi("Translated-origin shoelace plan-area calculation", "محاسبه مساحت پلان با فرمول بندکفش و مبدأ انتقال‌یافته"),
    bi("Euclidean 2D and 3D edge lengths", "طول اقلیدسی دو و سه‌بعدی اضلاع"),
    bi("Pt8-centered piecewise-linear TIN", "TIN خطی قطعه‌ای با مرکز Pt8"),
    bi("Linear 1 m contour interpolation on TIN facets", "درون‌یابی خطی خطوط تراز ۱ متری روی سطوح TIN"),
    bi("South–north and west–east centroid section sampling", "نمونه‌برداری مقطع جنوب–شمال و غرب–شرق از مرکز سطح"),
    bi("Independent Node.js and reopened FreeCAD checks", "کنترل مستقل Node.js و بازگشایی مدل FreeCAD"),
    bi("WGS 84 / UTM zone 38N inverse projection for every survey point", "تبدیل معکوس WGS 84 / UTM زون ۳۸ شمالی برای همه نقاط نقشه‌برداری"),
    bi("1991–2020 daily climate aggregation with NASA POWER humidity, cloud and radiation cross-source fields", "تجمیع روزانه اقلیم ۱۹۹۱–۲۰۲۰ همراه رطوبت، ابر و تابش NASA POWER"),
    bi("16-sector seasonal wind roses and five speed classes from 87,672 hourly records", "گل‌باد فصلی ۱۶ بخشی و پنج رده سرعت از ۸۷٬۶۷۲ رکورد ساعتی"),
    bi("NOAA solar-position equations precomputed at 10-minute intervals, against a DEM-derived terrain horizon; no buildings or vegetation modelled", "معادلات موقعیت خورشید NOAA با گام ۱۰ دقیقه‌ای در برابر افق زمینِ برگرفته از مدل رقومی ارتفاع؛ ساختمان و پوشش گیاهی مدل نشده"),
    bi("Haversine distance analysis of the USGS regional earthquake catalog", "تحلیل فاصله هاورساین فهرست زلزله منطقه‌ای USGS"),
  ],
  reproducibility: {
    generator: "scripts/generate-data.mjs + scripts/environmental-data.mjs",
    source_version: version.site_version,
    immutable_source_policy: "read-only input; dashboard contains safe copies",
  },
};

const translationsEn = {
  skip: "Skip to content",
  project: "SITE / 001",
  verified: "Verified",
  preliminary: "Preliminary",
  unresolved: "Unresolved",
  unavailable: "Unavailable",
  probable: "Strong-probable · not certified",
  regionalEstimate: "Regional estimate",
  open: "Open",
  download: "Download",
  language: "FA",
  theme: "Theme",
  menu: "Menu",
  close: "Close",
  overview: "Overview",
  survey: "Survey & geometry",
  terrain: "Terrain & slope",
  geography: "Geographic context",
  climate: "Climate",
  solar: "Sun & shadow",
  wind: "Wind",
  hazards: "Hazards & engineering",
  architecture: "Architectural implications",
  documents: "Documents & downloads",
  methodology: "Sources & methodology",
  heroEyebrow: "IMMUTABLE SITE VERSION · v1-three-fields",
  heroTitle: "A steep mountain site.<br><span>Now read in its real climate.</span>",
  heroSummary: "A bilingual evidence interface for a 487.428568 m² family-house site at a probable project location near Baneh Verdeh—combining verified drawing geometry with traceable climate, sun, wind and regional hazards.",
  area: "Verified drawing-plan area",
  elevation: "Elevation range",
  relief: "Terrain relief",
  fall: "Primary fall",
  fallValue: "Northeast",
  road: "Road access",
  roadValue: "Pt2–Pt1 · south",
  north: "North",
  northValue: "Drawing +Y",
  status: "Project status",
  geoStatus: "Geolocation confidence",
  geoUnresolved: "Strong-probable · not certified",
  viewEvidence: "Explore evidence",
  overviewKicker: "The site at a glance",
  overviewTitle: "One drawing geometry, seven outer points, one steep terrain story",
  overviewLead: "The three source polygons have been unified without changing their verified combined drawing area. Pt8 is retained only as an interior terrain point; legal and cadastral status remain unresolved.",
  terrainStory: "Terrain story",
  terrainStoryText: "The road edge is high at Pt2/Pt1. All seven TIN facets descend generally northeast toward the low Pt5/Pt6 side.",
  evidenceState: "Evidence state",
  evidenceStateText: "Drawing geometry and the terrain model are verified. The probable project location rests on a strong-probable CRS interpretation that is not surveyor-certified; all five environmental modules remain preliminary at parcel scale.",
  boundary: "Unified drawing boundary",
  boundaryCaption: "Drawing-derived survey geometry · north-up · road edge highlighted",
  toggleContours: "Contours",
  toggleLabels: "Point labels",
  sevenOuter: "7 outer points",
  oneInterior: "Pt8 interior terrain point",
  surveyKicker: "Source geometry",
  surveyTitle: "From three survey polygons to one verified drawing geometry",
  surveyLead: "The drawing-boundary story remains auditable: source polygons, point associations, side lengths, area checks and cryptographic hashes are retained. This verification is not cadastral or proof of ownership.",
  originalPolygons: "Original polygons",
  unifiedEdges: "Unified drawing edges",
  coordinates: "Survey coordinates",
  searchPoints: "Search point or role…",
  point: "Point",
  easting: "Easting / X (m)",
  northing: "Northing / Y (m)",
  latitude: "Latitude",
  longitude: "Longitude",
  level: "Elevation (m)",
  role: "Role",
  association: "Label offset (m)",
  methodologyLabel: "Survey methodology",
  sourceIntegrity: "Source integrity",
  hashManifest: "Open SHA-256 manifest",
  legalScopeTitle: "Drawing verification is not legal verification",
  terrainKicker: "Eight-point terrain model",
  terrainTitle: "11.754 metres of relief across a compact property",
  terrainLead: "The verified spot elevations support a preliminary TIN, one-metre contours and two analytical sections—not construction earthwork quantities.",
  terrain3dKicker: "Surveyed terrain · interactive 3D",
  terrain3dTitle: "Read the 11.754-metre fall in three dimensions",
  terrain3dLead: "This surface uses only the eight surveyed spot elevations and seven verified TIN facets. Drag to orbit, scroll to zoom, and compare the road, boundary and contours.",
  perspectiveView: "Perspective",
  topView: "Top",
  roadView: "From road",
  hillsideView: "Hillside",
  resetView: "Reset view",
  showContours: "Contours",
  showPoints: "Survey points",
  verticalScale: "Vertical scale",
  shadowTrace: "Shadow path",
  shadowWithheld: "Vertical exaggeration active · metric shadow length and the shadow path are withheld",
  terrain3dHint: "Drag to orbit · scroll or pinch to zoom · arrow keys also rotate",
  terrain3dEvidence: "8 measured points · 7 TIN facets · hillside is the surveyed 38.27% slope eased into a 90 m DEM · trees illustrative · lower road client-reported",
  webglUnavailable: "Interactive 3D is unavailable in this browser. The drawing-derived 2D terrain plan remains available below.",
  profile: "Interactive elevation profile",
  longitudinal: "South–north",
  transverse: "West–east",
  hoverProfile: "Move across the chart to inspect distance and elevation.",
  slopeFacets: "TIN facet slopes",
  slopeRisks: "Cut, fill & drainage risks",
  modelLimits: "What this model cannot see",
  diagrams: "Technical diagrams",
  geographyKicker: "Probable project location",
  geographyTitle: "Probable location near Baneh Verdeh, on a steep Zagros hillside",
  geographyLead: "Interpreting the survey as WGS 84 / UTM zone 38N places the parcel coherently near Baneh Verdeh in Paveh County. This supports a strong-probable project location for regional analysis, but the CRS is not surveyor-certified and cannot support cadastral use.",
  scaleStudies: "Context study scales",
  contextMap: "Offline context map",
  locationLabel: "Probable project location",
  coordinateSystem: "Probable coordinate reference",
  crsCertification: "Probable CRS · not surveyor-certified",
  missing: "Missing evidence",
  nextGate: "Certification boundary",
  climateKicker: "Environmental evidence",
  climateTitle: "Cold wet winters. Hot dry summers.",
  climateLead: "A 1991–2020 ERA5-Land baseline is combined with NASA POWER humidity, cloud and radiation climatology, with resolution and uncertainty kept visible.",
  requestedMetrics: "Climate evidence coverage",
  monthlyClimate: "Monthly climate",
  temperatureAndRain: "Temperature & precipitation",
  snowFrostSolar: "Snow, frost & solar resource",
  climateExtremes: "Baseline extremes",
  futureClimate: "2031–2050 model range",
  annualMean: "Annual mean",
  solarKicker: "Solar integrity",
  solarTitle: "A high summer arc, a valuable low winter sun",
  solarLead: "Explore precomputed astronomical positions for the probable site coordinates against a terrain horizon sampled from a 90 m DEM. Neighbouring buildings and vegetation are still not modelled.",
  season: "Season",
  timeOfDay: "Time of day",
  play: "Play",
  pause: "Pause",
  solarInterpolated: "Interpolated between 10-minute samples · maximum deviation",
  testObject: "Test object",
  overlays: "Overlays",
  winter: "Winter solstice",
  equinox: "Equinox",
  summer: "Summer solstice",
  morning: "Morning",
  noon: "Solar noon",
  afternoon: "Afternoon",
  pole: "Pole",
  wall: "Wall",
  volume: "Generic volume",
  locked: "PRECOMPUTED EXPLORER",
  lockedTitle: "Astronomical shadow study",
  lockedText: "Season, local time and test object update only precomputed solar positions. The mountain horizon is DEM-derived; neighbouring buildings and vegetation are not modelled.",
  solarOutputs: "Current solar readout",
  solarOutputItems: "Altitude · azimuth · shadow direction · shadow length · sunrise / sunset context",
  localTime: "Local clock time",
  solarAltitude: "Solar altitude",
  solarAzimuth: "Solar azimuth",
  shadowLength: "Shadow length",
  sunriseSunset: "Sunrise / sunset",
  horizonWarning: "DEM-derived terrain horizon · no buildings or vegetation",
  windKicker: "Directional evidence",
  windTitle: "Regional easterlies shift toward summer westerlies",
  windLead: "Seasonal roses use 87,672 hourly ERA5-Land records from 2011–2020. Local valley channeling remains a field-check item.",
  seasonalCompare: "Seasonal comparison",
  noWind: "Annual wind distribution",
  prevailing: "Prevailing",
  meanSpeed: "Mean speed",
  calmHours: "Calm hours",
  windSourceNote: "10 m regional grid wind · direction is where wind comes from",
  hazardsKicker: "Risk register",
  hazardsTitle: "Separate what is known from what needs fieldwork",
  hazardsLead: "Site-scale facts are separated from regional datasets, preliminary inference and the investigations that still control engineering decisions.",
  hazardFilter: "Filter status",
  all: "All",
  regionalData: "Regional data",
  fieldInvestigation: "Field investigation",
  architectureKicker: "Design intelligence, not a floor plan",
  architectureTitle: "What the evidence means for the next architect",
  architectureLead: "Recommendations are deliberately grouped by confidence. They guide investigations and site response without presenting a final house design.",
  confidence: "Confidence",
  documentsKicker: "Project library",
  documentsTitle: "Useful evidence, organised and local",
  documentsLead: "Every listed item opens from this offline package. High-resolution technical diagrams and machine-readable data remain accessible.",
  docSearch: "Search documents…",
  docLanguage: "Language",
  docType: "File type",
  english: "English",
  persian: "Persian",
  neutral: "Language-neutral",
  rejectedArchive: "Early rejected concept experiments",
  rejectedNote: "Rejected house-plan concepts are not recommendations and are intentionally excluded from this dashboard’s active library.",
  methodsKicker: "Audit trail",
  methodsTitle: "Sources, limitations and reproducibility",
  methodsLead: "The source register distinguishes verified project evidence from absent datasets. No external network resource is needed to inspect this dashboard.",
  sourceRegister: "Source register",
  dataset: "Dataset",
  organisation: "Organisation",
  accessed: "Accessed",
  resolution: "Resolution",
  limitation: "Limitation",
  calculationMethods: "Calculation methods",
  reproducibility: "Reproducibility",
  sourceVersion: "Source version",
  dashboardGenerator: "Dashboard generator",
  generated: "Generated",
  networkDependency: "Network dependency",
  none: "None",
  footerText: "Offline evidence interface · no external requests · no final floor-plan recommendation",
  lightboxHint: "Press Escape to close",

  // Monthly table headers. Their bodies always localized; the headers did not,
  // so a Persian reader got Persian rows under English column names.
  colMonth: "Month",
  colTempMean: "T mean",
  colTempMax: "T max",
  colTempMin: "T min",
  colRain: "Rain",
  colSnow: "Snow",
  colHumidity: "RH",
  colSolar: "Solar",
  colFrost: "Frost",
  colSunrise: "Sunrise",
  colSunset: "Sunset",
  colDayLength: "Day",
  colNoonAltitude: "Noon altitude",
  colSunriseAzimuth: "Sunrise az.",
  colSunsetAzimuth: "Sunset az.",
  colSolarResource: "Solar resource",

  // Accessible names. Previously English-only in both languages.
  ariaHome: "Site Intelligence home",
  ariaPrimaryNav: "Primary navigation",
  ariaMobileNav: "Mobile navigation",
  ariaSwitchLanguage: "Switch language",
  themeToDark: "Use dark theme",
  themeToLight: "Use light theme",
  ariaHeroBoundary: "Animated drawing-derived site boundary",
  ariaBoundaryPlan: "North-up unified seven-point drawing boundary with Pt8 interior terrain point and southern road edge",
  ariaSiteMetrics: "Key site metrics",
  ariaElevationStrip: "Elevation range strip",
  ariaEvidenceStatus: "Evidence module status",
  ariaViewpoint: "3D terrain viewpoint",
  ariaSunPosition: "Sun position",
  ariaSunTime: "Sun time of day",
  ariaTerrainMap: "Interactive north-up terrain view with unified drawing boundary, TIN contours and measured elevations",
  ariaSectionProfile: "Section profile",
  ariaProfileChart: "Interactive terrain elevation profile",
  ariaContextMap: "Offline OpenStreetMap context showing the probable parcel location, roads, water and nearby settlements",
  ariaClimateView: "Climate chart view",
  ariaSolarControls: "Solar explorer controls",
  ariaSolarCanvas: "Precomputed seasonal sun path and test-object shadow",
  ariaWindSeason: "Wind season",
  ariaWindRose: "Seasonal 16-direction wind rose",
  ariaHazardFilter: "Hazard status filter",
  ariaBackToTop: "Back to top",
  ariaCloseImage: "Close image",

  // Strings that used to be inline `state.lang === "fa" ? … : …` ternaries in
  // app.js. Those bypassed the translation files entirely, so the parity check
  // could not see them: it compares key sets, and these had no keys.
  polygonLabel: "Polygon",
  areaShort: "Area",
  perimeter: "Perimeter",
  roleInterior: "Interior terrain",
  roleOuter: "Outer boundary",
  riskHigh: "High",
  riskMedium: "Medium",
  annualMeanTemperature: "Mean temperature",
  annualPrecipitation: "Annual precipitation",
  annualSnowfall: "Annual snowfall",
  annualHumidity: "Relative humidity",
  extremeDailyHigh: "Daily high",
  extremeDailyLow: "Daily low",
  extremeWettestDay: "Wettest day",
  extremePeakGust: "Peak gust",
  precipitation: "Precipitation",
  meanTemperature: "Mean temperature",
  meanMaxMin: "Mean max/min",
  snowfall: "Snowfall",
  frostDays: "Frost days",
  solarResource: "Solar resource",
  unitDays: "days",
  registeredDatasets: "registered datasets",
  canvasSite: "SITE",

  // Concept massing. Wording matters here: a comparison outcome, not a choice.
  concepts: "Concept massing",
  conceptsKicker: "Design study · nothing selected",
  conceptsTitle: "Three preliminary massings against the real slope",
  conceptsLead: "Each option comes from the design workspace in its own road-aligned frame and is transformed onto the surveyed points. Compare them, then put one in the 3D view to see how the sun actually lands on it.",
  showConcepts: "Concept massing",
  ariaConceptOption: "Concept option",
  colMetric: "Metric",
  conceptInternalArea: "Internal area (m²)",
  conceptGarageArea: "Garage & workshop (m²)",
  conceptCourtyardArea: "Courtyard (m²)",
  conceptFootprint: "Footprint (m²)",
  conceptFrame: "Origin Pt2, u axis along the road edge Pt2–Pt1. Worst survey round-trip error across all eight points:",

  // Terrain horizon. "Effective" never means sunrise or sunset: those are
  // astronomical, already published, and unchanged by terrain.
  showHorizon: "Terrain horizon",
  showHillside: "Surrounding hillside",
  showRoads: "Roads",
  showTrees: "Trees (illustrative)",
  showWind: "Prevailing wind (illustrative motion)",
  effectiveSun: "Effective sun on this day",
  firstSun: "First direct sun",
  lastSun: "Last direct sun",
  solarAccess: "Solar access",
  terrainShaded: "Terrain-shaded",

  // The procurement register.
  investigations: "Investigations needed",
  investigationsKicker: "What this dashboard cannot compute",
  investigationsTitle: "Nineteen things that need a person, an instrument or a licence",
  gate: "Gate",
  colInvestigation: "Investigation",
  colProcureVia: "Procure via",
  colBlocks: "Blocks",
  colProxy: "What stands in for it now",
  ariaGateFilter: "Investigation gate",
  ariaSpeciesFilter: "Species verdict filter",

  // Derived statistics surfaced beside the series they come from.
  degreeDays: "Degree-days & percentile temperatures",
  hdd: "Heating degree-days, base",
  cdd: "Cooling degree-days, base",
  coldPercentile: "Coldest 0.4% of daily minima",
  warmPercentile: "Warmest 0.4% of daily maxima",
  gustReturn: "Gust return periods",
  yearReturn: "year",
  facetGeometry: "Facet geometry",
  planArea: "Plan area",
  levelPlatform: "Building on the level",
  platformLevel: "Platform level",
  platformCutArea: "Area to cut",
  platformFillArea: "Area to fill",
  platformMaxCut: "Deepest cut",
  platformMaxFill: "Deepest fill",
  platformWithin: "Within ±1.5 m",
  surfaceExcess: "Surface excess over plan",
  balanceLevel: "Equal-depth level",
  bestPlatform: "Most area within ±1.5 m",
  bestPlatformLevel: "Level giving that area",
  surfaceArea: "3D surface area",
  surfaceRatio: "Surface / plan ratio",
  slopeBand: "Parcel in slope band",
  species: "Trees & planting",
  speciesKicker: "What will actually grow here",
  // Not every constraint applies to every species: the frost constraint is only
  // asked of the trees grown for a crop, so the heading counts the ones that
  // apply to all of them and names the extra one for what it is.
  speciesTitle: `${species.species.length} trees, tested against ${siteWideConstraints} things this site already measures — and one more for the ${species.fruit.count} that fruit`,
  speciesConstraints: `The ${siteWideConstraints} constraints, and one more for fruit`,
  speciesAppliesToFruit: "Fruit trees only",
  speciesRule: "How the verdicts are decided",
  speciesShortlist: "The shortlist",
  speciesAvoid: "Do not plant these",
  speciesAvoidLead: "Every one of these is fast-growing, and every one of them is what somebody recommends for exactly this brief.",
  speciesAskLocally: "Worth asking a nursery about",
  speciesPlacement: "Where a tree can stand",
  speciesCare: "Getting them established",
  speciesFilter: "Verdict",
  speciesHeight: "Height",
  speciesCrown: "Crown",
  speciesGrowth: "Growth",
  speciesHardiness: "Hardy to",
  speciesWater: "Water",
  speciesSoil: "Lime",
  speciesShadeArea: "Shade footprint",
  speciesOfParcel: "of the parcel",
  speciesTests: "Constraint tests",
  speciesSources: "Sources",
  speciesWikipedia: "Wikipedia",
  speciesWikipediaFa: "Wikipedia (Persian)",
  speciesPhotoCredit: "Photograph",
  speciesUntested: "Untested",
  speciesDisputed: "Sources disagree",
  speciesNative: "Native to Iran",
  speciesDeciduous: "Deciduous",
  speciesEvergreen: "Evergreen",
  testCold: "Cold",
  testDrought: "Drought",
  testSoil: "Soil",
  testExposure: "Wind & snow",
  testBloomFrost: "Bloom vs frost",
  testPollination: "Pollination",
  speciesFruitTitle: "Fruit: what the frost record decides",
  speciesFruitingOnly: "Fruiting",
  speciesFruiting: "Grown for fruit",
  speciesClientReported: "Reported growing here",
  speciesCropVerdict: "Crop",
  speciesCropTests: "Crop tests",
  speciesBloom: "Flowers",
  speciesSelfFertile: "One tree enough",
  speciesBudKill: "Bud kill 10% / 90%",
  speciesBudKillAbsent: "No full-bloom bud-kill temperature is published for this fruit in the extension table used, so none is shown.",
  speciesRootstock: "Rootstock",
  speciesFruitCount: "Fruit trees listed",
  speciesFruitFrostClear: "Flower after the last frost",
  speciesFruitPartner: "Need a second tree",
  speciesFruitClean: "Clear on every crop test",
  selfFertileYes: "Yes, self-fertile",
  selfFertilePartial: "Partly",
  selfFertileNo: "No, needs a partner",
  verdictPass: "Clears",
  verdictMarginal: "Marginal",
  verdictFail: "Fails",
  verdictUnknown: "Untested",
  growthFast: "Fast",
  growthMedium: "Medium",
  growthSlow: "Slow",
  waterHigh: "High",
  waterModerate: "Moderate",
  waterLow: "Low",
  alkalineVery: "Very alkaline",
  alkalineMildly: "Mildly alkaline",
  alkalineUnknown: "Not stated",
};

const translationsFa = {
  skip: "رفتن به محتوا",
  project: "سایت / ۰۰۱",
  verified: "تأییدشده",
  preliminary: "اولیه",
  unresolved: "حل‌نشده",
  unavailable: "ناموجود",
  probable: "محتمل با اطمینان قوی · تأییدنشده",
  regionalEstimate: "برآورد منطقه‌ای",
  open: "باز کردن",
  download: "دریافت",
  language: "EN",
  theme: "پوسته",
  menu: "فهرست",
  close: "بستن",
  overview: "نمای کلی",
  survey: "نقشه‌برداری و هندسه",
  terrain: "زمین و شیب",
  geography: "زمینه جغرافیایی",
  climate: "اقلیم",
  solar: "خورشید و سایه",
  wind: "باد",
  hazards: "مخاطرات و مهندسی",
  architecture: "پیامدهای معماری",
  documents: "اسناد و دریافت‌ها",
  methodology: "منابع و روش‌شناسی",
  heroEyebrow: "نسخه تغییرناپذیر سایت · v1-three-fields",
  heroTitle: "سایتی کوهستانی و پرشیب.<br><span>اکنون در اقلیم واقعی خود.</span>",
  heroSummary: "رابط شواهد دوزبانه برای سایت ۴۸۷٫۴۲۸۵۶۸ مترمربعی در موقعیت محتمل پروژه نزدیک بانه‌ورده؛ با هندسه ترسیمی تأییدشده و شواهد قابل‌ردیابی اقلیم، خورشید، باد و مخاطرات منطقه‌ای.",
  area: "مساحت پلان ترسیمی تأییدشده",
  elevation: "دامنه ارتفاع",
  relief: "اختلاف تراز زمین",
  fall: "جهت اصلی افت",
  fallValue: "شمال‌شرق",
  road: "دسترسی راه",
  roadValue: "Pt2–Pt1 · جنوب",
  north: "شمال",
  northValue: "جهت ‎+Y نقشه",
  status: "وضعیت پروژه",
  geoStatus: "اطمینان موقعیت جغرافیایی",
  geoUnresolved: "محتمل با اطمینان قوی · تأییدنشده",
  viewEvidence: "بررسی شواهد",
  overviewKicker: "سایت در یک نگاه",
  overviewTitle: "یک هندسه ترسیمی، هفت نقطه بیرونی و یک روایت پرشیب",
  overviewLead: "سه چندضلعی منبع بدون تغییر مساحت ترسیمی مجموعِ تأییدشده، یکپارچه شده‌اند. Pt8 فقط به‌عنوان نقطه داخلی زمین حفظ شده و وضعیت قانونی و ثبتی همچنان حل‌نشده است.",
  terrainStory: "روایت زمین",
  terrainStoryText: "لبه راه در Pt2/Pt1 بلند است. هر هفت سطح TIN عموماً به سمت شمال‌شرق و ضلع پایین Pt5/Pt6 نزول دارند.",
  evidenceState: "وضعیت شواهد",
  evidenceStateText: "هندسه ترسیمی و مدل زمین تأیید شده‌اند. موقعیت محتمل پروژه بر تفسیر CRS با اطمینان قوی تکیه دارد که توسط نقشه‌بردار تأیید نشده است؛ هر پنج ماژول محیطی در مقیاس قطعه همچنان اولیه‌اند.",
  boundary: "مرز ترسیمی یکپارچه",
  boundaryCaption: "هندسه برداشت‌شده از نقشه · شمال رو به بالا · لبه راه مشخص",
  toggleContours: "خطوط تراز",
  toggleLabels: "برچسب نقاط",
  sevenOuter: "۷ نقطه بیرونی",
  oneInterior: "Pt8 نقطه داخلی زمین",
  surveyKicker: "هندسه منبع",
  surveyTitle: "از سه چندضلعی نقشه‌برداری تا یک هندسه ترسیمی تأییدشده",
  surveyLead: "روایت مرز ترسیمی قابل ممیزی است: چندضلعی‌ها، ارتباط نقاط، طول اضلاع، کنترل مساحت و هش‌های رمزنگاری حفظ شده‌اند. این راستی‌آزمایی ثبتی یا اثبات مالکیت نیست.",
  originalPolygons: "چندضلعی‌های اولیه",
  unifiedEdges: "اضلاع ترسیمی یکپارچه",
  coordinates: "مختصات نقشه‌برداری",
  searchPoints: "جستجوی نقطه یا نقش…",
  point: "نقطه",
  easting: "شرقی / X (متر)",
  northing: "شمالی / Y (متر)",
  latitude: "عرض جغرافیایی",
  longitude: "طول جغرافیایی",
  level: "ارتفاع (متر)",
  role: "نقش",
  association: "فاصله برچسب (متر)",
  methodologyLabel: "روش نقشه‌برداری",
  sourceIntegrity: "صحت منبع",
  hashManifest: "باز کردن فهرست SHA-256",
  legalScopeTitle: "راستی‌آزمایی نقشه، راستی‌آزمایی قانونی نیست",
  terrainKicker: "مدل زمین هشت‌نقطه‌ای",
  terrainTitle: "۱۱٫۷۵۴ متر اختلاف تراز در ملکی فشرده",
  terrainLead: "ترازهای تأییدشده یک TIN اولیه، خطوط تراز یک‌متری و دو مقطع تحلیلی را پشتیبانی می‌کنند؛ نه مقادیر اجرایی عملیات خاکی.",
  terrain3dKicker: "زمین برداشت‌شده · سه‌بعدی تعاملی",
  terrain3dTitle: "افت تراز ۱۱٫۷۵۴ متری را در سه بُعد ببینید",
  terrain3dLead: "این سطح فقط از هشت تراز برداشت‌شده و هفت سطح TIN تأییدشده ساخته شده است. برای چرخش بکشید، برای بزرگ‌نمایی پیمایش کنید و راه، مرز و خطوط تراز را مقایسه کنید.",
  perspectiveView: "پرسپکتیو",
  topView: "نمای بالا",
  roadView: "از سمت راه",
  hillsideView: "دامنه",
  resetView: "بازنشانی نما",
  showContours: "خطوط تراز",
  showPoints: "نقاط برداشت",
  verticalScale: "مقیاس عمودی",
  shadowTrace: "مسیر سایه",
  shadowWithheld: "بزرگ‌نمایی عمودی فعال است · طول متری سایه و مسیر سایه ارائه نمی‌شود",
  terrain3dHint: "برای چرخش بکشید · برای بزرگ‌نمایی پیمایش یا نیشگون کنید · کلیدهای جهت نیز نما را می‌چرخانند",
  terrain3dEvidence: "۸ نقطه اندازه‌گیری‌شده · ۷ سطح TIN · دامنه، شیب برداشت‌شدهٔ ۳۸٫۲۷ درصدی است که به مدل رقومی ۹۰ متری می‌رسد · درختان نمایشی · راه پایینی به گفتهٔ کارفرما",
  webglUnavailable: "نمای سه‌بعدی تعاملی در این مرورگر در دسترس نیست. پلان دوبعدی برگرفته از نقشه در پایین باقی مانده است.",
  profile: "پروفیل تعاملی ارتفاع",
  longitudinal: "جنوب–شمال",
  transverse: "غرب–شرق",
  hoverProfile: "برای دیدن فاصله و ارتفاع روی نمودار حرکت کنید.",
  slopeFacets: "شیب سطوح TIN",
  slopeRisks: "خطرات خاک‌برداری، خاک‌ریزی و زهکشی",
  modelLimits: "آنچه مدل نمی‌بیند",
  diagrams: "نمودارهای فنی",
  geographyKicker: "موقعیت محتمل پروژه",
  geographyTitle: "موقعیت محتمل نزدیک بانه‌ورده، بر دامنه پرشیب زاگرس",
  geographyLead: "تفسیر نقشه به‌صورت WGS 84 / UTM زون ۳۸ شمالی، قطعه را به‌طور منسجم نزدیک بانه‌ورده در شهرستان پاوه قرار می‌دهد. این تفسیر موقعیت پروژه را برای تحلیل منطقه‌ای با اطمینان قوی محتمل می‌سازد، اما CRS توسط نقشه‌بردار تأیید نشده و برای کاربرد ثبتی قابل اتکا نیست.",
  scaleStudies: "مقیاس‌های مطالعه زمینه",
  contextMap: "نقشه زمینه آفلاین",
  locationLabel: "موقعیت محتمل پروژه",
  coordinateSystem: "مرجع مختصات محتمل",
  crsCertification: "CRS محتمل · تأییدنشده توسط نقشه‌بردار",
  missing: "شواهد مفقود",
  nextGate: "مرز اعتبار",
  climateKicker: "شواهد محیطی",
  climateTitle: "زمستان سرد و مرطوب؛ تابستان گرم و خشک",
  climateLead: "خط پایه ERA5-Land برای ۱۹۹۱–۲۰۲۰ با اقلیم‌نمای رطوبت، ابر و تابش NASA POWER ترکیب شده و تفکیک و عدم‌قطعیت آشکار است.",
  requestedMetrics: "پوشش شواهد اقلیمی",
  monthlyClimate: "اقلیم ماهانه",
  temperatureAndRain: "دما و بارش",
  snowFrostSolar: "برف، یخبندان و منبع خورشیدی",
  climateExtremes: "حدهای خط پایه",
  futureClimate: "دامنه مدل ۲۰۳۱–۲۰۵۰",
  annualMean: "میانگین سالانه",
  solarKicker: "درستی خورشیدی",
  solarTitle: "قوس بلند تابستان و خورشید ارزشمند کم‌ارتفاع زمستان",
  solarLead: "موقعیت‌های نجومی پیش‌محاسبه‌شده را برای مختصات محتمل سایت در برابر افق زمینِ نمونه‌برداری‌شده از مدل رقومی ارتفاع ۹۰ متری بررسی کنید. ساختمان‌های مجاور و پوشش گیاهی هنوز مدل نشده‌اند.",
  season: "فصل",
  timeOfDay: "زمان روز",
  play: "پخش",
  pause: "توقف",
  solarInterpolated: "درون‌یابی میان نمونه‌های ۱۰ دقیقه‌ای · بیشترین انحراف",
  testObject: "شیء آزمایشی",
  overlays: "لایه‌ها",
  winter: "انقلاب زمستانی",
  equinox: "اعتدال",
  summer: "انقلاب تابستانی",
  morning: "صبح",
  noon: "ظهر خورشیدی",
  afternoon: "بعدازظهر",
  pole: "میله",
  wall: "دیوار",
  volume: "حجم عمومی",
  locked: "کاوشگر پیش‌محاسبه‌شده",
  lockedTitle: "مطالعه نجومی سایه",
  lockedText: "فصل، زمان محلی و شیء آزمایشی فقط موقعیت‌های از پیش محاسبه‌شده خورشید را تغییر می‌دهند. افق کوهستان از مدل رقومی ارتفاع گرفته شده؛ ساختمان همسایه و پوشش گیاهی مدل نشده است.",
  solarOutputs: "خوانش فعلی خورشید",
  solarOutputItems: "ارتفاع · آزیموت · جهت سایه · طول سایه · زمینه طلوع / غروب",
  localTime: "زمان محلی",
  solarAltitude: "ارتفاع خورشید",
  solarAzimuth: "آزیموت خورشید",
  shadowLength: "طول سایه",
  sunriseSunset: "طلوع / غروب",
  horizonWarning: "افق زمین از مدل رقومی ارتفاع · بدون ساختمان و پوشش گیاهی",
  windKicker: "شواهد جهتی",
  windTitle: "باد شرقی منطقه‌ای در تابستان به غربی تغییر می‌کند",
  windLead: "گل‌بادهای فصلی از ۸۷٬۶۷۲ رکورد ساعتی ERA5-Land در ۲۰۱۱–۲۰۲۰ ساخته شده‌اند. کانالیزه‌شدن محلی دره همچنان نیازمند کنترل میدانی است.",
  seasonalCompare: "مقایسه فصلی",
  noWind: "توزیع سالانه باد",
  prevailing: "جهت غالب",
  meanSpeed: "سرعت میانگین",
  calmHours: "ساعات آرام",
  windSourceNote: "باد شبکه‌ای منطقه‌ای در ارتفاع ۱۰ متر · جهت، مبدأ وزش باد است",
  hazardsKicker: "ثبت ریسک",
  hazardsTitle: "دانسته‌ها را از نیازهای بررسی میدانی جدا کنید",
  hazardsLead: "واقعیت‌های مقیاس سایت از داده منطقه‌ای، استنباط اولیه و بررسی‌هایی که همچنان تصمیم مهندسی را کنترل می‌کنند جدا شده‌اند.",
  hazardFilter: "فیلتر وضعیت",
  all: "همه",
  regionalData: "داده منطقه‌ای",
  fieldInvestigation: "بررسی میدانی",
  architectureKicker: "شناخت طراحی، نه پلان نهایی",
  architectureTitle: "معنای شواهد برای معمار بعدی",
  architectureLead: "توصیه‌ها آگاهانه بر اساس اطمینان گروه‌بندی شده‌اند و بدون ارائه طرح نهایی، تحقیقات و پاسخ سایت را هدایت می‌کنند.",
  confidence: "اطمینان",
  documentsKicker: "کتابخانه پروژه",
  documentsTitle: "شواهد مفید، منظم و محلی",
  documentsLead: "هر مورد از این بسته آفلاین باز می‌شود. نمودارهای باکیفیت و داده ماشین‌خوان در دسترس می‌مانند.",
  docSearch: "جستجوی اسناد…",
  docLanguage: "زبان",
  docType: "نوع فایل",
  english: "انگلیسی",
  persian: "فارسی",
  neutral: "بی‌نیاز از زبان",
  rejectedArchive: "آزمایش‌های اولیه ردشده",
  rejectedNote: "مفاهیم ردشده پلان خانه توصیه نیستند و عمداً از کتابخانه فعال این داشبورد کنار گذاشته شده‌اند.",
  methodsKicker: "رد ممیزی",
  methodsTitle: "منابع، محدودیت‌ها و بازتولیدپذیری",
  methodsLead: "فهرست منابع، شواهد تأییدشده را از داده‌های غایب جدا می‌کند. برای بررسی این داشبورد به شبکه بیرونی نیازی نیست.",
  sourceRegister: "فهرست منابع",
  dataset: "مجموعه‌داده",
  organisation: "سازمان",
  accessed: "دسترسی",
  resolution: "تفکیک",
  limitation: "محدودیت",
  calculationMethods: "روش‌های محاسبه",
  reproducibility: "بازتولیدپذیری",
  sourceVersion: "نسخه منبع",
  dashboardGenerator: "تولیدکننده داشبورد",
  generated: "تاریخ تولید",
  networkDependency: "وابستگی شبکه",
  none: "هیچ",
  footerText: "رابط شواهد آفلاین · بدون درخواست بیرونی · بدون توصیه پلان نهایی",
  lightboxHint: "برای بستن Escape را بزنید",

  colMonth: "ماه",
  colTempMean: "میانگین دما",
  colTempMax: "بیشینه دما",
  colTempMin: "کمینه دما",
  colRain: "بارش",
  colSnow: "برف",
  colHumidity: "رطوبت نسبی",
  colSolar: "تابش",
  colFrost: "یخبندان",
  colSunrise: "طلوع",
  colSunset: "غروب",
  colDayLength: "طول روز",
  colNoonAltitude: "ارتفاع ظهر",
  colSunriseAzimuth: "سمت طلوع",
  colSunsetAzimuth: "سمت غروب",
  colSolarResource: "منبع تابش",

  ariaHome: "خانه شناخت سایت",
  ariaPrimaryNav: "ناوبری اصلی",
  ariaMobileNav: "ناوبری موبایل",
  ariaSwitchLanguage: "تغییر زبان",
  themeToDark: "استفاده از پوسته تاریک",
  themeToLight: "استفاده از پوسته روشن",
  ariaHeroBoundary: "نمایش متحرک مرز سایت برگرفته از نقشه",
  ariaBoundaryPlan: "مرز ترسیمی یکپارچه هفت‌نقطه‌ای با شمال به بالا، نقطه داخلی زمین Pt8 و لبه راه جنوبی",
  ariaSiteMetrics: "شاخص‌های کلیدی سایت",
  ariaElevationStrip: "نوار دامنه ارتفاع",
  ariaEvidenceStatus: "وضعیت پیمانه‌های شواهد",
  ariaViewpoint: "نقطه دید زمین سه‌بعدی",
  ariaSunPosition: "موقعیت خورشید",
  ariaSunTime: "زمان روز خورشید",
  ariaTerrainMap: "نمای تعاملی زمین با شمال به بالا، مرز ترسیمی یکپارچه، خطوط تراز TIN و ترازهای اندازه‌گیری‌شده",
  ariaSectionProfile: "مقطع نمایه",
  ariaProfileChart: "نمایه تعاملی ارتفاع زمین",
  ariaContextMap: "بستر آفلاین OpenStreetMap شامل موقعیت محتمل قطعه، راه‌ها، آب و آبادی‌های نزدیک",
  ariaClimateView: "نمای نمودار اقلیم",
  ariaSolarControls: "کنترل‌های کاوشگر خورشید",
  ariaSolarCanvas: "مسیر فصلی پیش‌محاسبه‌شده خورشید و سایه جسم آزمایشی",
  ariaWindSeason: "فصل باد",
  ariaWindRose: "گل‌باد فصلی ۱۶ جهتی",
  ariaHazardFilter: "پالایه وضعیت مخاطرات",
  ariaBackToTop: "بازگشت به بالا",
  ariaCloseImage: "بستن تصویر",

  polygonLabel: "چندضلعی",
  areaShort: "مساحت",
  perimeter: "محیط",
  roleInterior: "نقطه داخلی زمین",
  roleOuter: "مرز بیرونی",
  riskHigh: "زیاد",
  riskMedium: "متوسط",
  annualMeanTemperature: "دمای میانگین",
  annualPrecipitation: "بارش سالانه",
  annualSnowfall: "برف سالانه",
  annualHumidity: "رطوبت نسبی",
  extremeDailyHigh: "بیشینه روزانه",
  extremeDailyLow: "کمینه روزانه",
  extremeWettestDay: "بیشترین بارش روزانه",
  extremePeakGust: "بیشترین تندباد",
  precipitation: "بارش",
  meanTemperature: "دمای میانگین",
  meanMaxMin: "بیشینه/کمینه",
  snowfall: "برف",
  frostDays: "روز یخبندان",
  solarResource: "تابش خورشیدی",
  unitDays: "روز",
  registeredDatasets: "مجموعه‌داده ثبت‌شده",
  canvasSite: "سایت",

  concepts: "حجم‌پردازی مفهومی",
  conceptsKicker: "مطالعه طراحی · هیچ گزینه‌ای انتخاب نشده",
  conceptsTitle: "سه حجم‌پردازی اولیه در برابر شیب واقعی",
  conceptsLead: "هر گزینه از فضای کار طراحی و در دستگاه هم‌سو با راه می‌آید و روی نقاط برداشت‌شده تبدیل می‌شود. آن‌ها را مقایسه کنید و سپس یکی را در نمای سه‌بعدی بگذارید تا ببینید خورشید واقعاً چگونه بر آن می‌افتد.",
  showConcepts: "حجم‌پردازی مفهومی",
  ariaConceptOption: "گزینه مفهومی",
  colMetric: "شاخص",
  conceptInternalArea: "مساحت داخلی (m²)",
  conceptGarageArea: "پارکینگ و کارگاه (m²)",
  conceptCourtyardArea: "حیاط (m²)",
  conceptFootprint: "سطح اشغال (m²)",
  conceptFrame: "مبدأ Pt2 و محور u در امتداد لبه راه Pt2–Pt1. بیشترین خطای بازگشت به برداشت در هر هشت نقطه:",

  showHorizon: "افق زمین",
  showHillside: "دامنه پیرامون",
  showRoads: "راه‌ها",
  showTrees: "درختان (نمایشی)",
  showWind: "باد غالب (حرکت نمایشی)",
  effectiveSun: "خورشید مؤثر در این روز",
  firstSun: "نخستین تابش مستقیم",
  lastSun: "آخرین تابش مستقیم",
  solarAccess: "دسترسی خورشیدی",
  terrainShaded: "سایه زمین",

  investigations: "بررسی‌های لازم",
  investigationsKicker: "آنچه این داشبورد نمی‌تواند محاسبه کند",
  investigationsTitle: "نوزده مورد که به فرد، ابزار یا مجوز نیاز دارند",
  gate: "مرحله",
  colInvestigation: "بررسی",
  colProcureVia: "تأمین از طریق",
  colBlocks: "مانع چیست",
  colProxy: "فعلاً چه چیزی جای آن است",
  ariaGateFilter: "مرحله بررسی",
  ariaSpeciesFilter: "صافی حکم گونه",

  degreeDays: "درجه-روز و دماهای صدکی",
  hdd: "درجه-روز گرمایش، مبنا",
  cdd: "درجه-روز سرمایش، مبنا",
  coldPercentile: "سردترین ۰٫۴٪ کمینه‌های روزانه",
  warmPercentile: "گرم‌ترین ۰٫۴٪ بیشینه‌های روزانه",
  gustReturn: "دوره بازگشت تندباد",
  yearReturn: "ساله",
  facetGeometry: "هندسه وجه‌ها",
  planArea: "مساحت تصویر افقی",
  levelPlatform: "ساخت روی سکوی تراز",
  platformLevel: "تراز سکو",
  platformCutArea: "سطح خاک‌برداری",
  platformFillArea: "سطح خاک‌ریزی",
  platformMaxCut: "بیشترین عمق برداشت",
  platformMaxFill: "بیشترین عمق ریزش",
  platformWithin: "در محدودهٔ ±۱٫۵ متر",
  surfaceExcess: "مازاد سطح بر تصویر افقی",
  balanceLevel: "تراز با عمق برابر",
  bestPlatform: "بیشترین سطح در ±۱٫۵ متر",
  bestPlatformLevel: "ترازی که این سطح را می‌دهد",
  surfaceArea: "مساحت سطح سه‌بعدی",
  surfaceRatio: "نسبت سطح به تصویر",
  slopeBand: "سهم قطعه در بازه شیب",
  species: "درختان و کاشت",
  speciesKicker: "چه چیزی واقعاً اینجا می‌روید",
  speciesTitle: `${faDigits(species.species.length)} درخت، آزموده در برابر ${faDigits(siteWideConstraints)} چیزی که این سایت پیش‌تر اندازه گرفته است — و یکی بیشتر برای ${faDigits(species.fruit.count)} درختی که میوه می‌دهند`,
  speciesConstraints: `${faDigits(siteWideConstraints)} قید، و یکی دیگر برای میوه`,
  speciesAppliesToFruit: "فقط درختان میوه",
  speciesRule: "حکم‌ها چگونه تعیین می‌شوند",
  speciesShortlist: "فهرست کوتاه",
  speciesAvoid: "این‌ها را نکارید",
  speciesAvoidLead: "همه این‌ها سریع‌رشدند و همه‌شان همان چیزی‌اند که کسی برای دقیقاً همین خواسته پیشنهاد می‌کند.",
  speciesAskLocally: "ارزش پرسیدن از نهالستان",
  speciesPlacement: "درخت کجا می‌تواند بایستد",
  speciesCare: "استقرار درختان",
  speciesFilter: "حکم",
  speciesHeight: "ارتفاع",
  speciesCrown: "تاج",
  speciesGrowth: "رشد",
  speciesHardiness: "مقاوم تا",
  speciesWater: "آب",
  speciesSoil: "آهک",
  speciesShadeArea: "سطح سایه",
  speciesOfParcel: "از قطعه",
  speciesTests: "آزمون قیدها",
  speciesSources: "منابع",
  speciesWikipedia: "ویکی‌پدیا",
  speciesWikipediaFa: "ویکی‌پدیا (فارسی)",
  speciesPhotoCredit: "عکس",
  speciesUntested: "آزموده‌نشده",
  speciesDisputed: "اختلاف منابع",
  speciesNative: "بومی ایران",
  speciesDeciduous: "برگ‌ریز",
  speciesEvergreen: "همیشه‌سبز",
  testCold: "سرما",
  testDrought: "خشکی",
  testSoil: "خاک",
  testExposure: "باد و برف",
  testBloomFrost: "گلدهی در برابر یخبندان",
  testPollination: "گرده‌افشانی",
  speciesFruitTitle: "میوه: آنچه رکورد یخبندان تعیین می‌کند",
  speciesFruitingOnly: "میوه‌دار",
  speciesFruiting: "کاشت برای میوه",
  speciesClientReported: "گزارش رشد در منطقه",
  speciesCropVerdict: "محصول",
  speciesCropTests: "آزمون‌های محصول",
  speciesBloom: "گلدهی",
  speciesSelfFertile: "یک درخت کافی است",
  speciesBudKill: "تلفات جوانه ۱۰٪ / ۹۰٪",
  speciesBudKillAbsent: "برای این میوه هیچ دمای تلفات جوانه در تمام‌گلی در جدول ترویجی به‌کاررفته منتشر نشده، پس عددی نشان داده نمی‌شود.",
  speciesRootstock: "پایه",
  speciesFruitCount: "درختان میوه فهرست‌شده",
  speciesFruitFrostClear: "گلدهی پس از آخرین یخبندان",
  speciesFruitPartner: "نیازمند درخت دوم",
  speciesFruitClean: "قبول در همه آزمون‌های محصول",
  selfFertileYes: "بله، خودبارور",
  selfFertilePartial: "تا حدی",
  selfFertileNo: "نه، گرده‌افشان لازم دارد",
  verdictPass: "قبول",
  verdictMarginal: "مرزی",
  verdictFail: "رد",
  verdictUnknown: "آزموده‌نشده",
  growthFast: "سریع",
  growthMedium: "میان‌رده",
  growthSlow: "کند",
  waterHigh: "زیاد",
  waterModerate: "متوسط",
  waterLow: "کم",
  alkalineVery: "بسیار قلیایی",
  alkalineMildly: "کمی قلیایی",
  alkalineUnknown: "ذکر نشده",
};

/*
  The procurement register. This is the honest answer to everything the site
  data cannot produce: not an apology, a set of instructions with an owner.

  Each row states who supplies it (procure_via), when it is needed (gate), what
  it blocks, and what this dashboard already has in its place (proxy_available)
  together with how far that proxy can be trusted. A row exists precisely
  because no amount of computation on the bundled sources can close it.
*/
const investigationRow = (
  id, family, gate, en, fa, procureEn, procureFa, blocksEn, blocksFa, proxyEn, proxyFa,
) => ({
  id,
  family,
  gate,
  status: "requires-field-investigation",
  title: bi(en, fa),
  procure_via: bi(procureEn, procureFa),
  blocks: bi(blocksEn, blocksFa),
  proxy_available: bi(proxyEn, proxyFa),
});

const investigations = {
  status: "requires-field-investigation",
  intro: bi(
    "Everything below needs a person, an instrument or a licensed document. None of it can be computed from the sources this dashboard carries, and each row says what stands in for it in the meantime and how far that stand-in reaches.",
    "هر مورد زیر به یک فرد، یک ابزار یا یک سند دارای مجوز نیاز دارد. هیچ‌کدام از منابع این داشبورد محاسبه‌پذیر نیست و هر ردیف می‌گوید فعلاً چه چیزی جای آن را می‌گیرد و آن جایگزین تا کجا معتبر است.",
  ),
  gates: [
    { id: "before-concept", label: bi("Before concept design", "پیش از طراحی مفهومی") },
    { id: "before-permit", label: bi("Before permit", "پیش از پروانه") },
    { id: "before-construction", label: bi("Before construction", "پیش از اجرا") },
  ],
  families: [
    { id: "legal", label: bi("Legal & cadastral", "حقوقی و ثبتی") },
    { id: "codes", label: bi("Structural codes", "آیین‌نامه‌های سازه") },
    { id: "geotechnical", label: bi("Geotechnical", "ژئوتکنیک") },
    { id: "environment", label: bi("Environment & hazard", "محیط و مخاطره") },
    { id: "utilities", label: bi("Utilities & access", "تأسیسات و دسترسی") },
  ],
  items: [
    investigationRow("crs-certification", "legal", "before-concept",
      "Surveyor certification of the coordinate reference system",
      "تأیید نقشه‌بردار برای دستگاه مختصات",
      "A licensed surveyor, against a known control point",
      "نقشه‌بردار دارای پروانه، در برابر نقطه کنترل شناخته‌شده",
      "Every geographic claim, every distance to a mapped feature, and the solar geometry",
      "هر ادعای جغرافیایی، هر فاصله تا عارضه نقشه‌شده و هندسه خورشیدی",
      "EPSG:32638 is a strong-probable interpretation that resolves the parcel coherently in Paveh County; no surveyor has confirmed it",
      "EPSG:32638 تفسیری محتمل با اطمینان قوی است که قطعه را در شهرستان پاوه منسجم می‌نشاند؛ هیچ نقشه‌برداری آن را تأیید نکرده است"),
    investigationRow("title-boundary", "legal", "before-permit",
      "Registered title and legal boundary",
      "سند رسمی و مرز قانونی",
      "The land registry and a cadastral surveyor",
      "اداره ثبت و نقشه‌بردار ثبتی",
      "Any ownership, cadastral-boundary, easement or right-of-way-dependent decision",
      "هر تصمیم وابسته به مالکیت، مرز ثبتی، حق ارتفاق یا حق عبور",
      "A verified 487.428568 m² drawing geometry and area calculation, which are measurements rather than a title or cadastral record",
      "هندسه ترسیمی و محاسبه مساحت تأییدشده ۴۸۷٫۴۲۸۵۶۸ مترمربع، که اندازه‌گیری‌اند نه سند مالکیت یا سابقه ثبتی"),
    investigationRow("zoning", "legal", "before-concept",
      "Municipal zoning, height limit and floor-area ratio",
      "ضوابط شهرداری، حد ارتفاع و سطح اشغال",
      "The local municipality",
      "شهرداری محل",
      "Massing, storey count and every area target",
      "حجم‌پردازی، تعداد طبقه و هر هدف مساحتی",
      "Nothing. No zoning source is bundled, and none of the concept massing has been tested against one",
      "هیچ. هیچ منبع ضوابطی همراه نیست و هیچ‌یک از حجم‌های مفهومی در برابر آن آزموده نشده است"),
    investigationRow("topographic-survey", "legal", "before-concept",
      "Full topographic survey",
      "نقشه‌برداری توپوگرافی کامل",
      "A surveyor with total station or GNSS",
      "نقشه‌بردار با توتال‌استیشن یا GNSS",
      "Grading design, platform levels and any earthwork estimate",
      "طراحی تسطیح، ترازهای سکو و هر برآورد خاکی",
      "A TIN interpolated from eight spot elevations, which is a surface hypothesis rather than a survey",
      "یک TIN درون‌یابی‌شده از هشت تراز نقطه‌ای، که فرضیه سطح است نه برداشت"),
    investigationRow("seismic-parameters", "codes", "before-concept",
      "Standard 2800 seismic design parameters",
      "پارامترهای طراحی لرزه‌ای استاندارد ۲۸۰۰",
      "The licensed standard and a structural engineer",
      "استاندارد دارای مجوز و مهندس سازه",
      "The entire lateral system",
      "کل سامانه جانبی",
      "A regional earthquake catalogue only. No base acceleration, zone or spectrum ordinate is published here, at any label: a number in that position becomes a design input regardless of its caveat",
      "فقط فهرست منطقه‌ای زلزله. هیچ شتاب مبنا، پهنه یا مقدار طیفی اینجا منتشر نشده است، با هیچ برچسبی: عددی در آن جایگاه صرف‌نظر از هشدارش تبدیل به ورودی طراحی می‌شود"),
    investigationRow("nbc-loads", "codes", "before-concept",
      "National Building Code Part 6 design loads",
      "بارهای طراحی مبحث ششم مقررات ملی ساختمان",
      "The licensed code and a structural engineer",
      "آیین‌نامه دارای مجوز و مهندس سازه",
      "Snow, wind and live load design",
      "طراحی بار برف، باد و زنده",
      "Measured snow depth and a gust return period, neither of which is a code load: snow depth needs a density this project does not have, and ground load is not roof load on a 40% drifting slope",
      "عمق برف اندازه‌گیری‌شده و دوره بازگشت تندباد، که هیچ‌کدام بار آیین‌نامه‌ای نیستند: عمق برف به چگالی‌ای نیاز دارد که این پروژه ندارد و بار زمین با بار بام روی شیب ۴۰ درصدیِ برف‌گیر یکی نیست"),
    investigationRow("bearing-capacity", "geotechnical", "before-permit",
      "Bearing capacity and foundation design parameters",
      "ظرفیت باربری و پارامترهای طراحی پی",
      "A geotechnical investigation with boreholes and laboratory testing",
      "بررسی ژئوتکنیک با گمانه و آزمایش آزمایشگاهی",
      "Foundation type, depth and sizing",
      "نوع، عمق و ابعاد پی",
      "SoilGrids 250 m predictions of texture and pH with wide intervals, which describe soil chemistry rather than strength",
      "پیش‌بینی ۲۵۰ متری SoilGrids از بافت و pH با بازه‌های گسترده، که شیمی خاک را توصیف می‌کند نه مقاومت را"),
    investigationRow("groundwater", "geotechnical", "before-permit",
      "Groundwater level and seasonal variation",
      "تراز آب زیرزمینی و نوسان فصلی",
      "Standpipes read across a full year",
      "لوله‌های مشاهده‌ای با قرائت یک‌ساله",
      "Basement viability, waterproofing and retaining design",
      "امکان زیرزمین، عایق‌بندی و طراحی دیوار حائل",
      "Nothing measured. Only a preliminary surface-drainage tendency toward the northeast",
      "هیچ اندازه‌گیری‌ای. فقط تمایل اولیه زهکشی سطحی به‌سوی شمال‌شرق"),
    investigationRow("frost-depth", "geotechnical", "before-permit",
      "Frost penetration depth",
      "عمق نفوذ یخبندان",
      "The local authority or a geotechnical report",
      "مرجع محلی یا گزارش ژئوتکنیک",
      "Minimum foundation depth",
      "حداقل عمق پی",
      "A frost-day count from the climate baseline, which counts days below zero and says nothing about how deep the freeze reaches",
      "شمار روزهای یخبندان از خط پایه اقلیم، که روزهای زیر صفر را می‌شمارد و درباره عمق یخ‌زدگی چیزی نمی‌گوید"),
    investigationRow("slope-stability", "geotechnical", "before-permit",
      "Slope stability assessment",
      "ارزیابی پایداری شیب",
      "A geotechnical engineer, informed by the borehole log",
      "مهندس ژئوتکنیک بر پایه گزارش گمانه",
      "Retaining heights, terracing and construction sequence",
      "ارتفاع دیوار حائل، پله‌بندی و توالی اجرا",
      "A measured 34.5–44% grade across every facet, which establishes that stability is the question rather than answering it",
      "شیب اندازه‌گیری‌شده ۳۴٫۵ تا ۴۴ درصد در همه وجه‌ها، که نشان می‌دهد پایداری پرسش است، نه پاسخ"),
    investigationRow("horizon-field-survey", "environment", "before-concept",
      "Field horizon survey from the building platform",
      "برداشت میدانی افق از تراز ساختمان",
      "A clinometer or a fisheye survey from the intended platform level",
      "شیب‌سنج یا برداشت لنز چشم‌ماهی از تراز سکوی موردنظر",
      "Any winter solar-gain strategy that depends on the last hours of direct sun",
      "هر راهبرد بهره خورشیدی زمستان که به ساعات پایانی تابش مستقیم وابسته است",
      "A 90 m DEM horizon, whose cell is wider than the whole parcel and therefore cannot see the site's own upslope self-shading",
      "افق از مدل رقومی ۹۰ متری، که سلول آن از کل قطعه پهن‌تر است و خودسایه‌اندازی شیب خود سایت را نمی‌بیند"),
    investigationRow("neighbour-survey", "environment", "before-concept",
      "Neighbouring building heights and overshadowing",
      "ارتفاع ساختمان‌های مجاور و سایه‌اندازی",
      "A site visit with measured heights and positions",
      "بازدید میدانی با اندازه‌گیری ارتفاع و موقعیت",
      "Overshadowing, privacy and party-boundary decisions",
      "تصمیم‌های سایه‌اندازی، حریم خصوصی و مرز مشترک",
      "None at all. The 5 km OpenStreetMap extract contains zero building footprints, so nothing can be inferred at any confidence",
      "هیچ. استخراج ۵ کیلومتری OpenStreetMap هیچ ردپای ساختمانی ندارد؛ بنابراین با هیچ درجه اطمینانی استنباطی ممکن نیست"),
    investigationRow("anemometry", "environment", "before-permit",
      "On-site wind measurement",
      "اندازه‌گیری باد در محل",
      "A mast or logger through at least one windy season",
      "دکل یا داده‌نگار در دست‌کم یک فصل بادخیز",
      "Wind-driven rain, terrace usability and any topographic speed-up factor",
      "باران رانده‌شده با باد، کارایی تراس و هر ضریب تشدید توپوگرافی",
      "A regional 11 km reanalysis rose and a gust return period, neither of which resolves valley channeling at parcel scale",
      "گل‌باد بازتحلیل منطقه‌ای ۱۱ کیلومتری و دوره بازگشت تندباد، که هیچ‌کدام کانالیزه‌شدن دره را در مقیاس قطعه تفکیک نمی‌کند"),
    investigationRow("flood-drainage", "environment", "before-permit",
      "Legal discharge point and flood assessment",
      "نقطه تخلیه قانونی و ارزیابی سیلاب",
      "The municipality and a drainage engineer",
      "شهرداری و مهندس زهکشی",
      "Surface-water design and any downslope discharge",
      "طراحی آب سطحی و هر تخلیه پایین‌دست",
      "A preliminary downslope tendency toward Pt5/Pt6; no legal discharge point is established",
      "تمایل اولیه پایین‌دست به‌سوی Pt5/Pt6؛ هیچ نقطه تخلیه قانونی تثبیت نشده است"),
    investigationRow("radon-wildfire", "environment", "before-permit",
      "Radon and wildfire exposure screening",
      "غربالگری رادون و مواجهه با آتش‌سوزی طبیعی",
      "Local authority mapping and a radon test kit",
      "نقشه‌های مرجع محلی و کیت آزمون رادون",
      "Sub-floor ventilation and defensible-space planning",
      "تهویه زیرکف و برنامه‌ریزی فضای دفاع‌پذیر",
      "Regional geology and a nearest-woodland distance, neither of which is an exposure assessment",
      "زمین‌شناسی منطقه‌ای و فاصله تا نزدیک‌ترین جنگل، که هیچ‌کدام ارزیابی مواجهه نیستند"),
    investigationRow("utility-connections", "utilities", "before-permit",
      "Electricity, water, sewer and gas connection points",
      "نقاط انشعاب برق، آب، فاضلاب و گاز",
      "Each utility provider, in writing",
      "هر شرکت خدماتی، به‌صورت مکتوب",
      "Service routing, meter positions and connection cost",
      "مسیر خدمات، محل کنتور و هزینه انشعاب",
      "The nearest mapped power infrastructure is a transmission line 3.56 km away that imposes no easement and is not a connection point; no distribution network is mapped near the parcel",
      "نزدیک‌ترین زیرساخت برق نقشه‌شده، خط انتقالی در ۳٫۵۶ کیلومتری است که حریمی تحمیل نمی‌کند و نقطه انشعاب نیست؛ هیچ شبکه توزیعی نزدیک قطعه نقشه نشده است"),
    investigationRow("road-gradient", "utilities", "before-concept",
      "Road gradient and vehicle access at the Pt2–Pt1 edge",
      "شیب راه و دسترسی خودرو در لبه Pt2–Pt1",
      "A site visit with levels taken along the road edge",
      "بازدید میدانی با ترازیابی در امتداد لبه راه",
      "Garage position, driveway gradient and turning geometry",
      "موقعیت پارکینگ، شیب رمپ و هندسه گردش",
      "A verified 10.270569 m drawing-derived road-edge length and its two end elevations, which give the edge but not the road's own gradient or legal extent",
      "طول ترسیمی تأییدشده ۱۰٫۲۷۰۵۶۹ متر برای لبه راه و تراز دو انتهای آن، که لبه را می‌دهد اما شیب خود راه یا محدوده قانونی آن را نه"),
    investigationRow("construction-access", "utilities", "before-construction",
      "Construction access and crane or plant standing",
      "دسترسی کارگاهی و استقرار جرثقیل یا ماشین‌آلات",
      "A contractor method statement",
      "روش اجرای پیمانکار",
      "Buildability of any scheme on a 40% slope with a single 10 m road frontage",
      "اجراپذیری هر طرح روی شیب ۴۰ درصد با تنها ۱۰ متر بر راه",
      "The verified drawing geometry shows the constraint but does not resolve it",
      "هندسه ترسیمی تأییدشده محدودیت را نشان می‌دهد اما آن را حل نمی‌کند"),
    investigationRow("noise", "utilities", "before-concept",
      "Ambient noise from the road edge",
      "نوفه محیطی از لبه راه",
      "A sound level meter over a representative period",
      "ترازسنج صوت در بازه نماینده",
      "Window specification and room placement on the road side",
      "مشخصات پنجره و چیدمان اتاق در سمت راه",
      "Nothing measured. Road class from OpenStreetMap only",
      "هیچ اندازه‌گیری‌ای. فقط رده راه از OpenStreetMap"),
  ],
};

const generated = {
  "project.json": project,
  "site.json": site,
  "survey-points.json": surveyPoints,
  "terrain.json": terrain,
  "geography.json": geography,
  "climate.json": climate,
  "solar.json": solar,
  "wind.json": wind,
  "hazards.json": hazards,
  "recommendations.json": recommendations,
  "documents.json": documents,
  "sources.json": sources,
  "concepts.json": conceptMassing,
  "horizon.json": horizon,
  "local-terrain.json": localTerrain,
  "planting.json": planting,
  "roads.json": roads,
  "investigations.json": investigations,
  "terrain-metrics.json": terrainMetrics,
  "platform.json": platform,
  "species.json": species,
  "translations.en.json": translationsEn,
  "translations.fa.json": translationsFa,
};

for (const [name, value] of Object.entries(generated)) writeJson(name, value);

const bundle = {
  project,
  site,
  survey: surveyPoints,
  terrain,
  geography,
  climate,
  solar,
  wind,
  hazards,
  recommendations,
  documents,
  sources,
  concepts: conceptMassing,
  horizon,
  localTerrain,
  planting,
  roads,
  investigations,
  terrainMetrics,
  platform,
  species,
  translations: { en: translationsEn, fa: translationsFa },
};
fs.writeFileSync(
  path.join(dataDir, "data.js"),
  `/* Generated from immutable site-base/${version.site_version}; do not edit directly. */\nwindow.HOUSEAI_DATA = ${JSON.stringify(bundle)};\n`,
);

const sanitizeReport = (content) =>
  content
    .replace(
      /^(- Original found at:\s*)`[^`]+`/gm,
      "$1[original source location withheld]",
    )
    .replace(
      /\/Users\/[^/\r\n]+\/[^\r\n`]*\/site\/original-survey\.dwg/g,
      "site-base source/original-survey.dwg",
    )
    .replace(
      /\/Users\/[^/\r\n]+\/[^\r\n`]*\/site\/survey-converted\.dxf/g,
      "site-base source/survey-converted.dxf",
    )
    .replaceAll("site/original-survey.dwg", "site-base source/original-survey.dwg")
    .replaceAll("site/survey-converted.dxf", "site-base source/survey-converted.dxf");

fs.writeFileSync(
  path.join(docsDir, "site-report.en.md"),
  sanitizeReport(fs.readFileSync(path.join(sourceDir, "site-report.md"), "utf8")),
);
fs.writeFileSync(
  path.join(docsDir, "slope-analysis.en.md"),
  fs.readFileSync(path.join(sourceDir, "slope-analysis.md"), "utf8"),
);
fs.writeFileSync(
  path.join(docsDir, "site-summary.fa.md"),
  `# خلاصه هندسه ترسیمی تأییدشده سایت\n\n` +
    `> این خلاصه فقط از نسخه تغییرناپذیر \`${version.site_version}\` تولید شده و توصیه پلان نهایی، تأیید مهندسی، سند مالکیت یا سابقه ثبتی نیست.\n\n` +
    `- مساحت پلان ترسیمی تأییدشده: **${version.site_area_m2.toFixed(6)} مترمربع**\n` +
    `- ترتیب مرز بیرونی: \`${version.outer_boundary_order.join(" → ")}\`\n` +
    `- Pt8: نقطه داخلی مدل زمین\n` +
    `- برِ راه: **Pt2–Pt1** با طول افقی **${version.road_boundary_length_m.toFixed(6)} متر**\n` +
    `- شمال پروژه: جهت **+Y نقشه**\n` +
    `- دامنه ارتفاع: **${version.elevation_min_m.toFixed(3)} تا ${version.elevation_max_m.toFixed(3)} متر**\n` +
    `- اختلاف تراز: **${version.total_relief_m.toFixed(3)} متر**\n` +
    `- شیب سطوح TIN: **${Math.min(...unified.triangles.map((item) => item.slope_percent)).toFixed(2)}٪ تا ${Math.max(...unified.triangles.map((item) => item.slope_percent)).toFixed(2)}٪**\n` +
    `- جهت عمومی افت: **شمال‌شرق**\n\n` +
    `- موقعیت محتمل پروژه: **نزدیک بانه‌ورده، شهرستان پاوه، استان کرمانشاه**\n` +
    `- مرجع مختصات محتمل: **WGS 84 / UTM زون ۳۸ شمالی (EPSG:32638)**\n` +
    `- مرکز تقریبی: **${siteGeolocation.latitude.toFixed(8)}° N، ${siteGeolocation.longitude.toFixed(8)}° E**\n\n` +
    `## محدودیت‌های مهم\n\n` +
    `مدل زمین فقط بر هشت تراز نقطه‌ای استوار است و شکست‌خط، دیوار، جدول، آب زیرزمینی و تغییرات موضعی شیب را نشان نمی‌دهد. تفسیر CRS با موقعیت بانه‌ورده انطباق قوی دارد، اما هنوز توسط نقشه‌بردار و نقطه کنترل تأیید نشده است. مالکیت قانونی، مرز ثبتی، حقوق ارتفاقی و حقوق عبور حل‌نشده‌اند. داده‌های اقلیم، خورشید، باد، زمین‌شناسی، خاک و زلزله منطقه‌ای‌اند و جایگزین ایستگاه محلی، گمانه ژئوتکنیک، افق‌برداری یا طراحی مهندسی نیستند.\n`,
);

const environmentalSummary = {
  generated_on: "2026-07-30",
  geolocation: geography,
  climate,
  solar,
  wind,
  hazards: hazardEvidence,
  sources: environmentalSources,
};
fs.writeFileSync(
  path.join(environmentalDataDir, "environmental-summary.json"),
  `${JSON.stringify(environmentalSummary, null, 2)}\n`,
);

fs.writeFileSync(
  path.join(docsDir, "environmental-methodology.md"),
  `# Environmental methodology / روش‌شناسی محیطی\n\n` +
    `## English\n\n` +
    `The survey coordinates are interpreted as WGS 84 / UTM zone 38N (EPSG:32638). The parcel centre converts to ` +
    `**${siteGeolocation.latitude.toFixed(8)}° N, ${siteGeolocation.longitude.toFixed(8)}° E**, matching Baneh Verdeh in OpenStreetMap. ` +
    `This is a strong-probable project location for regional analysis, not a surveyor-certified CRS.\n\n` +
    `Climate uses daily ERA5-Land data for 1991–2020 at approximately 11 km resolution. NASA POWER supplies the 2001–2020 monthly humidity, cloud and solar climatology. ` +
    `Wind roses use 87,672 hourly ERA5-Land records from 2011–2020, grouped into 16 directions and five speed classes. ` +
    `Solar positions use NOAA fractional-year equations and are precomputed at 10-minute intervals against a terrain horizon sampled from Copernicus GLO-90. ` +
    `Future considerations compare EC-Earth3P-HR and MPI-ESM1-2-XR HighResMIP/CMIP6 2001–2020 baselines against 2031–2050. ` +
    `Regional hazards combine the USGS M≥4.5 earthquake catalog within 200 km, Macrostrat regional geology, SoilGrids 250 m predictions, OpenStreetMap context and the verified site TIN.\n\n` +
    `These gridded and regional sources do not replace a survey control point, on-site weather/wind observation, horizon survey, geotechnical investigation, drainage design, legal boundary work or the applicable Iranian building codes.\n\n` +
    `## فارسی\n\n` +
    `مختصات نقشه به‌صورت WGS 84 / UTM زون ۳۸ شمالی (EPSG:32638) تفسیر شده است. مرکز ملک به ` +
    `**${siteGeolocation.latitude.toFixed(8)} درجه شمالی و ${siteGeolocation.longitude.toFixed(8)} درجه شرقی** تبدیل می‌شود و با بانه‌ورده در OpenStreetMap انطباق دارد. ` +
    `این موقعیت پروژه برای تحلیل منطقه‌ای با اطمینان قوی محتمل است، اما CRS توسط نقشه‌بردار تأیید نشده است.\n\n` +
    `اقلیم از داده روزانه ERA5-Land در دوره ۱۹۹۱–۲۰۲۰ با تفکیک تقریبی ۱۱ کیلومتر استفاده می‌کند. NASA POWER اقلیم‌نمای ماهانه رطوبت، ابر و تابش ۲۰۰۱–۲۰۲۰ را تأمین می‌کند. ` +
    `گل‌بادها از ۸۷٬۶۷۲ رکورد ساعتی ERA5-Land در ۲۰۱۱–۲۰۲۰ و در ۱۶ جهت و پنج رده سرعت ساخته شده‌اند. ` +
    `موقعیت خورشید با معادلات سال‌کسری NOAA و گام ۱۰ دقیقه‌ای در برابر افق زمین برگرفته از Copernicus GLO-90 پیش‌محاسبه شده است. ` +
    `بررسی آینده، خط پایه ۲۰۰۱–۲۰۲۰ مدل‌های EC-Earth3P-HR و MPI-ESM1-2-XR از HighResMIP/CMIP6 را با ۲۰۳۱–۲۰۵۰ مقایسه می‌کند. ` +
    `مخاطرات منطقه‌ای از فهرست زلزله USGS، زمین‌شناسی Macrostrat، پیش‌بینی ۲۵۰ متری SoilGrids، زمینه OpenStreetMap و TIN تأییدشده سایت استفاده می‌کنند.\n\n` +
    `این منابع شبکه‌ای و منطقه‌ای جایگزین نقطه کنترل نقشه‌برداری، مشاهده محلی هوا/باد، افق‌برداری، بررسی ژئوتکنیک، طراحی زهکشی، کار ثبتی یا آیین‌نامه‌های لازم ایران نیستند.\n`,
);

console.log(`Generated ${Object.keys(generated).length} JSON files, data.js, environmental summary and 4 safe report copies.`);
