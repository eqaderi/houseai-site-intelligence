/**
 * Planting: which trees can actually hold this slope, and what they cost to keep.
 *
 * The brief asked for fast, tall, beautiful shade trees that will prevail here.
 * Those four are not jointly free on this site, and the site's own bundled data
 * is what says so: annual precipitation is 760 mm, but June, July, August and
 * September together receive 4.8 mm, at about 21% relative humidity, with 82
 * days a year over 30 °C. Every species that grows fast, reaches 20 m and casts
 * dense shade is a high-transpiration tree. On this parcel each one of them is
 * an irrigated tree — permanently, not for two establishment summers. The
 * species that survive here unwatered are the slow ones, which is exactly why
 * the natural cover of these hills is Quercus brantii.
 *
 * So this module does not publish a wish list. It publishes five site
 * constraints already measured or mapped for this location, a register of
 * candidate species each carrying its own sourced figures, and the result of
 * testing each species against each constraint. A species that fails the cold
 * test is shown failing it.
 *
 * The constraint values are read from data already on the page — climate.json,
 * hazards.json, the SoilGrids response, the verified site area — so a species
 * verdict cannot drift away from the climate section beside it.
 *
 * Status is `preliminary-inference` throughout, and deliberately not `verified`.
 * The horticultural figures are published sources, not site observations: no
 * bundled source records a single plant growing on this parcel, nobody has
 * tested the soil, and nursery availability in Kermanshah province is unknown
 * here. This is a shortlist to take to a local nursery and an agricultural
 * extension office, not a landscape design.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SPECIES, DO_NOT_PLANT, ASK_LOCALLY, REGISTER_SOURCES,
} from "./species-register.mjs";

const round = (value, places = 1) => Number(value.toFixed(places));

/**
 * Persian digits for interpolated figures.
 *
 * Every authored Persian string in this project uses Persian numerals and the
 * Arabic decimal separator, so a figure interpolated straight from the data
 * would arrive as Latin digits inside a Persian sentence — which is how the
 * hero once showed one convention beside another quoting the same number. `faT`
 * is a tagged template that converts only the interpolated values, leaving the
 * authored text alone, so a Persian sentence cannot be written any other way
 * here. Latin identifiers stay Latin: a value containing a letter — a USDA zone
 * label like "6a" — is a code rather than a quantity and passes through
 * untouched, so "پهنه 6a" does not come out half-converted.
 */
const pd = (value) => (/[A-Za-z]/.test(String(value)) ? String(value) : String(value)
  .replace(/[0-9]/g, (digit) => "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[Number(digit)])
  .replaceAll(".", "\u066b")
  // A leading ASCII hyphen on a temperature reads as punctuation next to Persian
  // digits; the minus sign is the character that reads as a sign.
  .replaceAll("-", "\u2212"));
const faT = (strings, ...values) => strings
  .reduce((out, part, index) => out + part + (index < values.length ? pd(values[index]) : ""), "");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const imageManifestFile = path.resolve(
  scriptDir, "../assets/data/environmental/raw/wikipedia-species-images.json",
);

/**
 * Photographs and encyclopaedia links, from the fetch script's manifest.
 *
 * Absent manifest is not an error: the generator has to run offline, and the
 * dashboard has to build without photographs. What is not allowed is a broken
 * tile, so an entry only ships if the file it names is actually on disk — and
 * only with the author and licence the manifest recorded, since that is the
 * condition the picture is used under.
 */
function readImageManifest() {
  if (!fs.existsSync(imageManifestFile)) return new Map();
  const manifest = JSON.parse(fs.readFileSync(imageManifestFile, "utf8"));
  return new Map(manifest.entries.map((entry) => {
    const bundled = entry.status === "bundled"
      && entry.bundled_as
      && fs.existsSync(path.resolve(scriptDir, "..", entry.bundled_as));
    return [entry.species_id, {
      wikipedia_en: entry.article_url ?? null,
      wikipedia_fa: entry.persian_article_url ?? null,
      image: bundled
        ? {
          src: entry.bundled_as,
          author: entry.author,
          licence: entry.licence,
          licence_url: entry.licence_url,
          source_page: entry.description_page,
          file: entry.file,
        }
        : null,
      image_status: entry.status,
    }];
  }));
}

/**
 * USDA hardiness zones, °C, cold limit of each half zone. Published table, not
 * a conversion of our own: 5b is −26.1…−23.3 and 6a is −23.3…−20.6.
 */
const ZONE_FLOORS_C = [
  ["4b", -31.7], ["5a", -28.9], ["5b", -26.1], ["6a", -23.3],
  ["6b", -20.6], ["7a", -17.8], ["7b", -15.0], ["8a", -12.2],
];

function zoneFor(minimumC) {
  // The zone containing this temperature: the coldest band whose floor is at or
  // below it.
  let label = ZONE_FLOORS_C[0][0];
  for (const [zone, floor] of ZONE_FLOORS_C) {
    if (minimumC >= floor) label = zone;
  }
  return label;
}

const clock = (hour) => {
  const hours = Math.floor(hour);
  const minutes = Math.round((hour - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/**
 * Where a tree can stand without costing something the site is already short of.
 *
 * This is the part that makes planting a site decision rather than a nursery
 * order, and every number in it is quoted from the solar and wind sections of
 * this same dashboard. Two of the four zones exist because of a conflict the
 * data creates and nothing here resolves: the winter sun rises in the east‑
 * southeast and the cold winter wind blows from the same quarter, so a shelter
 * belt in the right place for one is in the wrong place for the other.
 */
function buildPlacement(solar, wind) {
  const bySeason = Object.fromEntries(solar.seasons.map((season) => [season.id, season]));
  const winter = bySeason.winter;
  const summer = bySeason.summer;
  const winterWind = wind.seasons.find((season) => season.season === "winter");
  const summerWind = wind.seasons.find((season) => season.season === "summer");
  const share = (season, direction) => season.direction_distribution
    .find((entry) => entry.direction === direction)?.percent ?? 0;

  return {
    status: "preliminary-inference",
    note: {
      en: "Zones are argued from this dashboard's own solar and wind figures, quoted beside each one. They are orientation guidance, not a planting plan: no position can be fixed before the house footprint and the platform level are chosen.",
      fa: "پهنه‌ها از همان اعداد خورشیدی و بادی این داشبورد استدلال شده‌اند و در کنار هر پهنه نقل شده‌اند. این راهنمای جهت‌گیری است نه نقشه کاشت: هیچ موقعیتی پیش از انتخاب ردپای ساختمان و تراز سکو قابل تثبیت نیست.",
    },
    zones: [
      {
        id: "west-southwest",
        title: { en: "West and south‑west of the house — the shade that matters", fa: "غرب و جنوب‌غرب ساختمان — سایه‌ای که اهمیت دارد" },
        evidence: {
          en: `Summer sun sets at azimuth ${summer.sunset_azimuth_deg}° and noon altitude reaches ${summer.noon_altitude_deg}°. A high midday sun is cheap to shade with a roof; the expensive gain is the low west and south‑west beam of a July afternoon at over 30 °C, which arrives under any overhang.`,
          fa: faT`خورشید تابستان در سمت ${summer.sunset_azimuth_deg} درجه غروب می‌کند و ارتفاع ظهر به ${summer.noon_altitude_deg} درجه می‌رسد. سایه‌انداختن بر خورشید بلند ظهر با بام ارزان است؛ بهره گران، تابش کم‌ارتفاع غرب و جنوب‌غرب بعدازظهری بالای ۳۰ درجه است که از زیر هر سایبانی وارد می‌شود.`,
        },
        guidance: {
          en: "This is where a large deciduous crown earns its water. Keep the trunk clear and the crown high so the summer west breeze still passes underneath — the same quarter the afternoon sun comes from also carries the season's prevailing wind.",
          fa: "اینجا جایی است که تاج بزرگ برگ‌ریز آبش را جبران می‌کند. تنه را آزاد و تاج را بلند نگه دارید تا نسیم غربی تابستان از زیر آن بگذرد — همان ربعی که خورشید بعدازظهر از آن می‌آید، باد غالب فصل را هم حمل می‌کند.",
        },
      },
      {
        id: "winter-aperture",
        title: { en: "The winter aperture — keep it clear", fa: "دهانه زمستان — بازش بگذارید" },
        evidence: {
          en: `On the winter solstice the sun clears the terrain horizon at ${clock(winter.effective_first_sun)} and leaves it at ${clock(winter.effective_last_sun)}, ${winter.solar_access_hours} hours in total, never higher than ${winter.noon_altitude_deg}°, crossing from azimuth ${winter.sunrise_azimuth_deg}° to ${winter.sunset_azimuth_deg}°.`,
          fa: faT`در انقلاب زمستانی خورشید در ${clock(winter.effective_first_sun)} از افق زمین بالا می‌آید و در ${clock(winter.effective_last_sun)} آن را ترک می‌کند، در مجموع ${winter.solar_access_hours} ساعت، هرگز بلندتر از ${winter.noon_altitude_deg} درجه، از سمت ${winter.sunrise_azimuth_deg} تا ${winter.sunset_azimuth_deg} درجه.`,
        },
        guidance: {
          en: "Nothing evergreen belongs in that arc. A bare deciduous crown is not free either — trunk, limbs and twigs still intercept a real share of a beam this low — so keep even deciduous trees off the line between the south to south‑west sky and the main winter glazing, rather than merely choosing deciduous and considering it solved.",
          fa: "هیچ همیشه‌سبزی در آن کمان جا ندارد. تاج لخت برگ‌ریز هم رایگان نیست — تنه، شاخه و ترکه سهم واقعی از تابشی این‌قدر کم‌ارتفاع را می‌گیرند — پس حتی درختان برگ‌ریز را از خط میان آسمان جنوب تا جنوب‌غرب و شیشه‌های اصلی زمستانی دور نگه دارید، نه آنکه فقط برگ‌ریز انتخاب کنید و مسئله را حل‌شده بدانید.",
        },
      },
      {
        id: "east-shelter",
        title: { en: "East shelter belt — and the conflict in it", fa: "کمربند بادشکن شرقی — و تضاد درون آن" },
        evidence: {
          en: `The cold half of the year blows from the east: ${share(winterWind, "E")}% of winter hours from E, ${share(winterWind, "ESE")}% from ESE, ${share(winterWind, "SE")}% from SE. Summer reverses to the west, ${share(summerWind, "W")}% from W. But winter sunrise is at azimuth ${winter.sunrise_azimuth_deg}° — the same quarter as the winter wind.`,
          fa: faT`نیمه سرد سال از شرق می‌وزد: ${share(winterWind, "E")} درصد ساعات زمستان از شرق، ${share(winterWind, "ESE")} درصد از شرق‌جنوب‌شرقی، ${share(winterWind, "SE")} درصد از جنوب‌شرقی. تابستان به غرب برمی‌گردد، ${share(summerWind, "W")} درصد از غرب. اما طلوع زمستان در سمت ${winter.sunrise_azimuth_deg} درجه است — همان ربع باد زمستان.`,
        },
        guidance: {
          en: "A dense evergreen belt is the right answer to the winter wind and the wrong answer to the winter morning. This dashboard does not resolve it: either keep the belt low and short of the sun line, push it round to the north‑east where the ground falls away anyway, or accept losing the first hour of winter sun. It is a decision for whoever fixes the house on the platform.",
          fa: "کمربند همیشه‌سبز انبوه پاسخ درست به باد زمستان و پاسخ نادرست به صبح زمستان است. این داشبورد آن را حل نمی‌کند: یا کمربند را کوتاه و بیرون از خط خورشید نگه دارید، یا آن را به شمال‌شرق بچرخانید که زمین همان‌جا افت می‌کند، یا از دست دادن نخستین ساعت آفتاب زمستان را بپذیرید. این تصمیم کسی است که ساختمان را روی سکو تثبیت می‌کند.",
        },
      },
      {
        id: "downhill-northeast",
        title: { en: "The downhill north‑east end — the cheapest place to plant", fa: "انتهای سراشیب شمال‌شرقی — کم‌هزینه‌ترین جای کاشت" },
        evidence: {
          en: `Every facet of the parcel descends north‑east, and the north‑east quarter lies outside both the winter arc (${winter.sunrise_azimuth_deg}°–${winter.sunset_azimuth_deg}°) and the summer afternoon. A tree there also stands below the platform, so its crown competes with the view long before it competes with the sun.`,
          fa: faT`همه وجه‌های قطعه به شمال‌شرق نزول دارند و ربع شمال‌شرقی بیرون از کمان زمستان (${winter.sunrise_azimuth_deg} تا ${winter.sunset_azimuth_deg} درجه) و بعدازظهر تابستان است. درختی در آنجا پایین‌تر از سکو هم می‌ایستد، پس تاجش خیلی پیش از آنکه با خورشید رقابت کند با منظر رقابت می‌کند.`,
        },
        guidance: {
          en: "Put the largest crowns here first. Keep roots and crowns clear of the lower road bench and of the platform cut face: a mature root plate lifting a retaining wall or a carriageway is the expensive failure, and neither the wall nor the road has been designed yet.",
          fa: "بزرگ‌ترین تاج‌ها را نخست همین‌جا بگذارید. ریشه و تاج را از سکوی جاده پایین و از جبهه برش سکو دور نگه دارید: صفحه ریشه بالغی که دیوار حائل یا سواره‌رو را بالا بیاورد خرابی گران است و نه دیوار طراحی شده و نه جاده.",
        },
      },
    ],
  };
}

const CARE = {
  status: "preliminary-inference",
  note: {
    en: "General practice for this climate, not a specification, and deliberately without quantities — a litres-per-week figure would need a soil test, a species list and a water source, and none of the three exists yet. Confirm planting season and irrigation with an agricultural extension office.",
    fa: "رویه عمومی برای این اقلیم است، نه مشخصات فنی، و آگاهانه بدون مقدار — عدد لیتر در هفته به آزمایش خاک، فهرست گونه و منبع آب نیاز دارد و هیچ‌یک از این سه هنوز موجود نیست. فصل کاشت و آبیاری را با مرکز جهاد کشاورزی تأیید کنید.",
  },
  items: [
    {
      id: "water-source",
      title: { en: "Settle the water before the species", fa: "پیش از گونه، آب را تعیین کنید" },
      body: {
        en: "No bundled source records a water supply at this parcel — the OSM extract within 5 km contains no building footprints at all and the nearest mapped utility is a transmission line several kilometres away. Since every fast shade tree here is an irrigated tree for life, the supply, its summer reliability and a stored buffer decide the species list. This is on the investigations register.",
        fa: "هیچ منبع همراهی تأمین آب در این قطعه ثبت نکرده است — برداشت OSM در شعاع ۵ کیلومتر هیچ ردپای ساختمانی ندارد و نزدیک‌ترین زیرساخت نقشه‌شده خط انتقال برقی در چند کیلومتری است. چون هر درخت سایه‌انداز سریع‌رشد اینجا تا پایان عمر آبیاری‌شده است، منبع، پایداری تابستانی آن و ذخیره میانی، فهرست گونه را تعیین می‌کند. این مورد در فهرست بررسی‌های لازم آمده است.",
      },
    },
    {
      id: "planting-season",
      title: { en: "Plant into the wet season, not the dry one", fa: "در فصل تر بکارید، نه خشک" },
      body: {
        en: "Rain falls between October and May and effectively stops for four months. A tree planted in autumn or very early spring has a whole wet season to put roots down before its first rainless summer; one planted in June is on life support from the day it arrives.",
        fa: "باران بین مهر و اردیبهشت می‌بارد و چهار ماه عملاً قطع می‌شود. نهالی که در پاییز یا ابتدای بهار کاشته شود یک فصل تر کامل برای ریشه‌دواندن پیش از نخستین تابستان بی‌باران دارد؛ نهالی که در خرداد کاشته شود از روز اول وابسته به دستگاه است.",
      },
    },
    {
      id: "slope-planting",
      title: { en: "Plant on a slope, not into it", fa: "روی شیب بکارید، نه در دل آن" },
      body: {
        en: "At 34.5–44%, water runs off a flat planting hole before it soaks in, and disturbed soil on this grade is already flagged as erosion-sensitive. Small level terraces or crescent berms on the downhill side hold irrigation where the roots are; bare disturbed ground between young trees is what a winter cloudburst removes.",
        fa: "در شیب ۳۴٫۵ تا ۴۴ درصد، آب پیش از نفوذ از چاله کاشت تخت سرریز می‌شود و خاک دست‌خورده در این شیب پیش‌تر فرسایش‌پذیر شناخته شده است. تراس‌های کوچک تراز یا آبگیرهای هلالی در سمت پایین‌دست، آب آبیاری را همان‌جا که ریشه است نگه می‌دارند؛ زمین لخت دست‌خورده میان نهال‌های جوان همان چیزی است که رگبار زمستانی می‌برد.",
      },
    },
    {
      id: "staking",
      title: { en: "Stake for the gust, then remove the stake", fa: "برای تندباد قیم بزنید، سپس قیم را بردارید" },
      body: {
        en: "A 117 km/h gust is on record. Young standards need low, temporary staking that lets the stem flex — a stem held rigid never lays down the wood that keeps it standing — and the tie has to come off before it girdles the trunk.",
        fa: "تندباد ۱۱۷ کیلومتر بر ساعت ثبت شده است. نهال‌های پابلند به قیم کوتاه و موقت نیاز دارند که به ساقه اجازه خمش بدهد — ساقه‌ای که سخت بسته شود هرگز چوبی که سرپا نگهش دارد نمی‌سازد — و بند باید پیش از آنکه تنه را حلقه کند باز شود.",
      },
    },
    {
      id: "root-setback",
      title: { en: "Keep root plates off the built work", fa: "صفحه ریشه را از کارهای ساختمانی دور کنید" },
      body: {
        en: "The platform will be cut into a 38% slope and two road benches sit above and below the parcel. Large trees planted close to a cut face, a retaining wall or a carriageway edge become a maintenance liability decades later, and the setback has to be agreed with whoever designs the retaining work — not chosen from a table.",
        fa: "سکو در شیب ۳۸ درصد بریده می‌شود و دو سکوی جاده بالا و پایین قطعه قرار دارند. درختان بزرگ کاشته‌شده نزدیک جبهه برش، دیوار حائل یا لبه سواره‌رو دهه‌ها بعد به تعهد نگهداری تبدیل می‌شوند و فاصله باید با طراح سازه نگهبان توافق شود، نه از جدول انتخاب گردد.",
      },
    },
    {
      id: "disturbed-ground",
      title: { en: "The cut face is a different problem", fa: "جبهه برش مسئله دیگری است" },
      body: {
        en: "Trees do not hold a fresh cut. What does is close, fibrous, fast cover — shrubs, grasses, groundcover — and this register names none, because no bundled source supports a species for it and inventing one would be worse than the gap. Take it to the same extension office as the tree list, and ask about the first winter specifically: the erosion finding on this page is about disturbed soil at 34.5–44%, and bare ground between young trees is where it starts.",
        fa: "درخت جبهه تازه‌بریده را نگه نمی‌دارد. آنچه نگه می‌دارد پوشش متراکم، ریشه‌افشان و سریع است — درختچه، چمن، پوشش زمینی — و این فهرست هیچ‌یک را نام نمی‌برد، چون هیچ منبع همراهی گونه‌ای برای آن پشتیبانی نمی‌کند و ساختن یکی بدتر از این کمبود است. این را به همان مرکز جهاد کشاورزی ببرید که فهرست درختان را می‌برید و مشخصاً درباره زمستان اول بپرسید: یافته فرسایش این صفحه درباره خاک دست‌خورده در شیب ۳۴٫۵ تا ۴۴ درصد است و زمین لخت میان نهال‌های جوان جایی است که از آن آغاز می‌شود.",
      },
    },
    {
      id: "mixture",
      title: { en: "Mix the planting", fa: "کاشت را متنوع کنید" },
      body: {
        en: "Several of the fastest species carry a single well-known disease between them — elm to Dutch elm disease, plane to canker stain, walnut and mulberry to their own pests. A row of one species is a row that fails together; a mixture loses one tree.",
        fa: "چند گونه از سریع‌رشدترین‌ها هر یک یک بیماری شناخته‌شده دارند — نارون بیماری هلندی، چنار شانکر، گردو و توت آفات خود. ردیفی از یک گونه ردیفی است که یک‌جا از بین می‌رود؛ کاشت آمیخته یک درخت را از دست می‌دهد.",
      },
    },
  ],
};

/**
 * @param {object} climate  climate.json, for the temperature and rainfall record.
 * @param {object} soil     Derived soil block: pH and texture from SoilGrids.
 * @param {object} site     Site block, for the verified plan area.
 * @param {object} metrics  terrain-metrics.json, for the measured slope range.
 */
export function buildSpecies(climate, soil, site, metrics, solar, wind) {
  const monthly = climate.monthly;
  const summerMonths = [6, 7, 8, 9];
  const summer = monthly.filter((month) => summerMonths.includes(month.month));
  const summerPrecipitation = round(
    summer.reduce((total, month) => total + month.precipitation_mm, 0), 1,
  );
  const summerHumidity = round(
    summer.reduce((total, month) => total + month.relative_humidity_percent, 0) / summer.length, 1,
  );
  const coldest = climate.extremes_1991_2020.lowest_daily_min_c;
  // Quoted from the register rather than typed, so the constraint and the card
  // cannot state two different crowns for the same tree. Orchard entries publish
  // no spread — on a fruit tree it is a rootstock and pruning decision, not a
  // species property — so they are absent from this maximum rather than counted
  // as zero.
  const fruitingCount = SPECIES.filter((entry) => entry.fruit).length;
  const spreads = SPECIES
    .filter((entry) => entry.crown_spread_m)
    .map((entry) => entry.crown_spread_m[1]);
  const widestCrown = Math.max(...spreads);
  const widestCrownArea = Math.round(Math.PI * (widestCrown / 2) ** 2);

  const frostRecord = climate.derived.spring_frost;
  const frostByThreshold = Object.fromEntries(
    frostRecord.thresholds.map((entry) => [entry.threshold_c, entry]),
  );
  const lastFrost = frostByThreshold[0];
  const killingFrost = frostByThreshold[-2];
  const aprilMinimum = frostRecord.spring_month_minima.find((entry) => entry.month === 4);
  const monthOf = (monthDay) => Number(monthDay.slice(0, 2));
  /*
    Frost dates are held as MM-DD so the checks can compare them, and printed as
    a day and a month name so a reader can act on them. "04-24" in a sentence
    about temperatures invites being read as a number, and the Persian side needs
    a month name anyway — the calendar stays Gregorian, as everywhere else here,
    but the month is written out rather than left as a digit pair.
  */
  const dateLabel = (monthDay, language) => (
    `${Number(monthDay.slice(3))} ${climate.monthly[monthOf(monthDay) - 1].label[language]}`
  );
  const enDate = (monthDay) => dateLabel(monthDay, "en");
  const faDate = (monthDay) => dateLabel(monthDay, "fa");

  const constraints = {
    cold: {
      id: "cold",
      lowest_daily_min_c: coldest,
      percentile_daily_min_c: climate.derived.temperature_percentiles.percentile_daily_min_c,
      frost_days: climate.annual.frost_days,
      usda_zone: zoneFor(coldest),
      source: "climate.json · extremes_1991_2020.lowest_daily_min_c",
      title: { en: "Winter cold", fa: "سرمای زمستان" },
      statement: {
        en: `The coldest daily minimum in the 30-year record for this location is ${coldest} °C, with about ${climate.annual.frost_days} frost days a year. That temperature sits inside USDA zone ${zoneFor(coldest)} and within 0.2 °C of its cold edge, so a species rated only to zone 6b or 7 is not marginal here — it is a replant.`,
        fa: faT`سردترین کمینه روزانه در رکورد ۳۰ ساله این موقعیت ${coldest} درجه سلسیوس است، با حدود ${climate.annual.frost_days} روز یخبندان در سال. این دما درون پهنه ${zoneFor(coldest)} استاندارد USDA و در فاصله ۰٫۲ درجه از لبه سرد آن قرار دارد؛ پس گونه‌ای که فقط تا پهنه ۶b یا ۷ مقاوم است اینجا مرزی نیست، بلکه کاشت دوباره است.`,
      },
    },
    spring_frost: {
      id: "spring_frost",
      // This constraint answers a different question from `cold`, and mixing the
      // two is the mistake it exists to prevent: winter hardiness is about the
      // wood surviving January, this is about the flower surviving April. A tree
      // can clear the first by 11 °C and lose its whole crop to the second.
      applies_to: "fruit",
      applies_to_note: {
        en: `Applies to the ${fruitingCount} fruit trees below, not to the whole list. A shade tree does not care what happens to a flower in April; the other five constraints apply to every species here.`,
        fa: faT`این قید به ${fruitingCount} درخت میوه زیر مربوط است، نه به کل فهرست. برای درخت سایه اهمیتی ندارد که در آوریل بر گل چه می‌آید؛ پنج قید دیگر برای همه گونه‌های اینجا برقرارند.`,
      },
      last_frost_median: lastFrost.last_spring_frost.median,
      last_frost_9_years_in_10: lastFrost.last_spring_frost.later_than_in_9_years_of_10,
      last_frost_latest: lastFrost.last_spring_frost.latest,
      killing_frost_median: killingFrost.last_spring_frost.median,
      killing_frost_latest: killingFrost.last_spring_frost.latest,
      april_lowest_daily_min_c: aprilMinimum.lowest_daily_min_c,
      frost_free_days_median: lastFrost.frost_free_days_median,
      dem_elevation_m: frostRecord.dem_elevation_m,
      chill_hours: frostRecord.chill_hours,
      source: "climate.json · derived.spring_frost, from daily temperature_2m_min 1991–2020",
      title: { en: "Spring frost at flowering", fa: "یخبندان بهاره در گلدهی" },
      statement: {
        en: `In the 30-year record the last night at or below 0 °C falls on ${enDate(lastFrost.last_spring_frost.median)} in a median year, later than ${enDate(lastFrost.last_spring_frost.later_than_in_9_years_of_10)} in one year of ten, and as late as ${enDate(lastFrost.last_spring_frost.latest)}. Nights at or below −2 °C run to ${enDate(killingFrost.last_spring_frost.latest)}, and April minima reach ${aprilMinimum.lowest_daily_min_c} °C. Full-bloom flowers of every pome and stone fruit on this list lose buds between −2.2 and −2.8 °C. So the question for a fruit tree here is not whether it survives the winter — it is whether it flowers before the last frost, and most of them do.`,
        fa: faT`در رکورد ۳۰ ساله آخرین شب با دمای صفر یا کمتر در سال میانه در ${faDate(lastFrost.last_spring_frost.median)} می‌افتد، در یک سال از ده دیرتر از ${faDate(lastFrost.last_spring_frost.later_than_in_9_years_of_10)}، و تا ${faDate(lastFrost.last_spring_frost.latest)} هم دیده شده است. شب‌های منفی ۲ درجه و کمتر تا ${faDate(killingFrost.last_spring_frost.latest)} ادامه دارند و کمینه‌های فروردین به ${aprilMinimum.lowest_daily_min_c} درجه می‌رسند. گل‌های تمام‌گلی هر میوه دانه‌دار و هسته‌دار این فهرست بین منفی ۲٫۲ تا منفی ۲٫۸ درجه جوانه از دست می‌دهند. پس پرسش یک درخت میوه اینجا این نیست که زمستان را می‌گذراند یا نه — این است که پیش از آخرین یخبندان گل می‌دهد یا نه، و بیشترشان می‌دهند.`,
      },
      caveat: frostRecord.bias_note,
      chill_note: frostRecord.chill_note,
    },
    drought: {
      id: "drought",
      annual_precipitation_mm: climate.annual.precipitation_mm,
      summer_precipitation_mm: summerPrecipitation,
      summer_months: "June–September",
      summer_relative_humidity_percent: summerHumidity,
      hot_days_ge_30c: climate.annual.hot_days_ge_30c,
      highest_daily_max_c: climate.extremes_1991_2020.highest_daily_max_c,
      source: "climate.json · monthly precipitation and humidity",
      title: { en: "Summer drought", fa: "خشکی تابستان" },
      statement: {
        en: `The year brings ${climate.annual.precipitation_mm} mm of precipitation, which sounds generous until it is read by month: June to September together receive ${summerPrecipitation} mm at about ${summerHumidity}% relative humidity, with ${climate.annual.hot_days_ge_30c} days a year above 30 °C. This is the constraint that decides the list. Fast growth and dense shade are bought with transpiration, and for four months there is nothing in the soil to transpire.`,
        fa: faT`بارش سالانه ${climate.annual.precipitation_mm} میلی‌متر است که تا زمانی که ماه‌به‌ماه خوانده نشود سخاوتمند به نظر می‌رسد: خرداد تا شهریور در مجموع ${summerPrecipitation} میلی‌متر دریافت می‌کند، با رطوبت نسبی حدود ${summerHumidity} درصد و ${climate.annual.hot_days_ge_30c} روز بالای ۳۰ درجه در سال. همین قید فهرست را تعیین می‌کند. رشد سریع و سایه انبوه با تعرق خریده می‌شود و چهار ماه چیزی در خاک برای تعرق نیست.`,
      },
    },
    soil: {
      id: "soil",
      ph: soil.ph,
      clay_percent: soil.clay_percent,
      silt_percent: soil.silt_percent,
      sand_percent: soil.sand_percent,
      geology: soil.geology,
      source: "SoilGrids point query (bundled) and regional geological mapping",
      title: { en: "Alkaline soil over limestone", fa: "خاک قلیایی روی سنگ‌آهک" },
      statement: {
        en: `Mapped topsoil pH is ${soil.ph}, fine-textured at about ${soil.clay_percent}% clay and ${soil.silt_percent}% silt, over Cretaceous limestone and shale. Lime-loving species are at home; anything that needs acid ground will yellow between the leaf veins and stay yellow. Both figures are mapped, not sampled — a soil test is on the investigations register.`,
        fa: faT`pH خاک سطحی نقشه‌شده ${soil.ph} است، ریزبافت با حدود ${soil.clay_percent} درصد رس و ${soil.silt_percent} درصد سیلت، روی سنگ‌آهک و شیل کرتاسه. گونه‌های آهک‌پسند اینجا در خانه‌اند؛ هر گونه‌ای که خاک اسیدی بخواهد میان رگبرگ‌ها زرد می‌شود و زرد می‌ماند. هر دو عدد نقشه‌ای‌اند نه نمونه‌برداری‌شده — آزمایش خاک در فهرست بررسی‌های لازم آمده است.`,
      },
    },
    exposure: {
      id: "exposure",
      observed_gust_kmh: climate.extremes_1991_2020.highest_daily_gust_kmh,
      gust_50_year_kmh: climate.derived.wind_return_periods.gust_return_period_kmh["50"],
      annual_snowfall_cm: climate.annual.snowfall_cm,
      source: "climate.json · gust record and snowfall",
      title: { en: "Wind and snow loading", fa: "بار باد و برف" },
      statement: {
        en: `The record holds a ${climate.extremes_1991_2020.highest_daily_gust_kmh} km/h gust and about ${climate.annual.snowfall_cm} cm of annual snowfall. The fastest-growing trees available — poplar, willow, black locust, paulownia — are also the weakest-wooded, and a limb failure over a house or a road is the failure mode that matters. Wet snow on a brittle crown does it as reliably as wind.`,
        fa: faT`رکورد تندبادی ${climate.extremes_1991_2020.highest_daily_gust_kmh} کیلومتر بر ساعت و حدود ${climate.annual.snowfall_cm} سانتی‌متر برف سالانه دارد. سریع‌رشدترین درختان در دسترس — تبریزی، بید، اقاقیا، پائولونیا — سست‌چوب‌ترین‌ها هم هستند و شکست شاخه روی ساختمان یا جاده همان حالت خرابی است که اهمیت دارد. برف سنگین روی تاج شکننده همان کار را می‌کند که باد.`,
      },
    },
    space: {
      id: "space",
      plan_area_m2: site.verified_area_m2,
      slope_percent_range: [metrics.slope_percent_min, metrics.slope_percent_max],
      aspect: { en: "northeast", fa: "شمال‌شرقی" },
      source: "site.json verified plan area and terrain-metrics.json slope range",
      title: { en: "How little room there is", fa: "چه اندازه جا کم است" },
      statement: {
        en: `The parcel is ${site.verified_area_m2} m² in plan, on ${metrics.slope_percent_min}–${metrics.slope_percent_max}% ground facing northeast, and a house has to fit on it too. The widest crown on the list below is ${widestCrown} m across, which covers ${widestCrownArea} m² — ${round(widestCrownArea / site.verified_area_m2 * 100, 0)}% of the whole parcel, from one tree. Crown spread, not height, is what runs out here, and every species whose source publishes a spread carries the plan area its mature crown would occupy. Three of the orchard trees do not: on a fruit tree the final spread is set by the rootstock and the pruning, so it is withheld here rather than estimated, and it is a question for the nursery.`,
        fa: faT`قطعه در پلان ${site.verified_area_m2} مترمربع است، روی زمینی با شیب ${metrics.slope_percent_min} تا ${metrics.slope_percent_max} درصد و جهت شمال‌شرقی، و ساختمان هم باید در آن جا بگیرد. پهن‌ترین تاج فهرست زیر ${widestCrown} متر گستره دارد که ${widestCrownArea} مترمربع را می‌پوشاند — ${round(widestCrownArea / site.verified_area_m2 * 100, 0)} درصد کل قطعه، از یک درخت. آنچه اینجا تمام می‌شود گستره تاج است نه ارتفاع، و هر گونه‌ای که منبعش گستره منتشر کرده، مساحت پلانی تاج بالغ خود را همراه دارد. سه درخت باغی چنین نیستند: در درخت میوه گستره نهایی را پایه و هرس تعیین می‌کند، پس اینجا به‌جای تخمین، منتشر نشده و پرسشی برای نهالستان است.`,
      },
    },
  };

  // The cold test, stated once as a rule rather than applied silently per row.
  // A published hardiness limit is a survival threshold, not a performance one,
  // so "marginal" is a real verdict and not a hedge: those species live through
  // an ordinary winter here and lose wood or die in the coldest one on record.
  const MARGIN_C = 2.5;
  const coldVerdict = (species) => {
    const limit = species.hardiness.min_c;
    if (limit === null || limit === undefined) return "unknown";
    const verdict = (limit <= coldest && "pass")
      || (limit <= coldest + MARGIN_C && "marginal")
      || "fail";
    // A contradicted rating cannot come back clean. Downgrading a disputed pass
    // to marginal is the only way the verdict carries the uncertainty the
    // published figure hides, and the contradiction itself ships beside it.
    return species.hardiness.disputed && verdict === "pass" ? "marginal" : verdict;
  };

  const order = { fail: 0, marginal: 1, pass: 2 };
  const weakestOf = (verdicts) => {
    const answered = verdicts.filter((verdict) => verdict && verdict !== "unknown");
    return answered.length
      ? answered.reduce((lowest, entry) => (order[entry] < order[lowest] ? entry : lowest), "pass")
      : "unknown";
  };

  /*
    Will it fruit, asked separately from will it live.

    The bloom test is read off the frost record rather than typed: a species that
    starts flowering before the month the median last frost falls in is failing,
    one that starts in that month is marginal because the frost runs to the end
    of it, and one that starts after the latest frost ever recorded is clear. On
    this record that puts March bloom at fail, April at marginal and May at pass —
    but the months come from the data, so a different site moves them.
  */
  const medianFrostMonth = monthOf(lastFrost.last_spring_frost.median);
  const latestFrostMonth = monthOf(lastFrost.last_spring_frost.latest);
  const bloomFrostVerdict = (fruit) => {
    if (!fruit.bloom_months) return "unknown";
    const start = fruit.bloom_months[0];
    if (start < medianFrostMonth) return "fail";
    if (start <= latestFrostMonth) return "marginal";
    return "pass";
  };

  // Self-fertility is a site constraint here and not a horticultural footnote.
  // A self-sterile species needs a second tree with overlapping bloom, and on
  // 487 m² with a house, a platform and two road benches, the second crown is
  // the thing there is no room for. "fail" means one tree of this species
  // flowers and sets nothing — not that the species cannot fruit.
  const POLLINATION = { yes: "pass", partial: "marginal", no: "fail" };

  const images = readImageManifest();

  const evaluated = SPECIES.map((species) => {
    const spread = species.crown_spread_m ? species.crown_spread_m[1] : null;
    const crownArea = spread === null ? null : round(Math.PI * (spread / 2) ** 2, 0);
    const tests = {
      cold: coldVerdict(species),
      drought: species.tests.drought,
      soil: species.tests.soil,
      exposure: species.tests.exposure,
    };
    // The overall verdict is the weakest test that actually has an answer, never
    // an average: a tree that freezes is not rescued by tolerating lime. A test
    // the sources are silent on is reported as untested rather than folded in as
    // either a pass or a failure.
    const weakest = weakestOf(Object.values(tests));
    // Cold is the binding constraint on this site, so an unanswered cold test
    // cannot leave a clean pass standing. The other three can be untested and
    // still leave a usable verdict; that one cannot.
    const verdict = tests.cold === "unknown" && weakest === "pass" ? "marginal" : weakest;

    // The crop verdict is capped by the survival verdict, so the page can never
    // promise fruit from a tree it has just said will not live.
    const cropTests = species.fruit
      ? {
        bloom_frost: bloomFrostVerdict(species.fruit),
        pollination: POLLINATION[species.fruit.self_fertile] ?? "unknown",
      }
      : null;
    const cropVerdict = cropTests
      ? weakestOf([verdict, ...Object.values(cropTests)])
      : null;

    return {
      ...species,
      tests,
      verdict,
      untested: Object.entries(tests)
        .filter(([, entry]) => entry === "unknown")
        .map(([id]) => id),
      ...(cropTests ? { crop_tests: cropTests, crop_verdict: cropVerdict } : {}),
      crown_plan_area_m2: crownArea,
      crown_share_of_parcel_percent: crownArea === null
        ? null
        : round(crownArea / site.verified_area_m2 * 100, 0),
      hardiness_zone_containing_limit: species.hardiness.min_c === null
        ? null
        : zoneFor(species.hardiness.min_c),
      ...(images.get(species.id) ?? {}),
    };
  });

  const rank = { pass: 0, marginal: 1, unknown: 2, fail: 3 };
  evaluated.sort((first, second) => (
    rank[first.verdict] - rank[second.verdict]
    || first.latin.localeCompare(second.latin)
  ));

  const fruiting = evaluated.filter((species) => species.fruit);
  const cropsCleanly = fruiting.filter((species) => species.crop_verdict === "pass");
  const springOnly = fruiting.filter((species) => species.crop_tests.bloom_frost === "pass");
  const needsPartner = fruiting.filter((species) => species.crop_tests.pollination === "fail");

  return {
    status: "preliminary-inference",
    confidence: "published-horticultural-sources",
    title: { en: "Trees and planting", fa: "درختان و کاشت" },
    purpose: {
      en: "A shortlist of trees for this parcel — for shade, and for fruit — each tested against the conditions this location is already measured or mapped for, with the sources it was drawn from. It is a shortlist to take to a nursery and an agricultural extension office, not a landscape design. Scope is deliberately trees only: the vines, shrubs, grasses and groundcover are a separate question. Grape is named under \"ask locally\" for that reason rather than left out, and the cover that holds a 38% cut face is what the erosion finding actually calls for — nothing in the bundled evidence supports naming a species for it here.",
      fa: "فهرست کوتاهی از درختان این قطعه — برای سایه و برای میوه — هر یک آزموده در برابر شرط‌هایی که این موقعیت پیش‌تر برای آن‌ها اندازه‌گیری یا نقشه‌برداری شده، همراه با منابعی که از آن‌ها برگرفته شده است. این فهرستی است برای بردن به نهالستان و مرکز جهاد کشاورزی، نه طرح محوطه. دامنه آگاهانه فقط درختان است: مو، درختچه، چمن و پوشش زمینی پرسشی جداگانه‌اند. انگور به همین دلیل زیر «از محلی‌ها بپرسید» نام برده شده نه حذف، و پوششی که جبهه برش ۳۸ درصدی را نگه می‌دارد همان چیزی است که یافته فرسایش واقعاً می‌خواهد — هیچ‌یک از شواهد همراه نام‌بردن گونه‌ای برای آن را اینجا پشتیبانی نمی‌کند.",
    },
    client_reported_note: {
      en: "Three species carry a \"grown here\" mark because you named them as doing well in the area: cherry, mulberry and walnut. That is recorded and shown, and it is deliberately not treated as a source — it cannot answer a test or change a verdict. It is worth taking seriously all the same: the Quercus brantii entry below is a published figure being plainly wrong about a tree that grows on these hills unwatered.",
      fa: "سه گونه نشان «اینجا کاشته می‌شود» دارند چون شما آن‌ها را به‌عنوان گونه‌هایی که در منطقه خوب می‌دهند نام بردید: گیلاس، توت و گردو. این ثبت و نمایش داده شده و آگاهانه منبع شمرده نمی‌شود — نمی‌تواند آزمونی را پاسخ دهد یا حکمی را عوض کند. با این حال جدی گرفتنش می‌ارزد: مدخل بلوط ایرانی در ادامه، عددی منتشرشده است که آشکارا درباره درختی که بی‌آبیاری روی همین تپه‌ها می‌روید اشتباه می‌کند.",
    },
    headline: {
      en: `Fast, tall and densely shading is available here. Unirrigated is not: June to September bring ${summerPrecipitation} mm of rain between them. Every fast shade tree on this list is a watered tree for its whole life, and that is a decision about the water supply before it is a decision about species.`,
      fa: faT`سریع، بلند و پرسایه اینجا در دسترس است. بی‌آبیاری در دسترس نیست: خرداد تا شهریور در مجموع ${summerPrecipitation} میلی‌متر باران دارد. هر درخت سایه‌انداز سریع‌رشد در این فهرست تا پایان عمرش درخت آبیاری‌شده است، و این پیش از آنکه تصمیمی درباره گونه باشد، تصمیمی درباره منبع آب است.`,
    },
    constraints,
    fruit: {
      status: "preliminary-inference",
      count: fruiting.length,
      crops_cleanly: cropsCleanly.length,
      clear_of_the_frost_window: springOnly.length,
      needs_a_pollination_partner: needsPartner.length,
      headline: {
        en: `${fruiting.length} of the trees below are grown for a crop as well as for shade, and the record on this page reorders them completely. Winter hardiness is not what limits fruit here — spring frost is. The last night at or below 0 °C falls on ${enDate(lastFrost.last_spring_frost.median)} in a median year and has been recorded as late as ${enDate(lastFrost.last_spring_frost.latest)}, while a flower at full bloom loses buds from about −2.2 °C. Only ${springOnly.length} of the ${fruiting.length} flower after the latest frost in the record. And ${needsPartner.length} cannot set fruit from a single tree at all, which on 487 m² with a house on it is a question about room, not about horticulture.`,
        fa: faT`${fruiting.length} درخت از فهرست زیر علاوه بر سایه برای محصول هم کاشته می‌شوند و رکورد همین صفحه ترتیبشان را کاملاً عوض می‌کند. آنچه میوه را اینجا محدود می‌کند مقاومت زمستانی نیست — یخبندان بهاره است. آخرین شب با دمای صفر یا کمتر در سال میانه در ${faDate(lastFrost.last_spring_frost.median)} می‌افتد و تا ${faDate(lastFrost.last_spring_frost.latest)} هم ثبت شده، در حالی که گل در تمام‌گلی از حدود منفی ۲٫۲ درجه جوانه از دست می‌دهد. فقط ${springOnly.length} از ${fruiting.length} گونه پس از دیرترین یخبندان رکورد گل می‌دهند. و ${needsPartner.length} گونه به‌هیچ‌وجه از یک درخت تنها میوه نمی‌بندند، که روی ۴۸۷ مترمربع با یک ساختمان بر آن پرسشی درباره جا است، نه درباره باغبانی.`,
      },
      test_rule: {
        en: `Two tests, both separate from the survival verdict, and a crop verdict that can never be better than it. The bloom test compares the month a species starts flowering against the frost record: flowering before ${enDate(lastFrost.last_spring_frost.median)} fails, flowering inside the month that holds the latest recorded frost (${enDate(lastFrost.last_spring_frost.latest)}) is marginal, and flowering after it passes. The pollination test asks whether one tree can set fruit alone — self-fertile passes, partially self-fertile is marginal, self-sterile fails, and "fails" means one tree flowers and sets nothing, not that the species cannot fruit. Where a bud-kill temperature is published for the fruit it is shown on the card; it is a bud-stage figure from an extension table, not a hardiness rating, and it does not exist for walnut, mulberry, fig, quince, almond or pomegranate.`,
        fa: faT`دو آزمون، هر دو جدا از حکم بقا، و حکم محصولی که هرگز نمی‌تواند بهتر از آن باشد. آزمون گلدهی ماه شروع گل‌دادن گونه را با رکورد یخبندان مقایسه می‌کند: گلدهی پیش از ${faDate(lastFrost.last_spring_frost.median)} رد است، گلدهی درون ماهی که دیرترین یخبندان ثبت‌شده (${faDate(lastFrost.last_spring_frost.latest)}) در آن است مرزی است، و گلدهی پس از آن قبول. آزمون گرده‌افشانی می‌پرسد آیا یک درخت تنها می‌تواند میوه ببندد — خودبارور قبول، نیمه‌خودبارور مرزی، خودناسازگار رد، و «رد» یعنی یک درخت گل می‌دهد و چیزی نمی‌بندد، نه اینکه گونه نمی‌تواند میوه بدهد. جایی که دمای تلفات جوانه برای میوه‌ای منتشر شده روی کارت نشان داده می‌شود؛ این عددی برای مرحله جوانه از جدول ترویجی است، نه رده مقاومت به سرما، و برای گردو، توت، انجیر، به، بادام و انار وجود ندارد.`,
      },
      irrigation_note: {
        en: "Nothing changes about the water. A fruit tree is a shade tree that also has to fill fruit through July and August, which is the driest part of a rainless summer, and a tree short of water at that point drops the crop before it drops leaves. The register still publishes no irrigation quantity: that needs a soil test, a species list and a water source.",
        fa: "درباره آب چیزی عوض نمی‌شود. درخت میوه همان درخت سایه است که باید در تیر و مرداد میوه را هم پر کند، و آن خشک‌ترین بخش تابستانی بی‌باران است، و درختی که در آن نقطه کم‌آب باشد پیش از آنکه برگ بریزد محصول را می‌ریزد. این فهرست باز هم هیچ مقدار آبیاری منتشر نمی‌کند: آن به آزمایش خاک، فهرست گونه و منبع آب نیاز دارد.",
      },
      position_note: {
        en: "The one defence against spring frost that costs nothing is position, and it points the opposite way to everything else on this page. Cold air drains downhill and pools on the low ground on a still night, so the downhill north-east end — the cheapest place to put a large shade crown, and where the illustrative trees stand in the 3D study — is the worst place to put a flower bud. Fruit goes high and open on this parcel; shade goes low.",
        fa: "تنها دفاع بی‌هزینه در برابر یخبندان بهاره موقعیت است و جهتش خلاف هر چیز دیگر این صفحه است. هوای سرد سراشیب را پایین می‌رود و در شب آرام روی زمین پست جمع می‌شود، پس انتهای پایین شمال‌شرقی — کم‌هزینه‌ترین جای گذاشتن تاج سایه‌انداز بزرگ و جایی که درختان نمایشی مطالعه سه‌بعدی می‌ایستند — بدترین جای گذاشتن جوانه گل است. میوه در این قطعه بالا و باز می‌رود؛ سایه پایین.",
      },
      no_yield_note: {
        en: "No yield figure appears anywhere in this section, and none can be derived from it. Kilograms per tree depend on cultivar, rootstock, age, pruning, pollination, irrigation and the frost that year, and this register knows the cultivar of nothing.",
        fa: "هیچ عدد عملکردی در این بخش نیامده و از آن هم استخراج‌پذیر نیست. کیلوگرم در درخت به رقم، پایه، سن، هرس، گرده‌افشانی، آبیاری و یخبندان همان سال بستگی دارد و این فهرست رقم هیچ‌چیز را نمی‌داند.",
      },
    },
    test_rule: {
      en: `Each species is tested against every constraint and its overall verdict is its weakest single test, never an average — a tree that freezes is not rescued by tolerating lime. The cold test compares the species' published hardiness limit against the ${coldest} °C on record: at or below it passes, within ${MARGIN_C} °C above it is marginal, warmer than that fails. "Marginal" means the tree lives through an ordinary winter here and loses wood or dies in the coldest one in thirty years.`,
      fa: faT`هر گونه در برابر همه قیدها آزموده می‌شود و حکم کلی آن ضعیف‌ترین آزمون تک آن است، هرگز میانگین — درختی که یخ می‌زند با تحمل آهک نجات نمی‌یابد. آزمون سرما حد مقاومت منتشرشده گونه را با ${coldest} درجه ثبت‌شده مقایسه می‌کند: برابر یا کمتر قبول، تا ${MARGIN_C} درجه بالاتر مرزی، گرم‌تر از آن رد. «مرزی» یعنی درخت زمستان معمولی را می‌گذراند و در سردترین زمستان سی سال چوب از دست می‌دهد یا می‌میرد.`,
    },
    verdict_legend: {
      pass: {
        en: "Clears every constraint the sources answer for",
        fa: "همه قیدهایی را که منابع پاسخ می‌دهند می‌گذراند",
      },
      marginal: {
        en: "One constraint is close, contested, or met only conditionally",
        fa: "یک قید نزدیک، مورد اختلاف یا فقط مشروط برآورده است",
      },
      fail: {
        en: "A published figure puts it outside a constraint",
        fa: "عددی منتشرشده آن را بیرون از یک قید می‌گذارد",
      },
      unknown: {
        en: "The sources do not answer",
        fa: "منابع پاسخ نمی‌دهند",
      },
    },
    hardiness_derivation: {
      en: `Where a source states a temperature, that number is used. Where it gives only a USDA zone range, the figure is the warm edge of its coldest zone — zone 5 becomes −26.1 °C, not −28.9 °C — which is the conservative reading of a band. Derived values are marked as derived in the data.`,
      fa: faT`جایی که منبع دما را صریح گفته، همان عدد به کار رفته است. جایی که فقط بازه پهنه USDA داده، عدد لبه گرم سردترین پهنه آن است — پهنه ۵ منفی ۲۶٫۱ درجه می‌شود نه منفی ۲۸٫۹ — که خوانش محافظه‌کارانه یک باند است. مقادیر استخراجی در داده‌ها با نشان derived مشخص شده‌اند.`,
    },
    species: evaluated,
    // The refused and unrated entries carry photographs on the same terms as the
    // shortlist: recognising the tree is the whole use of the picture, and it
    // matters most where the answer is no.
    do_not_plant: DO_NOT_PLANT.map((entry) => ({ ...entry, ...(images.get(entry.id) ?? {}) })),
    ask_locally: ASK_LOCALLY.map((entry) => ({ ...entry, ...(images.get(entry.id) ?? {}) })),
    placement: buildPlacement(solar, wind),
    care: CARE,
    image_credit_note: {
      en: "Photographs are bundled from Wikipedia article lead images under free licences, with the author and licence recorded beside each one. A file whose licence could not be verified ships no photograph rather than an unlicensed one.",
      fa: "عکس‌ها از تصویر شاخص مقاله‌های ویکی‌پدیا با پروانه آزاد همراه بسته شده‌اند و نام پدیدآور و پروانه در کنار هر یک ثبت شده است. فایلی که پروانه‌اش تأیید نشده، بی‌عکس منتشر می‌شود نه با عکس بی‌پروانه.",
    },
    limitations: {
      en: "Every figure in this section is from a published horticultural or botanical source, not from this site. No bundled source records a single plant growing on this parcel; the soil has not been sampled; frost pockets, exposure at this exact bench and the depth of soil over rock are all unknown until someone stands on it. Nursery availability and stock quality in Kermanshah province are not verified here either, and they usually decide the final list. Treat this as the question to ask a local nursery, and confirm species choice and planting season with an agricultural extension office before buying anything.",
      fa: "هر عدد این بخش از منبعی منتشرشده در باغبانی یا گیاه‌شناسی است، نه از این سایت. هیچ منبع همراهی رشد حتی یک گیاه را در این قطعه ثبت نکرده؛ خاک نمونه‌برداری نشده؛ حوضچه‌های سرما، مواجهه در همین سکو و عمق خاک روی سنگ تا وقتی کسی روی زمین نایستد ناشناخته‌اند. موجودی و کیفیت نهال در استان کرمانشاه هم اینجا بررسی نشده و معمولاً همان فهرست نهایی را تعیین می‌کند. این را پرسشی بدانید که باید از نهالستان محلی پرسید و پیش از خرید، انتخاب گونه و فصل کاشت را با مرکز جهاد کشاورزی تأیید کنید.",
    },
    illustrative_planting_note: {
      en: "The four trees in the 3D sun study are illustrative geometry sized to cast a shadow of building height. They are deliberately not tied to any species named here: giving them a species would turn a placeholder into a planting proposal.",
      fa: "چهار درخت مطالعه خورشیدی سه‌بعدی، هندسه نمایشی‌اند که برای انداختن سایه‌ای در ارتفاع ساختمان اندازه‌گذاری شده‌اند. آن‌ها آگاهانه به هیچ‌یک از گونه‌های نام‌برده اینجا گره نخورده‌اند: دادن گونه به آن‌ها یک جانگهدار را به پیشنهاد کاشت تبدیل می‌کند.",
    },
    sources: REGISTER_SOURCES,
  };
}
