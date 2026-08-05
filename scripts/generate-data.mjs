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

// Single release identity for project, sources, footer and methodology.
const RELEASE_DATE = "2026-08-05";
const DASHBOARD_VERSION = "1.2.0";

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
  generated_on: RELEASE_DATE,
  dashboard_version: DASHBOARD_VERSION,
  build_id: `dashboard-${RELEASE_DATE}`,
  // One canonical offline package: switch language inside this build; do not
  // treat alternate ports or old query-cache URLs as separate content trees.
  canonical_build_note: bi(
    "One offline build. Switch English and Persian inside this package; do not compare alternate ports or stale cache-query copies as different content.",
    "یک بسته آفلاین. انگلیسی و فارسی را داخل همین بسته عوض کنید؛ پورت‌های دیگر یا نشانی‌های کش‌شده قدیمی را محتوای جدا فرض نکنید.",
  ),
  privacy_boundary: bi(
    "Precise coordinates identify the studied site for analysis. They do not identify an owner and are not evidence of ownership, title, or a cadastral boundary.",
    "مختصات دقیق فقط سایت بررسی‌شده را برای تحلیل مشخص می‌کند. مالک را معرفی نمی‌کند و سند مالکیت، عنوان یا مرز ثبتی نیست.",
  ),
  status: "pre-design-environmental-analysis-complete",
  status_label: bi(
    "Pre-design environmental analysis complete · parcel-scale verification remains open",
    "تحلیل محیطی پیش‌طراحی تکمیل شده · راستی‌آزمایی در مقیاس قطعه همچنان باز است",
  ),
  geolocation_status: "probable",
  geolocation_confidence: "strong-probable",
  geolocation_note: bi(
    "Interpreting the survey as WGS 84 / UTM zone 38N places every point coherently near Baneh Verdeh, Paveh County. This is a strong-probable project location for regional analysis; the CRS is not surveyor-certified.",
    "اگر مختصات نقشه را WGS 84 / UTM زون ۳۸ شمالی در نظر بگیریم، همه نقاط نزدیک بانه‌ورده در شهرستان پاوه قرار می‌گیرند. می‌توان از این موقعیت برای بررسی داده‌های منطقه‌ای استفاده کرد، اما نقشه‌بردار هنوز CRS را تأیید نکرده است.",
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
      "Main vehicle and everyday entry from the upper Pt2–Pt1 frontage (household preference). Exact gate geometry not surveyed. Optional lower pedestrian/secondary gate remains unconfirmed.",
      "ورود اصلی خودرو و روزمره از بر بالایی Pt2–Pt1 (ترجیح خانوار). هندسه دقیق دروازه برداشت نشده. دروازه اختیاری پایین/ثانویه هنوز تأیید نشده.",
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

const architecturalReadiness = {
  status: "concept-design-blocked",
  summary: bi(
    "The household brief is complete enough for concept sketching: house high near the upper road, six people, 2–3-car garage and workshop, climate-first insulated envelope, 1–2 year primary build, unlimited budget preference for quality. Formal concept still waits on geotech, measured road geometry, utility connection agreements, and survey/cadastral certification. Unlimited budget does not remove those gates.",
    "شرح خانوار برای اسکچ مفهومی کامل است: خانه بالا نزدیک راه بالایی، شش نفر، گاراژ دو–سه خودرو و کارگاه، پوسته عایق‌دار اقلیمی، ساخت اصلی یک تا دو سال، بودجه نامحدود برای کیفیت. مفهوم رسمی هنوز به ژئوتکنیک، هندسه اندازه‌گیری‌شده راه، توافق انشعاب و تأیید نقشه‌برداری/ثبت نیاز دارد. بودجه نامحدود آن دروازه‌ها را برنمی‌دارد.",
  ),
  states: [
    {
      id: "usable-now",
      status: "usable-now",
      label: bi("Usable now", "قابل استفاده اکنون"),
      purpose: bi("Site strategy and consultant briefing", "راهبرد سایت و توجیه مشاوران"),
      evidence: [
        bi("Verified drawing geometry and 487.428568 m² plan-area calculation", "هندسه ترسیمی و محاسبه مساحت پلان ۴۸۷٫۴۲۸۵۶۸ مترمربع"),
        bi("Seven outer drawing points, Pt8 terrain point, Pt2–Pt1 road edge and drawing +Y north", "هفت نقطه بیرونی نقشه، نقطه زمین Pt8، لبه راه Pt2–Pt1 و شمال ‎+Y نقشه"),
        bi("Eight spot elevations and seven TIN facets for understanding the general northeast fall", "هشت تراز نقطه‌ای و هفت وجه TIN برای شناخت افت عمومی شمال‌شرقی"),
        bi("Traceable regional climate, solar, wind and hazard evidence for briefing—not design loads", "شواهد قابل‌ردیابی منطقه‌ای اقلیم، خورشید، باد و مخاطرات برای توجیه—نه بارگذاری طراحی"),
        bi("Complete household brief: six people; high upper-road house; 2–3 cars + workshop; high insulation + passive summer comfort; 1–2 year primary timeline; unlimited budget for envelope quality", "شرح کامل خانوار: شش نفر؛ خانه بالا نزدیک راه بالایی؛ دو–سه خودرو + کارگاه؛ عایق قوی + آسایش تابستانی غیرفعال؛ افق اصلی ۱–۲ سال؛ بودجه نامحدود برای کیفیت پوسته"),
      ],
    },
    {
      id: "preliminary-only",
      status: "preliminary-only",
      label: bi("Preliminary only", "فقط مقدماتی"),
      purpose: bi("Questions and options to test", "پرسش‌ها و گزینه‌های قابل آزمون"),
      evidence: [
        bi("Probable WGS 84 / UTM 38N interpretation and probable project location", "تفسیر محتمل WGS 84 / UTM 38N و موقعیت محتمل پروژه"),
        bi("Eight-point TIN, one-metre contours, sections and exploratory platform-depth table", "TIN هشت‌نقطه‌ای، خطوط تراز یک‌متری، مقاطع و جدول اکتشافی عمق سکو"),
        bi("Regional-grid climate, solar, wind, soil, geology and seismic context", "زمینه شبکه‌ای منطقه‌ای اقلیم، خورشید، باد، خاک، زمین‌شناسی و زلزله"),
        bi("Main vehicle entry and fire access preferred from upper Pt2–Pt1; optional lower pedestrian/gate access with stairs", "ورود اصلی خودرو و دسترسی آتش از Pt2–Pt1 بالایی؛ دسترسی اختیاری پایین با دروازه و پله"),
        bi("Utilities (electricity, gas, water) said to exist in the area but not yet to the parcel; connection route most probably from the lower road — unconfirmed", "تأسیسات (برق، گاز، آب) در منطقه گفته می‌شود هست اما هنوز به قطعه نرسیده؛ مسیر انشعاب احتمالاً از راه پایینی — تأییدنشده"),
        bi("Climate-first construction briefing: RC frame + continuous external insulation (not a stamped structural design)", "توجیه ساخت اقلیمی: قاب بتن‌آرمه + عایق پیوسته بیرونی (نه طرح سازه مُهرشده)"),
        bi("Household reports title documents exist for project use — not cadastral verification or ownership proof", "خانوار گزارش می‌دهد اسناد مالکیت برای استفاده پروژه موجود است — نه تأیید کاداستر و نه اثبات مالکیت"),
      ],
    },
    {
      id: "blocks-concept",
      status: "blocks-concept",
      label: bi("Blocks concept design", "مانع طراحی مفهومی"),
      purpose: bi("Resolve before fixing a building footprint or plan", "پیش از تثبیت سطح اشغال یا پلان حل شود"),
      evidence: [
        bi("Certified cadastral boundary geometry, easements, rights-of-way and surveyor-certified CRS — drawing area is not a title", "هندسه مرز ثبتی/قانونی، حقوق ارتفاقی و عبور و CRS تأییدشده نقشه‌بردار — مساحت ترسیمی سند نیست"),
        bi("Preliminary geotechnical and slope-stability assessment — required before concept", "ارزیابی اولیه ژئوتکنیک و پایداری شیب — پیش از مفهومی الزامی است"),
        bi("Utility connection agreements (capacity, meter points, cost) — networks nearby ≠ connected to parcel", "توافق انشعاب تأسیسات (ظرفیت، محل کنتور، هزینه) — شبکه در منطقه ≠ اتصال به قطعه"),
        bi("Measured upper-road grade, gate geometry, swept path for 2–3 cars; lower-gate feasibility on steep ground", "شیب اندازه‌گیری‌شده راه بالایی، هندسه دروازه، مسیر گردش برای دو–سه خودرو؛ امکان دروازه پایین روی زمین پرشیب"),
        bi("Municipal permit route still applies even if the area is currently undeveloped", "مسیر مجوز شهرداری حتی اگر منطقه فعلاً خالی باشد برقرار است"),
        bi("Structural and envelope detailing must follow Standard 2800, Topic 6 loads and local geotech — not the dashboard climate briefing alone", "جزئیات سازه و پوسته باید از استاندارد ۲۸۰۰، بارهای مبحث ۶ و ژئوتکنیک محلی پیروی کند — نه فقط توجیه اقلیمی داشبورد"),
      ],
    },
  ],
};

// Program answers: design-brief.md + household statements (2026-08-05 backlog passes).
// Values are household preferences and climate briefing, not permits or stamped engineering.
const clientBrief = {
  status: "complete",
  source: bi(
    "design-brief.md + household answers (2026-08-05)",
    "design-brief.md + پاسخ‌های خانوار (۲۰۲۶-۰۸-۰۵)",
  ),
  note: bi(
    "All twelve brief fields are answered, including design-direction refinements (2026-08-05). Construction system is a climate-first briefing for the engineer — not a stamped structural system. Unlimited budget does not skip survey, geotech, utilities or permits.",
    "هر دوازده فیلد شرح، شامل اصلاحات جهت طراحی (۲۰۲۶-۰۸-۰۵)، پاسخ داده شده‌اند. سیستم ساخت توجیه اقلیمی برای مهندس است — نه طرح سازه مُهرشده. بودجه نامحدود نقشه‌برداری، ژئوتکنیک، تأسیسات یا مجوز را حذف نمی‌کند.",
  ),
  fields: [
    {
      id: "household",
      label: bi("Household composition", "ترکیب خانوار"),
      status: "from-brief",
      value: bi(
        "Family of six — house must be suitable for six people living together",
        "خانواده شش‌نفره — خانه باید برای زندگی هم‌زمان شش نفر مناسب باشد",
      ),
    },
    {
      id: "room-program",
      label: bi("Room and space program", "برنامه فضاها و اتاق‌ها"),
      status: "household-stated",
      value: bi(
        "Four naturally lit bedrooms: one master suite + three similar rooms. Acoustically separated home office (architect default). Semi-open kitchen to living with visual link and some separation (not fully open, not closed). Living and dining; open-to-sky courtyard; laundry; storage; two bathrooms. Outdoor nature-play for children; later water feature may be fountain or pool — architect proposes. Practical circulation for six.",
        "چهار اتاق‌خواب با نور طبیعی: یک سوئیت والدین + سه اتاق مشابه. دفتر خانگی جدا از نظر صوتی (پیش‌فرض معمار). آشپزخانه نیمه‌باز به نشیمن با پیوند دیداری و کمی جداسازی (نه کاملاً باز، نه بسته). نشیمن و ناهارخوری؛ حیاط باز به آسمان؛ رختشوی‌خانه؛ انبار؛ دو سرویس. بازی کودکان در طبیعت؛ عنصر آبی بعدی فواره یا استخر — پیشنهاد معمار. گردش عملی برای شش نفر.",
      ),
    },
    {
      id: "target-area",
      label: bi("Target internal and external areas", "مساحت هدف داخلی و بیرونی"),
      status: "household-stated",
      value: bi(
        "No numeric floor-area target. Main house mass high near the upper road. Keep outdoor land for children in nature; later water feature optional (fountain or pool — architect proposes). Parcel plan area is the verified 487.428568 m² drawing figure — not a buildable-area target. Trade-offs balanced: comfort, outdoor play, car access and 1–2 year speed equally.",
        "بدون هدف عددی زیربنا. حجم اصلی خانه بالا نزدیک راه بالایی. زمین بیرونی برای بازی کودکان در طبیعت؛ عنصر آبی بعدی اختیاری (فواره یا استخر — پیشنهاد معمار). مساحت پلان قطعه ۴۸۷٫۴۲۸۵۶۸ مترمربع ترسیمی تأییدشده است — نه هدف سطح اشغال. تعادل برابر: آسایش، بازی بیرون، دسترسی خودرو و سرعت ۱–۲ ساله.",
      ),
    },
    {
      id: "accessibility",
      label: bi("Accessibility and ageing-in-place needs", "دسترس‌پذیری و نیازهای سالمندی در محل"),
      status: "household-stated",
      value: bi(
        "Main everyday vehicle and pedestrian entrance from the upper road. Lower downhill gate with stairs is a nice-to-have only if the slope allows — study it; not a hard phase-1 requirement. Full ageing-in-place / step-free brief not specified; concept door and corridor minima remain a floor.",
        "ورود روزمره خودرو و پیاده از راه بالایی. دروازه پایین با پله فقط در صورت امکان شیب مطلوب است — مطالعه شود؛ الزام سخت فاز ۱ نیست. شرح کامل سالمندی/بدون‌پله بیان نشده؛ حداقل در و راهرو شرح مفهومی کف است.",
      ),
    },
    {
      id: "privacy-culture",
      label: bi("Privacy, hosting and cultural needs", "نیازهای حریم، پذیرایی و فرهنگی"),
      status: "household-stated",
      value: bi(
        "Surroundings currently empty — no built neighbours (household; OSM has no nearby footprints). Outdoor nature-play for children is important. Semi-open kitchen/living suits everyday family life more than formal separation. No detailed hosting protocol stated.",
        "اطراف فعلاً خالی — خانهٔ همسایه ساخته‌نشده (خانوار؛ OSM بدون ردپای نزدیک). بازی کودکان در طبیعت مهم است. آشپزخانه/نشیمن نیمه‌باز بیشتر با زندگی روزمره خانواده جور است تا جداسازی رسمی. پروتکل دقیق پذیرایی بیان نشده.",
      ),
    },
    {
      id: "budget",
      label: bi("Budget range and cost priorities", "بازه بودجه و اولویت‌های هزینه"),
      status: "household-stated",
      value: bi(
        "Treat budget as unlimited for design quality: prioritise thermal envelope, durability on a steep seismic site, and comfort over cheapest first cost. Unlimited budget does not remove geotech, utilities, survey or permit steps, and does not set a currency figure in this dashboard.",
        "بودجه برای کیفیت طراحی نامحدود در نظر گرفته شود: اولویت با پوسته حرارتی، دوام روی سایت پرشیب لرزه‌خیز و آسایش است نه ارزان‌ترین هزینه اولیه. بودجه نامحدود ژئوتکنیک، تأسیسات، نقشه‌برداری یا مجوز را حذف نمی‌کند و رقم ارزی در این داشبورد ثبت نمی‌شود.",
      ),
    },
    {
      id: "phasing",
      label: bi("Phasing and occupied-construction needs", "فازبندی و نیازهای ساخت در زمان سکونت"),
      status: "household-stated",
      value: bi(
        "Primary house, upper garage/workshop band and essential outdoor access first. Optional lower gate only if slope allows. Fountain/pool and garden refinements may follow after move-in.",
        "خانه اصلی، نوار گاراژ/کارگاه بالایی و دسترسی ضروری بیرون اول. دروازه پایین فقط اگر شیب اجازه دهد. فواره/استخر و تکمیل باغ می‌تواند بعد از سکونت باشد.",
      ),
    },
    {
      id: "timeline",
      label: bi("Decision and construction timeline", "زمان‌بندی تصمیم‌گیری و ساخت"),
      status: "household-stated",
      value: bi(
        "Primary house ready for occupation within one year if possible, two years at most. Later outdoor phases may follow after move-in.",
        "خانه اصلی در صورت امکان ظرف یک سال برای سکونت آماده شود، حداکثر دو سال. فازهای بعدی محوطه می‌تواند بعد از سکونت باشد.",
      ),
    },
    {
      id: "construction",
      label: bi("Construction system and material preferences", "ترجیحات سیستم ساخت و مصالح"),
      status: "climate-briefing",
      value: bi(
        "Structure briefing: reinforced-concrete frame with insulated non-structural infill + continuous external thermal insulation and thermal-bridge control (engineer confirms after 2800 / Topic 6 / geotech). Character: simple modern, clean lines. Massing: two levels that split and step down the slope (not one flat platform; not a single tall block only). Not a stamped structural design.",
        "توجیه سازه: قاب بتن‌آرمه با میان‌قاب عایق غیرسازه‌ای + عایق حرارتی پیوسته بیرونی و کنترل پل حرارتی (مهندس پس از ۲۸۰۰ / مبحث ۶ / ژئوتکنیک تأیید می‌کند). شخصیت: مدرن ساده، خطوط تمیز. حجم: دو تراز که روی شیب شکسته و پایین می‌روند (نه یک سکوی صاف؛ نه فقط یک بلوک بلند). طرح سازه مُهرشده نیست.",
      ),
    },
    {
      id: "garage-workshop",
      label: bi("Garage, workshop and vehicle requirements", "نیازهای گاراژ، کارگاه و خودرو"),
      status: "household-stated",
      value: bi(
        "Upper Pt2–Pt1 band: design for two covered cars as the base. Prefer an open-ended garage that opens toward the garden so a third car can fit when layout allows. Workshop/carpentry may share the same upper area — when one car is out there should be enough room for handwork (not necessarily a fully separate pavilion). Main vehicle and fire access from upper road. Lower gate + stairs: nice-to-have if slope allows, not a hard phase-1 requirement.",
        "نوار بالایی Pt2–Pt1: طراحی برای دو خودرو سرپوشیده به‌عنوان پایه. ترجیح گاراژ باز به سمت باغ تا در صورت جا خودروی سوم هم بنشیند. کارگاه/نجاری می‌تواند همان فضای بالایی را شریک شود — وقتی یک خودرو بیرون است جا برای کار دستی باشد (لزوماً غرفه جدا نیست). ورود خودرو و آتش از راه بالایی. دروازه + پله پایین: مطلوب اگر شیب اجازه دهد، نه الزام سخت فاز ۱.",
      ),
    },
    {
      id: "energy-carbon",
      label: bi("Energy, comfort and carbon goals", "اهداف انرژی، آسایش و کربن"),
      status: "household-stated",
      value: bi(
        "High continuous insulation mandatory. Prefer gas heating when connected; AC only as backup — not 24/7. Summer comfort via shading (esp. west/southwest), limited unprotected west glass, night purge / cross-ventilation, courtyard airflow. Design roof ready for PV (reserve unshaded south-facing zone). No EPW energy model claimed here.",
        "عایق پیوسته قوی الزامی. ترجیح گرمایش گاز پس از انشعاب؛ کولر فقط پشتیبان — نه ۲۴/۷. آسایش تابستان با سایه‌اندازی (به‌ویژه غرب/جنوب‌غرب)، محدود کردن شیشه غربی بدون حفاظت، تهویه شبانه/متقاطع، جریان حیاط. بام آماده PV (ناحیه جنوبی بدون سایه). هیچ مدل انرژی EPW اینجا ادعا نشده.",
      ),
    },
    {
      id: "future-expansion",
      label: bi("Future expansion and adaptability", "توسعه آینده و انعطاف‌پذیری"),
      status: "household-stated",
      value: bi(
        "Phased: later outdoor water (fountain or pool — architect proposes) and garden work after move-in. Roof PV-ready from the start. Flexible third-car / workshop use in the upper band. No second dwelling stated.",
        "مرحله‌ای: عنصر آبی بعدی (فواره یا استخر — پیشنهاد معمار) و کار باغ بعد از سکونت. بام از ابتدا آماده PV. استفاده انعطاف‌پذیر خودروی سوم / کارگاه در نوار بالایی. واحد دوم بیان نشده.",
      ),
    },
  ],
};

const associationDistances = points.map((point) => point.association_distance_m);
const maxAssociationDistance = Math.max(...associationDistances);
const maxAssociationPoint = points.find(
  (point) => point.association_distance_m === maxAssociationDistance,
);

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
  label_association: {
    method: bi(
      "Each SurveyPoint MTEXT label is associated with its nearest vertex; the offset is published, not hidden.",
      "هر برچسب MTEXT از نوع SurveyPoint به نزدیک‌ترین رأس مرتبط می‌شود؛ فاصله اعلام می‌شود و پنهان نمی‌ماند.",
    ),
    max_offset_m: maxAssociationDistance,
    max_offset_point_id: maxAssociationPoint?.id ?? null,
    note: bi(
      `Maximum elevation-label association offset is ${maxAssociationDistance.toFixed(3)} m at ${maxAssociationPoint?.id ?? "unknown"}. Contours and TIN facets inherit that geometric uncertainty.`,
      `بیشینه فاصله ارتباط برچسب تراز ${maxAssociationDistance.toFixed(3)} متر در ${maxAssociationPoint?.id ?? "نامشخص"} است. خطوط تراز و وجوه TIN همان عدم‌قطعیت هندسی را به ارث می‌برند.`,
    ),
  },
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

const sectionDirections = {
  longitudinal: { start: bi("South", "جنوب"), end: bi("North", "شمال") },
  transverse: { start: bi("West", "غرب"), end: bi("East", "شرق") },
};

const buildTerrainSection = (key, section) => {
  // The immutable longitudinal cut line spans the rectangular analysis bounds,
  // so its first and last samples fall just outside the parcel and are NaN in
  // the source. They must be removed before chart scaling: JavaScript coerces
  // null to zero in Math.min(), which previously drew a false 0–1657 m section.
  const valid = section.distance_m
    .map((distance, index) => ({ distance, elevation: section.elevation_m[index] }))
    .filter((sample) => Number.isFinite(sample.distance) && Number.isFinite(sample.elevation));
  if (valid.length < 2) throw new Error(`terrain section ${key} has fewer than two valid samples`);
  const origin = valid[0].distance;
  const distance = valid.map((sample) => sample.distance - origin);
  const elevations = valid.map((sample) => sample.elevation);
  const run = distance.at(-1);
  const fall = elevations[0] - elevations.at(-1);
  return {
    label: bi(section.label, sectionLabelsFa[key] ?? section.label),
    direction: sectionDirections[key],
    distance_m: distance,
    elevation_m: elevations,
    sample_count: valid.length,
    omitted_outside_parcel_samples: section.distance_m.length - valid.length,
    start_elevation_m: elevations[0],
    end_elevation_m: elevations.at(-1),
    elevation_change_m: elevations.at(-1) - elevations[0],
    fall_m: fall,
    run_m: run,
    average_grade_percent: run ? (fall / run) * 100 : null,
    scope: bi(
      "TIN intersection along the parcel only; analytical and exploratory, with no surveyed breaklines.",
      "تقاطع TIN فقط در محدوده قطعه؛ تحلیلی و اکتشافی، بدون شکست‌خط برداشت‌شده.",
    ),
  };
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
      buildTerrainSection(key, section),
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
// the client says it is there. Household characterisation (2026-08-05): rough /
// seasonal track, not equivalent to the surveyed upper frontage. That is a
// different kind of evidence from a survey and it is labelled as one, not folded
// in beside it.
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
        bi("Lower road · client-reported rough/seasonal", "راه پایینی · rough/فصلی به گفتهٔ کارفرما"),
        bi(
          "Client-reported rough/seasonal track — not surveyed and not in any bundled source. The survey records exactly one road boundary: the upper Pt2–Pt1 frontage (the real vehicle/pedestrian access for the brief). This strip follows the downhill Pt5–Pt6 edge only because that is the edge described; position, width, length, surface and seasonal usability are all unverified and must be checked on site.",
          "مسیر rough/فصلی به گفتهٔ کارفرما — برداشت نشده و در هیچ منبع همراه نیست. نقشه‌برداری تنها یک مرز راه ثبت کرده: بر بالایی Pt2–Pt1 (دسترسی واقعی خودرو/پیاده در شرح پروژه). این نوار فقط مرز سراشیب Pt5–Pt6 را دنبال می‌کند چون همان لبه توصیف شده؛ موقعیت، عرض، طول، سطح و قابلیت استفاده فصلی هیچ‌یک تأیید نشده و باید در محل بررسی شوند.",
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
  seismic_gate: {
    status: "blocks-structural-design",
    title: bi("Seismic design inputs are unavailable", "ورودی‌های طراحی لرزه‌ای موجود نیست"),
    finding: bi(
      "No applicable Standard 2800 design spectrum, seismic zone/base acceleration, importance factor or geotechnical site class has been established for this parcel. Regional earthquake counts describe context only and must not be used as structural design parameters.",
      "اطلاعات لازم استاندارد ۲۸۰۰ برای این قطعه هنوز تهیه نشده است: طیف طراحی، شتاب مبنا، ضریب اهمیت و رده خاک ساختگاه را نداریم. فهرست زلزله‌های منطقه فقط برای شناخت کلی است و برای محاسبات سازه قابل استفاده نیست.",
    ),
    missing_inputs: [
      bi("Applicable Standard 2800 design spectrum and seismic parameters", "طیف طراحی و پارامترهای لرزه‌ای لازم استاندارد ۲۸۰۰"),
      bi("Geotechnical site class from parcel investigation", "رده ساختگاه ژئوتکنیکی از بررسی خود قطعه"),
      bi("Structural system, importance category and code applicability", "سیستم سازه‌ای، گروه اهمیت و دامنه کاربرد آیین‌نامه"),
    ],
    regional_context: {
      title: bi("Regional earthquake catalogue—context only", "فهرست منطقه‌ای زلزله—فقط برای زمینه"),
      finding: hazardEvidence.seismic.finding,
      counts: hazardEvidence.seismic.counts,
      strongest: hazardEvidence.seismic.strongest,
    },
  },
  categories: [
    {
      id: "seismic",
      status: "requires-field-investigation",
      title: bi("Seismic design basis", "مبنای طراحی لرزه‌ای"),
      finding: bi(
        "Design spectrum, Standard 2800 parameters and geotechnical site class are unavailable. Obtain them before structural design; the regional catalogue below is not a substitute.",
        "طیف طراحی، پارامترهای استاندارد ۲۸۰۰ و رده خاک ساختگاه موجود نیست. مهندس سازه پیش از طراحی به این اطلاعات نیاز دارد. فهرست زلزله‌های منطقه جای آن‌ها را نمی‌گیرد.",
      ),
    },
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
    ["courtyard", "Courtyard question", "پرسش حیاط", "requires-investigation", "Household wants outdoor nature-play for children and may add a small fountain or pool later; the design brief also keeps an open-to-sky courtyard. Test drainage, safety fencing and frost/winter shutdown before fixing water features; no pool size or level is selected.", "خانوار بازی کودکان در طبیعت می‌خواهد و ممکن است بعداً فواره یا استخر کوچک اضافه کند؛ شرح طراحی هم حیاط باز به آسمان دارد. پیش از تثبیت عنصر آبی، زهکشی، حصار ایمنی و تعطیلی زمستانی آزمون شود؛ هیچ اندازه یا تراز استخر انتخاب نشده."],
    ["bedrooms", "Bedroom questions", "پرسش‌های اتاق‌خواب", "requires-investigation", "Four bedrooms: master suite + three similar rooms for a household of six; house mass preferred high near the upper road. Confirm privacy, accessibility, views and noise tolerance before fixing orientations; no room side is selected yet.", "چهار اتاق‌خواب: سوئیت والدین + سه اتاق مشابه برای خانوار شش‌نفره؛ حجم خانه ترجیحاً بالا نزدیک راه بالایی. پیش از تثبیت جهت، حریم، دسترس‌پذیری، دید و تحمل صدا تأیید شود؛ هنوز سمت اتاق انتخاب نشده."],
    ["living", "Living-area questions", "پرسش‌های فضای نشیمن", "requires-investigation", "Living spaces should suit six people and connect to outdoor nature-play. Prefer testing living/kitchen relationships on the high half of the parcel near the upper road; no terrace or finished level is promised.", "فضاهای نشیمن باید برای شش نفر مناسب باشد و به بازی در طبیعت وصل شود. رابطه نشیمن/آشپزخانه در نیمه بالای قطعه نزدیک راه بالایی آزمون شود؛ هیچ تراس یا تراز تمام‌شده تضمین نشده."],
    ["kitchen", "Kitchen questions", "پرسش‌های آشپزخانه", "requires-investigation", "Household wants semi-open kitchen to living (visual link, some separation). Still confirm extract, gas/electric fuel after utility letters, storage and service access before fixing the plan.", "خانوار آشپزخانه نیمه‌باز به نشیمن می‌خواهد (پیوند دیداری، کمی جداسازی). پیش از تثبیت پلان، هواکش، سوخت گاز/برق پس از نامه تأسیسات، انبارش و دسترسی خدماتی هنوز تأیید شود."],
    ["office", "Office questions", "پرسش‌های دفتر کار", "requires-investigation", "Keep an acoustically separated home office (household accepts architect default). Still check road noise, glare and visitor access before fixing orientation; road noise has not been measured.", "دفتر خانگی جدا از نظر صوتی نگه داشته شود (خانوار پیش‌فرض معمار را می‌پذیرد). پیش از تثبیت جهت، صدای راه، خیرگی و دسترسی مراجعان هنوز کنترل شود؛ صدای راه اندازه‌گیری نشده."],
    ["garage", "Garage / workshop gate", "شرط گاراژ / کارگاه", "requires-investigation", "Household: two covered cars base at upper Pt2–Pt1; open-ended toward garden so a third car can fit if layout allows; workshop may share the same upper area when a bay is free; lower gate only if slope allows. Still measure road longitudinal and crossfall grade, gate geometry and vehicle swept paths before fixing the plan — preference is not a survey.", "خانوار: دو خودرو سرپوشیده در Pt2–Pt1؛ باز به باغ تا خودروی سوم در صورت جا؛ کارگاه ممکن است همان فضای بالایی را وقتی یک جای خالی است شریک شود؛ دروازه پایین فقط اگر شیب اجازه دهد. پیش از تثبیت پلان، شیب طولی و عرضی راه، هندسه دروازه و مسیر گردش اندازه‌گیری شود — ترجیح برداشت نیست."],
    ["roof", "Roof", "بام", "reasonable-inference", "Coordinate roof drainage with the strong northeast fall and a confirmed legal discharge route.", "زهکشی بام با افت شدید شمال‌شرقی و مسیر قانونی تخلیه هماهنگ شود."],
    ["ventilation", "Ventilation", "تهویه", "reasonable-inference", "Household wants summer comfort without AC 24/7: provide cross-ventilation and night-purge paths that can use cooler outdoor air, remain closable for cold easterly winter flow, and work with the courtyard; confirm with on-site anemometry.", "خانوار آسایش تابستان بدون کولر ۲۴/۷ می‌خواهد: مسیر تهویه متقاطع و تخلیه شبانه برای هوای خنک بیرون، قابل‌بستن در برابر جریان سرد شرقی زمستان، و هماهنگ با حیاط؛ با بادسنجی محلی تأیید شود."],
    ["shading", "Shading", "سایه‌اندازی", "reasonable-inference", "Mandatory for the comfort goal: horizontal control on south glazing and stronger external vertical or operable protection on west/southwest façades so the house is not baked in summer afternoons.", "برای هدف آسایش الزامی است: کنترل افقی روی شیشه جنوب و حفاظت عمودی یا متحرک قوی‌تر روی نماهای غرب/جنوب‌غرب تا خانه در عصر تابستان پخته نشود."],
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
    ["contours", "Exploratory terrain contours", "خطوط تراز اکتشافی زمین", "One-metre contours derived from the eight-point TIN; not construction grading or pricing evidence.", "خطوط تراز یک‌متری مشتق‌شده از TIN هشت‌نقطه‌ای؛ نامناسب برای تسطیح اجرایی یا قیمت‌گذاری.", "PNG", "neutral", "phase-2", "preliminary-inference", "assets/diagrams/site-contours.png", "image"],
    ["sections", "Exploratory site sections", "مقاطع اکتشافی سایت", "Analytical south–north and west–east TIN sections; valid only within the parcel and without surveyed breaklines.", "مقاطع تحلیلی جنوب–شمال و غرب–شرق TIN؛ فقط در محدوده قطعه و بدون شکست‌خط برداشت‌شده معتبرند.", "PNG", "neutral", "phase-2", "preliminary-inference", "assets/diagrams/site-sections.png", "image"],
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
    // Key retained for schema compatibility; meaning is preliminary concept studies.
    archive_included: true,
    active_library: false,
    hidden_by_default: false,
    status: "preliminary-studies-for-architect",
    revived: true,
    note: bi(
      "Three preliminary house-massing studies (A/B/C) are available for architect discussion. They are unselected and are not construction or permit documents.",
      "سه مطالعه حجم خانه (A/B/C) برای گفتگو با معمار در دسترس است. انتخاب‌شده نیستند و سند ساخت یا مجوز نیستند.",
    ),
  },
};

const sources = {
  generated_on: RELEASE_DATE,
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
    {
      dataset: bi("Open-Meteo elevation horizon ring", "حلقه افق ارتفاع Open-Meteo"),
      organisation: bi("Open-Meteo Elevation API", "API ارتفاع Open-Meteo"),
      accessed: "2026-07-30",
      period: bi("single DEM sample batch", "یک دسته نمونه‌برداری DEM"),
      resolution: bi("72 azimuths × 15 radii to 27 km · 90 m DEM", "۷۲ سمت × ۱۵ شعاع تا ۲۷ کیلومتر · DEM ۹۰ متری"),
      status: "regional-data",
      limitation: bi(
        "Regional DEM horizon, not a surveyed field horizon; near-field cells are wider than the parcel.",
        "افق DEM منطقه‌ای است نه افق میدانی برداشت‌شده؛ سلول‌های نزدیک پهن‌تر از قطعه هستند.",
      ),
      href: "assets/data/environmental/raw/openmeteo-elevation-horizon-ring.json",
    },
    {
      dataset: bi("Open-Meteo local hillside elevation grid", "شبکه ارتفاع دامنه محلی Open-Meteo"),
      organisation: bi("Open-Meteo Elevation API", "API ارتفاع Open-Meteo"),
      accessed: "2026-07-30",
      period: bi("single DEM sample batch", "یک دسته نمونه‌برداری DEM"),
      resolution: bi("100 m square · 2.5 m grid after blend", "مربع ۱۰۰ متری · شبکه ۲٫۵ متری پس از ترکیب"),
      status: "regional-data",
      limitation: bi(
        "Near the parcel the surface is the survey plane, not the DEM; beyond 20 m it eases into the DEM.",
        "نزدیک قطعه سطح صفحه برداشت است نه DEM؛ بعد از ۲۰ متر به DEM نرم می‌شود.",
      ),
      href: "assets/data/environmental/raw/openmeteo-elevation-local-grid.json",
    },
    {
      dataset: bi("CMIP6 / HighResMIP monthly files (four retained)", "فایل‌های ماهانه CMIP6 / HighResMIP (چهار مورد نگه داشته‌شده)"),
      organisation: bi("EC-Earth3P-HR and MPI-ESM1-2-XR", "EC-Earth3P-HR و MPI-ESM1-2-XR"),
      accessed: "2026-07-30",
      period: bi("2001–2020 baseline · 2031–2050 future", "خط پایه ۲۰۰۱–۲۰۲۰ · آینده ۲۰۳۱–۲۰۵۰"),
      resolution: bi("gridded model cell, not parcel climate", "سلول مدل شبکه‌ای، نه اقلیم قطعه"),
      status: "regional-data",
      limitation: bi(
        "Future range only; not a design weather file and not downscaled to the parcel.",
        "فقط بازه آینده؛ فایل هوای طراحی نیست و به قطعه ریزمقیاس نشده است.",
      ),
      href: "assets/data/environmental/raw/",
    },
    {
      dataset: bi("OpenStreetMap Nominatim reverse geocoder", "ژئوکد معکوس Nominatim اوپن‌استریت‌مپ"),
      organisation: bi("OpenStreetMap / Nominatim", "اوپن‌استریت‌مپ / Nominatim"),
      accessed: "2026-07-29",
      period: bi("single reverse lookup", "یک جستجوی معکوس"),
      resolution: bi("place label for probable centre", "برچسب مکان برای مرکز محتمل"),
      status: "regional-data",
      limitation: bi(
        "Supports the probable location story; not surveyor CRS certification.",
        "داستان موقعیت محتمل را پشتیبانی می‌کند؛ تأیید CRS نقشه‌بردار نیست.",
      ),
      href: "assets/data/environmental/raw/osm-nominatim-reverse.json",
    },
    {
      dataset: bi("Wikipedia species lead images and licences", "تصاویر شاخص گونه و مجوزها در ویکی‌پدیا"),
      organisation: bi("Wikimedia Commons via Wikipedia pageimages", "ویکی‌مدیا کامنز از طریق pageimages"),
      accessed: "2026-08-04",
      period: bi("bundled offline photographs", "عکس‌های آفلاین همراه"),
      resolution: bi("article lead image per taxon when licence allows", "تصویر شاخص مقاله برای هر تاکسون در صورت مجاز بودن مجوز"),
      status: "verified-integrity",
      limitation: bi(
        "Two taxa ship without photographs because the lead image failed the licence allowlist.",
        "دو تاکسون بدون عکس منتشر شده‌اند چون تصویر شاخص از فهرست مجوز عبور نکرد.",
      ),
      href: "assets/data/environmental/raw/wikipedia-species-images.json",
    },
    {
      dataset: bi("Client-reported lower road", "راه پایین گزارش‌شده توسط کارفرما"),
      organisation: bi("Client report (not surveyed)", "گزارش کارفرما (برداشت‌نشده)"),
      accessed: "2026-07-29",
      period: bi("project brief conversation", "گفت‌وگوی شرح پروژه"),
      resolution: bi("presence and approximate alignment only", "فقط وجود و راستا تقریبی"),
      status: "unresolved",
      limitation: bi(
        "The survey records one road boundary (Pt2–Pt1). The lower road is client-reported and not a measured geometry.",
        "برداشت فقط یک مرز راه (Pt2–Pt1) دارد. راه پایین گزارش کارفرما است و هندسه اندازه‌گیری‌شده نیست.",
      ),
    },
    {
      dataset: bi("Concept massing studies A / B / C", "مطالعات حجم مفهومی A / B / C"),
      organisation: bi("Design-001 FreeCAD preliminary options", "گزینه‌های مقدماتی FreeCAD design-001"),
      accessed: "2026-07-29",
      period: bi("preliminary massing studies", "مطالعات حجم مقدماتی"),
      resolution: bi("three options · unselected · available for discussion", "سه گزینه · انتخاب‌نشده · آماده گفتگو"),
      status: "preliminary-inference",
      limitation: bi(
        "Study massing only. No construction selection, no measured road proof, no drainage design.",
        "فقط حجم مطالعاتی. بدون انتخاب ساخت، بدون اثبات راه اندازه‌گیری‌شده، بدون طراحی زهکشی.",
      ),
    },
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
  readinessKicker: "Architectural readiness",
  readinessTitle: "What can move now—and what blocks concept design",
  readinessLead: "A decision gate, not a completion badge. Each state names the evidence that sets its limit.",
  clientBriefKicker: "Client / project brief",
  clientBriefTitle: "Twelve brief fields — all answered",
  clientBriefLead: "Household program, access, climate-first construction briefing, insulation goals and timeline are below. Preferences are not permits, surveys or a stamped structural design.",
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
  labelAssociationTitle: "Elevation-label association uncertainty",
  buildId: "Build",
  privacyBoundary: "Privacy boundary",
  privacyBoundaryLead: "Precise coordinates identify the studied site for analysis. They do not identify an owner and are not evidence of ownership, title, or a cadastral boundary.",
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
  sectionStartElevation: "Start elevation",
  sectionEndElevation: "End elevation",
  sectionFall: "Net fall",
  sectionGrade: "Average grade",
  elevationAxis: "Elevation (m)",
  distanceAxis: "Distance through parcel (m)",
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
  solarDesignLimits: "Continuous values interpolate ten-minute samples. Neighbours, vegetation and a surveyed horizon are not modelled — only a DEM-derived terrain horizon.",
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
  windTitleAnnual: "Annual wind is easterly on the regional grid",
  windTitleWinter: "Winter wind is easterly on the regional grid",
  windTitleSpring: "Spring wind is easterly on the regional grid",
  windTitleSummer: "Summer wind turns westerly on the regional grid",
  windTitleAutumn: "Autumn wind is easterly on the regional grid",
  windLead: "Seasonal roses use 87,672 hourly ERA5-Land records from 2011–2020. Local valley channeling remains a field-check item.",
  seasonalCompare: "Seasonal comparison",
  noWind: "Annual wind distribution",
  prevailing: "Prevailing",
  meanSpeed: "Mean speed",
  calmHours: "Calm hours",
  windSourceNote: "10 m regional grid wind · direction is where wind comes from",
  hazardsKicker: "Risk register",
  hazardsTitle: "Separate what is known from what needs fieldwork",
  hazardsLead: "Seismic design inputs are unavailable and lead this register. Site-scale facts are then separated from regional context, preliminary inference and required fieldwork.",
  hazardFilter: "Filter status",
  all: "All",
  regionalData: "Regional data",
  fieldInvestigation: "Field investigation",
  architectureKicker: "Design intelligence, not a floor plan",
  architectureTitle: "What the evidence means for the next architect",
  architectureLead: "Evidence-backed site responses are separated from room and access questions that must wait for the client brief and local investigation. No floor plan is proposed.",
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
  rejectedArchive: "Preliminary concept studies A / B / C — available for architect discussion",
  rejectedNote: "Available for review with the completed household brief. Not a selected construction design and not a permit document.",
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

  // Preliminary concept studies — revived for architect discussion, still unselected.
  concepts: "Concept studies",
  conceptsKicker: "Preliminary studies · available for discussion",
  conceptsTitle: "Concept massing studies A, B and C",
  conceptsLead: "Three FreeCAD massing options for the same steep parcel. Switch A / B / C to read what each is, how it steps the slope, rooms, strengths, trade-offs and fit with your brief. Metrics and isometrics sit beside the text. None is a final selected design until field investigations close.",
  showConcepts: "Concept studies",
  conceptBriefFit: "Fit with household brief",
  conceptComparisonNote: "Study comparison note",
  conceptIsometricAlt: "Isometric view of concept massing",
  conceptWhatItIs: "What this option is",
  conceptHowItWorks: "How it works on the slope",
  conceptProgram: "Rooms and program",
  conceptStrengths: "Strengths",
  conceptTradeoffs: "Trade-offs",
  conceptLevelsTitle: "Finished levels in this study",
  conceptChecksTitle: "Study checks",
  conceptCompareTitle: "Side-by-side study metrics",
  conceptMetricsNote: "Internal area excludes garage and open courtyard. Footprint is the plan union of plates + garage. Figures are approximate FreeCAD study values.",
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
  provMeasured: "Measured / drawing-derived",
  provMeasuredItems: "TIN parcel, contours, survey points, upper road edge Pt2–Pt1",
  provRegional: "Regional",
  provRegionalItems: "Surrounding hillside beyond the surveyed plane (90 m DEM blend)",
  provClient: "Client-reported",
  provClientItems: "Lower road (not in the survey drawing)",
  provIllustrative: "Illustrative",
  provIllustrativeItems: "Trees and wind motion (not measured vegetation or parcel wind)",
  layerProvenance: "3D layer evidence classes",
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
  architectClimateKicker: "Architect climate brief",
  architectClimateTitle: "Heating, cooling and what monthly grids cannot decide",
  heatingSeason: "Heating season",
  coolingSeason: "Cooling season",
  passiveOpportunities: "Passive opportunities",
  overheatingRisk: "Overheating risk",
  passiveOpportunitiesText: "Keep low winter sun available; shade or protect west and southwest summer façades; test thermal mass and night ventilation in summer. None of this is fixed without the client brief and a field horizon.",
  overheatingRiskText: "Summers are hot and dry. CDD18 is about {cdd18} K·day and flags afternoon overheating and water stress — not a building cooling load.",
  gridLimitations: "Limits of monthly gridded data",
  hdd18Label: "HDD18",
  cdd18Label: "CDD18",
  cdd10Label: "CDD10",
  handoffKicker: "Architect handoff",
  handoffTitle: "What may be used, concept directions, and what must wait",
  handoffLead: "One bilingual brief for the next designer: complete household program, suggested parti, and open field gates. Numbers stay evidence; missing field work stays open.",
  geoScaleNote: "Context scales crop the same offline OSM extract around the probable centre. Features beyond the extract cannot appear.",
  ariaGeoScale: "Map context scale",
  colOwner: "Owner / consultant",
  colPrerequisite: "Prerequisite",
  colStatus: "Status",
  colDeliverable: "Expected deliverable",
  colDependency: "Dependency",
  colScopeNote: "Scope note",
  earlyFeasibility: "Early feasibility",
  tocTitle: "On this page",
  tocLabel: "Section table of contents",
  plantingPrereqTitle: "Planting prerequisites",
  plantingAnnexTitle: "Full species explorer — landscape annex",
  plantingAnnexLead: "Main page keeps a short robust shortlist. Open the annex for the complete register, filters and do-not-plant list.",
  fieldEvidenceTitle: "Field evidence still required",
  fieldEvidenceLead: "Empty slots until measured. Regional data does not fill them.",
  claimMatrixTitle: "Claim-to-source matrix",
  rawFilesTitle: "Raw environmental files",
  rawFilesInternal: "Internal evidence only",
  rawFilesDownloadable: "Downloadable from this package",
  unresolvedSlot: "Unresolved",
  showDetails: "Show details",
  hideDetails: "Hide details",
  platformDetails: "Exploratory platform table (details)",
  sourcesDetails: "Full source register (details)",
  seismicDetails: "Regional seismic catalogue (context only)",
  claim: "Claim",
  period: "Period",
  calculation: "Calculation",
  confidence: "Confidence",
  designUse: "Design-use limit",
  futureAnalysisKicker: "Future analysis tracks",
  futureAnalysisTitle: "What becomes possible only after better evidence",
  futureAnalysisLead: "These four tracks stay gated. Nothing here invents hourly comfort, neighbour shadows, a preferred envelope or design loads from the monthly and regional data already on the page.",
  futurePrerequisites: "Prerequisites",
  futureWithheld: "Deliberately withheld now",
  futureWhenAvailable: "When inputs exist",
  futureParameters: "Parameter slots",
  futureStatusBlocked: "Blocked — missing inputs",
  futureResearchNotes: "Regional research notes (not design input)",
  hdd: "Heating degree-days, base",
  cdd: "Cooling degree-days, base",
  coldPercentile: "Coldest 0.4% of daily minima",
  warmPercentile: "Warmest 0.4% of daily maxima",
  gustReturn: "Gust return periods",
  yearReturn: "year",
  facetGeometry: "Facet geometry",
  planArea: "Plan area",
  levelPlatform: "Building on the level",
  platformLevel: "Exploratory level",
  platformCutArea: "Area above level (cut side)",
  platformFillArea: "Area below level (fill side)",
  platformMaxCut: "Exploratory max cut depth",
  platformMaxFill: "Exploratory max fill depth",
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
  heroSummary: "مساحت این سایت ۴۸۷٫۴۲۸۵۶۸ مترمربع است و احتمالاً نزدیک بانه‌ورده قرار دارد. این داشبورد هندسه نقشه را کنار اطلاعات اقلیم، خورشید، باد و مخاطرات منطقه نشان می‌دهد.",
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
  overviewLead: "سه چندضلعی نقشه با هم ترکیب شده‌اند و مساحت کل تغییر نکرده است. Pt8 فقط برای ساخت مدل زمین استفاده می‌شود. مرز ثبتی و وضعیت قانونی هنوز بررسی نشده‌اند.",
  readinessKicker: "آمادگی معماری",
  readinessTitle: "چه کاری اکنون ممکن است و چه چیزی مانع طراحی مفهومی است",
  readinessLead: "این بخش روشن می‌کند چه کاری را می‌توان اکنون شروع کرد و برای چه کاری هنوز اطلاعات کافی نداریم.",
  clientBriefKicker: "شرح کارفرما / پروژه",
  clientBriefTitle: "دوازده فیلد شرح — همه پاسخ داده شده",
  clientBriefLead: "برنامه خانوار، دسترسی، توجیه ساخت اقلیمی، اهداف عایق و زمان‌بندی در زیر است. ترجیحات نه مجوزند، نه برداشت و نه طرح سازه مُهرشده.",
  terrainStory: "روایت زمین",
  terrainStoryText: "لبه کنار راه، یعنی Pt2–Pt1، بالاترین بخش زمین است. زمین از این لبه به سمت Pt5 و Pt6 در شمال‌شرق پایین می‌رود.",
  evidenceState: "وضعیت شواهد",
  evidenceStateText: "هندسه استخراج‌شده از نقشه و محاسبات مدل زمین کنترل شده‌اند. موقعیت جغرافیایی محتمل است، اما نقشه‌بردار هنوز CRS را تأیید نکرده است. اطلاعات محیطی نیز منطقه‌ای است و باید در خود سایت بررسی شود.",
  boundary: "مرز ترسیمی یکپارچه",
  boundaryCaption: "هندسه برداشت‌شده از نقشه · شمال رو به بالا · لبه راه مشخص",
  toggleContours: "خطوط تراز",
  toggleLabels: "برچسب نقاط",
  sevenOuter: "۷ نقطه بیرونی",
  oneInterior: "Pt8 نقطه داخلی زمین",
  surveyKicker: "هندسه منبع",
  surveyTitle: "از سه چندضلعی نقشه‌برداری تا یک هندسه ترسیمی تأییدشده",
  surveyLead: "همه مراحل استخراج هندسه قابل پیگیری است: چندضلعی‌های اولیه، نقاط، طول ضلع‌ها، کنترل مساحت و هش فایل‌ها نگهداری شده‌اند. این کنترل فقط درباره نقشه است و مالکیت یا مرز ثبتی را ثابت نمی‌کند.",
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
  labelAssociationTitle: "عدم‌قطعیت ارتباط برچسب تراز",
  buildId: "شناسه ساخت",
  privacyBoundary: "مرز حریم خصوصی",
  privacyBoundaryLead: "مختصات دقیق فقط سایت بررسی‌شده را برای تحلیل مشخص می‌کند. مالک را معرفی نمی‌کند و سند مالکیت، عنوان یا مرز ثبتی نیست.",
  methodologyLabel: "روش نقشه‌برداری",
  sourceIntegrity: "صحت منبع",
  hashManifest: "باز کردن فهرست SHA-256",
  legalScopeTitle: "راستی‌آزمایی نقشه، راستی‌آزمایی قانونی نیست",
  terrainKicker: "مدل زمین هشت‌نقطه‌ای",
  terrainTitle: "۱۱٫۷۵۴ متر اختلاف تراز در ملکی فشرده",
  terrainLead: "از هشت تراز نقطه‌ای، یک مدل اولیه TIN، خطوط تراز یک‌متری و دو مقطع ساخته شده است. این مدل برای محاسبه عملیات خاکی یا قیمت‌گذاری کافی نیست.",
  terrain3dKicker: "زمین برداشت‌شده · سه‌بعدی تعاملی",
  terrain3dTitle: "افت تراز ۱۱٫۷۵۴ متری را در سه بُعد ببینید",
  terrain3dLead: "این نمای سه‌بعدی فقط از هشت تراز و هفت وجه TIN ساخته شده است. نما را بچرخانید و جای راه، مرز و خطوط تراز را با هم مقایسه کنید.",
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
  terrain3dHint: "با کشیدن، نما را بچرخانید. با اسکرول یا نیشگون، بزرگ‌نمایی کنید. کلیدهای جهت نیز کار می‌کنند.",
  terrain3dEvidence: "۸ نقطه اندازه‌گیری‌شده و ۷ وجه TIN. دامنه بیرون قطعه ترکیبی از شیب ۳۸٫۲۷ درصدی برداشت و مدل ارتفاعی ۹۰ متری است. درختان فقط نمایشی‌اند و راه پایین فقط بر اساس گفته کارفرما نشان داده شده است.",
  webglUnavailable: "این مرورگر نمی‌تواند نمای سه‌بعدی را نشان دهد. از پلان دوبعدی پایین صفحه استفاده کنید.",
  profile: "پروفیل تعاملی ارتفاع",
  longitudinal: "جنوب–شمال",
  transverse: "غرب–شرق",
  hoverProfile: "برای دیدن فاصله و ارتفاع روی نمودار حرکت کنید.",
  sectionStartElevation: "ارتفاع آغاز",
  sectionEndElevation: "ارتفاع پایان",
  sectionFall: "افت خالص",
  sectionGrade: "شیب میانگین",
  elevationAxis: "ارتفاع (متر)",
  distanceAxis: "فاصله درون قطعه (متر)",
  slopeFacets: "شیب سطوح TIN",
  slopeRisks: "خطرات خاک‌برداری، خاک‌ریزی و زهکشی",
  modelLimits: "آنچه مدل نمی‌بیند",
  diagrams: "نمودارهای فنی",
  geographyKicker: "موقعیت محتمل پروژه",
  geographyTitle: "موقعیت محتمل نزدیک بانه‌ورده، بر دامنه پرشیب زاگرس",
  geographyLead: "اگر مختصات نقشه را WGS 84 / UTM زون ۳۸ شمالی در نظر بگیریم، سایت نزدیک بانه‌ورده در شهرستان پاوه قرار می‌گیرد. این نتیجه برای بررسی اطلاعات منطقه‌ای قابل استفاده است، اما برای کار ثبتی کافی نیست؛ نقشه‌بردار باید CRS را تأیید کند.",
  scaleStudies: "مقیاس‌های مطالعه زمینه",
  contextMap: "نقشه زمینه آفلاین",
  locationLabel: "موقعیت محتمل پروژه",
  coordinateSystem: "مرجع مختصات محتمل",
  crsCertification: "CRS محتمل · تأییدنشده توسط نقشه‌بردار",
  missing: "شواهد مفقود",
  nextGate: "مرز اعتبار",
  climateKicker: "شواهد محیطی",
  climateTitle: "زمستان سرد و پربارش؛ تابستان گرم و خشک",
  climateLead: "دما، بارش، برف و یخبندان از ERA5-Land برای سال‌های ۱۹۹۱ تا ۲۰۲۰ گرفته شده است. رطوبت، ابر و تابش از NASA POWER آمده است. همه این اعداد منطقه‌ای هستند و اندازه‌گیری مستقیم داخل ملک نیستند.",
  requestedMetrics: "پوشش شواهد اقلیمی",
  monthlyClimate: "اقلیم ماهانه",
  temperatureAndRain: "دما و بارش",
  snowFrostSolar: "برف، یخبندان و منبع خورشیدی",
  climateExtremes: "حدهای خط پایه",
  futureClimate: "دامنه مدل ۲۰۳۱–۲۰۵۰",
  annualMean: "میانگین سالانه",
  solarKicker: "درستی خورشیدی",
  solarTitle: "تابستان با خورشید بلند؛ زمستان با فرصت تابش کم‌ارتفاع",
  solarLead: "مسیر خورشید برای مختصات محتمل ملک از قبل محاسبه شده است. افق زمین از مدل ارتفاعی ۹۰ متری به دست آمده است. ساختمان‌ها و درختان اطراف در این مدل وجود ندارند.",
  season: "فصل",
  timeOfDay: "زمان روز",
  play: "پخش",
  pause: "توقف",
  solarInterpolated: "مقدارهای پیوسته بین نمونه‌های ۱۰ دقیقه‌ای درون‌یابی شده‌اند · بیشترین خطای آزمون",
  solarDesignLimits: "مقدارهای پیوسته بین نمونه‌های ۱۰ دقیقه‌ای درون‌یابی می‌شوند. همسایه‌ها، پوشش گیاهی و افق برداشت‌شده مدل نشده‌اند — فقط افق زمین برگرفته از مدل رقومی ارتفاع.",
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
  lockedText: "با تغییر فصل، ساعت یا جسم آزمایشی، صفحه یکی از نتیجه‌های از پیش محاسبه‌شده را نشان می‌دهد. این ابزار محاسبه لحظه‌ای انجام نمی‌دهد. ساختمان همسایه و درختان نیز در مدل نیستند.",
  solarOutputs: "خوانش فعلی خورشید",
  solarOutputItems: "ارتفاع · آزیموت · جهت سایه · طول سایه · زمینه طلوع / غروب",
  localTime: "زمان محلی",
  solarAltitude: "ارتفاع خورشید",
  solarAzimuth: "آزیموت خورشید",
  shadowLength: "طول سایه",
  sunriseSunset: "طلوع / غروب",
  horizonWarning: "افق زمین از مدل رقومی ارتفاع · بدون ساختمان و پوشش گیاهی",
  windKicker: "شواهد جهتی",
  windTitle: "باد غالب منطقه‌ای در فصل‌ها تغییر می‌کند",
  windTitleAnnual: "باد سالانه روی شبکه منطقه‌ای شرقی است",
  windTitleWinter: "باد زمستان روی شبکه منطقه‌ای شرقی است",
  windTitleSpring: "باد بهار روی شبکه منطقه‌ای شرقی است",
  windTitleSummer: "باد تابستان روی شبکه منطقه‌ای غربی می‌شود",
  windTitleAutumn: "باد پاییز روی شبکه منطقه‌ای شرقی است",
  windLead: "گل‌بادها از ۸۷٬۶۷۲ رکورد ساعتی ERA5-Land بین ۲۰۱۱ تا ۲۰۲۰ ساخته شده‌اند. این داده منطقه‌ای است. باد داخل ملک ممکن است فرق کند. جهت و سرعت نهایی را باید در محل اندازه گرفت.",
  seasonalCompare: "مقایسه فصلی",
  noWind: "توزیع سالانه باد",
  prevailing: "جهت غالب",
  meanSpeed: "سرعت میانگین",
  calmHours: "ساعات آرام",
  windSourceNote: "باد شبکه‌ای منطقه‌ای در ارتفاع ۱۰ متر · جهت، مبدأ وزش باد است",
  hazardsKicker: "ثبت ریسک",
  hazardsTitle: "دانسته‌ها را از نیازهای بررسی میدانی جدا کنید",
  hazardsLead: "اطلاعات لازم برای طراحی لرزه‌ای هنوز فراهم نشده است. در ادامه، برچسب هر خطر روشن می‌کند که این نتیجه از نقشه، داده منطقه‌ای، استنباط اولیه یا بررسی میدانی آمده است.",
  hazardFilter: "فیلتر وضعیت",
  all: "همه",
  regionalData: "داده منطقه‌ای",
  fieldInvestigation: "بررسی میدانی",
  architectureKicker: "شناخت طراحی، نه پلان نهایی",
  architectureTitle: "معنای شواهد برای معمار بعدی",
  architectureLead: "این بخش نشان می‌دهد معمار چه موضوع‌هایی را می‌تواند بررسی کند و کدام تصمیم‌ها هنوز زود هستند. جای اتاق‌ها، ورودی خودرو و پلان خانه هنوز تعیین نشده است.",
  confidence: "اطمینان",
  documentsKicker: "کتابخانه پروژه",
  documentsTitle: "شواهد مفید، منظم و محلی",
  documentsLead: "همه فایل‌های این بخش در همین بسته هستند و بدون اینترنت باز می‌شوند. تصویرهای اصلی و داده‌های قابل پردازش هم در دسترس‌اند.",
  docSearch: "جستجوی اسناد…",
  docLanguage: "زبان",
  docType: "نوع فایل",
  english: "انگلیسی",
  persian: "فارسی",
  neutral: "بی‌نیاز از زبان",
  rejectedArchive: "مطالعات مفهومی مقدماتی A / B / C — آماده گفتگو با معمار",
  rejectedNote: "با شرح کامل خانوار برای مرور در دسترس است. طرح ساخت انتخاب‌شده و سند مجوز نیست.",
  methodsKicker: "رد ممیزی",
  methodsTitle: "منابع، محدودیت‌ها و بازتولیدپذیری",
  methodsLead: "اینجا می‌بینید هر عدد از کجا آمده، چگونه محاسبه شده و چه محدودیتی دارد. برای خواندن این اطلاعات به اینترنت نیاز نیست.",
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

  concepts: "مطالعات مفهومی",
  conceptsKicker: "مطالعات مقدماتی · آماده گفتگو",
  conceptsTitle: "مطالعات حجم مفهومی A، B و C",
  conceptsLead: "سه گزینه حجم FreeCAD برای همان قطعه پرشیب. با دکمه‌های A / B / C بخوانید هر کدام چیست، چگونه روی شیب می‌نشیند، فضاها، نقاط قوت، بده‌بستان‌ها و همخوانی با شرح. شاخص‌ها و ایزومتریک کنار متن‌اند. هیچ‌کدام طرح نهایی نیست تا بررسی‌های میدانی بسته شوند.",
  conceptBriefFit: "همخوانی با شرح خانوار",
  conceptComparisonNote: "یادداشت مقایسه مطالعه",
  conceptIsometricAlt: "نمای ایزومتریک حجم مفهومی",
  conceptWhatItIs: "این گزینه چیست",
  conceptHowItWorks: "چگونه روی شیب کار می‌کند",
  conceptProgram: "اتاق‌ها و برنامه",
  conceptStrengths: "نقاط قوت",
  conceptTradeoffs: "بده‌بستان‌ها",
  conceptLevelsTitle: "ترازهای تمام‌شده در این مطالعه",
  conceptChecksTitle: "کنترل‌های مطالعه",
  conceptCompareTitle: "شاخص‌های مقایسه‌ای مطالعه",
  conceptMetricsNote: "مساحت داخلی گاراژ و حیاط باز را ندارد. سطح اشغال اجتماع پلان صفحات + گاراژ است. ارقام تقریبی مطالعه FreeCAD‌اند.",
  showConcepts: "مطالعات مفهومی",
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
  provMeasured: "اندازه‌گیری‌شده / برگرفته از نقشه",
  provMeasuredItems: "قطعه TIN، خطوط تراز، نقاط برداشت، لبه راه بالایی Pt2–Pt1",
  provRegional: "منطقه‌ای",
  provRegionalItems: "دامنه پیرامون فراتر از صفحه برداشت‌شده (ترکیب مدل ارتفاعی ۹۰ متری)",
  provClient: "گزارش کارفرما",
  provClientItems: "راه پایین (در نقشه برداشت نیست)",
  provIllustrative: "نمایشی",
  provIllustrativeItems: "درختان و حرکت باد (پوشش گیاهی یا باد ملک اندازه‌گیری نشده)",
  layerProvenance: "طبقه‌بندی شواهد لایه‌های سه‌بعدی",
  effectiveSun: "خورشید مؤثر در این روز",
  firstSun: "نخستین تابش مستقیم",
  lastSun: "آخرین تابش مستقیم",
  solarAccess: "دسترسی خورشیدی",
  terrainShaded: "سایه زمین",

  investigations: "بررسی‌های لازم",
  investigationsKicker: "آنچه این داشبورد نمی‌تواند محاسبه کند",
  investigationsTitle: "نوزده کار که هنوز باید کسی انجام دهد",
  gate: "مرحله",
  colInvestigation: "بررسی",
  colProcureVia: "تأمین از طریق",
  colBlocks: "مانع چیست",
  colProxy: "فعلاً چه چیزی جای آن است",
  ariaGateFilter: "مرحله بررسی",
  ariaSpeciesFilter: "صافی حکم گونه",

  degreeDays: "درجه-روز و دماهای صدکی",
  architectClimateKicker: "خلاصه اقلیم برای معمار",
  architectClimateTitle: "گرمایش، سرمایش و آنچه شبکه ماهانه نمی‌تواند تصمیم بگیرد",
  heatingSeason: "فصل گرمایش",
  coolingSeason: "فصل سرمایش",
  passiveOpportunities: "فرصت‌های غیرفعال",
  overheatingRisk: "خطر بیش‌گرمایش",
  passiveOpportunitiesText: "خورشید کم‌ارتفاع زمستان را باز نگه دارید. نمای غرب و جنوب‌غرب تابستان را ببندید یا سایه‌دار کنید. جرم حرارتی و تهویه شب تابستان را بیازمایید. بدون شرح پروژه و افق میدانی هیچ‌کدام قطعی نیست.",
  overheatingRiskText: "تابستان گرم و خشک است. CDD18 حدود {cdd18} K·day است و بیش‌گرمایش بعدازظهر و تنش آبی را نشان می‌دهد؛ بار سرمایش ساختمان نیست.",
  gridLimitations: "محدودیت داده شبکه‌ای ماهانه",
  hdd18Label: "HDD18",
  cdd18Label: "CDD18",
  cdd10Label: "CDD10",
  handoffKicker: "تحویل به معمار",
  handoffTitle: "چه چیزی قابل استفاده است، جهت مفهومی، و چه چیزی باید بماند",
  handoffLead: "یک خلاصه دوزبانه برای طراح بعدی: برنامه کامل خانوار، پیشنهاد حجم، و دروازه‌های میدانی باز. عددها شواهد می‌مانند؛ کار میدانی ناتمام باز می‌ماند.",
  geoScaleNote: "مقیاس‌های زمینه همان عصاره آفلاین OSM را حول مرکز محتمل برش می‌زنند. عوارض بیرون از عصاره دیده نمی‌شوند.",
  ariaGeoScale: "مقیاس زمینه نقشه",
  colOwner: "مسئول / مشاور",
  colPrerequisite: "پیش‌نیاز",
  colStatus: "وضعیت",
  colDeliverable: "تحویل مورد انتظار",
  colDependency: "وابستگی",
  colScopeNote: "یادداشت دامنه",
  earlyFeasibility: "امکان‌سنجی اولیه",
  tocTitle: "در این صفحه",
  tocLabel: "فهرست بخش‌ها",
  plantingPrereqTitle: "پیش‌نیازهای کاشت",
  plantingAnnexTitle: "کاشف کامل گونه‌ها — پیوست منظر",
  plantingAnnexLead: "صفحه اصلی فقط فهرست کوتاه مقاوم را نگه می‌دارد. برای فهرست کامل، صافی‌ها و فهرست نکاشت، پیوست را باز کنید.",
  fieldEvidenceTitle: "شواهد میدانی هنوز لازم است",
  fieldEvidenceLead: "جایگاه‌ها تا اندازه‌گیری خالی‌اند. داده منطقه‌ای آن‌ها را پر نمی‌کند.",
  claimMatrixTitle: "ماتریس ادعا–منبع",
  rawFilesTitle: "فایل‌های خام محیطی",
  rawFilesInternal: "فقط شواهد داخلی",
  rawFilesDownloadable: "قابل دانلود از این بسته",
  unresolvedSlot: "حل‌نشده",
  showDetails: "نمایش جزئیات",
  hideDetails: "پنهان کردن جزئیات",
  platformDetails: "جدول اکتشافی سکو (جزئیات)",
  sourcesDetails: "فهرست کامل منابع (جزئیات)",
  seismicDetails: "فهرست منطقه‌ای زلزله (فقط زمینه)",
  claim: "ادعا",
  period: "دوره",
  calculation: "محاسبه",
  confidence: "اطمینان",
  designUse: "حد استفاده طراحی",
  futureAnalysisKicker: "مسیرهای تحلیل آینده",
  futureAnalysisTitle: "چه چیزی فقط با شواهد بهتر ممکن می‌شود",
  futureAnalysisLead: "این چهار مسیر قفل‌اند. اینجا از داده ماهانه و منطقه‌ای موجود، آسایش ساعتی، سایه همسایه، پوسته ترجیحی یا بار طراحی ساخته نمی‌شود.",
  futurePrerequisites: "پیش‌نیازها",
  futureWithheld: "عمداً فعلاً نگه داشته شده",
  futureWhenAvailable: "وقتی ورودی‌ها موجود شوند",
  futureParameters: "جایگاه پارامترها",
  futureStatusBlocked: "مسدود — ورودی ناقص",
  futureResearchNotes: "یادداشت پژوهش منطقه‌ای (نه ورودی طراحی)",
  hdd: "درجه-روز گرمایش، مبنا",
  cdd: "درجه-روز سرمایش، مبنا",
  coldPercentile: "سردترین ۰٫۴٪ کمینه‌های روزانه",
  warmPercentile: "گرم‌ترین ۰٫۴٪ بیشینه‌های روزانه",
  gustReturn: "دوره بازگشت تندباد",
  yearReturn: "ساله",
  facetGeometry: "هندسه وجه‌ها",
  planArea: "مساحت تصویر افقی",
  levelPlatform: "ساخت روی سکوی تراز",
  platformLevel: "تراز اکتشافی",
  platformCutArea: "مساحت بالاتر از تراز (سمت برداشت)",
  platformFillArea: "مساحت پایین‌تر از تراز (سمت خاک‌ریزی)",
  platformMaxCut: "بیشترین عمق اکتشافی برداشت",
  platformMaxFill: "بیشترین عمق اکتشافی خاک‌ریزی",
  platformWithin: "در محدودهٔ ±۱٫۵ متر",
  surfaceExcess: "مازاد سطح بر تصویر افقی",
  balanceLevel: "تراز با عمق برابر",
  bestPlatform: "بیشترین سطح در ±۱٫۵ متر",
  bestPlatformLevel: "ترازی که این سطح را می‌دهد",
  surfaceArea: "مساحت سطح سه‌بعدی",
  surfaceRatio: "نسبت سطح به تصویر",
  slopeBand: "سهم قطعه در بازه شیب",
  species: "درختان و کاشت",
  speciesKicker: "کدام گیاهان با این شرایط سازگارند",
  speciesTitle: `بررسی ${faDigits(species.species.length)} گونه درخت برای شرایط این ملک`,
  speciesConstraints: `${faDigits(siteWideConstraints)} قید، و یکی دیگر برای میوه`,
  speciesAppliesToFruit: "فقط درختان میوه",
  speciesRule: "نتیجه هر گونه چگونه تعیین شده است",
  speciesShortlist: "فهرست کوتاه",
  speciesAvoid: "این‌ها را نکارید",
  speciesAvoidLead: "این درختان سریع رشد می‌کنند، اما برای این ملک انتخاب مطمئنی نیستند. دلیل رد هر گونه در کارت خودش نوشته شده است.",
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
  speciesBudKillAbsent: "منبع استفاده‌شده دمای آسیب جوانه این میوه را در زمان گل‌دهی کامل اعلام نکرده است؛ بنابراین عددی نشان نمی‌دهیم.",
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
  // Filled by enrichInvestigations() so every row carries the P1-18 fields.
  owner: null,
  prerequisite: null,
  expected_deliverable: null,
  dependency: null,
  scope_note: null,
});

const familyOwner = {
  legal: bi("Licensed surveyor / land registry", "نقشه‌بردار دارای پروانه / اداره ثبت"),
  codes: bi("Structural engineer with licensed codes", "مهندس سازه با آیین‌نامه‌های دارای مجوز"),
  geotechnical: bi("Geotechnical engineer", "مهندس ژئوتکنیک"),
  environment: bi("Environmental / hazard specialist", "متخصص محیط و مخاطره"),
  utilities: bi("Utility providers and access surveyor", "شرکت‌های تأسیسات و نقشه‌بردار دسترسی"),
};

const enrichInvestigations = (register) => {
  register.items = register.items.map((item) => ({
    ...item,
    owner: familyOwner[item.family] || bi("Appointed consultant", "مشاور منصوب"),
    prerequisite: bi(
      item.gate === "early-feasibility"
        ? "None beyond site access permission"
        : item.gate === "before-concept"
          ? "Early feasibility inputs and the client brief where it affects scope"
          : item.gate === "before-permit"
            ? "Concept-blocking investigations that define the legal and ground envelope"
            : "Permit-stage inputs and a contractor method statement",
      item.gate === "early-feasibility"
        ? "هیچ، جز مجوز ورود به سایت"
        : item.gate === "before-concept"
          ? "ورودی‌های امکان‌سنجی اولیه و شرح پروژه هرجا که بر محدوده اثر می‌گذارد"
          : item.gate === "before-permit"
            ? "بررسی‌های مانع مفهومی که چارچوب قانونی و زمین را تعریف می‌کنند"
            : "ورودی‌های مرحله پروانه و روش‌نامه پیمانکار",
    ),
    expected_deliverable: bi(
      `Signed report or drawing for «${item.title.en}» suitable for design use`,
      `گزارش یا نقشه امضاشده برای «${item.title.fa}» مناسب استفاده طراحی`,
    ),
    dependency: bi(
      item.blocks.en,
      item.blocks.fa,
    ),
    scope_note: bi(
      `Scope: procure via ${item.procure_via.en}. Proxy now: ${item.proxy_available.en}. Do not treat the proxy as the deliverable.`,
      `دامنه: تأمین از ${item.procure_via.fa}. جایگزین فعلی: ${item.proxy_available.fa}. جایگزین را تحویل نهایی ندانید.`,
    ),
  }));
  return register;
};

const investigations = {
  status: "requires-field-investigation",
  intro: bi(
    "Everything below needs a person, an instrument or a licensed document. None of it can be computed from the sources this dashboard carries, and each row says who owns it, what must come first, what to deliver, and how far the stand-in reaches.",
    "هر مورد زیر به فرد، ابزار یا سند دارای مجوز نیاز دارد. هیچ‌کدام از منابع این داشبورد قابل محاسبه نیست. هر ردیف می‌گوید مسئول کیست، پیش‌نیاز چیست، چه تحویلی لازم است و جایگزین فعلی تا کجا معتبر است.",
  ),
  gates: [
    { id: "early-feasibility", label: bi("Early feasibility", "امکان‌سنجی اولیه") },
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
    investigationRow("title-boundary", "legal", "before-concept",
      "Registered title and legal boundary",
      "سند رسمی و مرز قانونی",
      "The land registry and a cadastral surveyor",
      "اداره ثبت و نقشه‌بردار ثبتی",
      "Any ownership, cadastral-boundary, easement or right-of-way-dependent decision",
      "هر تصمیم وابسته به مالکیت، مرز ثبتی، حق ارتفاق یا حق عبور",
      "Household reports title documents exist for project use (not scanned into this offline package). Drawing geometry 487.428568 m² remains a measurement, not a cadastral boundary, easement map or ownership proof",
      "خانوار گزارش می‌دهد اسناد مالکیت برای استفاده پروژه موجود است (در این بسته آفلاین اسکن نشده). هندسه ترسیمی ۴۸۷٫۴۲۸۵۶۸ مترمربع همچنان اندازه‌گیری است، نه مرز ثبتی، نقشه حق ارتفاق یا اثبات مالکیت"),
    investigationRow("zoning", "legal", "before-concept",
      "Municipal zoning, height limit and floor-area ratio",
      "ضوابط شهرداری، حد ارتفاع و سطح اشغال",
      "The local municipality",
      "شهرداری محل",
      "Massing, storey count and every area target",
      "حجم‌پردازی، تعداد طبقه و هر هدف مساحتی",
      "Household states the area is currently undeveloped and treats municipal zoning as low priority. That is a client preference, not a legal waiver — no zoning source is bundled and no massing has been tested against one",
      "خانوار می‌گوید منطقه فعلاً ساخته‌نشده و ضوابط شهرداری را کم‌اهمیت می‌داند. این ترجیح کارفرما است نه معافیت قانونی — هیچ منبع ضوابطی همراه نیست و هیچ حجمی در برابر آن آزموده نشده"),
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
    investigationRow("bearing-capacity", "geotechnical", "before-concept",
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
    investigationRow("slope-stability", "geotechnical", "before-concept",
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
      "Household states nobody has built around the parcel yet; the 5 km OpenStreetMap extract also contains zero building footprints. Still confirm on a site visit before locking openings and privacy — absence today is not a permanent guarantee",
      "خانوار می‌گوید هنوز کسی دور قطعه نساخته؛ استخراج ۵ کیلومتری OpenStreetMap هم ردپای ساختمانی ندارد. پیش از تثبیت بازشو و حریم، در بازدید میدانی تأیید شود — خالی بودن امروز تضمین دائمی نیست"),
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
    investigationRow("utility-connections", "utilities", "early-feasibility",
      "Electricity, water, sewer and gas connection points",
      "نقاط انشعاب برق، آب، فاضلاب و گاز",
      "Each utility provider, in writing",
      "هر شرکت خدماتی، به‌صورت مکتوب",
      "Service routing, meter positions and connection cost",
      "مسیر خدمات، محل کنتور و هزینه انشعاب",
      "Household: electricity, gas pipeline and water exist around the area but have not reached the parcel; connection most probably from the lower road (possibility, not confirmed). Mapped power is only a transmission line 3.56 km away. Written provider enquiry still required — nearby network ≠ connected",
      "خانوار: برق، لوله گاز و آب در منطقه هست اما به قطعه نرسیده؛ انشعاب احتمالاً از راه پایینی (احتمال، نه تأیید). برق نقشه‌شده فقط خط انتقال ۳٫۵۶ کیلومتری است. استعلام کتبی هنوز لازم است — شبکه نزدیک ≠ متصل"),
    investigationRow("road-gradient", "utilities", "early-feasibility",
      "Road gradient and vehicle access at the Pt2–Pt1 edge",
      "شیب راه و دسترسی خودرو در لبه Pt2–Pt1",
      "A site visit with levels taken along the road edge",
      "بازدید میدانی با ترازیابی در امتداد لبه راه",
      "Garage position, driveway gradient and turning geometry",
      "موقعیت پارکینگ، شیب رمپ و هندسه گردش",
      "Household preference: main cars and fire access from upper Pt2–Pt1 (real surveyed frontage, 10.270569 m). Optional lower gate with stairs for a necessary stop. Lower road is rough/seasonal only. Longitudinal grade, crossfall, legal width and gate geometry remain unmeasured",
      "ترجیح خانوار: خودروهای اصلی و آتش از Pt2–Pt1 بالایی (بر واقعی، ۱۰٫۲۷۰۵۶۹ متر). دروازه اختیاری پایین با پله برای توقف ضروری. راه پایینی فقط rough/فصلی. شیب طولی، شیب عرضی، عرض قانونی و هندسه دروازه هنوز اندازه‌گیری نشده"),
    investigationRow("construction-access", "utilities", "early-feasibility",
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
enrichInvestigations(investigations);

const plantingPrerequisites = {
  status: "requires-field-investigation",
  intro: bi(
    "Species shortlists do not replace these five site decisions. No irrigation quantity is published: litres-per-week needs soil, water quality and a chosen list.",
    "فهرست کوتاه گونه جای این پنج تصمیم سایت را نمی‌گیرد. هیچ مقدار آبیاری منتشر نشده: لیتر در هفته به خاک، کیفیت آب و فهرست انتخاب‌شده نیاز دارد.",
  ),
  items: [
    {
      id: "soil-test",
      label: bi("Soil test", "آزمایش خاک"),
      status: "unresolved",
      note: bi("Texture, pH confirmation, salinity and organic matter at planting depth.", "بافت، تأیید pH، شوری و ماده آلی در عمق کاشت."),
    },
    {
      id: "irrigation-source",
      label: bi("Irrigation source, quantity and quality", "منبع، مقدار و کیفیت آبیاری"),
      status: "unresolved",
      note: bi("Summer drought is severe; every fast shade tree is a permanently irrigated tree here.", "خشکی تابستان شدید است؛ هر درخت سایه سریع اینجا درخت آبیاری دائم است."),
    },
    {
      id: "nursery",
      label: bi("Local nursery availability", "دسترسی نهالستان محلی"),
      status: "unresolved",
      note: bi("Confirm stock, rootstock and provenance before naming a cultivar.", "پیش از نام بردن رقم، موجودی، پایه و منشأ را تأیید کنید."),
    },
    {
      id: "retaining-roots",
      label: bi("Retaining-wall and root conflicts", "تعارض دیوار حائل و ریشه"),
      status: "unresolved",
      note: bi("Cut faces and platforms are not designed; root volume cannot be promised.", "وجه برش و سکو طراحی نشده؛ حجم ریشه قابل وعده نیست."),
    },
    {
      id: "microclimate",
      label: bi("Final microclimate", "ریزاقلیم نهایی"),
      status: "unresolved",
      note: bi("Cold-air pooling, wind exposure and neighbour shade need field observation.", "تجمع هوای سرد، باد و سایه همسایه به مشاهده میدانی نیاز دارد."),
    },
  ],
};

const speciesShortlistIds = [
  "elaeagnus-angustifolia",
  "fraxinus-angustifolia",
  "morus-alba",
  "pinus-nigra",
  "styphnolobium-japonicum",
  "cydonia-oblonga",
  "quercus-brantii",
];

const fieldEvidenceSlots = {
  status: "unresolved",
  intro: bi(
    "These slots stay empty until measured field evidence exists. Client-characterisation notes may appear under a slot without filling it — they are not surveys.",
    "این جایگاه‌ها تا وجود شواهد میدانی اندازه‌گیری‌شده خالی می‌مانند. یادداشت توصیف کارفرما ممکن است زیر یک جایگاه بیاید بدون پر کردن آن — آن‌ها برداشت نیستند.",
  ),
  groups: [
    {
      id: "site-observation",
      title: bi("Site observation media", "رسانه مشاهده سایت"),
      slots: [
        { id: "site-photos", label: bi("Site photographs", "عکس‌های سایت"), status: "unresolved" },
        { id: "panorama-360", label: bi("360° panorama", "پانورامای ۳۶۰ درجه"), status: "unresolved" },
        {
          id: "neighbour-heights",
          label: bi("Neighbouring buildings and heights", "ساختمان‌ها و ارتفاع همسایه"),
          status: "unresolved",
          note: bi(
            "Household: currently empty around the parcel — no houses built nearby. Confirm on site; photograph evidence still missing.",
            "خانوار: اطراف قطعه فعلاً خالی است — خانه‌ای نزدیک ساخته نشده. در محل تأیید شود؛ شواهد عکسی هنوز نیست.",
          ),
        },
        {
          id: "privacy-views",
          label: bi("Privacy and view corridors", "حریم و کریدور دید"),
          status: "unresolved",
          note: bi(
            "Empty surroundings today reduce immediate overlooking risk; still record view corridors when the house sits high on the upper road.",
            "خالی بودن اطراف امروز ریسک دید مستقیم را کم می‌کند؛ وقتی خانه بالا روی راه بالایی بنشیند، کریدور دید هنوز ثبت شود.",
          ),
        },
        { id: "existing-trees", label: bi("Existing trees and structures", "درختان و سازه‌های موجود"), status: "unresolved" },
        {
          id: "visible-utilities",
          label: bi("Visible utilities", "تأسیسات قابل‌مشاهده"),
          status: "unresolved",
          note: bi(
            "Household: electricity, gas and water exist in the area but are not yet on the parcel. Photograph poles, pipes and valves on site; written provider enquiry still required.",
            "خانوار: برق، گاز و آب در منطقه هست اما هنوز روی قطعه نیست. تیرها، لوله‌ها و شیرها را در محل عکس بگیرید؛ استعلام کتبی هنوز لازم است.",
          ),
        },
      ],
    },
    {
      id: "road-access",
      title: bi("Road and access", "راه و دسترسی"),
      slots: [
        {
          id: "road-width",
          label: bi("Road width", "عرض راه"),
          status: "unresolved",
          note: bi(
            "Upper Pt2–Pt1 is the main usable frontage for cars and fire access (10.270569 m length measured; 4 m width still illustrative). Lower road is rough/seasonal — possible utility route, not main entry.",
            "Pt2–Pt1 بالایی بر اصلی قابل‌استفاده برای خودرو و آتش است (طول ۱۰٫۲۷۰۵۶۹ متر؛ عرض ۴ متر هنوز نمایشی). راه پایینی rough/فصلی — مسیر محتمل تأسیسات، نه ورود اصلی.",
          ),
        },
        { id: "longitudinal-grade", label: bi("Longitudinal grade", "شیب طولی"), status: "unresolved" },
        { id: "crossfall", label: bi("Crossfall", "شیب عرضی"), status: "unresolved" },
        {
          id: "gate-position",
          label: bi("Gate position", "موقعیت دروازه"),
          status: "unresolved",
          note: bi(
            "Preference: main gate on upper frontage for 2–3 cars. Optional lower gate with stairs for a necessary stop / house link. Neither position is surveyed.",
            "ترجیح: دروازه اصلی روی بر بالایی برای دو–سه خودرو. دروازه اختیاری پایین با پله برای توقف ضروری / اتصال به خانه. هیچ‌کدام برداشت نشده.",
          ),
        },
        {
          id: "swept-path",
          label: bi("Turning swept path", "مسیر جاروب گردش"),
          status: "unresolved",
          note: bi(
            "Size for two or three cars at the upper entry once grade and width are measured.",
            "پس از اندازه‌گیری شیب و عرض، برای دو یا سه خودرو در ورود بالایی اندازه شود.",
          ),
        },
        {
          id: "emergency-access",
          label: bi("Emergency access", "دسترسی اضطراری"),
          status: "unresolved",
          note: bi(
            "Household expects fire-service access from the upper road (more usable). Confirm clearance and approach with local requirements.",
            "خانوار دسترسی آتش را از راه بالایی (قابل‌استفاده‌تر) انتظار دارد. فضای آزاد و مسیر نزدیک‌شدن را با ضوابط محلی تأیید کنید.",
          ),
        },
        { id: "construction-access", label: bi("Construction access", "دسترسی کارگاهی"), status: "unresolved" },
      ],
    },
    {
      id: "hydrology",
      title: bi("Hydrology", "هیدرولوژی"),
      slots: [
        { id: "upstream-catchment", label: bi("Upstream catchment", "حوضه بالادست"), status: "unresolved" },
        { id: "concentrated-flows", label: bi("Concentrated flows", "جریان‌های متمرکز"), status: "unresolved" },
        { id: "legal-outfall", label: bi("Legal outfall", "خروجی قانونی"), status: "unresolved" },
        { id: "drainage-rights", label: bi("Drainage rights", "حقوق زهکشی"), status: "unresolved" },
        { id: "parcel-flood", label: bi("Parcel flood study", "مطالعه سیل قطعه"), status: "unresolved" },
        { id: "erosion-control", label: bi("Erosion-control strategy", "راهبرد کنترل فرسایش"), status: "unresolved" },
      ],
    },
    {
      id: "utilities-logistics",
      title: bi("Utilities and logistics", "تأسیسات و لجستیک"),
      slots: [
        {
          id: "electricity",
          label: bi("Electricity capacity and connection", "ظرفیت و اتصال برق"),
          status: "unresolved",
          note: bi(
            "Household: network exists around the area but not yet to the parcel. Capacity and meter point still need written utility answer.",
            "خانوار: شبکه در منطقه هست اما هنوز به قطعه نرسیده. ظرفیت و محل کنتور هنوز پاسخ کتبی می‌خواهد.",
          ),
        },
        {
          id: "water",
          label: bi("Water capacity and connection", "ظرفیت و اتصال آب"),
          status: "unresolved",
          note: bi(
            "Household: water exists around the area but not yet to the parcel. Written provider enquiry required.",
            "خانوار: آب در منطقه هست اما هنوز به قطعه نرسیده. استعلام کتبی لازم است.",
          ),
        },
        {
          id: "wastewater",
          label: bi("Wastewater", "فاضلاب"),
          status: "unresolved",
          note: bi("Not described by the household — written provider enquiry required (or on-site treatment if no network).", "خانوار توصیف نکرده — استعلام کتبی لازم است (یا تصفیه در محل اگر شبکه نباشد)."),
        },
        {
          id: "communications",
          label: bi("Communications", "ارتباطات"),
          status: "unresolved",
          note: bi("Not described — written provider enquiry required.", "توصیف نشده — استعلام کتبی لازم است."),
        },
        {
          id: "connection-points",
          label: bi("Connection points", "نقاط اتصال"),
          status: "unresolved",
          note: bi(
            "Household possibility: electricity, gas and water most probably approach from the lower road. Unconfirmed — providers must mark the real tie-in points. Gas is named as present in the area but not on the parcel.",
            "احتمال خانوار: برق، گاز و آب احتمالاً از راه پایینی نزدیک می‌شوند. تأییدنشده — شرکت‌ها باید نقطه واقعی اتصال را مشخص کنند. گاز در منطقه گفته شده هست اما روی قطعه نیست.",
          ),
        },
        { id: "staging", label: bi("Construction staging", "جانمایی کارگاهی"), status: "unresolved" },
        { id: "delivery", label: bi("Delivery constraints", "محدودیت‌های تحویل"), status: "unresolved" },
        { id: "cost-impact", label: bi("Probable cost impacts", "اثرهای احتمالی هزینه"), status: "unresolved" },
      ],
    },
  ],
};

/*
  P3 future analysis capabilities. These modules are scaffolded and gated.
  They deliberately publish no hourly comfort chart, no neighbour shadow study,
  no buildable envelope geometry and no design-load numbers until the named
  inputs exist. Completing the product task means the gates and placeholders
  are honest and bilingual — not inventing results from monthly grids.
*/
const futureAnalysis = {
  status: "gated-until-inputs",
  intro: bi(
    "Four later analysis tracks. Each is ready to host results only after its prerequisite evidence exists. Monthly reanalysis, the regional DEM horizon and the eight-point TIN are not substitutes.",
    "چهار مسیر تحلیل بعدی. هر کدام فقط پس از فراهم شدن پیش‌نیازش نتیجه می‌گیرد. بازتحلیل ماهانه، افق DEM منطقه‌ای و TIN هشت‌نقطه‌ای جایگزین آن‌ها نیستند.",
  ),
  modules: [
    {
      id: "hourly-comfort",
      backlog: "P3-01",
      status: "blocked-missing-weather-file",
      title: bi("Hourly comfort analysis", "تحلیل ساعتی آسایش"),
      summary: bi(
        "Psychrometric and hourly comfort studies need a defensible weather file (for example a quality-controlled EPW or local station series). Monthly ERA5-Land summaries on this page must not be converted into an EPW or a comfort verdict.",
        "مطالعه سایکرومتریک و آسایش ساعتی به فایل هوای قابل دفاع (مثلاً EPW کنترل‌کیفیت‌شده یا سری ایستگاه محلی) نیاز دارد. خلاصه ماهانه ERA5-Land این صفحه نباید به EPW یا حکم آسایش تبدیل شود.",
      ),
      prerequisites: [
        bi("Defensible hourly weather file with documented station or generation method", "فایل هوای ساعتی قابل دفاع با روش ایستگاه یا تولید مستند"),
        bi("Site elevation and exposure notes suitable for the weather file", "یادداشت ارتفاع و معرض مناسب همان فایل هوا"),
        bi("Occupancy and comfort criteria agreed with the household", "معیار آسایش و الگوی سکونت مورد توافق خانوار"),
      ],
      withheld: [
        bi("No EPW derived from monthly means", "هیچ EPW از میانگین ماهانه ساخته نشده"),
        bi("No psychrometric chart or hours-of-discomfort total", "هیچ نمودار سایکرومتریک یا جمع ساعات ناراحتی"),
      ],
      when_available: bi(
        "Publish hourly temperature/humidity distributions, adaptive comfort bands and explicit weather-file provenance.",
        "توزیع ساعتی دما/رطوبت، نوار آسایش تطبیقی و منشأ صریح فایل هوا منتشر شود.",
      ),
      research_notes: [
        bi(
          "What public data already shows (not an EPW): ERA5-Land 1991–2020 at ~11 km gives HDD18 ≈ 2585 K·day, CDD18 ≈ 965 K·day, annual snowfall ≈ 156 cm, coldest daily min −23.1 °C, hottest daily max 39.1 °C. These describe climate, not hourly comfort.",
          "آنچه داده عمومی نشان می‌دهد (نه EPW): ERA5-Land ۱۹۹۱–۲۰۲۰ در حدود ۱۱ کیلومتر HDD18 حدود ۲۵۸۵، CDD18 حدود ۹۶۵، برف سالانه حدود ۱۵۶ سانتی‌متر، سردترین کمینه روزانه −۲۳٫۱ °C و گرم‌ترین بیشینه ۳۹٫۱ °C. این‌ها اقلیم‌اند نه آسایش ساعتی.",
        ),
        bi(
          "A defensible weather file must be obtained or generated under engineer supervision; monthly means must not be converted into an EPW on this dashboard.",
          "فایل هوای قابل دفاع باید با نظارت مهندس تهیه یا تولید شود؛ میانگین ماهانه نباید در این داشبورد به EPW تبدیل شود.",
        ),
      ],
    },
    {
      id: "neighbor-field-horizon",
      backlog: "P3-02",
      status: "blocked-missing-field-survey",
      title: bi("Neighbour and field-horizon shadow studies", "مطالعه سایه همسایه و افق میدانی"),
      summary: bi(
        "The solar explorer uses a regional DEM horizon. Neighbour buildings, vegetation and a surveyed horizon are separate studies and stay off until measured.",
        "کاوشگر خورشید از افق DEM منطقه‌ای استفاده می‌کند. ساختمان همسایه، پوشش گیاهی و افق برداشت‌شده مطالعات جدا هستند و تا اندازه‌گیری خاموش می‌مانند.",
      ),
      prerequisites: [
        bi("Field horizon survey from the building platform", "برداشت افق میدانی از سکوی ساختمان"),
        bi("Neighbour heights, setbacks and openings survey", "برداشت ارتفاع، عقب‌نشینی و بازشوهای همسایه"),
        bi("Existing tree crown survey if vegetation is to cast", "برداشت تاج درختان موجود اگر باید سایه بیندازند"),
      ],
      withheld: [
        bi("No neighbour massing in the 3D sun study", "هیچ حجم همسایه در مطالعه خورشید سه‌بعدی"),
        bi("Regional DEM horizon is not relabelled as surveyed", "افق DEM منطقه‌ای به‌عنوان برداشت‌شده برچسب نخورده"),
      ],
      when_available: bi(
        "Separate layers: surveyed horizon ring, neighbour blockers, and the existing DEM horizon kept for comparison only.",
        "لایه‌های جدا: حلقه افق برداشت‌شده، مانع‌های همسایه، و افق DEM موجود فقط برای مقایسه.",
      ),
      research_notes: [
        bi(
          "Already on the page: a regional DEM horizon (72 azimuths, 90 m DEM) and solar access hours. That is not a field horizon and does not include neighbours or trees.",
          "همین حالا در صفحه: افق DEM منطقه‌ای (۷۲ سمت، DEM ۹۰ متری) و ساعات دسترسی خورشید. این افق میدانی نیست و همسایه یا درخت را ندارد.",
        ),
        bi(
          "Zagros oak/pasture wildfire is a documented regional issue around Paveh; fuel and setbacks still need local assessment.",
          "آتش‌سوزی جنگل/مرتع زاگرس در اطراف پاوه مسئله منطقه‌ای مستند است؛ سوخت و عقب‌نشینی هنوز به ارزیابی محلی نیاز دارد.",
        ),
      ],
    },
    {
      id: "buildable-envelope",
      backlog: "P3-03",
      status: "blocked-missing-planning-controls",
      title: bi("Abstract buildable-envelope study", "مطالعه پوسته قابل‌ساخت انتزاعی"),
      summary: bi(
        "An abstract envelope (setbacks, height, plan limits) can be drawn only after municipal planning controls are verified. This is not a floor plan and not a preferred house option.",
        "پوسته انتزاعی (عقب‌نشینی، ارتفاع، حد پلان) فقط پس از تأیید ضوابط شهرداری قابل ترسیم است. این پلان نیست و گزینه ترجیحی خانه هم نیست.",
      ),
      prerequisites: [
        bi("Verified zoning, setbacks, FAR/height and parking rules", "ضوابط تأییدشده، عقب‌نشینی، سطح اشغال/ارتفاع و پارکینگ"),
        bi("Legal/cadastral boundary, not only drawing geometry", "مرز قانونی/ثبتی، نه فقط هندسه ترسیمی"),
        bi("Preliminary access and slope feasibility", "امکان‌سنجی اولیه دسترسی و شیب"),
      ],
      withheld: [
        bi("No schematic floor plan or room layout", "هیچ پلان شماتیک یا چیدمان اتاق"),
        bi("No ranked option A/B/C massing as a recommendation", "هیچ رتبه‌بندی حجم A/B/C به‌عنوان توصیه"),
      ],
      when_available: bi(
        "Publish a non-preferential envelope diagram with cited bylaws and explicit non-selection language.",
        "نمودار پوسته غیرترجیحی با استناد به ضوابط و زبان صریح عدم‌انتخاب منتشر شود.",
      ),
      research_notes: [
        bi(
          "Public sources do not publish parcel zoning, FAR, setbacks or height limits for Baneh Verdeh. Only the municipal authority / licensed planner can supply the applicable rules.",
          "منابع عمومی ضوابط قطعه، سطح اشغال، عقب‌نشینی یا ارتفاع برای بانه‌ورده منتشر نمی‌کنند. فقط مرجع شهرداری / شهرساز دارای پروانه قواعد لازم را می‌دهد.",
        ),
        bi(
          "Drawing geometry (487.428568 m², seven outer points) is verified; legal cadastre is not.",
          "هندسه ترسیمی (۴۸۷٫۴۲۸۵۶۸ مترمربع، هفت نقطه بیرونی) تأیید شده؛ کاداستر قانونی نه.",
        ),
      ],
    },
    {
      id: "design-weather-parameters",
      backlog: "P3-04",
      status: "blocked-missing-formal-parameters",
      title: bi("Design weather and engineering parameters", "پارامترهای هوای طراحی و مهندسی"),
      summary: bi(
        "Snow, frost, wind, seismic and thermal design values may appear only when formally obtained, each with provenance and applicability. Regional catalogues and reanalysis means are not design loads.",
        "مقادیر طراحی برف، یخبندان، باد، لرزه و حرارتی فقط وقتی رسماً به‌دست آیند — هر کدام با منشأ و دامنه کاربرد — ظاهر می‌شوند. فهرست منطقه‌ای و میانگین بازتحلیل بار طراحی نیستند.",
      ),
      prerequisites: [
        bi("Standard 2800 parameters and geotechnical site class", "پارامترهای استاندارد ۲۸۰۰ و رده ساختگاه ژئوتکنیک"),
        bi("Code snow, wind, rain and temperature loads from the licensed document", "بار برف، باد، باران و دما از سند دارای مجوز"),
        bi("Local frost depth and frost-susceptible soil assessment", "عمق یخبندان محلی و ارزیابی خاک یخ‌بندان‌پذیر"),
      ],
      parameters: [
        {
          id: "snow-load",
          label: bi("Structural snow load", "بار برف سازه‌ای"),
          value: null,
          unit: null,
          status: "unresolved",
          provenance: bi("Not obtained", "به‌دست نیامده"),
          applicability: bi("Withhold until the licensed code value is supplied", "تا تأمین مقدار آیین‌نامه دارای مجوز نگه داشته شود"),
        },
        {
          id: "frost-depth",
          label: bi("Design frost depth", "عمق یخبندان طراحی"),
          value: null,
          unit: null,
          status: "unresolved",
          provenance: bi("Not obtained", "به‌دست نیامده"),
          applicability: bi("Withhold until local assessment exists", "تا ارزیابی محلی نگه داشته شود"),
        },
        {
          id: "design-wind",
          label: bi("Design wind / basic wind speed", "باد طراحی / سرعت مبنای باد"),
          value: null,
          unit: null,
          status: "unresolved",
          provenance: bi("Not obtained — regional gust return is not a code load", "به‌دست نیامده — دوره بازگشت تندباد منطقه‌ای بار آیین‌نامه‌ای نیست"),
          applicability: bi("Withhold until the licensed wind load is supplied", "تا تأمین بار باد آیین‌نامه‌ای نگه داشته شود"),
        },
        {
          id: "seismic-spectrum",
          label: bi("Seismic design spectrum / Standard 2800", "طیف طراحی لرزه‌ای / استاندارد ۲۸۰۰"),
          value: null,
          unit: null,
          status: "unresolved",
          provenance: bi("Not obtained — regional event counts are context only", "به‌دست نیامده — شمار رویداد منطقه‌ای فقط زمینه است"),
          applicability: bi("Withhold until spectrum and site class exist", "تا طیف و رده ساختگاه نگه داشته شود"),
        },
        {
          id: "thermal-design-temps",
          label: bi("Thermal design temperatures", "دماهای طراحی حرارتی"),
          value: null,
          unit: null,
          status: "unresolved",
          provenance: bi("Not obtained — climate percentiles are not design temperatures", "به‌دست نیامده — صدک‌های اقلیمی دمای طراحی نیستند"),
          applicability: bi("Withhold until formally specified design temps exist", "تا دماهای طراحی رسماً مشخص شوند نگه داشته شود"),
        },
      ],
      withheld: [
        bi("No base acceleration, zone number or spectrum ordinate invented from USGS counts", "هیچ شتاب مبنا، شماره پهنه یا مقدار طیفی از شمار USGS ساخته نشده"),
        bi("No design snow from measured depth without density and code conversion", "هیچ برف طراحی از عمق اندازه‌گیری بدون چگالی و تبدیل آیین‌نامه‌ای"),
      ],
      when_available: bi(
        "Each parameter ships value, unit, source document, access date, applicability clause and a design-use limit.",
        "هر پارامتر با مقدار، واحد، سند منبع، تاریخ دسترسی، بند کاربرد و حد استفاده طراحی منتشر شود.",
      ),
      research_notes: [
        bi(
          "Standard 2800 (Iran seismic code) maps the country into four relative hazard zones with design base acceleration ratios A = 0.35g (very high), 0.30g (high), 0.25g (intermediate) and 0.20g (low). Western Zagros / Kermanshah is among the more active parts of the country; the bundled USGS catalogue shows a M7.3 event about 37 km from the probable parcel (2017). The official city/town table in the current 2800 edition must still be read by a structural engineer for Paveh / the parcel — this note is regional context, not A for design.",
          "استاندارد ۲۸۰۰ کشور را به چهار پهنه با شتاب مبنای طراحی ۰٫۳۵g (خیلی زیاد)، ۰٫۳۰g (زیاد)، ۰٫۲۵g (متوسط) و ۰٫۲۰g (کم) تقسیم می‌کند. زاگرس غربی / کرمانشاه از پهنه‌های فعال‌تر است؛ فهرست USGS همراه بسته رخداد ۷٫۳ در حدود ۳۷ کیلومتری قطعه محتمل (۲۰۱۷) را نشان می‌دهد. جدول رسمی شهرها در ویرایش جاری ۲۸۰۰ را هنوز مهندس سازه برای پاوه / قطعه باید بخواند — این یادداشت زمینه منطقه‌ای است نه A طراحی.",
        ),
        bi(
          "National Building Code Topic 6 (loads) defines ground/base snow and wind procedures with a national snow-zone appendix. Public web extracts do not reliably state the official snow-zone cell for Baneh Verdeh; the licensed Topic 6 table + local municipality govern. Climate evidence here (≈156 cm mean annual snow, 117 km/h observed regional daily gust) is climate, not code load.",
          "مبحث ششم مقررات ملی روش بار برف و باد مبنا را با پیوست پهنه‌بندی برف تعریف می‌کند. استخراج‌های عمومی وب پهنه رسمی برف بانه‌ورده را قابل‌اتکا بیان نمی‌کنند؛ جدول دارای مجوز مبحث ۶ + شهرداری حاکم است. شواهد اقلیمی اینجا (حدود ۱۵۶ سانتی‌متر برف سالانه، تندباد روزانه منطقه‌ای ۱۱۷ کیلومتر بر ساعت) اقلیم است نه بار آیین‌نامه‌ای.",
        ),
        bi(
          "Regional geology (Macrostrat): undivided Bangestan Group — mainly Cretaceous limestone and shale. SoilGrids 250 m: alkaline soils (pH ~7.6 context already on page), clayey textures possible. Neither replaces boreholes or frost-depth assessment.",
          "زمین‌شناسی منطقه‌ای (Macrostrat): گروه بنگستان تفکیک‌نشده — عمدتاً سنگ‌آهک و شیل کرتاسه. SoilGrids ۲۵۰ متری: خاک قلیایی (زمینه pH حدود ۷٫۶ در صفحه)، بافت رسی محتمل. هیچ‌کدام جایگزین گمانه یا ارزیابی عمق یخبندان نیست.",
        ),
        bi(
          "Frost: reanalysis frost record is severe (last spring frost into April in many years; minima to −23.1 °C). Design frost depth for foundations is a code/local geotechnical value and is not published as a metre figure here.",
          "یخبندان: رکورد بازتحلیل شدید است (آخرین یخبندان بهاره در بسیاری سال‌ها تا آوریل؛ کمینه تا −۲۳٫۱ °C). عمق یخبندان طراحی پی مقدار آیین‌نامه‌ای/ژئوتکنیک محلی است و اینجا به‌صورت متر منتشر نشده.",
        ),
        bi(
          "Wildfire (open literature, not parcel clearance): Zagros oak/pasture fires are recurring — peer-reviewed work notes Marivan and Paveh among the most affected northern-Zagros areas; multi-decade burned-area products record thousands of fire events across the southern Zagros 2000–2023 with a recent rise. Treat fuel, access and defensible space as a screening issue for this hillside parcel, not a cleared risk.",
          "آتش‌سوزی (ادبیات باز، نه پاک‌سازی قطعه): آتش جنگل/مرتع زاگرس تکراری است — پژوهش‌ها مریوان و پاوه را از مناطق متأثر شمالی‌زاگرس می‌دانند؛ محصولات سطح سوخته هزاران رخداد در زاگرس جنوبی ۲۰۰۰–۲۰۲۳ با افزایش اخیر ثبت کرده‌اند. سوخت، دسترسی و فضای دفاع‌پذیر را مسئله غربالگری این دامنه بدانید نه ریسک پاک‌شده.",
        ),
        bi(
          "Radon (open literature, not parcel measurement): a 2025 cross-sectional study measured seasonal indoor radon in Kermanshah primary schools/kindergartens; other Iranian provincial studies show cold-season indoor peaks and occasional exceedance of WHO 100 Bq/m³ guidance. Parcel screening still needs on-site measurement — provincial school means are not a design input.",
          "رادون (ادبیات باز، نه اندازه‌گیری قطعه): مطالعه مقطعی ۲۰۲۵ رادون فصلی داخل مدارس/مهدهای کرمانشاه را سنجید؛ مطالعات استانی دیگر اوج فصل سرد و گاه عبور از راهنمای WHO ۱۰۰ Bq/m³ را نشان می‌دهند. غربالگری قطعه هنوز اندازه‌گیری در محل می‌خواهد — میانگین مدرسه‌ای استانی ورودی طراحی نیست.",
        ),
      ],
    },
  ],
};

const claimSourceMatrix = {
  intro: bi(
    "Important claims mapped to source, resolution, period, access date, calculation, confidence and design-use limit.",
    "ادعاهای مهم با منبع، تفکیک، دوره، تاریخ دسترسی، محاسبه، اطمینان و حد استفاده طراحی.",
  ),
  rows: [
    {
      claim: bi("Verified plan area 487.428568 m²", "مساحت پلان تأییدشده ۴۸۷٫۴۲۸۵۶۸ مترمربع"),
      source: bi("Survey drawing + shoelace recomputation", "نقشه برداشت + محاسبه بندکفش"),
      resolution: bi("drawing geometry", "هندسه ترسیمی"),
      period: bi("project snapshot v1-three-fields", "نسخه v1-three-fields"),
      accessed: "2026-07-29",
      calculation: bi("Translated-origin shoelace on seven outer points", "بندکفش با مبدأ انتقال‌یافته روی هفت نقطه بیرونی"),
      confidence: bi("verified drawing geometry", "هندسه ترسیمی تأییدشده"),
      design_use: bi("Site strategy only — not legal area or title", "فقط راهبرد سایت — نه مساحت قانونی یا سند"),
    },
    {
      claim: bi("Probable project location near Baneh Verdeh", "موقعیت محتمل پروژه نزدیک بانه‌ورده"),
      source: bi("UTM 38N interpretation + Nominatim", "تفسیر UTM 38N + Nominatim"),
      resolution: bi("parcel centre", "مرکز قطعه"),
      period: bi("2026-07-29 lookup", "جستجوی ۲۰۲۶-۰۷-۲۹"),
      accessed: "2026-07-29",
      calculation: bi("Survey coordinates read as EPSG:32638", "مختصات برداشت به‌صورت EPSG:32638"),
      confidence: bi("strong-probable · not surveyor-certified", "محتمل قوی · تأیید نقشه‌بردار نیست"),
      design_use: bi("Regional context only — not cadastral", "فقط زمینه منطقه‌ای — نه ثبتی"),
    },
    {
      claim: bi("HDD18 ≈ 2585 K·day / CDD18 ≈ 965 K·day", "HDD18 حدود ۲۵۸۵ و CDD18 حدود ۹۶۵ K·day"),
      source: bi("ERA5-Land daily 1991–2020", "ERA5-Land روزانه ۱۹۹۱–۲۰۲۰"),
      resolution: bi("~11 km grid", "شبکه حدود ۱۱ کیلومتر"),
      period: "1991-01-01/2020-12-31",
      accessed: "2026-07-30",
      calculation: bi("Daily mean against base, summed / 30 years", "میانگین روزانه نسبت به مبنا، جمع / ۳۰ سال"),
      confidence: bi("regional climate description", "توصیف اقلیم منطقه‌ای"),
      design_use: bi("Briefing only — not energy demand", "فقط توجیه — نه تقاضای انرژی"),
    },
    {
      claim: bi("Terrain horizon and effective sun hours", "افق زمین و ساعات خورشید مؤثر"),
      source: bi("NOAA solar + Open-Meteo DEM ring", "خورشید NOAA + حلقه DEM Open-Meteo"),
      resolution: bi("10-minute samples · 90 m DEM", "نمونه‌های ۱۰ دقیقه‌ای · DEM ۹۰ متری"),
      period: bi("three season arcs", "سه قوس فصلی"),
      accessed: "2026-07-30",
      calculation: bi("Precomputed positions with linear interpolation bounds", "موقعیت‌های پیش‌محاسبه با حد درون‌یابی خطی"),
      confidence: bi("preliminary — no surveyed horizon or neighbours", "مقدماتی — بدون افق برداشت یا همسایه"),
      design_use: bi("Solar study context — not final aperture design", "زمینه مطالعه خورشید — نه طراحی نهایی بازشو"),
    },
    {
      claim: bi("Seasonal wind roses and summer westerlies", "گل‌باد فصلی و باد غربی تابستان"),
      source: bi("ERA5-Land hourly wind 2011–2020", "باد ساعتی ERA5-Land ۲۰۱۱–۲۰۲۰"),
      resolution: bi("11 km · 10 m height", "۱۱ کیلومتر · ارتفاع ۱۰ متر"),
      period: "2011-01-01/2020-12-31",
      accessed: "2026-07-30",
      calculation: bi("16-direction roses by season", "گل‌باد ۱۶ جهتی بر حسب فصل"),
      confidence: bi("regional grid only", "فقط شبکه منطقه‌ای"),
      design_use: bi("Not parcel wind, dust or cold-air drainage", "نه باد قطعه، نه غبار، نه زهکشی هوای سرد"),
    },
  ],
};

const rawEnvironmentalFiles = {
  policy: bi(
    "Retained raw responses are project evidence. Contact-bearing tags are not shown as downloadable personal data; science dumps stay internal-only where they add no design use beyond the summarised register.",
    "پاسخ‌های خام نگه داشته‌شده شواهد پروژه‌اند. برچسب‌های دارای تماس به‌عنوان داده شخصی قابل دانلود نشان داده نمی‌شوند؛ انبوه علمی هرجا استفاده طراحی فراتر از فهرست خلاصه ندارد، داخلی می‌ماند.",
  ),
  files: [
    { path: "assets/data/environmental/raw/openmeteo-era5land-daily-1991-2020.json", role: "internal-evidence", label: bi("ERA5-Land daily climate raw", "خام اقلیم روزانه ERA5-Land") },
    { path: "assets/data/environmental/raw/openmeteo-era5land-wind-hourly-2011-2020.json", role: "internal-evidence", label: bi("ERA5-Land hourly wind raw", "خام باد ساعتی ERA5-Land") },
    { path: "assets/data/environmental/raw/nasa-power-climatology-2001-2020.json", role: "internal-evidence", label: bi("NASA POWER climatology raw", "خام اقلیم‌نمای NASA POWER") },
    { path: "assets/data/environmental/raw/openmeteo-elevation-horizon-ring.json", role: "downloadable", label: bi("Horizon DEM request manifest", "مانیفست درخواست DEM افق") },
    { path: "assets/data/environmental/raw/openmeteo-elevation-local-grid.json", role: "downloadable", label: bi("Local hillside DEM request manifest", "مانیفست درخواست DEM دامنه") },
    { path: "assets/data/environmental/raw/osm-nominatim-reverse.json", role: "downloadable", label: bi("Reverse geocoder response", "پاسخ ژئوکد معکوس") },
    { path: "assets/data/environmental/raw/openstreetmap-5km.xml", role: "downloadable", label: bi("OSM 5 km extract", "عصاره ۵ کیلومتری OSM") },
    { path: "assets/data/environmental/raw/usgs-earthquakes-m45-200km-1900-2026.json", role: "internal-evidence", label: bi("USGS regional earthquake catalogue", "فهرست منطقه‌ای زلزله USGS") },
    { path: "assets/data/environmental/raw/macrostrat-geology-site.json", role: "internal-evidence", label: bi("Macrostrat geology", "زمین‌شناسی Macrostrat") },
    { path: "assets/data/environmental/raw/isric-soilgrids-site.json", role: "internal-evidence", label: bi("SoilGrids properties", "ویژگی‌های SoilGrids") },
    { path: "assets/data/environmental/raw/wikipedia-species-images.json", role: "downloadable", label: bi("Species image licence manifest", "مانیفست مجوز تصاویر گونه") },
    { path: "assets/data/environmental/raw/cmip6-ec-earth3p-hr-2001-2020.json", role: "internal-evidence", label: bi("CMIP6 EC-Earth3P-HR baseline", "خط پایه CMIP6 EC-Earth3P-HR") },
    { path: "assets/data/environmental/raw/cmip6-ec-earth3p-hr-2031-2050.json", role: "internal-evidence", label: bi("CMIP6 EC-Earth3P-HR future", "آینده CMIP6 EC-Earth3P-HR") },
    { path: "assets/data/environmental/raw/cmip6-mpi-esm1-2-xr-2001-2020.json", role: "internal-evidence", label: bi("CMIP6 MPI-ESM1-2-XR baseline", "خط پایه CMIP6 MPI-ESM1-2-XR") },
    { path: "assets/data/environmental/raw/cmip6-mpi-esm1-2-xr-2031-2050.json", role: "internal-evidence", label: bi("CMIP6 MPI-ESM1-2-XR future", "آینده CMIP6 MPI-ESM1-2-XR") },
  ],
};

const releaseMetadata = {
  generated_on: RELEASE_DATE,
  dashboard_version: DASHBOARD_VERSION,
  build_id: `dashboard-${RELEASE_DATE}`,
  site_version: version.site_version,
  validation: {
    static_suite: "validate-static.mjs",
    solar_suite: "verify-solar-3d.mjs",
    responsive_suite: "verify-responsive.mjs",
    accessibility_suite: "verify-accessibility.mjs",
    privacy_suite: "verify-privacy.mjs",
    link_suite: "verify-links.mjs",
    offline_suite: "verify-offline.mjs",
  },
};

const architectHandoff = {
  status: "pre-design-brief",
  summary: bi(
    "Household brief is complete for concept sketching. Use verified drawing geometry and regional climate for site strategy. Suggested parti below is direction only — fix footprint, finished levels and schematic plan only after blocking field investigations close.",
    "شرح خانوار برای اسکچ مفهومی کامل است. از هندسه ترسیمی تأییدشده و اقلیم منطقه‌ای برای راهبرد سایت استفاده کنید. پیشنهاد حجم زیر فقط جهت است — سطح اشغال، تراز نهایی و پلان شماتیک را فقط پس از بستن بررسی‌های مانع تثبیت کنید.",
  ),
  sections: [
    {
      id: "usable-now",
      label: bi("May be used now", "اکنون قابل استفاده"),
      items: [
        bi("Verified drawing geometry, 487.428568 m² plan area, seven outer points and Pt8", "هندسه ترسیمی تأییدشده، مساحت پلان ۴۸۷٫۴۲۸۵۶۸ مترمربع، هفت نقطه بیرونی و Pt8"),
        bi("Pt2–Pt1 road edge length and drawing +Y north assumption", "طول لبه راه Pt2–Pt1 و فرض شمال ‎+Y نقشه"),
        bi("Eight-point TIN for understanding the northeast fall — not for quantities", "TIN هشت‌نقطه‌ای برای شناخت افت شمال‌شرقی — نه برای مقادیر خاکی"),
        bi("Complete household brief (12 fields) including design-direction refinements", "شرح کامل خانوار (۱۲ فیلد) شامل اصلاحات جهت طراحی"),
        bi("Regional climate, solar, wind and hazard context for briefing only", "زمینه منطقه‌ای اقلیم، خورشید، باد و مخاطره فقط برای توجیه"),
      ],
    },
    {
      id: "concept-directions",
      label: bi("Suggested concept directions for the architect", "پیشنهادهای مفهومی برای معمار"),
      items: [
        bi("Parti: upper road band = 2-car open-ended garage (third car if garden opening allows) + shared carpentry zone when a bay is free + main entry + fire approach; house as two levels that split and step down the slope toward the northeast garden", "پارت: نوار راه بالایی = گاراژ دو خودرو باز (خودروی سوم اگر دهانه باغ اجازه دهد) + پهنه نجاری مشترک وقتی جا خالی است + ورود اصلی + مسیر آتش؛ خانه دو تراز که روی شیب شکسته و به باغ شمال‌شرقی پایین می‌رود"),
        bi("Rooms: master suite + three similar bedrooms; acoustically separated office; semi-open kitchen to living; courtyard; laundry + storage + two bathrooms", "فضاها: سوئیت والدین + سه اتاق مشابه؛ دفتر جدا از نظر صوتی؛ آشپزخانه نیمه‌باز به نشیمن؛ حیاط؛ رختشوی‌خانه + انبار + دو سرویس"),
        bi("Outdoors: keep contiguous nature-play garden on the lower half; later fountain or pool — architect proposes type/size; lower gate + stairs only if slope study allows (not hard phase 1)", "بیرون: باغ بازی طبیعی پیوسته در نیمه پایین؛ بعداً فواره یا استخر — نوع/اندازه پیشنهاد معمار؛ دروازه + پله پایین فقط اگر مطالعه شیب اجازه دهد (نه الزام فاز ۱)"),
        bi("Envelope: simple modern clean lines; RC frame + continuous external insulation briefing; gas heat when available; AC backup only; roof PV-ready (south reserve); strong west/southwest shade", "پوسته: مدرن ساده؛ توجیه قاب بتن + عایق پیوسته بیرونی؛ گرمایش گاز وقتی وصل شد؛ کولر فقط پشتیبان؛ بام آماده PV (ذخیره جنوب)؛ سایه قوی غرب/جنوب‌غرب"),
        bi("Delivery: primary occupation in 1–2 years; unlimited quality budget does not skip geotech, utilities, survey or permits; balance comfort, outdoor play, car access and speed equally", "تحویل: سکونت اصلی در ۱–۲ سال؛ بودجه کیفیت نامحدود ژئوتکنیک/تأسیسات/نقشه/مجوز را حذف نمی‌کند؛ آسایش، بازی بیرون، خودرو و سرعت را برابر سبک کنید"),
        bi("Massing studies A/B/C are in the Concepts section with brief-fit notes and isometrics. Study comparison favours C as a terrain starting point for discussion — not a selection. Expand garage/workshop for two cars + carpentry flex.", "مطالعات حجم A/B/C در بخش مفاهیم با یادداشت همخوانی شرح و ایزومتریک موجودند. مقایسه مطالعه C را نقطه شروع زمین برای گفتگو می‌داند — نه انتخاب. گاراژ/کارگاه را برای دو خودرو + نجاری انعطاف‌پذیر بزرگ‌تر کنید."),
      ],
    },
    {
      id: "provisional",
      label: bi("Provisional only", "فقط مقدماتی"),
      items: [
        bi("Probable WGS 84 / UTM 38N location near Baneh Verdeh", "موقعیت محتمل WGS 84 / UTM 38N نزدیک بانه‌ورده"),
        bi("DEM horizon, surrounding hillside blend and exploratory contours/sections", "افق مدل ارتفاعی، ترکیب دامنه پیرامون و خطوط تراز/مقاطع اکتشافی"),
        bi("Degree-days, frost dates and wind roses from gridded reanalysis", "درجه-روز، تاریخ یخبندان و گل‌باد از بازتحلیل شبکه‌ای"),
        bi("Utilities said to exist in the area (power, gas, water) but not on the parcel — probable approach from lower road, unconfirmed", "تأسیسات گفته‌شده در منطقه (برق، گاز، آب) اما نه روی قطعه — نزدیک‌شدن محتمل از راه پایینی، تأییدنشده"),
      ],
    },
    {
      id: "must-not-use",
      label: bi("Must not be used as design fact", "نباید به‌عنوان واقعیت طراحی استفاده شود"),
      items: [
        bi("Legal ownership, cadastral boundary, easements or rights-of-way", "مالکیت قانونی، مرز ثبتی، حقوق ارتفاقی یا حقوق عبور"),
        bi("Construction earthwork volumes, finished platform levels or retaining design", "حجم عملیات خاکی، تراز نهایی سکو یا طراحی حائل"),
        bi("Standard 2800 spectrum, design snow/wind loads or foundation bearing", "طیف استاندارد ۲۸۰۰، بار برف/باد طراحی یا ظرفیت باربری پی"),
        bi("Preliminary A/B/C massing as a selected or permit-ready house", "حجم مقدماتی A/B/C به‌عنوان خانه انتخاب‌شده یا آماده مجوز"),
        bi("Climate construction briefing as a stamped structural system", "توجیه ساخت اقلیمی به‌عنوان سیستم سازه مُهرشده"),
      ],
    },
    {
      id: "immediate-investigations",
      label: bi("Immediate investigations", "بررسی‌های فوری"),
      items: [
        bi("Surveyor-certified CRS + cadastral boundary / easements (title docs exist for project use — still not a certified boundary)", "CRS تأییدشده نقشه‌بردار + مرز ثبتی / حقوق ارتفاقی (اسناد برای پروژه موجود است — هنوز مرز تأییدشده نیست)"),
        bi("Preliminary geotech and slope-stability assessment", "ارزیابی اولیه ژئوتکنیک و پایداری شیب"),
        bi("Measure upper-road grade, main gate and swept path for two cars (third flexible); study lower-gate only if slope allows", "اندازه‌گیری شیب راه بالایی، دروازه اصلی و مسیر گردش دو خودرو (سوم انعطاف‌پذیر)؛ مطالعه دروازه پایین فقط اگر شیب اجازه دهد"),
        bi("Written utility capacity and connection points (power, gas, water; probable lower-road approach)", "ظرفیت و نقاط انشعاب کتبی (برق، گاز، آب؛ نزدیک‌شدن محتمل از راه پایینی)"),
      ],
    },
    {
      id: "key-geometry",
      label: bi("Key geometry", "هندسه کلیدی"),
      items: [
        bi("Plan area 487.428568 m² · relief 11.754 m · elevations 1647.899–1659.653 m", "مساحت پلان ۴۸۷٫۴۲۸۵۶۸ مترمربع · اختلاف تراز ۱۱٫۷۵۴ متر · ارتفاع ۱۶۴۷٫۸۹۹–۱۶۵۹٫۶۵۳ متر"),
        bi("Outer ring Pt2→Pt1→Pt7→Pt6→Pt5→Pt4→Pt3 · road Pt2–Pt1 10.270569 m", "حلقه بیرونی Pt2→Pt1→Pt7→Pt6→Pt5→Pt4→Pt3 · راه Pt2–Pt1 به طول ۱۰٫۲۷۰۵۶۹ متر"),
        bi("Steepest TIN facets 34.5–44.0% · descent generally northeast", "تندترین وجوه TIN ۳۴٫۵–۴۴٫۰٪ · نزول عموماً شمال‌شرق"),
        bi("Maximum survey-label association offset 3.875 m at Pt3", "بیشینه فاصله ارتباط برچسب ۳٫۸۷۵ متر در Pt3"),
      ],
    },
    {
      id: "environmental-implications",
      label: bi("Environmental implications", "پیامدهای محیطی"),
      items: [
        bi("Long heating season (HDD18 ≈ 2585 K·day) with cold snow-capable winters — insulation and gas heat when connected", "فصل گرمایش طولانی (HDD18 حدود ۲۵۸۵) با زمستان سرد برف‌پذیر — عایق و گرمایش گاز وقتی وصل شد"),
        bi("Hot dry summers (CDD18 ≈ 965 K·day) — shade west/southwest; AC only as backup", "تابستان گرم خشک (CDD18 حدود ۹۶۵) — سایه غرب/جنوب‌غرب؛ کولر فقط پشتیبان"),
        bi("Winter sun is valuable and low; reserve south roof for PV readiness", "خورشید زمستان کم‌ارتفاع و ارزشمند است؛ بام جنوب را برای آمادگی PV نگه دارید"),
        bi("Regional easterlies dominate most seasons; summer wind turns westerly on the grid", "باد شرقی منطقه‌ای در بیشتر فصول غالب است؛ در تابستان روی شبکه غربی می‌شود"),
      ],
    },
  ],
};

const generated = {
  "project.json": project,
  "site.json": site,
  "architectural-readiness.json": architecturalReadiness,
  "client-brief.json": clientBrief,
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
  "architect-handoff.json": architectHandoff,
  "planting-prerequisites.json": plantingPrerequisites,
  "field-evidence-slots.json": fieldEvidenceSlots,
  "future-analysis.json": futureAnalysis,
  "claim-source-matrix.json": claimSourceMatrix,
  "raw-environmental-files.json": rawEnvironmentalFiles,
  "release-metadata.json": releaseMetadata,
  "species-shortlist.json": { ids: speciesShortlistIds },
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
  architecturalReadiness,
  clientBrief,
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
  architectHandoff,
  plantingPrerequisites,
  fieldEvidenceSlots,
  futureAnalysis,
  claimSourceMatrix,
  rawEnvironmentalFiles,
  releaseMetadata,
  speciesShortlist: { ids: speciesShortlistIds },
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
  generated_on: project.generated_on,
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
