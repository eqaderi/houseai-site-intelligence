/**
 * Preliminary house-concept massing, transformed from the design workspace's own
 * (u, v) frame into survey coordinates.
 *
 * Scope boundary, deliberately narrow. `documents.rejected_concepts.included`
 * stays false and keeps its meaning: these concepts are not in the active
 * document library and are not recommendations. Nothing here is bundled as a
 * document, an image or an asset reference — the geometry arrives as data and
 * renders as an off-by-default layer labelled unselected. `selected-design/` in
 * the design workspace is empty, and option C is a comparison outcome, not a
 * selection.
 *
 * No FreeCAD export pipeline is involved. `working/concept-data.json` already
 * holds every volume as an axis-aligned box in a frame whose origin is Pt2 and
 * whose u axis runs along the road edge Pt2→Pt1, so the transform is exact
 * arithmetic and is verified against all eight surveyed points.
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
        validation: option.validation.map((check) => ({
          check: validationChecks[check.check] || bi(check.check, check.check),
          passed: check.passed,
        })),
      };
    })
    .sort((a, b) => a.letter.localeCompare(b.letter));

  return {
    // Not a selection and not part of the active document library. The same
    // meaning documents.rejected_concepts.included === false has always carried.
    unselected: true,
    status: "preliminary-concept-massing",
    selection: {
      selected: null,
      compared_outcome: "option-c",
      note: bi(
        "Option C scores highest in the workspace comparison. That is a comparison outcome, not a decision: no design has been selected, and none of this geometry is coordinated for construction.",
        "گزینه C در مقایسه کارگاهی بالاترین امتیاز را دارد. این نتیجه مقایسه است، نه تصمیم: هیچ طرحی انتخاب نشده و هیچ‌یک از این هندسه‌ها برای اجرا هماهنگ نشده است.",
      ),
    },
    caveat: bi(
      "Preliminary massing only. Room rectangles come from the design workspace; heights are the underside of each bar's mono-pitch roof, because the concept data states no storey height. Nothing here is structural, serviced or permit-ready.",
      "فقط حجم‌پردازی اولیه. مستطیل اتاق‌ها از فضای کار طراحی می‌آید و ارتفاع‌ها زیر سقف شیب‌دار هر نوار است، زیرا داده مفهومی ارتفاع طبقه را بیان نمی‌کند. هیچ بخشی از این سازه، تأسیسات یا مدارک پروانه نیست.",
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
