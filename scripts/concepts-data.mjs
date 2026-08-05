/**
 * Preliminary house-concept massing, transformed from the design workspace's own
 * (u, v) frame into survey coordinates.
 *
 * Three FreeCAD options (A/B/C) are published as **available preliminary studies**
 * for architect discussion. They stay unselected as a construction decision and
 * are not a substitute for geotech / road / utilities. `selected-design/` is empty.
 *
 * Geometry: `working/concept-data.json` holds axis-aligned boxes in a frame
 * whose origin is Pt2 and whose u axis runs along Pt2→Pt1. The transform is
 * exact arithmetic and is verified against all eight surveyed points.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bi = (en, fa) => ({ en, fa });
const round = (value, digits = 3) => Number(value.toFixed(digits));

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const conceptSourcePath = path.resolve(scriptDir, "../../working/concept-data.json");

const optionLetters = { "option-a": "A", "option-b": "B", "option-c": "C" };

const titles = {
  "option-a": bi("Option A — Compact split-level house", "گزینه A — خانه نیم‌طبقه فشرده"),
  "option-b": bi(
    "Option B — Two-storey house with road-level garage",
    "گزینه B — خانه دوطبقه با پارکینگ هم‌تراز راه",
  ),
  "option-c": bi("Option C — Stepped courtyard house", "گزینه C — خانه حیاط‌دار پله‌ای"),
};

const concepts = {
  "option-a": bi(
    "A compact half-level sequence stepping northeast with the terrain.",
    "توالی فشرده نیم‌طبقه که همراه شیب زمین به‌سوی شمال‌شرق پله می‌خورد.",
  ),
  "option-b": bi(
    "A compact two-storey downhill volume, with the quiet sleeping level over a garden family level.",
    "حجم فشرده دوطبقه در جهت شیب؛ طبقه آرام خواب روی طبقه خانوادگی مرتبط با باغ.",
  ),
  "option-c": bi(
    "Four terrain-following bars distributed down the slope around an open courtyard.",
    "چهار نوار هم‌سو با زمین که در شیب توزیع شده‌اند و حیاط بازی را در میان می‌گیرند.",
  ),
};

/** How each early massing relates to the completed household brief (not a selection). */
const briefAlignment = {
  "option-a": bi(
    "Fits: house steps with the slope; compact for six; largest internal area; quiet/road band for office. Gaps vs brief: several daily half-level stairs; garage/workshop bay (~35 m²) is small for two cars plus open carpentry flex; semi-open kitchen not fixed in this massing. Useful as a compact split-level reference.",
    "سازگار: خانه با شیب پله می‌خورد؛ فشرده برای شش نفر؛ بیشترین مساحت داخلی؛ نوار آرام/راه برای دفتر. فاصله با شرح: چند نیم‌طبقه روزانه؛ گاراژ/کارگاه (~۳۵ m²) برای دو خودرو + نجاری انعطاف‌پذیر تنگ است؛ آشپزخانه نیمه‌باز در این حجم تثبیت نشده. مرجع مفید برای نیم‌طبقه فشرده.",
  ),
  "option-b": bi(
    "Fits: garage at high road level; two clear storeys; smallest footprint leaves more garden for nature play. Gaps vs brief: single deep downhill façade and larger retaining study zone conflict with minimising excavation; less stepped than the preferred split-down-the-slope form. Useful as the most compact superstructure option.",
    "سازگار: گاراژ در تراز بالای راه؛ دو طبقه روشن؛ کوچک‌ترین سطح اشغال فضای بیشتری برای بازی در طبیعت می‌گذارد. فاصله با شرح: نمای عمیق پایین‌دست و منطقه حائل بزرگ‌تر با کمینه‌کردن گودبرداری ناسازگار است؛ کمتر از فرم ترجیحی پله‌ای روی شیب است. گزینه فشرده‌ترین اسکلت فوقانی.",
  ),
  "option-c": bi(
    "Fits best with the household brief: stepped bars track the slope; garage at upper road; courtyard for outdoor life; living–kitchen–courtyard composition; closest to “two levels split following the slope.” Gaps: longer circulation; more roof/drainage junctions; garage bay still modest for two cars + workshop flex; outdoor water feature not modelled. Strongest starting sketch for discussion — still not a selected design.",
    "بهترین همخوانی با شرح خانوار: نوارهای پله‌ای شیب را دنبال می‌کنند؛ گاراژ در راه بالایی؛ حیاط برای زندگی بیرون؛ ترکیب نشیمن–آشپزخانه–حیاط؛ نزدیک‌ترین به «دو تراز شکسته روی شیب». فاصله‌ها: گردش طولانی‌تر؛ اتصالات بام/زهکشی بیشتر؛ گاراژ هنوز برای دو خودرو + کارگاه تنگ؛ عنصر آبی مدل نشده. قوی‌ترین اسکچ آغازین برای گفتگو — هنوز طرح انتخاب‌شده نیست.",
  ),
};

const isometricImages = {
  "option-a": "assets/diagrams/concepts/option-a-isometric.png",
  "option-b": "assets/diagrams/concepts/option-b-isometric.png",
  "option-c": "assets/diagrams/concepts/option-c-isometric.png",
};

/**
 * Full study profiles for the architect UI. Sourced from option-summary.md and
 * concept-comparison.md; bilingual; study-level only (not construction docs).
 */
const optionProfiles = {
  "option-a": {
    what_it_is: bi(
      "A compact split-level family house that climbs down the slope in short half-level steps from the high southern road edge toward the northeast. Garage/workshop stays at the road; living and kitchen sit on a mid family level; four bedrooms and a second bath sit one step lower. About 148 m² internal, 35 m² garage/workshop, 16 m² courtyard, ~231 m² footprint.",
      "خانه خانوادگی فشرده نیم‌طبقه که از لبه بالای راه جنوبی با پله‌های کوتاه به‌سوی شمال‌شرق پایین می‌رود. گاراژ/کارگاه در تراز راه می‌ماند؛ نشیمن و آشپزخانه در تراز میانی خانواده؛ چهار اتاق‌خواب و حمام دوم یک پله پایین‌تر. حدود ۱۴۸ مترمربع داخلی، ۳۵ مترمربع گاراژ/کارگاه، ۱۶ مترمربع حیاط، حدود ۲۳۱ مترمربع سطح اشغال.",
    ),
    how_it_works: bi(
      "Three main finished levels: Road / quiet (~1659.2 m) holds entry, home office and storage next to the road. Family level (~1657.7 m) holds living/dining, kitchen, laundry and bath 1. Bedroom level (~1656.2 m) holds master + three bedrooms and bath 2. Daily life uses several short stair flights instead of one long flight. Courtyard is small and open to the sky with a conceptual NE drainage fall.",
      "سه تراز اصلی: راه / آرام (~۱۶۵۹٫۲ m) ورودی، دفتر خانگی و انبار کنار راه. تراز خانواده (~۱۶۵۷٫۷ m) نشیمن/ناهارخوری، آشپزخانه، رختشوی‌خانه و حمام ۱. تراز خواب (~۱۶۵۶٫۲ m) سوئیت والدین + سه اتاق و حمام ۲. زندگی روزانه چند پرواز کوتاه پله دارد نه یک پرواز بلند. حیاط کوچک و باز به آسمان با شیب مفهومی زهکشی به‌سوی شمال‌شرق.",
    ),
    program: bi(
      "Program covered: entry, office, living/dining, kitchen, laundry, storage, two bathrooms, four bedrooms (master + three), garage/workshop, small courtyard, circulation. Matches a family of six in outline; garage bay is still modest (~one car plus work zone in the original study).",
      "برنامه پوشش‌داده‌شده: ورودی، دفتر، نشیمن/ناهارخوری، آشپزخانه، رختشوی‌خانه، انبار، دو سرویس، چهار اتاق‌خواب (اصلی + سه)، گاراژ/کارگاه، حیاط کوچک، گردش. در کلیات با خانواده شش‌نفره جور است؛ گاراژ در مطالعه اصلی هنوز متوسط است (حدود یک خودرو + فضای کار).",
    ),
    strengths: [
      bi("Largest internal area of the three (~148 m²)", "بیشترین مساحت داخلی میان سه گزینه (~۱۴۸ m²)"),
      bi("Short day-to-day routes between rooms", "مسیرهای کوتاه روزمره بین فضاها"),
      bi("Steps with the terrain rather than one deep cut", "با زمین پله می‌خورد نه یک برش عمیق"),
      bi("Office and entry stay near the road / quiet band", "دفتر و ورودی نزدیک نوار راه / آرام می‌مانند"),
    ],
    tradeoffs: [
      bi("Several half-level stairs every day — hard for step-free living", "چند نیم‌طبقه هر روز — زندگی بدون پله سخت است"),
      bi("Split-level junctions need careful waterproofing and detailing", "اتصالات نیم‌طبقه به آب‌بندی و جزئیات دقیق نیاز دارند"),
      bi("Garage/workshop area needs enlarging for two cars + carpentry flex", "مساحت گاراژ/کارگاه برای دو خودرو + نجاری انعطاف‌پذیر باید بزرگ‌تر شود"),
    ],
  },
  "option-b": {
    what_it_is: bi(
      "A compact two-storey house with the garage and quiet/sleeping rooms at the high road level, and living, kitchen and service rooms on a lower garden level. About 138 m² internal, 36 m² garage/workshop, 17 m² courtyard, ~199 m² footprint — the smallest plan of the three.",
      "خانه فشرده دوطبقه با گاراژ و فضاهای آرام/خواب در تراز بالای راه، و نشیمن، آشپزخانه و خدمات در تراز پایین باغ. حدود ۱۳۸ مترمربع داخلی، ۳۶ مترمربع گاراژ/کارگاه، ۱۷ مترمربع حیاط، حدود ۱۹۹ مترمربع سطح اشغال — کوچک‌ترین پلان میان سه گزینه.",
    ),
    how_it_works: bi(
      "Two clear storeys. Road / bedroom level (~1659.2 m): entry, office, master + three bedrooms, bath 2, circulation. Garden / family level (~1656.1 m): living/dining, kitchen, laundry, storage, bath 1. The house drops about 3 m in one main step, so the downhill façade is taller and the retaining study zone is more concentrated (~3.3 m conceptual).",
      "دو طبقه روشن. تراز راه / خواب (~۱۶۵۹٫۲ m): ورودی، دفتر، سوئیت + سه اتاق، حمام ۲، گردش. تراز باغ / خانواده (~۱۶۵۶٫۱ m): نشیمن/ناهارخوری، آشپزخانه، رختشوی‌خانه، انبار، حمام ۱. خانه حدود ۳ متر در یک پله اصلی پایین می‌آید؛ نمای پایین‌دست بلندتر و منطقه حائل متمرکزتر است (~۳٫۳ متر مفهومی).",
    ),
    program: bi(
      "Same family program outline as A: four bedrooms, office, living/kitchen, two baths, laundry, storage, garage/workshop, courtyard. Bedrooms cluster at road level (quiet side); family life opens to the garden below.",
      "همان کلیات برنامه خانواده مانند A: چهار اتاق‌خواب، دفتر، نشیمن/آشپزخانه، دو سرویس، رختشوی‌خانه، انبار، گاراژ/کارگاه، حیاط. اتاق‌خواب‌ها در تراز راه (سمت آرام)؛ زندگی خانواده به باغ پایین باز می‌شود.",
    ),
    strengths: [
      bi("Smallest footprint — most contiguous outdoor garden for children", "کوچک‌ترین سطح اشغال — بیشترین باغ پیوسته برای کودکان"),
      bi("Simple two-storey superstructure and clear zoning (sleep up / live down)", "اسکلت دوطبقه ساده و منطقه‌بندی روشن (خواب بالا / زندگی پایین)"),
      bi("Garage sits naturally at the high road edge", "گاراژ طبیعی در لبه بالای راه می‌نشیند"),
    ],
    tradeoffs: [
      bi("Deepest single downhill cut and tallest garden façade of the three", "عمیق‌ترین برش یک‌باره پایین‌دست و بلندترین نمای باغ میان سه گزینه"),
      bi("Least forgiving if geotech or retaining is difficult", "اگر ژئوتکنیک یا حائل سخت باشد، کم‌تحمل‌ترین گزینه است"),
      bi("Less “split following the slope” than the household’s preferred form", "کمتر از فرم ترجیحی «شکسته روی شیب» خانوار است"),
      bi("Garage/workshop still modest for two cars + open carpentry", "گاراژ/کارگاه هنوز برای دو خودرو + نجاری باز متوسط است"),
    ],
  },
  "option-c": {
    what_it_is: bi(
      "A stepped courtyard house: four smaller bars/pavilions follow the slope down from the road — garage, quiet/guest wing, living–courtyard wing, and bedroom wing — around an open-to-sky courtyard. About 138 m² internal, 36 m² garage/workshop, 18 m² courtyard, ~234 m² footprint.",
      "خانه حیاط‌دار پله‌ای: چهار نوار/غرفه کوچک‌تر شیب را از راه پایین می‌آیند — گاراژ، بال آرام/مهمان، بال نشیمن–حیاط، و بال خواب — دور یک حیاط باز به آسمان. حدود ۱۳۸ مترمربع داخلی، ۳۶ مترمربع گاراژ/کارگاه، ۱۸ مترمربع حیاط، حدود ۲۳۴ مترمربع سطح اشغال.",
    ),
    how_it_works: bi(
      "Three main finished bands. Quiet / guest (~1657.4 m): entry, office, bedroom 4, bath 1, storage, laundry. Courtyard / family (~1655.6 m): living/dining and kitchen opening to the courtyard. Lower bedroom (~1653.8 m): master + bedrooms 2–3 and bath 2. Garage stays high at the road. Retaining is distributed in shorter walls rather than one deep cut. Courtyard falls conceptually to a NE slot drain.",
      "سه نوار اصلی. آرام / مهمان (~۱۶۵۷٫۴ m): ورودی، دفتر، اتاق‌خواب ۴، حمام ۱، انبار، رختشوی‌خانه. حیاط / خانواده (~۱۶۵۵٫۶ m): نشیمن/ناهارخوری و آشپزخانه رو به حیاط. خواب پایین (~۱۶۵۳٫۸ m): سوئیت + اتاق‌های ۲–۳ و حمام ۲. گاراژ بالا در راه می‌ماند. حائل در دیوارهای کوتاه‌تر پخش است نه یک برش عمیق. حیاط مفهومی به زهکش شمال‌شرق می‌ریزد.",
    ),
    program: bi(
      "Full family program with the strongest outdoor room: living and kitchen share the courtyard level; bedrooms split between quiet upper guest and lower bedroom wing. Closest spatial idea to “two levels split following the slope” plus a real courtyard for children and outdoor life.",
      "برنامه کامل خانواده با قوی‌ترین فضای بیرونی: نشیمن و آشپزخانه در تراز حیاط؛ اتاق‌خواب‌ها بین بال آرام بالایی و بال خواب پایین تقسیم می‌شوند. نزدیک‌ترین ایده فضایی به «دو تراز شکسته روی شیب» به‌همراه حیاط واقعی برای کودکان و زندگی بیرون.",
    ),
    strengths: [
      bi("Closest fit to the steep terrain and household “stepped” preference", "نزدیک‌ترین به زمین پرشیب و ترجیح «پله‌ای» خانوار"),
      bi("Best living–kitchen–courtyard relationship for outdoor play", "بهترین رابطه نشیمن–آشپزخانه–حیاط برای بازی بیرون"),
      bi("Shorter distributed retaining instead of one deep wall", "حائل کوتاه و پخش‌شده به‌جای یک دیوار عمیق"),
      bi("Garage remains at the high usable upper road", "گاراژ در راه بالایی قابل‌استفاده می‌ماند"),
    ],
    tradeoffs: [
      bi("Largest distributed footprint and longest indoor circulation", "بزرگ‌ترین سطح اشغال پخش‌شده و طولانی‌ترین گردش داخلی"),
      bi("More roof edges, stairs and drainage junctions to detail", "لبه‌های بام، پله و اتصالات زهکشی بیشتر برای جزئیات"),
      bi("Garage/workshop still needs upsizing for two cars + carpentry flex", "گاراژ/کارگاه هنوز برای دو خودرو + نجاری باید بزرگ‌تر شود"),
      bi("Outdoor fountain/pool not modelled — later garden phase", "فواره/استخر مدل نشده — فاز بعدی باغ"),
    ],
  },
};

const levelNames = {
  "Road / Quiet Level": bi("Road / quiet level", "تراز راه / آرام"),
  "Road / Bedroom Level": bi("Road / bedroom level", "تراز راه / خواب"),
  "Road / Garage Level": bi("Road / garage level", "تراز راه / پارکینگ"),
  "Family Level": bi("Family level", "تراز خانوادگی"),
  "Bedroom Level": bi("Bedroom level", "تراز خواب"),
  "Garden / Family Level": bi("Garden / family level", "تراز باغ / خانوادگی"),
  "Quiet / Guest Level": bi("Quiet / guest level", "تراز آرام / مهمان"),
  "Courtyard / Family Level": bi("Courtyard / family level", "تراز حیاط / خانوادگی"),
  "Lower Bedroom Level": bi("Lower bedroom level", "تراز پایین خواب"),
};

const roomNames = {
  Entry: bi("Entry", "ورودی"),
  "Home Office": bi("Home office", "اتاق کار"),
  "Living / Dining": bi("Living / dining", "نشیمن / غذاخوری"),
  Kitchen: bi("Kitchen", "آشپزخانه"),
  Storage: bi("Storage", "انباری"),
  Laundry: bi("Laundry", "رختشویخانه"),
  "Master Bedroom": bi("Master bedroom", "اتاق خواب اصلی"),
  "Bedroom 2": bi("Bedroom 2", "اتاق خواب ۲"),
  "Bedroom 3": bi("Bedroom 3", "اتاق خواب ۳"),
  "Bedroom 4": bi("Bedroom 4", "اتاق خواب ۴"),
  "Bathroom 1": bi("Bathroom 1", "حمام ۱"),
  "Bathroom 2": bi("Bathroom 2", "حمام ۲"),
  "Circulation A1": bi("Circulation A1", "راهرو A۱"),
  "Circulation A2": bi("Circulation A2", "راهرو A۲"),
  "Circulation A3": bi("Circulation A3", "راهرو A۳"),
  "Circulation B1": bi("Circulation B1", "راهرو B۱"),
  "Circulation B2": bi("Circulation B2", "راهرو B۲"),
  "Circulation C1": bi("Circulation C1", "راهرو C۱"),
  "Circulation C2": bi("Circulation C2", "راهرو C۲"),
  "Circulation C3": bi("Circulation C3", "راهرو C۳"),
};

const categoryLabels = {
  entry: bi("Entry", "ورودی"),
  living: bi("Living", "نشیمن"),
  kitchen: bi("Kitchen", "آشپزخانه"),
  bedroom: bi("Bedroom", "خواب"),
  bath: bi("Bathroom", "حمام"),
  office: bi("Office", "کار"),
  service: bi("Service", "خدمات"),
  storage: bi("Storage", "انباری"),
  circulation: bi("Circulation", "گردش"),
};

const validationChecks = {
  "No geometry outside property": bi(
    "No geometry outside the property",
    "هیچ حجمی بیرون از ملک نیست",
  ),
  "Temporary 1.5 m study margin": bi(
    "Temporary 1.5 m study margin respected",
    "حاشیه مطالعاتی موقت ۱٫۵ متر رعایت شده",
  ),
  "No overlapping rooms": bi("No overlapping rooms", "هیچ اتاقی هم‌پوشانی ندارد"),
  "All spaces accessible": bi("Every space is reachable", "همه فضاها دسترس‌پذیرند"),
  "Suitable door clearances": bi("Door clearances are workable", "فاصله آزاد درها کارآمد است"),
  "Exterior bedroom windows": bi(
    "Every bedroom has an exterior window",
    "هر اتاق خواب پنجره بیرونی دارد",
  ),
  "Usable stair geometry": bi("Stair geometry is usable", "هندسه پله قابل استفاده است"),
  "Workable vehicle access": bi("Vehicle access is workable", "دسترسی خودرو کارآمد است"),
  "Courtyard cannot trap drainage": bi(
    "The courtyard cannot trap drainage",
    "حیاط آب سطحی را محبوس نمی‌کند",
  ),
};

/**
 * Two corresponding points fix a rigid transform, because the concept frame is a
 * rotation and translation of the survey frame with no scaling: |Pt2→Pt1| in the
 * frame equals the verified road length. The v axis sign is resolved from the
 * data rather than assumed — Pt3 has positive v and lies inland.
 */
function buildFrame(site, surveyPoints) {
  const origin = surveyPoints.find((point) => point.id === "Pt2");
  const along = surveyPoints.find((point) => point.id === "Pt1");
  const inland = surveyPoints.find((point) => point.id === "Pt3");
  if (!origin || !along || !inland) throw new Error("concepts: Pt1, Pt2 and Pt3 are required");

  const span = Math.hypot(along.x_m - origin.x_m, along.y_m - origin.y_m);
  const ux = (along.x_m - origin.x_m) / span;
  const uy = (along.y_m - origin.y_m) / span;
  // Both perpendiculars are candidates; pick the one that puts Pt3 inland.
  let vx = -uy;
  let vy = ux;
  const expected = site.points_uvz.Pt3;
  const trial = (inland.x_m - origin.x_m) * vx + (inland.y_m - origin.y_m) * vy;
  if (Math.sign(trial) !== Math.sign(expected[1])) {
    vx = uy;
    vy = -ux;
  }
  return {
    origin,
    ux,
    uy,
    vx,
    vy,
    road_span_m: span,
    // Scene convention in terrain-3d.js is Y-up with Z = negated survey north,
    // so a box whose local +X follows the u axis needs this rotation about Y.
    rotation_y_rad: Math.atan2(uy, ux),
  };
}

const toSurvey = (frame, u, v) => ({
  x_m: frame.origin.x_m + u * frame.ux + v * frame.vx,
  y_m: frame.origin.y_m + u * frame.uy + v * frame.vy,
});

/** Every one of the eight surveyed points must come back out of the transform. */
function verifyFrame(frame, site, surveyPoints) {
  let worst = 0;
  for (const [id, [u, v]] of Object.entries(site.points_uvz)) {
    const point = surveyPoints.find((item) => item.id === id);
    if (!point) throw new Error(`concepts: ${id} is not a surveyed point`);
    const mapped = toSurvey(frame, u, v);
    worst = Math.max(worst, Math.hypot(mapped.x_m - point.x_m, mapped.y_m - point.y_m));
  }
  return worst;
}

/**
 * The concept data gives every volume a plan rectangle but never a storey
 * height, so heights are derived rather than invented, and from whichever
 * surface is genuinely lower: the underside of the mono-pitch roof covering the
 * bar, or the next platform above. Taking the roof alone produced a 6.2 m room
 * in the two-storey option — a volume passing straight through the floor above.
 * Anything with neither surface above it stays flat and says so.
 */
const centreOf = (rectangle) => [
  rectangle.u + rectangle.w / 2,
  rectangle.v + rectangle.d / 2,
];

const covers = (rectangle, u, v) => (
  u >= rectangle.u && u <= rectangle.u + rectangle.w
    && v >= rectangle.v && v <= rectangle.v + rectangle.d
);

function heightBelowCeiling(option, u, v, w, d, level) {
  const roofs = option.roofs || [];
  const plates = option.plates || [];
  // The bar the volume belongs to, not just anything at the same elevation.
  const bar = plates.find((plate) => (
    Math.abs(plate.level - level) < 0.5 && covers(plate, u + w / 2, v + d / 2)
  ));
  // The ceiling belongs to the bar, so both candidates are tested against the
  // bar's own centre. Testing the room's centre instead put a lower room under
  // a different bar's roof, giving a 6.2 m volume straight through the floor
  // above; testing bare level differences gave 1.5 m rooms in the split-level
  // option, where the next half-level is beside the room, not over it.
  const [probeU, probeV] = bar ? centreOf(bar) : [u + w / 2, v + d / 2];

  const candidates = [];
  const roof = roofs.find((item) => covers(item, probeU, probeV));
  if (roof) candidates.push([roof.elev - level, "underside-of-mono-pitch-roof"]);
  plates
    .filter((plate) => plate.level - level > 0.2 && covers(plate, probeU, probeV))
    .forEach((plate) => candidates.push([plate.level - level, "floor-of-the-bar-above"]));

  const usable = candidates.filter(([height]) => height > 0.2).sort((a, b) => a[0] - b[0])[0];
  if (!usable) return { height_m: null, height_source: "nothing-above" };
  return { height_m: round(usable[0], 2), height_source: usable[1] };
}

function box(frame, source, extra = {}) {
  const centre = toSurvey(frame, source.u + source.w / 2, source.v + source.d / 2);
  return {
    u: source.u,
    v: source.v,
    width_m: source.w,
    depth_m: source.d,
    x_m: round(centre.x_m, 4),
    y_m: round(centre.y_m, 4),
    ...extra,
  };
}

export function buildConcepts(surveyPoints) {
  const source = JSON.parse(fs.readFileSync(conceptSourcePath, "utf8"));
  const frame = buildFrame(source.site, surveyPoints);
  const roundTripError = verifyFrame(frame, source.site, surveyPoints);
  if (roundTripError > 1e-6) {
    throw new Error(
      `concepts: the (u,v) frame does not reproduce the survey (worst ${roundTripError} m)`,
    );
  }

  const options = Object.values(source.options)
    .map((option) => {
      const roofs = option.roofs || [];
      const rooms = (option.rooms || []).map((room) => box(frame, room, {
        name: roomNames[room.name] || bi(room.name, room.name),
        category: room.category,
        category_label: categoryLabels[room.category] || bi(room.category, room.category),
        level_m: room.level,
        level_name: levelNames[room.level_name] || bi(room.level_name, room.level_name),
        window: Boolean(room.window),
        ...heightBelowCeiling(option, room.u, room.v, room.w, room.d, room.level),
      }));
      return {
        id: option.id,
        letter: optionLetters[option.id] || option.id.slice(-1).toUpperCase(),
        title: titles[option.id] || bi(option.title, option.title),
        concept: concepts[option.id] || bi(option.concept, option.concept),
        levels: option.levels.map(([name, elevation]) => ({
          name: levelNames[name] || bi(name, name),
          elevation_m: elevation,
        })),
        metrics: {
          internal_area_m2: option.metrics.internal_area_m2,
          garage_workshop_area_m2: option.metrics.garage_workshop_area_m2,
          courtyard_area_m2: option.metrics.courtyard_area_m2,
          footprint_m2: option.metrics.footprint_m2,
        },
        rooms,
        roofs: roofs.map((roof) => box(frame, roof, {
          elevation_m: roof.elev,
          slope_percent: roof.slope,
        })),
        garage: option.garage
          ? box(frame, option.garage, {
            level_m: option.garage.level,
            ...heightBelowCeiling(
              option,
              option.garage.u,
              option.garage.v,
              option.garage.w,
              option.garage.d,
              option.garage.level,
            ),
          })
          : null,
        // Open to the sky by definition, so it carries no height at all.
        courtyard: option.courtyard
          ? box(frame, option.courtyard, {
            level_m: option.courtyard.level,
            drainage_open: Boolean(option.courtyard.drainage),
          })
          : null,
        retaining: (option.retaining || []).map((wall) => box(frame, wall, {
          level_m: wall.elev,
          height_m: wall.h,
          height_source: "given-in-concept-data",
        })),
        stairs: (option.stairs || []).map((stair) => {
          const centre = toSurvey(frame, stair.u, stair.v);
          return {
            u: stair.u,
            v: stair.v,
            x_m: round(centre.x_m, 4),
            y_m: round(centre.y_m, 4),
            top_m: stair.top,
            bottom_m: stair.bottom,
            risers: stair.risers,
            going_m: stair.going,
            width_m: stair.width,
          };
        }),
        // Geometry containment / door / stair checks from FreeCAD are study-level
        // only. Claims that need measured road grade, geotech or legal outfall
        // stay withheld so they cannot be read as field approval.
        validation: [],
        source_validation_withheld: bi(
          "Workspace pass/fail claims that depend on unmeasured road, ground or drainage evidence are withheld. Geometry containment and room-schedule checks remain study-level only.",
          "ادعاهای قبول/رد فضای کار که به شواهد اندازه‌گیری‌نشده راه، زمین یا زهکشی وابسته‌اند منتشر نمی‌شوند. کنترل هندسه و جدول اتاق فقط در سطح مطالعه است.",
        ),
        brief_alignment: briefAlignment[option.id] || null,
        isometric_image: isometricImages[option.id] || null,
        profile: optionProfiles[option.id] || null,
      };
    })
    .sort((a, b) => a.letter.localeCompare(b.letter));

  return {
    // Available preliminary studies — not a selected construction design.
    unselected: true,
    rejected: false,
    revived: true,
    available: true,
    status: "preliminary-studies-for-architect",
    overview: bi(
      "What A, B and C are: three editable FreeCAD massing experiments for the same steep 487 m² parcel. All put the garage near the high Pt2–Pt1 road, step (or drop) toward the northeast garden, and sketch a full family program (four bedrooms, office, living, kitchen, two baths, laundry, storage, courtyard). They differ in how they meet the 35–44% slope — split half-levels (A), two storeys with one deep drop (B), or four stepped bars around a courtyard (C). Areas are approximate study figures, not measured as-built.",
      "A، B و C چیستند: سه آزمایش حجم قابل‌ویرایش FreeCAD برای همان قطعه پرشیب ۴۸۷ مترمربعی. هر سه گاراژ را نزدیک راه بالای Pt2–Pt1 می‌گذارند، به‌سوی باغ شمال‌شرق پله یا افت می‌کنند، و برنامه کامل خانواده را اسکچ می‌کنند (چهار اتاق‌خواب، دفتر، نشیمن، آشپزخانه، دو سرویس، رختشوی‌خانه، انبار، حیاط). تفاوت در برخورد با شیب ۳۵–۴۴٪ است — نیم‌طبقه‌ها (A)، دو طبقه با یک افت عمیق (B)، یا چهار نوار پله‌ای دور حیاط (C). مساحت‌ها ارقام تقریبی مطالعه‌اند، نه اندازه‌گیری ساخته‌شده.",
    ),
    selection: {
      selected: null,
      ranking_published: false,
      comparison_note: bi(
        "Among the three, option C is the strongest terrain starting point for discussion: it tracks the fall with shorter retaining pieces and a real courtyard. A is the most compact family plan with more internal area. B keeps the most garden but asks for the deepest single cut. None is selected for construction.",
        "میان سه گزینه، C قوی‌ترین نقطه شروع زمین برای گفتگو است: افت را با حائل‌های کوتاه‌تر و حیاط واقعی دنبال می‌کند. A فشرده‌ترین پلان خانواده با مساحت داخلی بیشتر است. B بیشترین باغ را نگه می‌دارد اما عمیق‌ترین برش یک‌باره را می‌خواهد. هیچ‌کدام برای ساخت انتخاب نشده.",
      ),
      note: bi(
        "Preliminary concept studies A, B and C are available for discussion with the architect. No option is selected for construction. Use them with the completed household brief; they are not finished levels, vehicle-access proof or drainage design.",
        "مطالعات مفهومی مقدماتی A، B و C برای گفتگو با معمار در دسترس‌اند. هیچ گزینه‌ای برای ساخت انتخاب نشده. با شرح کامل خانوار استفاده کنید؛ تراز نهایی، اثبات دسترسی خودرو یا طراحی زهکشی نیستند.",
      ),
    },
    caveat: bi(
      "Concept-study massing on an eight-point TIN: useful for layout conversation, not evidence for construction, services, cost or permitting. The 1.5 m margin in the models is a temporary study line, not a legal setback. Geotech, road geometry and utility connections are still required before fixing a footprint. Original FreeCAD “pass” checks are study geometry only.",
      "حجم مطالعاتی روی TIN هشت‌نقطه‌ای: برای گفتگوی چیدمان مفید است، نه شاهد ساخت، تأسیسات، هزینه یا مجوز. حاشیه ۱٫۵ متری مدل‌ها خط موقت مطالعه است نه عقب‌نشینی قانونی. پیش از تثبیت سطح اشغال هنوز ژئوتکنیک، هندسه راه و انشعاب لازم است. چک‌های «قبول» FreeCAD فقط هندسه مطالعه‌اند.",
    ),
    frame: {
      origin_point: "Pt2",
      u_axis: "Pt2→Pt1 road edge",
      v_axis: "perpendicular, inland positive",
      road_span_m: round(frame.road_span_m, 6),
      rotation_y_rad: frame.rotation_y_rad,
      survey_round_trip_max_error_m: roundTripError,
      verified_against: "all eight surveyed points",
    },
    category_labels: categoryLabels,
    options,
  };
}
