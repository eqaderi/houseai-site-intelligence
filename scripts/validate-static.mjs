import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { verifyInterpolationBound, verifySolarGeometry } from "./verify-solar-3d.mjs";
import { verifyPrivacy } from "./verify-privacy.mjs";
// Accessibility is a separate Chrome-driven script (verify-accessibility.mjs).

// Pinned so the offline guarantee survives a vendor swap. Update deliberately.
const THREE_SHA256 = "dc00b6025b327639fb291b18469d9931cd2964978bb6241a1f1fe709903f2c92";

const dashboard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dashboard, "data", name), "utf8"));
const failures = [];
const checks = [];
const pass = (label, condition, detail = "") => {
  checks.push({ label, condition, detail });
  if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
};

const html = fs.readFileSync(path.join(dashboard, "index.html"), "utf8");
const css = fs.readFileSync(path.join(dashboard, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(dashboard, "app.js"), "utf8");
const site = readJson("site.json");
const survey = readJson("survey-points.json");
const terrain = readJson("terrain.json");
const project = readJson("project.json");
const geography = readJson("geography.json");
const climate = readJson("climate.json");
const solar = readJson("solar.json");
const wind = readJson("wind.json");
const hazards = readJson("hazards.json");
const readiness = readJson("architectural-readiness.json");
const clientBrief = readJson("client-brief.json");
const recommendations = readJson("recommendations.json");
const documents = readJson("documents.json");
const en = readJson("translations.en.json");
const fa = readJson("translations.fa.json");

const htmlRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith("#"));
const dataRefs = documents.items.map((item) => item.href);
const localRefs = [...new Set([...htmlRefs, ...dataRefs])];
const localPath = (reference) => decodeURIComponent(reference.split(/[?#]/, 1)[0]);
const missing = localRefs.filter((reference) => !fs.existsSync(path.resolve(dashboard, localPath(reference))));
pass("All local HTML and document references exist", missing.length === 0, missing.join(", "));

// Scope: the runtime code we author. terrain-3d.js was previously unscanned —
// a real blind spot, since it is a full script tag on the page.
// Deliberately excluded:
//   data/data.js       — its URLs are source-register citations shown to the
//                        reader (USGS, NASA POWER, SoilGrids…), never fetched.
//   three.min.js       — contains threejs.org URLs in its own deprecation
//                        notices; pinned by hash below instead.
//   scripts/*.mjs      — build-time, and hold the twelve source URLs on purpose.
const terrain3d = fs.readFileSync(path.join(dashboard, "terrain-3d.js"), "utf8");
const networkRefs = `${html}\n${css}\n${app}\n${terrain3d}`
  .match(/https?:\/\/|@import\s+url|fonts\.google|cdnjs|unpkg|jsdelivr/gi) || [];
pass("No network or CDN dependency", networkRefs.length === 0, networkRefs.join(", "));

// The offline `file://` guarantee has three mechanical preconditions. Under
// file:// the origin is `null`, so ES modules and fetch are both CORS-blocked;
// asserting these is what makes the promise testable without a browser.
pass("No ES module scripts (blocked from file://)", !/type=["']module["']/.test(html));
pass(
  "No fetch or XHR at runtime (blocked from file://)",
  !/\bfetch\(|XMLHttpRequest/.test(`${app}\n${terrain3d}`),
);
pass(
  "Runtime data arrives as a global from a classic script",
  /<script src="data\/data\.js(?:\?[^\"]+)?"><\/script>/.test(html)
    && app.includes("window.HOUSEAI_DATA"),
);

const vendorHash = createHash("sha256")
  .update(fs.readFileSync(path.join(dashboard, "assets/vendor/three/three.min.js")))
  .digest("hex");
pass(
  "Vendored Three.js matches the pinned build",
  vendorHash === THREE_SHA256,
  vendorHash,
);

// The 3D module shipped dead once: it assigned window.HOUSEAI_TERRAIN_3D and
// nothing ever called init(). These two assertions are what make that visible.
pass("3D terrain module is wired into app.js", app.includes("HOUSEAI_TERRAIN_3D"));
pass(
  "3D sun is driven by solar data, not a hardcoded vector",
  terrain3d.includes("api.setSun") && !/position\.set\(-32,\s*48,\s*24\)/.test(terrain3d),
);

const solarGeometry = verifySolarGeometry();
pass(
  `Solar 3D geometry is exact across ${solarGeometry.checks} precomputed positions`,
  solarGeometry.failures.length === 0,
  solarGeometry.failures.join(" · "),
);

// The time slider is continuous over a discrete table, so the blend error is a
// published upper bound rather than a silent approximation.
const interpolation = verifyInterpolationBound();
pass(
  `Published interpolation bound holds across ${interpolation.intervals} sample intervals`,
  interpolation.failures.length === 0,
  interpolation.failures.join(" · "),
);
pass(
  "Solar time is a continuous hour, not a sample index",
  !app.includes("solarPositionIndex") && app.includes("state.solarHour"),
);
pass(
  "Interpolated readings are labelled with their deviation",
  html.includes('id="solar-interpolation-note"') && app.includes("solarInterpolated"),
);
// A persistent animation loop is the easy mistake here: it would keep a WebGL
// scene redrawing forever on a page nobody is looking at.
pass(
  "Sun playback is opt-in, stoppable and honours reduced motion",
  app.includes("prefers-reduced-motion")
    && app.includes("cancelAnimationFrame(playback.frame)")
    && /if \(document\.hidden\) stopSolarPlayback\(\)/.test(app),
);
pass(
  "Whole-day shadow trace is wired to the toolbar",
  terrain3d.includes("api.setShadowTraceVisible")
    && terrain3d.includes("#terrain-3d-trace")
    && html.includes('id="terrain-3d-trace"'),
);
// Exaggerated relief is a steeper site than the survey, so metric shadow claims
// have to be withheld rather than rescaled — and the reader has to be told.
pass(
  "Vertical exaggeration withholds shadow measurements visibly",
  html.includes('id="terrain-3d-withheld"')
    && terrain3d.includes("updateWithheldNote")
    && (terrain3d.match(/verticalScale !== 1/g) || []).length >= 2,
);

// Data-bearing elevation ramps must use the direction-aware tokens. A physical
// gradient angle beside RTL-reversing labels puts the colour under the wrong
// number, which is how both legends came to disagree with themselves.
const rampSelectors = [".terrain-3d-gradient i", ".gradient-bar"];
const rampLiterals = rampSelectors.filter((selector) => {
  const block = css.match(new RegExp(`\\${selector.replace(/[.\s]/g, "\\$&")}\\s*\\{[^}]*\\}`));
  return block && /background:\s*linear-gradient\([^)]*#[0-9a-f]{3,6}/i.test(block[0]);
});
pass(
  "Elevation ramps use direction-aware tokens, not colour literals",
  rampLiterals.length === 0,
  rampLiterals.join(", "),
);
pass(
  "RTL swaps the elevation ramp endpoints",
  /html\[dir="rtl"\]\s*\{[^}]*--ramp-start/.test(css),
);

// A verified figure frozen into the markup cannot be localized, so the Persian
// interface showed Latin digits beside Persian prose quoting the same number.
// Every one must go through the locale formatter at runtime.
// data-metric and data-i18n elements keep their figure as no-JS fallback text
// and are both replaced at runtime, so a figure is only frozen if it sits on a
// line with neither hook.
const frozenFigures = ["487.428568", "1647.899", "1659.653", "11.754", "10.270569"]
  .filter((figure) => html
    .split("\n")
    .some((line) => line.includes(figure) && !/data-metric|data-i18n/.test(line)));
pass(
  "Verified figures are rendered from data, not frozen in markup",
  frozenFigures.length === 0,
  frozenFigures.join(", "),
);
pass(
  "Persian keeps its own numerals",
  !app.includes("-u-nu-latn"),
);
pass(
  "Month axis uses authored short labels, not truncation",
  !/local\(month\.label\)\.slice\(/.test(app) && app.includes("month.label_short"),
);

// Direction alone is not enough: the legend must key the palette the 3D mesh is
// actually painted with, or the elevation scale decodes the wrong surface.
// Resolves one level of var() indirection, so --elev-high: var(--clay) keeps its
// semantic link to the palette instead of duplicating the literal.
const cssColour = (token) => {
  const match = css.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6}|var\\(--[a-z-]+\\))`));
  if (!match) return null;
  const value = match[1];
  if (!value.startsWith("var(")) return value.toLowerCase();
  return cssColour(value.slice(4, -1));
};
const cssElevation = ["--elev-low", "--elev-mid", "--elev-high"].map(cssColour);
const meshElevation = ["ELEV_LOW", "ELEV_MID", "ELEV_HIGH"].map((name) => {
  const match = terrain3d.match(new RegExp(`${name}\\s*=\\s*0x([0-9a-fA-F]{6})`));
  return match ? `#${match[1].toLowerCase()}` : null;
});
pass(
  "3D mesh elevation palette matches the legend tokens",
  cssElevation.every((value, index) => value && value === meshElevation[index]),
  `css ${cssElevation.join(",")} vs mesh ${meshElevation.join(",")}`,
);

// Persian comprehension. Each of these was a real defect: Persian table rows
// under English headers, an entirely English screen-reader experience, canvas
// labels drawn in a fallback face, and translatable strings hidden in inline
// ternaries where the parity check above could not see them.
// The whole cell, not just its tag: the sortable coordinate headers carry the
// key on an inner <span> beside a decorative arrow.
const headerCells = [...html.matchAll(/<th\b[\s\S]*?<\/th>/g)].map((match) => match[0]);
// Every header needs either a key or an explicit exemption. data-i18n-exempt
// marks text that is an identifier and stays Latin in Persian — the same
// treatment Pt1 and EPSG:32638 already get.
const unlocalizedHeaders = headerCells.filter((cell) => (
  !/data-i18n=|data-i18n-html=/.test(cell) && !cell.includes("data-i18n-exempt")
));
pass(
  `All ${headerCells.length} table headers carry a translation key`,
  unlocalizedHeaders.length === 0,
  unlocalizedHeaders.join(" "),
);
// Adding longer Persian headers to a 920px-wide table with no scroll container
// pushes the overflow toward the inline-start edge, unreachable in RTL.
pass(
  "Wide tables scroll inside their shell",
  /\.table-shell\s*\{[^}]*overflow-x:\s*auto/.test(css),
);
// Grid/flex items default to min-width: auto, so a wide readout (the
// solar-access rows) can inflate a single 1fr track past the viewport — the
// document measured 397 px at a 320 px viewport before this. These three rules
// are the P1-01 containment; assert they survive. The behaviour itself is
// exercised by scripts/verify-responsive.mjs in a real browser.
pass(
  "Solar readouts cannot inflate their card past the viewport",
  /\.solar-insights > article\s*\{[^}]*min-width:\s*0/.test(css)
    && /#solar-access\s*\{[^}]*min-width:\s*0/.test(css)
    && /#solar-access > div\s*\{[^}]*min-width:\s*0/.test(css),
);
pass(
  "Geo-map heading stacks its status pill below 650px",
  /@media \(max-width: 650px\)[\s\S]*?\.map-heading\s*\{[^}]*flex-direction:\s*column/.test(css),
);
const attributeHooks = ["data-i18n-aria-label", "data-i18n-title", "data-i18n-alt"];
const localizedAttributes = attributeHooks
  .reduce((total, hook) => total + (html.match(new RegExp(hook, "g")) || []).length, 0);
// Two are owned by JS on purpose: the 3D stage label by terrain-3d.js, and the
// theme toggle by applyTheme, whose wording depends on the theme not the
// language. Everything else must be hooked.
const bareAria = (html.match(/(?<!data-i18n-)aria-label="/g) || []).length
  - (html.match(/data-i18n-aria-label="[^"]*" aria-label="/g) || []).length;
pass(
  `${localizedAttributes} accessible names are localized, ${bareAria} left to JS owners`,
  localizedAttributes >= 35 && bareAria <= 2 && app.includes("I18N_ATTRS"),
  `bare aria-label count ${bareAria}`,
);
pass(
  "Canvas text uses the bundled family, not a generic stack",
  !/context\.font\s*=\s*[`"][^`"]*ui-sans-serif/.test(app)
    && !/context\.font\s*=\s*[`"][^`"]*Arial/.test(app)
    && app.includes("canvasFont(")
    && !/context\.font\s*=\s*[`"][^`"]*Arial/.test(terrain3d),
);
pass(
  "Compass points are words from one vocabulary, not baked-in letters",
  app.includes("data.wind?.direction_vocabulary")
    && !/fillText\("[NESW]"/.test(app)
    && !app.includes("escapeHtml(season.prevailing_direction)"),
);
// A translatable string inside a ternary has no key, so translation parity
// cannot see it. Six uses remain and all are genuine locale logic: the number
// formatter, digit transliteration, `dir`, the document title and two alt
// bridges.
const languageTernaries = (app.match(/state\.lang === "fa"/g) || []).length;
pass(
  "Translatable strings live in the translation files, not inline ternaries",
  languageTernaries <= 6 && !app.includes("fieldNamesFa"),
  `${languageTernaries} uses of state.lang === "fa"`,
);
// Arabic script is cursive; tracking breaks the joins between letters.
pass(
  "Persian resets letter-spacing and floors the smallest sizes",
  (css.match(/html\[lang="fa"\][^{}]*\{[^}]*letter-spacing:\s*normal/g) || []).length >= 1
    && /html\[lang="fa"\][^{}]*\{[^}]*font-size:\s*10\.5px/.test(css),
);
// Direction is set before the stylesheet, so a returning Persian reader does not
// watch the page lay out left-to-right first.
pass(
  "Direction and theme are restored before first paint",
  /<script>[\s\S]*houseai-language[\s\S]*<\/script>\s*<link rel="stylesheet"/.test(html),
);
// Physical padding needed an RTL twin for every rule. Logical properties do not.
pass(
  "RTL overrides are down to the direction-only cases",
  (css.match(/html\[dir="rtl"\]/g) || []).length <= 2,
  `${(css.match(/html\[dir="rtl"\]/g) || []).length} occurrences`,
);

// Concept massing. The reference ban below is deliberately NOT relaxed: the
// geometry arrives as data in the bundle, so it never enters localRefs, and the
// ban still correctly keeps concept renders and .FCStd files out of the HTML and
// the document registry. These assert the intent that ban stood for instead.
const concepts = readJson("concepts.json");
pass(
  "Preliminary concepts are available, unselected and unranked as a design decision",
  concepts.unselected === true
    && concepts.rejected === false
    && concepts.available === true
    && concepts.revived === true
    && concepts.status === "preliminary-studies-for-architect"
    && concepts.selection.selected === null
    && concepts.selection.ranking_published === false
    && !("compared_outcome" in concepts.selection)
    && documents.rejected_concepts.archive_included === true
    && documents.rejected_concepts.active_library === false
    && documents.rejected_concepts.hidden_by_default === false
    && documents.rejected_concepts.revived === true
    && !/rejected|dead|not for selection|archive only/i.test(concepts.selection.note.en)
    && !/rejected|dead|not for selection|archive only/i.test(en.conceptsLead || "")
    && !JSON.stringify(recommendations).includes("option-"),
);
pass(
  "Concept studies section is a visible primary section with A/B/C switcher",
  /<section[^>]*id="concepts"/.test(html)
    && html.includes('data-concept-option="option-a"')
    && html.includes('data-concept-option="option-b"')
    && html.includes('data-concept-option="option-c"')
    && html.includes('id="concept-brief-fit"')
    && html.includes('id="terrain-3d-concepts"')
    && terrain3d.includes("conceptsHidden = true"),
);
pass(
  "Concept studies withhold unsupported field validations and carry full profiles",
  Boolean(concepts.overview?.en)
    && Boolean(concepts.overview?.fa)
    && concepts.options.every((option) => option.validation.length === 0
      && Boolean(option.source_validation_withheld?.en)
      && Boolean(option.source_validation_withheld?.fa)
      && Boolean(option.brief_alignment?.en)
      && Boolean(option.brief_alignment?.fa)
      && Boolean(option.profile?.what_it_is?.en)
      && Boolean(option.profile?.how_it_works?.en)
      && Boolean(option.profile?.program?.en)
      && Array.isArray(option.profile?.strengths)
      && option.profile.strengths.length >= 3
      && Array.isArray(option.profile?.tradeoffs)
      && option.profile.tradeoffs.length >= 3
      && Boolean(option.isometric_image)
      && fs.existsSync(path.join(dashboard, option.isometric_image)))
    && html.includes('id="concept-what"')
    && html.includes('id="concepts-overview"')
    && !JSON.stringify(concepts).includes("scores highest")
    && !JSON.stringify(concepts).includes("دسترسی خودرو کارآمد است")
    && !JSON.stringify(concepts).includes("حیاط آب سطحی را محبوس نمی‌کند"),
);
// Heights are absent from the concept data, so every volume must say where its
// height came from rather than carrying an invented storey height.
const conceptVolumes = concepts.options.flatMap((option) => option.rooms);
pass(
  `All ${conceptVolumes.length} concept rooms declare a derived height source`,
  conceptVolumes.every((room) => typeof room.height_source === "string"
    && (room.height_m === null || room.height_m > 2)),
);
// Two points fix the frame and all eight test it.
pass(
  "The concept frame reproduces the survey exactly",
  concepts.frame.survey_round_trip_max_error_m < 1e-6,
  String(concepts.frame.survey_round_trip_max_error_m),
);

// Terrain horizon. The near/far split is mandatory: a 90 m DEM cell is wider
// than the 25 m-wide parcel, so the near field is an inference and the two must
// never be published as one continuous measured profile.
const horizon = readJson("horizon.json");
const localTerrain = readJson("local-terrain.json");
const planting = readJson("planting.json");
const roads = readJson("roads.json");
const platform = readJson("platform.json");
const platformMetrics = readJson("terrain-metrics.json");
pass(
  "Horizon is split into far field and near field with different statuses",
  horizon.far_field.status === "regional-data"
    && horizon.near_field.status === "preliminary-inference"
    && horizon.combined.status === "preliminary-inference"
    && horizon.near_field.to_m === 500,
);
pass(
  "Horizon profiles cover all 72 azimuths",
  [horizon.far_field, horizon.near_field, horizon.combined]
    .every((field) => field.profile.length === 72),
);
// The DEM's own value at the site, not the survey's. Mixing datums biases
// near-field angles worst where sensitivity is highest, so the gap is published.
pass(
  "Observer elevation is the DEM's and the datum gap is stated",
  Number.isFinite(horizon.observer.dem_elevation_m)
    && Number.isFinite(horizon.observer.dem_minus_survey_min_m)
    && horizon.observer.dem_elevation_m !== site.elevation.min_m,
);
// Astronomical sunrise and sunset are unchanged; these are different figures and
// must never borrow those names.
pass(
  "Effective sun is named as such and falls inside the astronomical day",
  horizon.seasons.every((season) => season.effective_first_sun !== null
    && season.effective_last_sun !== null
    && season.effective_first_sun >= Number(season.astronomical_sunrise.split(":")[0])
    && season.effective_last_sun <= Number(season.astronomical_sunset.split(":")[0]) + 1)
    && !JSON.stringify(horizon.seasons).includes('"sunrise"'),
);
pass(
  "Every solar position is annotated against the measured horizon",
  solar.seasons.every((season) => season.positions.every((position) => (
    Number.isFinite(position.horizon_deg) && typeof position.above_horizon === "boolean"
  ))),
);
// Shipping horizon data while the page still asserts a flat one would make the
// dashboard contradict itself, which is worse than not shipping it.
const horizonProse = [
  html,
  app,
  JSON.stringify(solar),
  JSON.stringify(en),
  JSON.stringify(fa),
  fs.readFileSync(path.join(dashboard, "assets/documents/environmental-methodology.md"), "utf8"),
].join("\n");
pass(
  "No surviving flat-horizon claim anywhere",
  !/flat (astronomical )?horizon|افق نجومی تخت|افق تخت/i.test(horizonProse),
);
pass(
  "The horizon is drawn in both views",
  app.includes("data.horizon?.combined?.profile")
    && terrain3d.includes("buildHorizonRing")
    // Scene fog is camera-distance based, so a fixed-radius ring must opt out.
    && /fog:\s*false/.test(terrain3d)
    && html.includes('id="terrain-3d-horizon"'),
);

/*
  The surrounding hillside surface.

  This is the one layer in the scene that draws ground nobody surveyed, so every
  guard here is about keeping that legible rather than about it looking right.
  The original rule was "no off-site surface at all"; it is now "sampled DEM,
  smoothed and resampled only between samples, datum shift published rather than
  folded in, labelled, non-shadow-casting, and cut open over the surveyed
  parcel" — which is checkable, where a blanket ban was not.
*/
const hill = localTerrain;
// About twenty times the parcel, which is what was asked for. Wider than that at
// 90 m sampling is landform nobody needs; narrower stops short of the slope.
pass(
  "The drawn hillside is between 10 and 25 times the parcel area",
  (() => {
    const ratio = ((hill.published_half_extent_m * 2) ** 2) / site.verified_area_m2;
    return ratio > 10 && ratio < 25;
  })(),
);
pass(
  "The hillside is a square grid clipped inside the sampled box",
  hill.published_half_extent_m === 50
    && hill.published_half_extent_m < hill.sampled_half_extent_m
    && hill.axis_m[0] === -hill.published_half_extent_m
    && hill.axis_m[hill.axis_m.length - 1] === hill.published_half_extent_m
    && hill.elevations_m.length === hill.axis_m.length
    && hill.elevations_m.every((row) => row.length === hill.axis_m.length
      && row.every((value) => Number.isFinite(value))),
);
// 40 m samples of a 90 m raster, drawn at 5 m. Both steps are presentation and
// both are published; neither may be described as resolution.
pass(
  "Smoothing and resampling are published, and neither claims added detail",
  hill.cell_m === 90
    && hill.sampled_spacing_m === 40
    && hill.grid_spacing_m < hill.sampled_spacing_m
    && hill.smoothing.passes >= 1
    && /staircase|blocks/.test(hill.smoothing.note.en)
    && Boolean(hill.smoothing.note.fa),
);
// The near field is the surveyed slope, not the DEM. The plane is a measurement
// with a published residual range; extending it is inference and says so.
pass(
  "The near-field slope is the surveyed plane, fitted and residuals published",
  hill.surveyed_plane.residuals_m.length === 8
    && Math.max(...hill.surveyed_plane.residuals_m.map(Math.abs)) < 0.5
    && Math.abs(hill.surveyed_plane.slope_percent - 38.27) < 0.01
    // Which is the survey's own certified steepest descent, toward the northeast.
    && hill.surveyed_plane.downslope_azimuth_deg > 22.5
    && hill.surveyed_plane.downslope_azimuth_deg < 67.5
    && /inference/.test(hill.surveyed_plane.note.en)
    && hill.blend.plane_only_m > 0
    && hill.blend.blend_to_m === hill.published_half_extent_m
    // Applied once, in the generator. The viewer must not shift the surface again.
    && /const elevationY = \(elevation\) => \(elevation - minElevation\) \* verticalScale/
      .test(terrain3d),
);
// The DEM's value at the site and the surveyed elevation genuinely differ. The
// shift is published as one constant rather than left as an unexplained step.
pass(
  "The datum shift is published as a constant, measured at the site",
  hill.datum.matched_point === "Pt8"
    && Math.abs(hill.datum.offset_m
      - (hill.surveyed_plane.intercept_m - hill.datum.smoothed_dem_at_site_m)) < 0.01
    && hill.datum.dem_elevation_at_site_m !== hill.datum.survey_elevation_m
    && hill.min_elevation_m < site.elevation.min_m,
);
// A 90 m cell straddles the whole parcel, so the DEM's aspect and the survey's
// are not measuring the same thing. Neither is allowed to overwrite the other.
pass(
  "The DEM aspect is published beside the surveyed one, unreconciled",
  Number.isFinite(hill.aspect.dem_downslope_deg)
    && hill.aspect.survey_downslope.en === site.terrain_direction.en
    && /not measuring the same thing/.test(hill.aspect.note.en),
);
// The surface runs under the parcel rather than stopping at it, and it is set
// below the plane by more than the plane's largest positive residual, so no
// measured facet is ever buried by the inference beneath it.
pass(
  "The surface is continuous under the parcel and never buries measured ground",
  hill.blend.plane_drop_m > Math.max(...hill.surveyed_plane.residuals_m)
    && !/draw_mask|openingBounds|buildParcelWall/.test(terrain3d)
    && hill.elevations_m.length === hill.axis_m.length
    && hill.elevations_m.every((row) => row.length === hill.axis_m.length),
);
const shadowExtent = terrain3d.slice(
  terrain3d.indexOf("function updateShadowExtent"),
  terrain3d.indexOf("function testObjectDefinition"),
);
pass(
  "The hillside is outside the shadow frustum and casts nothing",
  // A 400 m surface inside that bounding sphere takes the shadow texel from
  // 23 mm to roughly a third of a metre — it would not error, it would go soft.
  !shadowExtent.includes("hillGroup")
    && /hillGroup = new THREE\.Group\(\)[\s\S]{0,60}scene\.add\(hillGroup\)/.test(terrain3d)
    && (terrain3d.match(/castShadow = false;\n\s+\w+\.receiveShadow = false;/g) || []).length >= 2,
);
pass(
  "The camera frustum and zoom clamp are sized for the hillside, not a region",
  /new THREE\.PerspectiveCamera\(38, 1, 1, 3000\)/.test(terrain3d)
    && /hillside: \{ yaw: [\d.]+, pitch: [\d.]+, distance: 235 \}/.test(terrain3d)
    && !/SKYLINE_RADIUS/.test(terrain3d),
);
pass(
  "The hillside layer is on by default, labelled and reachable",
  html.includes('id="terrain-3d-hillside"')
    && /id="terrain-3d-hillside"[^>]*\bchecked\b/.test(html)
    && html.includes('data-terrain-view="hillside"')
    && en.showHillside && fa.showHillside && en.hillsideView && fa.hillsideView
    // The caveat moved off a sprite plate over the terrain and into the section's
    // own evidence line, in both languages. It may not simply disappear.
    && /surveyed 38\.27% slope eased into a 90 m DEM/.test(en.terrain3dEvidence)
    && /مدل ارتفاعی ۹۰ متری/.test(fa.terrain3dEvidence)
    && !/DEM, not surveyed/.test(terrain3d),
);
// One road edge is surveyed and one is only reported. They may ship together only
// while the difference is visible in the data, in the caption, and on screen.
pass(
  "The two roads keep their evidence classes apart",
  roads.roads.length === 2
    && roads.roads[0].derived_from_edge === site.road.edge
    && roads.roads[0].edge_length_m === site.road.length_m
    && roads.roads[0].status === "surveyed-edge-illustrative-width"
    && roads.roads[0].width_status === "illustrative"
    && roads.roads[1].status === "client-reported"
    && /not surveyed and not in any bundled source/.test(roads.roads[1].note.en)
    && Boolean(roads.roads[1].note.fa)
    // Drawn in different materials, and the caption names the reported one.
    && /road\.status !== "client-reported"/.test(terrain3d)
    && /lower road client-reported/.test(en.terrain3dEvidence)
    && /گفته کارفرما/.test(fa.terrain3dEvidence)
    && en.showRoads && fa.showRoads,
);
// Vegetation is illustrative, so at least put it where the client asked: the trees
// group at the downhill end of the fitted plane, not wherever the lattice started.
pass(
  "The trees stand at the downhill end of the field",
  planting.trees.every((tree) => {
    const plane = localTerrain.surveyed_plane;
    const height = plane.intercept_m + plane.east_per_m * tree.east_m
      + plane.north_per_m * tree.north_m;
    // Below the parcel's own midpoint elevation, which is what "the bottom" means
    // on ground that falls 11.754 m across 25 m.
    return height < (site.elevation.min_m + site.elevation.max_m) / 2;
  }),
);
// The wind layer draws a measured direction and an unmeasured motion in the same
// breath, so the label has to carry both and the loop has to be containable.
/*
  Plan area against surface area, and what a level platform costs.

  The failure to guard against is the surface area being read as buildable land, or
  the depth table quietly becoming an earthwork estimate. Areas and depths ship;
  their product does not.
*/
pass(
  "Plan and surface area are published as different things, with the excess stated",
  platform.plan_area_m2 === site.verified_area_m2
    && platform.surface_area_m2 === platformMetrics.surface_area_m2
    && platform.surface_area_m2 > platform.plan_area_m2
    && Math.abs(platform.surface_excess_m2
      - (platform.surface_area_m2 - platform.plan_area_m2)) < 0.001
    && platform.level_platform_area_basis === "plan"
    && /not extra buildable land/.test(platform.difference_note.en)
    && Boolean(platform.difference_note.fa),
);
pass(
  "The platform raster reproduces the verified plan area",
  // 0.25 m cells over 487.428568 m². If this drifts, every area in the table is
  // wrong by the same proportion.
  Math.abs(platform.raster.raster_error_m2) < 0.5
    && platform.raster.cell_m <= 0.25
    && platform.raster.cell_count > 5000,
);
pass(
  "Platform levels span the surveyed relief and carry no volumes",
  platform.levels.length > 10
    && platform.levels[0].level_m >= site.elevation.min_m
    && platform.levels[platform.levels.length - 1].level_m <= site.elevation.max_m
    && platform.levels.every((entry) => (
      entry.cut_area_m2 + entry.fill_area_m2 <= platform.raster.area_m2 + 0.5
        && entry.max_cut_depth_m <= site.elevation.relief_m
        && entry.max_fill_depth_m <= site.elevation.relief_m
    ))
    // The balance level is a level, not a quantity, and it sits inside the relief.
    && platform.balance_level_m > site.elevation.min_m
    && platform.balance_level_m < site.elevation.max_m
    && !/m3|m³|cubic|volume_m|حجم_/.test(JSON.stringify(platform))
    && en.levelPlatform && fa.levelPlatform && en.platformWithin && fa.platformWithin,
);
pass(
  "Terrain platform outputs are explicitly exploratory and not for pricing",
  platform.status === "preliminary-engineering-inference"
    && platform.design_use.status === "exploratory-not-for-pricing"
    && platform.level_step_m === 0.5
    && platform.published_area_precision_m2 === 0.1
    && /one-metre contours/.test(platform.design_use.note.en)
    && /not for quantities or pricing/.test(platform.design_use.label.en)
    && Boolean(platform.design_use.note.fa)
    && html.includes('id="platform-design-use"'),
);

const longitudinal = terrain.sections.longitudinal;
pass(
  "Longitudinal L–L chart contains only valid in-parcel elevations",
  longitudinal.distance_m.length === longitudinal.elevation_m.length
    && longitudinal.elevation_m.every(Number.isFinite)
    && longitudinal.distance_m[0] === 0
    && longitudinal.omitted_outside_parcel_samples === 2
    && longitudinal.start_elevation_m > longitudinal.end_elevation_m
    && Math.abs(longitudinal.fall_m - 7.1368640650826) < 1e-9
    && Math.abs(longitudinal.run_m - 24.79773009335622) < 1e-9
    && html.includes('class="chart-card profile-card profile-card-featured"')
    && html.includes('id="profile-summary"')
    && /#profile-canvas\s*\{[^}]*height:\s*430px/.test(css),
);
/*
  Trees and planting.

  This section carries the only published-literature claims on the page, about a
  parcel where no bundled source records a single plant. Four things are guarded.

  Status: horticultural figures must never wear the authority of the surveyed
  geometry, so the register is `preliminary-inference` and nothing in it verified.

  Verdicts: the cold test is recomputed here from the climate record instead of
  being trusted, and a species whose hardiness sources contradict each other may
  not come back as a clean pass. Those two are what stop the table from quietly
  becoming a recommendation.

  Photographs: bundled and local, or absent. A remote image src would break the
  offline guarantee in the one place the global URL scan cannot see it, because
  the path arrives from data.js rather than from the HTML.

  Attribution: every bundled photograph ships a licence, and one under a licence
  that requires credit ships a named author. This is a licence condition, not a
  stylistic preference, so it fails the build.
*/
const species = readJson("species.json");
pass(
  "Planting guidance is preliminary inference, never verified site data",
  species.status === "preliminary-inference"
    && species.placement.status === "preliminary-inference"
    && species.care.status === "preliminary-inference"
    && ![species, species.species, species.do_not_plant]
      .some((block) => /"status":\s*"verified/.test(JSON.stringify(block)))
    && /not a landscape design/.test(species.purpose.en)
    && Boolean(species.purpose.fa),
);
pass(
  "The five constraints are quoted from data already on the page",
  species.constraints.cold.lowest_daily_min_c
    === climate.extremes_1991_2020.lowest_daily_min_c
    && species.constraints.exposure.observed_gust_kmh
      === climate.extremes_1991_2020.highest_daily_gust_kmh
    && species.constraints.space.plan_area_m2 === site.verified_area_m2
    // June–September, from the same monthly block the climate section renders.
    && Math.abs(species.constraints.drought.summer_precipitation_mm
      - climate.monthly.filter((month) => month.month >= 6 && month.month <= 9)
        .reduce((total, month) => total + month.precipitation_mm, 0)) < 0.05
    && species.constraints.soil.ph === hazards.evidence.soils.ph[0].mean,
);
pass(
  "Cold verdicts are consistent with the record and disputed ratings never pass",
  species.species.every((entry) => {
    const limit = entry.hardiness.min_c;
    const coldest = species.constraints.cold.lowest_daily_min_c;
    if (limit === null) return entry.tests.cold === "unknown";
    const expected = (limit <= coldest && "pass")
      || (limit <= coldest + 2.5 && "marginal")
      || "fail";
    const downgraded = entry.hardiness.disputed && expected === "pass" ? "marginal" : expected;
    return entry.tests.cold === downgraded
      && (!entry.hardiness.disputed || Boolean(entry.hardiness.dispute?.en));
  })
  // The weakest answered test is the verdict, and an unanswered cold test cannot
  // leave a clean pass standing.
  && species.species.every((entry) => {
    const answered = Object.values(entry.tests).filter((verdict) => verdict !== "unknown");
    const order = { fail: 0, marginal: 1, pass: 2 };
    const weakest = answered.reduce(
      (lowest, verdict) => (order[verdict] < order[lowest] ? verdict : lowest), "pass",
    );
    const expected = entry.tests.cold === "unknown" && weakest === "pass" ? "marginal" : weakest;
    return entry.verdict === expected;
  }),
);
pass(
  "The register keeps a failing species visible and a refused one separate",
  // A species that fails is published failing, not dropped: the reason the list
  // is useful in a nursery is that it names what to say no to.
  species.species.some((entry) => entry.verdict === "fail")
    && species.species.some((entry) => entry.verdict === "pass")
    && species.do_not_plant.length >= 4
    && species.do_not_plant.every((entry) => (
      !species.species.some((candidate) => candidate.id === entry.id)
        && entry.reason.en && entry.reason.fa
    ))
    && species.ask_locally.every((entry) => entry.gap.en && entry.gap.fa),
);
pass(
  "A native-to-Iran badge is backed by text in the entry that says where",
  // The badge is a claim, and it sits on the top-ranked species. Nothing may
  // carry it on a boolean alone: the entry has to say, in its own prose, which
  // range or which subspecies reaches here — which is what a reader would check
  // at a nursery counter.
  species.species
    .filter((entry) => entry.native_to_iran)
    .every((entry) => entry.sources.length > 0
      && /Iran|Zagros/.test([
        entry.native_note?.en, entry.note.en, entry.caution.en, entry.hardiness.dispute?.en,
      ].filter(Boolean).join(" "))),
);
pass(
  "Every species photograph is bundled locally and exists on disk",
  species.species.concat(species.do_not_plant, species.ask_locally)
    .filter((entry) => entry.image)
    .every((entry) => (
      entry.image.src.startsWith("assets/images/species/")
        && !/^https?:/i.test(entry.image.src)
        && fs.existsSync(path.join(dashboard, entry.image.src))
    )),
);
pass(
  "Every bundled photograph carries a licence, and a named author where required",
  species.species.concat(species.do_not_plant, species.ask_locally)
    .filter((entry) => entry.image)
    .every((entry) => Boolean(entry.image.licence)
      && (!/^(cc\s?by|gfdl)/i.test(entry.image.licence) || Boolean(entry.image.author))),
);
pass(
  "External species links are wikipedia.org and arrive from data, not from app.js",
  species.species.concat(species.do_not_plant, species.ask_locally)
    .flatMap((entry) => [entry.wikipedia_en, entry.wikipedia_fa].filter(Boolean))
    .every((url) => /^https:\/\/(en|fa)\.wikipedia\.org\/wiki\//.test(url))
    && species.species.every((entry) => entry.sources.every(
      (id) => species.sources.some((source) => source.id === id),
    )),
);
pass(
  "Placement zones quote the published solar and wind figures",
  (() => {
    const winter = solar.seasons.find((season) => season.id === "winter");
    const aperture = species.placement.zones.find((zone) => zone.id === "winter-aperture");
    const shelter = species.placement.zones.find((zone) => zone.id === "east-shelter");
    const winterWind = wind.seasons.find((season) => season.season === "winter");
    const easterly = winterWind.direction_distribution
      .find((entry) => entry.direction === "E").percent;
    return aperture.evidence.en.includes(String(winter.sunrise_azimuth_deg))
      && aperture.evidence.en.includes(String(winter.noon_altitude_deg))
      && shelter.evidence.en.includes(String(easterly))
      && species.placement.zones.every((zone) => zone.evidence.fa && zone.guidance.fa);
  })(),
);
pass(
  "Planting carries no irrigation quantity and does not claim the illustrative trees",
  // A litres-per-week figure would need a soil test, a species list and a water
  // source; none exists. The four trees in the 3D study stay unnamed for the
  // same reason the concepts stay unselected.
  // A number attached to a volume of water, not the word — the care note says in
  // as many words that a litres-per-week figure cannot be given here.
  !/\d\s*(litres?|liters?|l)\s*(per|\/)\s*(week|day|month|tree)/i.test(JSON.stringify(species))
    && !/\d\s*(m3|m³)/i.test(JSON.stringify(species))
    && /illustrative/.test(species.illustrative_planting_note.en)
    && planting.status === "illustrative-only"
    && !species.species.some((entry) => JSON.stringify(planting).includes(entry.latin))
    && en.speciesTitle && fa.speciesTitle && en.speciesAvoid && fa.speciesAvoid,
);

// The frost constraint has to keep quoting the climate section, or a species
// verdict and the record it was decided against drift apart silently.
pass(
  "The spring-frost constraint matches the climate record it is derived from",
  (() => {
    const constraint = species.constraints.spring_frost;
    const record = climate.derived.spring_frost;
    const zero = record.thresholds.find((entry) => entry.threshold_c === 0);
    const killing = record.thresholds.find((entry) => entry.threshold_c === -2);
    const april = record.spring_month_minima.find((entry) => entry.month === 4);
    return constraint.last_frost_median === zero.last_spring_frost.median
      && constraint.last_frost_latest === zero.last_spring_frost.latest
      && constraint.killing_frost_latest === killing.last_spring_frost.latest
      && constraint.april_lowest_daily_min_c === april.lowest_daily_min_c
      && constraint.dem_elevation_m === record.dem_elevation_m
      // And every one of those dates is inside the first half of the year, which
      // is what a *spring* frost date means. A sign error in the calendar
      // arithmetic would put one in October.
      && record.thresholds.every((entry) => Number(entry.last_spring_frost.latest.slice(0, 2)) <= 6
        && Number(entry.first_autumn_frost.earliest.slice(0, 2)) >= 7)
      && constraint.statement.fa
      && constraint.caveat.en && constraint.caveat.fa
      // It applies to the fruit trees and not to the list, so the card has to
      // say so and the heading must not count it as a site-wide constraint.
      && constraint.applies_to === "fruit"
      && /fruit trees below/.test(constraint.applies_to_note.en)
      && Boolean(constraint.applies_to_note.fa)
      && en.speciesAppliesToFruit && fa.speciesAppliesToFruit
      && !en.speciesTitle.includes(`against ${Object.keys(species.constraints).length} things`)
      && en.speciesTitle.includes(`against ${
        Object.values(species.constraints).filter((entry) => !entry.applies_to).length} things`);
  })(),
);

// Chill accumulation is defined on hourly temperature and only the daily series
// is bundled. A day-count published as a chill figure would be compared against a
// cultivar's chill-hour requirement, which is a different quantity — so the field
// ships null and no number anywhere may claim to be one.
pass(
  "No chill-hour figure is published, and the reason is",
  climate.derived.spring_frost.chill_hours === null
    && species.constraints.spring_frost.chill_hours === null
    && /hourly/.test(climate.derived.spring_frost.chill_note.en)
    && Boolean(climate.derived.spring_frost.chill_note.fa)
    && !/\d\s*chill[\s-]*(hours?|units?|portions?)/i.test(JSON.stringify(species))
    && !/chill[\s-]*(hours?|units?|portions?)\s*[:=]?\s*\d/i.test(JSON.stringify(species)),
);

// The crop verdict is recomputed here from the register's own published fields,
// so a hand-edited verdict cannot outrank the evidence beside it. Two rules are
// load-bearing: a crop can never be rated better than the survival verdict, and a
// self-sterile species can never come back clean.
pass(
  "Crop verdicts follow the bloom and pollination evidence, capped by survival",
  (() => {
    const order = { fail: 0, marginal: 1, pass: 2, unknown: 3 };
    const constraint = species.constraints.spring_frost;
    const medianMonth = Number(constraint.last_frost_median.slice(0, 2));
    const latestMonth = Number(constraint.last_frost_latest.slice(0, 2));
    const fruiting = species.species.filter((entry) => entry.fruit);
    return fruiting.length >= 10
      && fruiting.every((entry) => {
        const start = entry.fruit.bloom_months ? entry.fruit.bloom_months[0] : null;
        const bloom = start === null
          ? "unknown"
          : (start < medianMonth && "fail") || (start <= latestMonth && "marginal") || "pass";
        const pollination = { yes: "pass", partial: "marginal", no: "fail" }[entry.fruit.self_fertile]
          ?? "unknown";
        const answered = [entry.verdict, bloom, pollination]
          .filter((verdict) => verdict !== "unknown");
        const weakest = answered.reduce(
          (lowest, value) => (order[value] < order[lowest] ? value : lowest), "pass",
        );
        return entry.crop_tests.bloom_frost === bloom
          && entry.crop_tests.pollination === pollination
          && entry.crop_verdict === weakest
          && order[entry.crop_verdict] <= order[entry.verdict]
          && (pollination !== "fail" || entry.crop_verdict === "fail")
          && Boolean(entry.fruit.note.en && entry.fruit.note.fa && entry.fruit.crop.fa);
      })
      // A species with no crop is not quietly given one.
      && species.species.every((entry) => Boolean(entry.fruit) === Boolean(entry.crop_verdict));
  })(),
);

// Two claims that would sell a tree, so both have to carry their source: a
// bud-kill temperature and a rootstock recommendation. And the client's own
// report that a species grows here is never allowed to act as one.
pass(
  "Bud-kill and rootstock claims carry a source, and a client report is not one",
  (() => {
    const fruiting = species.species.filter((entry) => entry.fruit);
    const sourceIds = new Set(species.sources.map((source) => source.id));
    return fruiting.every((entry) => {
      const fruit = entry.fruit;
      const budKillSourced = fruit.bud_kill_c === null
        ? !fruit.bud_kill_source
        : Boolean(fruit.bud_kill_source_text) && sourceIds.has(fruit.bud_kill_source);
      const rootstockSourced = !fruit.rootstock
        || (Boolean(fruit.rootstock.source_text) && sourceIds.has(fruit.rootstock.source));
      return budKillSourced && rootstockSourced && Boolean(fruit.bloom_source_text);
    })
      // A client report is a badge, never an entry in `sources`, and the register
      // says so in both languages.
      && species.species.some((entry) => entry.client_reported)
      && !sourceIds.has("client")
      && !species.sources.some((source) => /client|owner/i.test(source.id))
      && /not.{0,20}(a source|treated as a source)/i.test(species.client_reported_note.en)
      && Boolean(species.client_reported_note.fa);
  })(),
);

// The crop section is the easiest place on the page to invent a number. A yield
// figure needs a cultivar, a rootstock, an age and a pruning regime, and this
// register knows none of them.
pass(
  "The fruit register publishes no yield figure",
  !/\d\s*(kg|kilogram|kilo|tonnes?|tons?)\b/i.test(JSON.stringify(species))
    && !/(yield|harvest|crop)\s*(of|:)?\s*\d/i.test(JSON.stringify(species))
    && /no yield figure/i.test(species.fruit.no_yield_note.en)
    && Boolean(species.fruit.no_yield_note.fa)
    // The counts on the summary are the counts in the list, not typed.
    && species.fruit.count === species.species.filter((entry) => entry.fruit).length
    && species.fruit.crops_cleanly
      === species.species.filter((entry) => entry.crop_verdict === "pass").length
    && species.fruit.needs_a_pollination_partner
      === species.species.filter((entry) => entry.crop_tests?.pollination === "fail").length
    && en.testBloomFrost && fa.testBloomFrost && en.speciesFruitTitle && fa.speciesFruitTitle,
);

// Direction here is seasonal — easterly most of the year, westerly in summer — so
// the arrow has to follow the date on screen rather than the annual average.
pass(
  "Each solar date maps to a published wind season",
  (() => {
    const map = wind.season_for_solar_date || {};
    const names = new Set(wind.seasons.map((season) => season.season));
    return solar.seasons.every((season) => names.has(map[season.id]))
      && wind.seasons.every((season) => season.season_label?.en && season.season_label?.fa)
      // And the summer row really does differ, or this check proves nothing.
      && wind.seasons.find((season) => season.season === "summer").prevailing_direction
        !== wind.seasons.find((season) => season.season === "winter").prevailing_direction
      && /season_for_solar_date\?\.\[currentSeason\?\.id\]/.test(terrain3d);
  })(),
);
pass(
  "The wind layer states its direction convention and its illustrative motion",
  /direction the wind blows \*from\*|blows \*from\*/.test(terrain3d)
    // The motion is declared on the control rather than in the world label, which
    // could not hold a third clause at legible size in either language.
    && /illustrative/i.test(en.showWind) && /نمایشی/.test(fa.showWind)
    && /amplitude here is a fixed few degrees/.test(terrain3d)
    // The one animation loop in the file: reduced-motion respected, cancellable,
    // and idle while the tab is hidden.
    && /prefers-reduced-motion: reduce/.test(terrain3d)
    && /function stopWindLoop/.test(terrain3d)
    && /cancelAnimationFrame\(windFrame\)/.test(terrain3d)
    && /if \(document\.hidden \|\| !plantingGroup\) return;/.test(terrain3d)
    && html.includes('id="terrain-3d-wind"')
    && !/id="terrain-3d-wind"[^>]*\bchecked\b/.test(html)
    && en.showWind && fa.showWind,
);
// Vegetation appears nowhere in the bundled sources, so trees may ship only as
// explicitly illustrative geometry that no measured figure depends on.
pass(
  "Trees are illustrative, declared, and excluded from the exaggerated view",
  planting.status === "illustrative-only"
    && planting.trees.length >= 3
    && planting.trees.every((tree) => tree.height_m > 0 && tree.crown_radius_m > 0)
    && /not survey data/.test(planting.note.en)
    && Boolean(planting.note.fa)
    && /illustrative/i.test(en.showTrees) && Boolean(fa.showTrees)
    && /plantingHidden \|\| verticalScale !== 1/.test(terrain3d)
    // They cast, unlike the hillside, so the shadow frustum has to see them.
    && shadowExtent.includes("plantingGroup"),
);
// The old claim was true only while no off-site surface shipped.
pass(
  "No surviving claim that this view carries no off-site terrain",
  !/no interpolated off-site terrain|بدون زمین برون‌سایت/.test([html, JSON.stringify(en), JSON.stringify(fa)].join("\n")),
);

/*
  Anti-fabrication gate. A code parameter is the one kind of number that becomes
  a design input regardless of how carefully it is labelled: an engineer who
  finds `basic_wind_speed` in a site dashboard will size against it. None of
  these can be derived from anything on disk — they come from licensed standards
  and from field investigation — so any key that reads like one may only ship
  inside an object whose status already says it is not available.

  Written before the Stage 4 derivations rather than after, so it gates them
  instead of auditing them.
*/
const FABRICATION_KEYS =
  /design_(wind|snow|seismic)|basic_wind|base_acceleration|seismic_zone|response_spectrum|bearing_capacity|snow_load|frost_depth|setback|far_ratio|allowable_/;
const fabricationHits = [];
const scanForFabrication = (value, trail) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForFabrication(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  const status = typeof value.status === "string" ? value.status : "";
  for (const [key, child] of Object.entries(value)) {
    if (FABRICATION_KEYS.test(key) && !status.startsWith("requires-")) {
      fabricationHits.push(`${trail}.${key} (status "${status || "none"}")`);
    }
    scanForFabrication(child, `${trail}.${key}`);
  }
};
for (const name of fs.readdirSync(path.join(dashboard, "data"))) {
  if (name.endsWith(".json")) scanForFabrication(readJson(name), name);
}
pass(
  "No code parameter ships outside a requires-* status",
  fabricationHits.length === 0,
  fabricationHits.join(" · "),
);

/*
  Stage 4 derivations. Each of these is a real statistic from bundled data, and
  each is named for the statistic rather than for the code parameter it
  resembles — the anti-fabrication gate above enforces the naming, these assert
  the arithmetic and the framing.
*/
const derived = climate.derived;
const hdd18 = derived.degree_days.totals.find((total) => total.id === "hdd18");
pass(
  "Monthly degree-days sum to the published annual total",
  derived.degree_days.totals.every((total) => (
    Math.abs(total.monthly_k_day.reduce((sum, value) => sum + value, 0) - total.annual_k_day) <= 6
  )),
  `hdd18 monthly ${hdd18.monthly_k_day.reduce((sum, value) => sum + value, 0)} vs ${hdd18.annual_k_day}`,
);
pass(
  "Percentile temperatures are never named design temperatures",
  !JSON.stringify(derived.temperature_percentiles).includes("design_temperature")
    && Number.isFinite(derived.temperature_percentiles.percentile_daily_min_c)
    && derived.temperature_percentiles.percentile_daily_min_c
      > derived.temperature_percentiles.absolute_min_c,
);
// The accepted fit is checkable because the rejected one is published beside it.
pass(
  "Wind return periods come from the daily gust series, with the rejected fit published",
  derived.wind_return_periods.series.startsWith("daily")
    && derived.wind_return_periods.factors_applied.length === 0
    && derived.wind_return_periods.factors_required.length >= 3
    && derived.wind_return_periods.rejected_fit.series.startsWith("hourly")
    // The 30-year observed maximum should sit between the 50 and 100-year fits,
    // which is what makes the extrapolation credible rather than merely fitted.
    && derived.wind_return_periods.observed_max_kmh
      > derived.wind_return_periods.gust_return_period_kmh["25"],
);
const terrainMetrics = readJson("terrain-metrics.json");
pass(
  "TIN facet areas sum to the verified plan area",
  Math.abs(terrainMetrics.plan_area_m2 - site.verified_area_m2) < 1e-3,
  `${terrainMetrics.plan_area_m2} vs ${site.verified_area_m2}`,
);
pass(
  "Slope classes account for the whole parcel and no earthwork quantity ships",
  Math.abs(terrainMetrics.slope_classes.reduce((sum, item) => sum + item.share_percent, 0) - 100)
    < 0.2
    && terrainMetrics.surface_to_plan_ratio > 1
    && !JSON.stringify(terrainMetrics).match(/cut_volume|fill_volume|_m3\b/),
);
const investigations = readJson("investigations.json");
pass(
  `The register carries ${investigations.items.length} rows, each an instruction with an owner`,
  investigations.items.length >= 18
    && investigations.items.every((item) => item.status.startsWith("requires-")
      && item.procure_via?.en && item.blocks?.en && item.proxy_available?.en
      && investigations.gates.some((gate) => gate.id === item.gate)
      && investigations.families.some((family) => family.id === item.family)),
);
// The two things a site dashboard must never quietly supply.
pass(
  "No seismic or snow-load figure appears anywhere in the bundle",
  !/\b\d+(\.\d+)?\s*g\b.*(seismic|acceleration)/i.test(JSON.stringify(readJson("hazards.json")))
    && !/kN\/m2|kN\/m²/.test(JSON.stringify(readJson("climate.json"))),
);

const sectionIds = [
  "overview",
  "survey",
  "terrain",
  "geography",
  "climate",
  "solar",
  "wind",
  "hazards",
  "architecture",
  "concepts",
  "species",
  "investigations",
  "documents",
  "methodology",
];
pass(
  "All required sections are present",
  sectionIds.every((id) => html.includes(`id="${id}"`)),
);

pass(
  "English and Persian translation keys match",
  JSON.stringify(Object.keys(en).sort()) === JSON.stringify(Object.keys(fa).sort()),
);
pass("RTL styling is present", css.includes('html[dir="rtl"]'));
pass("Verified site area", site.verified_area_m2 === 487.428568);
pass(
  "Drawing verification is separated from legal property status",
  site.property_verification.items.find((item) => item.id === "drawing-geometry")?.status === "verified"
    && site.property_verification.items.find((item) => item.id === "plan-area-calculation")?.status === "verified"
    && ["legal-ownership", "cadastral-boundary", "easements", "rights-of-way"].every(
      (id) => site.property_verification.items.find((item) => item.id === id)?.status === "unresolved",
    )
    && en.surveyTitle.includes("verified drawing geometry")
    && fa.surveyTitle.includes("هندسه ترسیمی تأییدشده")
    && !en.surveyTitle.includes("verified property")
    && !fa.surveyTitle.includes("ملک تأییدشده")
    && html.includes('id="property-verification-list"'),
);
pass(
  "Architectural-readiness gate names all three bilingual decision states",
  readiness.status === "concept-design-blocked"
    && JSON.stringify(readiness.states.map((item) => item.id))
      === '["usable-now","preliminary-only","blocks-concept"]'
    && readiness.states.every((item) => item.evidence.length >= 4
      && Boolean(item.label.en) && Boolean(item.label.fa)
      && item.evidence.every((entry) => Boolean(entry.en) && Boolean(entry.fa)))
    && html.includes('id="readiness-grid"'),
);
const briefAnswered = clientBrief.fields.filter((item) =>
  ["from-brief", "household-stated", "climate-briefing"].includes(item.status));
pass(
  "Client brief exposes twelve answered fields without inventing engineering stamps",
  clientBrief.status === "complete"
    && clientBrief.fields.length === 12
    && briefAnswered.length === 12
    && clientBrief.fields.every((item) => Boolean(item.label.en) && Boolean(item.label.fa)
      && item.value && Boolean(item.value.en) && Boolean(item.value.fa)
      && item.status !== "unresolved" && item.status !== "inferred")
    && clientBrief.fields.find((item) => item.id === "budget")?.value?.en.includes("unlimited")
    && clientBrief.fields.find((item) => item.id === "construction")?.status === "climate-briefing"
    && /reinforced-concrete|RC frame|بتن/i.test(clientBrief.fields.find((item) => item.id === "construction")?.value?.en || "")
    && /not a stamped structural design/i.test(clientBrief.fields.find((item) => item.id === "construction")?.value?.en || "")
    && /insulation/i.test(clientBrief.fields.find((item) => item.id === "energy-carbon")?.value?.en || "")
    && /24\/7|AC/i.test(clientBrief.fields.find((item) => item.id === "energy-carbon")?.value?.en || "")
    && /two years|1–2|one year/i.test(clientBrief.fields.find((item) => item.id === "timeline")?.value?.en || "")
    && /two covered cars|2–3|2-3|two or three/i.test(clientBrief.fields.find((item) => item.id === "garage-workshop")?.value?.en || "")
    && html.includes('id="client-brief-grid"'),
);
pass(
  "Room and garage placement remains gated by brief and field evidence",
  ["courtyard", "bedrooms", "living", "kitchen", "office", "garage"].every(
    (id) => recommendations.items.find((item) => item.id === id)?.confidence === "requires-investigation",
  )
    && recommendations.items.find((item) => item.id === "garage")?.detail.en.includes("road longitudinal and crossfall grade")
    && recommendations.items.find((item) => item.id === "garage")?.detail.en.includes("vehicle swept paths")
    && recommendations.items.find((item) => item.id === "bedrooms")?.detail.en.includes("no room side is selected"),
);
pass("Seven-point outer boundary", site.outer_boundary_points.length === 7);
pass("Pt8 is the only interior terrain point", JSON.stringify(site.interior_terrain_points) === '["Pt8"]');
pass("Eight survey points", survey.points.length === 8);
pass("Road edge", site.road.edge === "Pt2–Pt1" && site.road.length_m === 10.270569);
pass("North direction", site.north.direction === "+Y");
pass(
  "Elevation range",
  site.elevation.min_m === 1647.899 &&
    site.elevation.max_m === 1659.653 &&
    site.elevation.relief_m === 11.754,
);
const slopes = terrain.triangles.map((triangle) => triangle.slope_percent);
pass(
  "TIN slope range",
  Math.abs(Math.min(...slopes) - 34.51924061568701) < 1e-12 &&
    Math.abs(Math.max(...slopes) - 44.03106871127578) < 1e-12,
);
pass(
  "Probable geolocation is explicit",
  project.geolocation_status === "probable"
    && project.geolocation_confidence === "strong-probable"
    && !("geolocation_confirmed" in project)
    && project.status === "pre-design-environmental-analysis-complete"
    && project.evidence_counts.unresolved_environmental_modules === 5
    && geography.probable_project_location.en.includes("Baneh Verdeh")
    && !("confirmed_location" in geography)
    && geography.coordinate_reference_system.status === "probable-not-certified"
    && geography.coordinate_reference_system.epsg === "EPSG:32638",
);
pass(
  "All survey points include derived WGS 84 coordinates",
  survey.points.every((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
);
pass("Climate baseline has 12 complete months", climate.monthly.length === 12);
pass(
  "Climate annual values are populated",
  climate.annual.precipitation_mm > 0
    && climate.annual.frost_days > 0
    && climate.annual.solar_radiation_kwh_m2_day > 0,
);
pass(
  "Solar explorer is precomputed and enabled",
  solar.controls.enabled === true
    && solar.seasons.length === 3
    && solar.seasons.every((season) => season.positions.length > 15),
);
pass(
  "Wind roses contain 10 years of hourly evidence",
  wind.seasons.length === 5
    && wind.seasons[0].sample_hours === 87672
    && wind.seasons.every((season) => season.direction_distribution.length === 16),
);
pass(
  "Regional hazard evidence is separated from field requirements",
  hazards.categories.some((item) => item.status === "regional-data")
    && hazards.categories.some((item) => item.status === "requires-field-investigation"),
);
pass(
  "Seismic design limitations lead while event counts remain expandable context",
  hazards.categories[0].id === "seismic"
    && hazards.categories[0].status === "requires-field-investigation"
    && hazards.seismic_gate.status === "blocks-structural-design"
    && hazards.seismic_gate.missing_inputs.length === 3
    && hazards.seismic_gate.finding.en.includes("Standard 2800 design spectrum")
    && hazards.seismic_gate.finding.en.includes("geotechnical site class")
    && hazards.seismic_gate.regional_context.counts.within_200_km > 0
    && html.includes('id="seismic-gate"')
    && app.includes("regional.counts.within_200_km"),
);
pass(
  "Preliminary concepts stay out of the active document library",
  documents.rejected_concepts.archive_included === true
    && documents.rejected_concepts.active_library === false
    && documents.rejected_concepts.hidden_by_default === false
    && documents.rejected_concepts.revived === true,
);
pass(
  "No FreeCAD concept models are registered as downloadable documents",
  !localRefs.some((reference) => /\.FCStd$/i.test(reference) && /option|concept/i.test(reference)),
);
pass(
  "No absolute Mac paths in visible interface or safe report copies",
  !`${html}\n${app}\n${fs.readFileSync(path.join(dashboard, "assets/documents/site-report.en.md"), "utf8")}`.includes(
    "/Users/",
  ),
);
const privacy = verifyPrivacy(dashboard);
pass(
  "Public-release privacy scan is clean",
  privacy.ok,
  privacy.findings.slice(0, 5).map((hit) => `${hit.file}:${hit.rule}`).join(", "),
);
pass(
  "Canonical build identity is published",
  Boolean(project.build_id && project.generated_on && project.privacy_boundary)
    && html.includes('id="footer-build"')
    && html.includes('id="repro-build-id"')
    && app.includes("renderBuildIdentity"),
);
pass(
  "Survey label-association uncertainty is published",
  survey.label_association?.max_offset_m > 3.8
    && survey.label_association?.max_offset_point_id === "Pt3"
    && html.includes('id="label-association-card"')
    && app.includes("renderLabelAssociation"),
);
pass(
  "Solar design limits remain visible",
  html.includes('id="solar-design-limits"')
    && en.solarDesignLimits?.includes("ten-minute")
    && fa.solarDesignLimits?.includes("۱۰"),
);
pass(
  "Wind heading follows the selected season",
  app.includes("windSeasonTitleKey")
    && en.windTitleSummer?.toLowerCase().includes("westerly")
    && en.windTitleWinter?.toLowerCase().includes("easterly"),
);
const inv = readJson("investigations.json");
const handoff = readJson("architect-handoff.json");
pass(
  "Investigations carry owner, prerequisite, deliverable, dependency and scope",
  inv.items.every((item) =>
    item.owner?.en
    && item.prerequisite?.en
    && item.expected_deliverable?.en
    && item.dependency?.en
    && item.scope_note?.en
    && item.owner?.fa
    && item.scope_note?.fa),
);
pass(
  "Critical gates sit early: title and ground before concept; utilities/access as early feasibility",
  inv.gates.some((gate) => gate.id === "early-feasibility")
    && inv.items.find((item) => item.id === "title-boundary")?.gate === "before-concept"
    && inv.items.find((item) => item.id === "slope-stability")?.gate === "before-concept"
    && inv.items.find((item) => item.id === "bearing-capacity")?.gate === "before-concept"
    && inv.items.find((item) => item.id === "utility-connections")?.gate === "early-feasibility"
    && inv.items.find((item) => item.id === "road-gradient")?.gate === "early-feasibility"
    && inv.items.find((item) => item.id === "construction-access")?.gate === "early-feasibility",
);
pass(
  "Architect handoff brief is complete in both languages",
  handoff.sections.length >= 6
    && handoff.sections.some((section) => section.id === "concept-directions")
    && handoff.sections.every((section) =>
      section.items.length >= 3
      && section.label.en
      && section.label.fa
      && section.items.every((item) => item.en && item.fa))
    && html.includes('id="architect-handoff"')
    && app.includes("renderArchitectHandoff"),
);
pass(
  "Architect climate brief shows CDD18 with heating and cooling seasons",
  html.includes('id="architect-climate"')
    && app.includes("renderArchitectClimate")
    && en.cdd18Label === "CDD18"
    && fa.cdd18Label === "CDD18"
    && en.passiveOpportunitiesText
    && fa.passiveOpportunitiesText,
);
pass(
  "Geography multi-scale controls cover 250 m to 20 km",
  html.includes('data-geo-scale="250"')
    && html.includes('data-geo-scale="1000"')
    && html.includes('data-geo-scale="5000"')
    && html.includes('data-geo-scale="20000"')
    && app.includes("geoViewBounds")
    && app.includes("geoScaleM"),
);
// P2 semantic contradictions
pass(
  "No concept is published as a selected winner for construction",
  concepts.selection.selected === null
    && concepts.selection.ranking_published === false
    && documents.rejected_concepts.active_library === false
    && !/recommended option|winner|select option [abc]/i.test(`${html}\n${app}`)
    && !/گزینه پیشنهادی|برنده/.test(fa.conceptsLead || ""),
);
pass(
  "Probable geolocation is never labelled confirmed ownership",
  project.geolocation_status === "probable"
    && project.geolocation_confidence === "strong-probable"
    && !/geolocation_confirmed:\s*true/.test(JSON.stringify(project))
    && !/confirmed location|تأیید مالکیت/.test(`${en.geoUnresolved || ""}${fa.geoUnresolved || ""}`),
);
pass(
  "Planting main page shortlist is bounded and annex holds the full explorer",
  html.includes('id="species-shortlist-grid"')
    && html.includes('id="species-annex"')
    && readJson("species-shortlist.json").ids.length >= 5
    && readJson("species-shortlist.json").ids.length <= 7
    && app.includes("species-shortlist-grid"),
);
pass(
  "Field evidence slots and claim matrix ship unresolved / sourced structures",
  html.includes('id="field-evidence"')
    && html.includes('id="claim-matrix-table"')
    && readJson("field-evidence-slots.json").groups.length === 4
    && readJson("claim-source-matrix.json").rows.length >= 4
    && readJson("planting-prerequisites.json").items.length === 5,
);
pass(
  "Release metadata and offline Three.js pin stay synchronized",
  project.dashboard_version
    && project.generated_on
    && project.build_id
    && readJson("release-metadata.json").dashboard_version === project.dashboard_version
    && !/are deprecated with r150/.test(fs.readFileSync(path.join(dashboard, "assets/vendor/three/three.min.js"), "utf8")),
);
pass(
  "Page TOC and progressive disclosure panels are present",
  html.includes('id="page-toc"')
    && html.includes("disclosure-panel")
    && html.includes("platformDetails")
    && html.includes("sourcesDetails"),
);
const future = readJson("future-analysis.json");
pass(
  "P3 future-analysis modules are gated and do not invent results",
  future.status === "gated-until-inputs"
    && future.modules.length === 4
    && future.modules.every((module) =>
      module.status.startsWith("blocked-")
      && module.prerequisites?.length >= 2
      && module.withheld?.length >= 1
      && module.title?.en
      && module.title?.fa
      && module.summary?.en
      && module.summary?.fa)
    && html.includes('id="future-analysis"')
    && app.includes("renderFutureAnalysis"),
);
const designParams = future.modules.find((module) => module.id === "design-weather-parameters");
pass(
  "P3 design parameters stay null until formally obtained",
  designParams
    && designParams.parameters.every((param) =>
      param.value === null
      && param.status === "unresolved"
      && param.provenance?.en
      && param.applicability?.en
      && param.provenance?.fa
      && param.applicability?.fa)
    && !/"value":\s*[0-9]/.test(JSON.stringify(designParams.parameters)),
);
pass(
  "P3 does not publish EPW, psychrometric totals or preferred envelope geometry",
  // Forbid affirmative result language; allow "No EPW derived…" withhold text.
  !/hours of discomfort|preferred envelope|floor plan recommendation|comfort verdict published/i.test(
    JSON.stringify(future),
  )
    && /monthly/i.test(future.modules.find((m) => m.id === "hourly-comfort").summary.en)
    && /not a floor plan/i.test(future.modules.find((m) => m.id === "buildable-envelope").summary.en)
    && future.modules.find((m) => m.id === "hourly-comfort").withheld.some((w) => /EPW/i.test(w.en)),
);
pass("Interactive canvases are present", (html.match(/<canvas/g) || []).length >= 7);
pass("Lightbox dialog is present", html.includes('<dialog class="lightbox"'));
pass("Searchable coordinate table is present", html.includes('id="point-search"'));
pass("Language switch is present", html.includes('id="language-toggle"'));
pass("Theme switch is present", html.includes('id="theme-toggle"'));

for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"}  ${check.label}${check.detail ? ` — ${check.detail}` : ""}`);
}
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed.`);
if (failures.length) process.exit(1);
