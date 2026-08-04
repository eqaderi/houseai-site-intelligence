import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decimalHourLabel,
  solarDay as solarDayFor,
  solarPosition as solarPositionAt,
} from "./solar-math.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, "..");
const rawDir = path.join(dashboardDir, "assets/data/environmental/raw");

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(rawDir, name), "utf8"));
const round = (value, digits = 2) => Number(value.toFixed(digits));
const mean = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const valid = (value) => Number.isFinite(value) && value > -900;
const bi = (en, fa) => ({ en, fa });

export const siteGeolocation = {
  latitude: 34.97131638,
  longitude: 46.35559359,
  utm: {
    epsg: "EPSG:32638",
    zone: 38,
    hemisphere: "N",
    datum: "WGS 84",
  },
  timezone: "Asia/Tehran",
  utc_offset_hours: 3.5,
  confidence: "strong-probable",
  certification: "not-surveyor-certified",
};

export function utmToWgs84(easting, northing, zone = 38) {
  const a = 6378137;
  const eccentricity = 0.08181919084262149;
  const eccentricityPrimeSquared = 0.006739496742276434;
  const scale = 0.9996;
  const x = easting - 500000;
  const y = northing;
  const longitudeOrigin = (zone - 1) * 6 - 180 + 3;
  const meridionalArc = y / scale;
  const mu = meridionalArc
    / (a * (1 - eccentricity ** 2 / 4 - 3 * eccentricity ** 4 / 64 - 5 * eccentricity ** 6 / 256));
  const e1 = (1 - Math.sqrt(1 - eccentricity ** 2))
    / (1 + Math.sqrt(1 - eccentricity ** 2));
  const footprintLatitude = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + 151 * e1 ** 3 / 96 * Math.sin(6 * mu)
    + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const c1 = eccentricityPrimeSquared * Math.cos(footprintLatitude) ** 2;
  const t1 = Math.tan(footprintLatitude) ** 2;
  const n1 = a / Math.sqrt(1 - eccentricity ** 2 * Math.sin(footprintLatitude) ** 2);
  const r1 = a * (1 - eccentricity ** 2)
    / (1 - eccentricity ** 2 * Math.sin(footprintLatitude) ** 2) ** 1.5;
  const d = x / (n1 * scale);
  const latitude = footprintLatitude - (n1 * Math.tan(footprintLatitude) / r1) * (
    d ** 2 / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccentricityPrimeSquared) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccentricityPrimeSquared - 3 * c1 ** 2)
      * d ** 6 / 720
  );
  const longitude = (
    d
    - (1 + 2 * t1 + c1) * d ** 3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccentricityPrimeSquared + 24 * t1 ** 2)
      * d ** 5 / 120
  ) / Math.cos(footprintLatitude);
  return {
    latitude: round(latitude * 180 / Math.PI, 8),
    longitude: round(longitudeOrigin + longitude * 180 / Math.PI, 8),
  };
}

function haversineKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radiusKm = 6371.0088;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLatitude = toRadians(latitudeB - latitudeA);
  const dLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(dLatitude / 2) ** 2
    + Math.cos(toRadians(latitudeA))
      * Math.cos(toRadians(latitudeB))
      * Math.sin(dLongitude / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const climateRaw = readJson("openmeteo-era5land-daily-1991-2020.json");
const powerRaw = readJson("nasa-power-climatology-2001-2020.json");
const windRaw = readJson("openmeteo-era5land-wind-hourly-2011-2020.json");
const earthquakesRaw = readJson("usgs-earthquakes-m45-200km-1900-2026.json");
const nominatimRaw = readJson("osm-nominatim-reverse.json");
const soilRaw = readJson("isric-soilgrids-site.json");
const geologyRaw = readJson("macrostrat-geology-site.json");
const futureEcBaseline = readJson("cmip6-ec-earth3p-hr-2001-2020.json");
const futureEc = readJson("cmip6-ec-earth3p-hr-2031-2050.json");
const futureMpiBaseline = readJson("cmip6-mpi-esm1-2-xr-2001-2020.json");
const futureMpi = readJson("cmip6-mpi-esm1-2-xr-2031-2050.json");

const monthKeys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const monthLabels = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  fa: ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"],
};

// Chart-axis forms. The English names are already three characters; the Persian
// ones are full words, and the chart used to slice them to three characters,
// which cut mid-word and changed the final letter's contextual form. Persian
// month numerals are used instead: compact, unambiguous, and never a fragment.
// The full name stays in the table and the tooltip.
const monthLabelsShort = {
  en: monthLabels.en,
  fa: monthLabels.en.map((_, index) => String(index + 1)
    .replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])),
};
const power = powerRaw.properties.parameter;
const daily = climateRaw.daily;
const yearsInClimateRecord = new Set(daily.time.map((date) => date.slice(0, 4))).size;

const monthlyBuckets = Array.from({ length: 12 }, () => ({
  temperatureMean: [],
  temperatureMax: [],
  temperatureMin: [],
  precipitation: [],
  rain: [],
  snowfall: [],
  radiation: [],
  sunshine: [],
  frost: 0,
  hot: 0,
  days: 0,
}));

daily.time.forEach((date, index) => {
  const month = Number(date.slice(5, 7)) - 1;
  const bucket = monthlyBuckets[month];
  const fields = {
    temperatureMean: daily.temperature_2m_mean[index],
    temperatureMax: daily.temperature_2m_max[index],
    temperatureMin: daily.temperature_2m_min[index],
    precipitation: daily.precipitation_sum[index],
    rain: daily.rain_sum[index],
    snowfall: daily.snowfall_sum[index],
    radiation: daily.shortwave_radiation_sum[index],
    sunshine: daily.sunshine_duration[index],
  };
  for (const [key, value] of Object.entries(fields)) {
    if (valid(value)) bucket[key].push(value);
  }
  if (valid(fields.temperatureMin) && fields.temperatureMin < 0) bucket.frost += 1;
  if (valid(fields.temperatureMax) && fields.temperatureMax >= 30) bucket.hot += 1;
  bucket.days += 1;
});

const monthlyClimate = monthlyBuckets.map((bucket, month) => ({
  month: month + 1,
  label: bi(monthLabels.en[month], monthLabels.fa[month]),
  label_short: bi(monthLabelsShort.en[month], monthLabelsShort.fa[month]),
  temperature_mean_c: round(mean(bucket.temperatureMean), 1),
  temperature_max_c: round(mean(bucket.temperatureMax), 1),
  temperature_min_c: round(mean(bucket.temperatureMin), 1),
  precipitation_mm: round(sum(bucket.precipitation) / yearsInClimateRecord, 1),
  rainfall_mm: round(sum(bucket.rain) / yearsInClimateRecord, 1),
  snowfall_cm: round(sum(bucket.snowfall) / yearsInClimateRecord, 1),
  relative_humidity_percent: round(power.RH2M[monthKeys[month]], 1),
  solar_radiation_kwh_m2_day: round(power.ALLSKY_SFC_SW_DWN[monthKeys[month]], 2),
  clear_sky_radiation_kwh_m2_day: round(power.CLRSKY_SFC_SW_DWN[monthKeys[month]], 2),
  cloud_cover_percent: round(power.CLOUD_AMT[monthKeys[month]], 1),
  sunshine_hours_day: round(mean(bucket.sunshine) / 3600, 1),
  frost_days: round(bucket.frost / yearsInClimateRecord, 1),
  hot_days_ge_30c: round(bucket.hot / yearsInClimateRecord, 1),
}));

const allMax = daily.temperature_2m_max.filter(valid);
const allMin = daily.temperature_2m_min.filter(valid);
const allPrecipitation = daily.precipitation_sum.filter(valid);
const allGusts = daily.wind_gusts_10m_max.filter(valid);
const annualPrecipitation = sum(monthlyClimate.map((month) => month.precipitation_mm));
const annualSnowfall = sum(monthlyClimate.map((month) => month.snowfall_cm));
const annualFrostDays = sum(monthlyClimate.map((month) => month.frost_days));
const annualHotDays = sum(monthlyClimate.map((month) => month.hot_days_ge_30c));
const heatingMonths = monthlyClimate.filter((month) => month.temperature_mean_c < 18).map((month) => month.month);
const coolingMonths = monthlyClimate.filter((month) => month.temperature_mean_c > 22).map((month) => month.month);

function summarizeClimateModel(baseline, future, model) {
  const baselineTemperature = baseline.daily.temperature_2m_mean.filter(valid);
  const futureTemperature = future.daily.temperature_2m_mean.filter(valid);
  const baselinePrecipitation = baseline.daily.precipitation_sum.filter(valid);
  const futurePrecipitation = future.daily.precipitation_sum.filter(valid);
  const baselineYears = new Set(baseline.daily.time.map((date) => date.slice(0, 4))).size;
  const futureYears = new Set(future.daily.time.map((date) => date.slice(0, 4))).size;
  const baselineAnnualPrecipitation = sum(baselinePrecipitation) / baselineYears;
  const futureAnnualPrecipitation = sum(futurePrecipitation) / futureYears;
  return {
    model,
    baseline_period: "2001–2020",
    future_period: "2031–2050",
    mean_temperature_change_c: round(mean(futureTemperature) - mean(baselineTemperature), 1),
    annual_precipitation_change_percent: round(
      ((futureAnnualPrecipitation - baselineAnnualPrecipitation) / baselineAnnualPrecipitation) * 100,
      1,
    ),
  };
}

export const climateEvidence = {
  availability: "available-regional-grid",
  confidence: "regional-data",
  location: siteGeolocation,
  baseline: {
    dataset: "ERA5-Land via Open-Meteo Historical Weather API",
    period: "1991–2020",
    temporal_resolution: "daily",
    spatial_resolution: "0.1° (approximately 11 km)",
    grid_point: {
      latitude: climateRaw.latitude,
      longitude: climateRaw.longitude,
      elevation_m: climateRaw.elevation,
    },
  },
  monthly: monthlyClimate,
  annual: {
    mean_temperature_c: round(mean(daily.temperature_2m_mean.filter(valid)), 1),
    precipitation_mm: round(annualPrecipitation, 0),
    rainfall_mm: round(sum(monthlyClimate.map((month) => month.rainfall_mm)), 0),
    snowfall_cm: round(annualSnowfall, 1),
    frost_days: round(annualFrostDays, 0),
    hot_days_ge_30c: round(annualHotDays, 0),
    solar_radiation_kwh_m2_day: round(power.ALLSKY_SFC_SW_DWN.ANN, 2),
    relative_humidity_percent: round(power.RH2M.ANN, 1),
    cloud_cover_percent: round(power.CLOUD_AMT.ANN, 1),
  },
  extremes_1991_2020: {
    highest_daily_max_c: round(Math.max(...allMax), 1),
    lowest_daily_min_c: round(Math.min(...allMin), 1),
    highest_daily_precipitation_mm: round(Math.max(...allPrecipitation), 1),
    highest_daily_gust_kmh: round(Math.max(...allGusts), 1),
  },
  seasons: {
    heating_months: heatingMonths,
    cooling_months: coolingMonths,
    summary: bi(
      "Long heating season with cold, snow-capable winters; hot, very dry summers create afternoon overheating and water-stress risk.",
      "فصل گرمایش طولانی با زمستان‌های سرد و برف‌پذیر؛ تابستان‌های گرم و بسیار خشک، خطر بیش‌گرمایش بعدازظهر و تنش آبی ایجاد می‌کنند.",
    ),
  },
  classification: {
    label: bi(
      "Mountain Mediterranean pattern: wet/cold winter, hot/dry summer",
      "الگوی مدیترانه‌ای کوهستانی: زمستان مرطوب/سرد و تابستان گرم/خشک",
    ),
    method_note: bi(
      "Descriptive classification from the 1991–2020 monthly record; not a statutory Iranian climate-zone designation.",
      "رده‌بندی توصیفی بر پایه رکورد ماهانه ۱۹۹۱–۲۰۲۰ است و جایگزین پهنه‌بندی قانونی اقلیم ایران نیست.",
    ),
  },
  future: {
    source: "Open-Meteo Climate API; HighResMIP / CMIP6, ERA5-Land statistical downscaling",
    scenario_note: bi(
      "High-resolution models are broadly comparable to a high-emissions pathway before 2050. Use the range, not a single deterministic forecast.",
      "مدل‌های تفکیک‌بالا تا پیش از ۲۰۵۰ تقریباً با مسیر انتشار بالا قابل مقایسه‌اند؛ از دامنه نتایج استفاده شود، نه یک پیش‌بینی قطعی.",
    ),
    models: [
      summarizeClimateModel(futureEcBaseline, futureEc, "EC-Earth3P-HR"),
      summarizeClimateModel(futureMpiBaseline, futureMpi, "MPI-ESM1-2-XR"),
    ],
  },
  limitations: bi(
    "Reanalysis and satellite-assimilated grids are regional estimates, not a weather station on the parcel. Mountain microclimate, wind channeling, snow drifting and horizon shading require local observation.",
    "بازتحلیل و شبکه‌های تلفیقی ماهواره‌ای برآورد منطقه‌ای‌اند، نه ایستگاه هواشناسی داخل ملک. ریزاقلیم کوهستان، کانالیزه‌شدن باد، تجمع برف و سایه افق به مشاهده محلی نیاز دارد.",
  ),
};

const directionNames = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

/**
 * One place for the 16-sector vocabulary. app.js rendered the raw code, so a
 * Persian reader saw a Latin "E" as the prevailing direction, and the compass
 * ticks on three canvases were hardcoded English letters. Full Persian words,
 * not initials: ش is ambiguous between شمال and شرق.
 */
const directionLabels = {
  N: bi("N", "شمال"),
  NNE: bi("NNE", "شمال‌شمال‌شرقی"),
  NE: bi("NE", "شمال‌شرقی"),
  ENE: bi("ENE", "شرق‌شمال‌شرقی"),
  E: bi("E", "شرق"),
  ESE: bi("ESE", "شرق‌جنوب‌شرقی"),
  SE: bi("SE", "جنوب‌شرقی"),
  SSE: bi("SSE", "جنوب‌جنوب‌شرقی"),
  S: bi("S", "جنوب"),
  SSW: bi("SSW", "جنوب‌جنوب‌غربی"),
  SW: bi("SW", "جنوب‌غربی"),
  WSW: bi("WSW", "غرب‌جنوب‌غربی"),
  W: bi("W", "غرب"),
  WNW: bi("WNW", "غرب‌شمال‌غربی"),
  NW: bi("NW", "شمال‌غربی"),
  NNW: bi("NNW", "شمال‌شمال‌غربی"),
};
const speedBinLabels = ["<1", "1–3", "3–5", "5–8", "≥8"];
const windSeasonMonths = {
  annual: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  winter: [12, 1, 2],
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  autumn: [9, 10, 11],
};

function windSummaryForMonths(months) {
  const directions = Array(16).fill(0);
  const speedBins = Array(5).fill(0);
  const speeds = [];
  let calm = 0;
  windRaw.hourly.time.forEach((date, index) => {
    const month = Number(date.slice(5, 7));
    if (!months.includes(month)) return;
    const speed = windRaw.hourly.wind_speed_10m[index] / 3.6;
    const direction = windRaw.hourly.wind_direction_10m[index];
    if (!valid(speed) || !valid(direction)) return;
    speeds.push(speed);
    const directionIndex = Math.round(direction / 22.5) % 16;
    directions[directionIndex] += 1;
    if (speed < 1) {
      speedBins[0] += 1;
      calm += 1;
    } else if (speed < 3) speedBins[1] += 1;
    else if (speed < 5) speedBins[2] += 1;
    else if (speed < 8) speedBins[3] += 1;
    else speedBins[4] += 1;
  });
  const total = speeds.length;
  const orderedSpeeds = [...speeds].sort((a, b) => a - b);
  const prevailingIndex = directions.indexOf(Math.max(...directions));
  return {
    sample_hours: total,
    mean_speed_ms: round(mean(speeds), 1),
    p90_speed_ms: round(orderedSpeeds[Math.floor(orderedSpeeds.length * 0.9)], 1),
    calm_percent: round(calm / total * 100, 1),
    prevailing_direction: directionNames[prevailingIndex],
    prevailing_direction_label: directionLabels[directionNames[prevailingIndex]],
    direction_distribution: directionNames.map((direction, index) => ({
      direction,
      label: directionLabels[direction],
      percent: round(directions[index] / total * 100, 1),
    })),
    speed_distribution: speedBinLabels.map((label, index) => ({
      label_ms: label,
      percent: round(speedBins[index] / total * 100, 1),
    })),
  };
}

export const windEvidence = {
  availability: "available-regional-grid",
  confidence: "regional-data",
  dataset: "ERA5-Land via Open-Meteo Historical Weather API",
  period: "2011–2020",
  height_m: 10,
  temporal_resolution: "hourly",
  spatial_resolution: "0.1° (approximately 11 km)",
  direction_convention: "meteorological direction from which wind blows",
  direction_vocabulary: directionLabels,
  seasons: Object.entries(windSeasonMonths).map(([season, months]) => ({
    season,
    status: "regional-data",
    ...windSummaryForMonths(months),
  })),
  exposure_notes: [
    bi(
      "The regional grid indicates prevailing direction and seasonal speed patterns; the steep local valley may rotate and accelerate wind at parcel scale.",
      "شبکه منطقه‌ای جهت غالب و الگوی سرعت فصلی را نشان می‌دهد؛ دره پرشیب محلی می‌تواند باد را در مقیاس ملک بچرخاند یا شتاب دهد.",
    ),
    bi(
      "Cold-wind and hot-wind design claims should be checked with a temporary on-site anemometer before fixing openings.",
      "ادعاهای طراحی درباره باد سرد یا گرم باید پیش از تثبیت بازشوها با بادسنج موقت در محل کنترل شود.",
    ),
    bi(
      "Dust concentration is not available from this dataset and remains unresolved.",
      "غلظت گردوغبار در این مجموعه‌داده موجود نیست و همچنان حل‌نشده است.",
    ),
  ],
};

// Solar astronomy lives in solar-math.mjs so the horizon module and the
// verification harness can use it without importing this file's raw-data reads.
const solarPosition = (dateString, localClockHour) =>
  solarPositionAt(siteGeolocation, dateString, localClockHour);
// The three season arcs drive a continuous time slider and a playback loop, so
// they are sampled every 10 minutes. The monthly days keep the coarser step:
// nothing interpolates them, they only publish sunrise, sunset and noon figures.
const SEASON_STEP_HOURS = 1 / 6;
const MONTHLY_STEP_HOURS = 0.5;

const seasonDefinitions = [
  ["winter", "2026-12-21", "Winter solstice", "انقلاب زمستانی"],
  ["equinox", "2026-03-20", "March equinox", "اعتدال بهاری"],
  ["summer", "2026-06-21", "Summer solstice", "انقلاب تابستانی"],
];
const solarSeasons = seasonDefinitions.map(([id, date, en, fa]) => ({
  id,
  label: bi(en, fa),
  ...solarDayFor(siteGeolocation, date, SEASON_STEP_HOURS),
}));

/**
 * The slider reads a continuous hour and the runtime linearly interpolates
 * between the two neighbouring samples, so the deviation from the exact NOAA
 * position is a published figure rather than an unstated assumption. Measured
 * here across every sample interval of all three arcs, and rounded upward so
 * the published value is an upper bound. verify-solar-3d.mjs re-derives it.
 */
function interpolationDeviation(seasons) {
  let altitudeError = 0;
  let azimuthError = 0;
  for (const season of seasons) {
    for (let index = 0; index < season.positions.length - 1; index += 1) {
      const from = season.positions[index];
      const to = season.positions[index + 1];
      let sweep = to.azimuth_deg - from.azimuth_deg;
      if (sweep > 180) sweep -= 360;
      if (sweep < -180) sweep += 360;
      for (let fraction = 0.05; fraction < 1; fraction += 0.05) {
        const exact = solarPosition(
          season.date,
          from.clock_hour + fraction * (to.clock_hour - from.clock_hour),
        );
        altitudeError = Math.max(
          altitudeError,
          Math.abs(from.altitude_deg + fraction * (to.altitude_deg - from.altitude_deg)
            - exact.altitude_deg),
        );
        let error = Math.abs(from.azimuth_deg + fraction * sweep - exact.azimuth_deg);
        if (error > 180) error = 360 - error;
        azimuthError = Math.max(azimuthError, error);
      }
    }
  }
  return {
    method: "linear between precomputed samples",
    step_minutes: Math.round(SEASON_STEP_HOURS * 60),
    max_altitude_deviation_deg: Math.ceil(altitudeError * 100) / 100,
    max_azimuth_deviation_deg: Math.ceil(azimuthError * 100) / 100,
  };
}
const monthlySolar = monthKeys.map((_, index) => {
  const date = `2026-${String(index + 1).padStart(2, "0")}-21`;
  return {
    month: index + 1,
    label: bi(monthLabels.en[index], monthLabels.fa[index]),
    ...solarDayFor(siteGeolocation, date, MONTHLY_STEP_HOURS),
    radiation_kwh_m2_day: monthlyClimate[index].solar_radiation_kwh_m2_day,
  };
});

export const solarEvidence = {
  availability: "available-precomputed",
  confidence: "calculated-from-probable-geolocation",
  method: "NOAA fractional-year solar-position equations; season arcs precomputed at 10-minute intervals, monthly days at 30 minutes",
  assumptions: {
    horizon: "DEM-derived terrain horizon (Copernicus GLO-90); see horizon.json",
    atmospheric_refraction: "standard sunrise/sunset zenith 90.833°",
    timezone: siteGeolocation.timezone,
    utc_offset_hours: siteGeolocation.utc_offset_hours,
    obstructions: "not modelled",
  },
  controls: {
    seasons: solarSeasons.map((season) => season.id),
    times: "precomputed 10-minute local-clock steps, linearly interpolated between them",
    interpolation: interpolationDeviation(solarSeasons),
    test_objects: [
      { id: "pole", height_m: 2, label: bi("2 m pole", "میله ۲ متری") },
      { id: "wall", height_m: 3, label: bi("3 m wall", "دیوار ۳ متری") },
      { id: "generic-volume", height_m: 3, label: bi("3 m test volume", "حجم آزمایشی ۳ متری") },
    ],
    overlays: ["property-boundary", "contours"],
    enabled: true,
  },
  seasons: solarSeasons,
  monthly: monthlySolar,
  design_summary: {
    winter: bi(
      "Low southern winter sun offers useful gain, and the measured terrain horizon leaves it available; preserve controlled southern exposure.",
      "خورشید کم‌ارتفاع جنوبی زمستان فرصت بهره حرارتی دارد؛ در صورت اجازه افق واقعی، مواجهه کنترل‌شده جنوبی حفظ شود.",
    ),
    summer: bi(
      "High summer sun is readily shaded at noon, while west and southwest afternoon sun remains the overheating priority.",
      "خورشید بلند تابستان در ظهر به‌راحتی سایه می‌شود؛ تابش عصرگاهی غرب و جنوب‌غرب اولویت کنترل بیش‌گرمایش است.",
    ),
  },
  warning: bi(
    "Sun positions are astronomical and the horizon is DEM-derived. Neither is a surveyed horizon, and neighbouring buildings are not modelled.",
    "این ابزار مسیر نجومی خورشید/سایه است، نه شبیه‌سازی افق برداشت‌شده یا سایه‌اندازی بین ساختمان‌ها.",
  ),
};

const earthquakeFeatures = earthquakesRaw.features.map((feature) => {
  const [longitude, latitude, depthKm] = feature.geometry.coordinates;
  return {
    id: feature.id,
    date: new Date(feature.properties.time).toISOString().slice(0, 10),
    magnitude: feature.properties.mag,
    place: feature.properties.place,
    latitude,
    longitude,
    depth_km: depthKm,
    distance_km: haversineKm(
      siteGeolocation.latitude,
      siteGeolocation.longitude,
      latitude,
      longitude,
    ),
    url: feature.properties.url,
  };
}).sort((a, b) => a.date.localeCompare(b.date));
const strongestEarthquake = [...earthquakeFeatures].sort((a, b) => b.magnitude - a.magnitude)[0];
const nearestM5 = [...earthquakeFeatures]
  .filter((event) => event.magnitude >= 5)
  .sort((a, b) => a.distance_km - b.distance_km)[0];

function soilLayer(name) {
  const layer = soilRaw.properties.layers.find((item) => item.name === name);
  const divisor = layer.unit_measure.d_factor;
  return layer.depths.map((depth) => ({
    depth: depth.label,
    mean: round(depth.values.mean / divisor, 2),
    q05: round(depth.values["Q0.05"] / divisor, 2),
    q95: round(depth.values["Q0.95"] / divisor, 2),
    unit: layer.unit_measure.target_units,
  }));
}

const geologyUnit = geologyRaw.success.data[0];

export const hazardEvidence = {
  seismic: {
    status: "regional-data",
    query: "USGS catalog; M≥4.5; radius 200 km; 1900-01-01 to 2026-07-30",
    counts: {
      within_50_km: earthquakeFeatures.filter((event) => event.distance_km <= 50).length,
      within_100_km: earthquakeFeatures.filter((event) => event.distance_km <= 100).length,
      within_200_km: earthquakeFeatures.length,
    },
    strongest: {
      ...strongestEarthquake,
      distance_km: round(strongestEarthquake.distance_km, 1),
    },
    nearest_m5_or_greater: {
      ...nearestM5,
      distance_km: round(nearestM5.distance_km, 1),
    },
    finding: bi(
      `The regional catalog contains ${earthquakeFeatures.length} M≥4.5 events within 200 km; the strongest is M${strongestEarthquake.magnitude.toFixed(1)} at about ${round(strongestEarthquake.distance_km, 0)} km. Structural design requires the applicable Iranian code spectrum and a geotechnical site class.`,
      `فهرست منطقه‌ای شامل ${earthquakeFeatures.length} رخداد با بزرگی ۴٫۵ یا بیشتر در شعاع ۲۰۰ کیلومتر است؛ قوی‌ترین رخداد با بزرگی ${strongestEarthquake.magnitude.toFixed(1)} در فاصله تقریبی ${round(strongestEarthquake.distance_km, 0)} کیلومتر بوده است. طراحی سازه به طیف آیین‌نامه‌ای ایران و رده خاک ژئوتکنیکی نیاز دارد.`,
    ),
  },
  geology: {
    status: "regional-data",
    unit: geologyUnit.strat_name,
    age: geologyUnit.best_int_name,
    description: geologyUnit.descrip,
    source_scale: "1:1,000,000",
    finding: bi(
      "Regional mapping identifies the undivided Bangestan Group—mainly Cretaceous limestone and shale. Outcrop, weathering, bedding and discontinuities at the parcel remain unverified.",
      "نقشه‌برداری منطقه‌ای گروه تفکیک‌نشده بنگستان را—عمدتاً سنگ‌آهک و شیل کرتاسه—نشان می‌دهد. رخنمون، هوازدگی، لایه‌بندی و درزه‌ها در خود ملک تأیید نشده‌اند.",
    ),
  },
  soils: {
    status: "regional-data",
    spatial_resolution: "250 m",
    clay: soilLayer("clay"),
    sand: soilLayer("sand"),
    silt: soilLayer("silt"),
    ph: soilLayer("phh2o"),
    bulk_density: soilLayer("bdod"),
    organic_carbon: soilLayer("soc"),
    finding: bi(
      `SoilGrids suggests a fine-textured topsoil near ${soilLayer("clay")[0].mean}% clay, ${soilLayer("silt")[0].mean}% silt and ${soilLayer("sand")[0].mean}% sand, but uncertainty is wide and mapped soil cannot establish bearing capacity or fill quality.`,
      `SoilGrids خاک سطحی ریزدانه‌ای با حدود ${soilLayer("clay")[0].mean}٪ رس، ${soilLayer("silt")[0].mean}٪ سیلت و ${soilLayer("sand")[0].mean}٪ ماسه پیشنهاد می‌کند؛ اما عدم‌قطعیت زیاد است و خاک نقشه‌ای ظرفیت باربری یا کیفیت خاک‌ریزی را تعیین نمی‌کند.`,
    ),
  },
};

function decodeXml(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&#10;", " ");
}

function parseTags(body) {
  const tags = {};
  const tagPattern = /<tag k="([^"]+)" v="([^"]*)"\s*\/>/g;
  for (const match of body.matchAll(tagPattern)) tags[decodeXml(match[1])] = decodeXml(match[2]);
  return tags;
}

function parseOsm() {
  const xml = fs.readFileSync(path.join(rawDir, "openstreetmap-5km.xml"), "utf8");
  const nodes = new Map();
  const attribute = (attributes, name) => {
    const match = attributes.match(new RegExp(`${name}="([^"]+)"`));
    return match?.[1] ?? null;
  };
  const nodePattern = /<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g;
  for (const match of xml.matchAll(nodePattern)) {
    const id = attribute(match[1], "id");
    nodes.set(id, {
      id,
      latitude: Number(attribute(match[1], "lat")),
      longitude: Number(attribute(match[1], "lon")),
      tags: parseTags(match[2] || ""),
    });
  }
  const ways = [];
  const wayPattern = /<way id="([^"]+)"[^>]*>([\s\S]*?)<\/way>/g;
  for (const match of xml.matchAll(wayPattern)) {
    const refs = [...match[2].matchAll(/<nd ref="([^"]+)"\s*\/>/g)].map((item) => item[1]);
    const coordinates = refs.map((ref) => nodes.get(ref)).filter(Boolean);
    const tags = parseTags(match[2]);
    if (coordinates.length < 2) continue;
    ways.push({
      id: match[1],
      tags,
      coordinates: coordinates.map((node) => [node.longitude, node.latitude]),
    });
  }
  return { nodes: [...nodes.values()], ways };
}

const osm = parseOsm();
const contextBounds = {
  west: 46.3008,
  south: 34.9264,
  east: 46.4104,
  north: 35.0162,
};
const inContextBounds = ([longitude, latitude]) => (
  longitude >= contextBounds.west
  && longitude <= contextBounds.east
  && latitude >= contextBounds.south
  && latitude <= contextBounds.north
);
const roadWays = osm.ways
  .filter((way) => way.tags.highway && way.coordinates.some(inContextBounds))
  .map((way) => ({
    id: way.id,
    class: way.tags.highway,
    name: way.tags["name:en"] || way.tags.name || null,
    coordinates: way.coordinates.filter((coordinate) => (
      coordinate[0] >= contextBounds.west - 0.01
      && coordinate[0] <= contextBounds.east + 0.01
      && coordinate[1] >= contextBounds.south - 0.01
      && coordinate[1] <= contextBounds.north + 0.01
    )),
  }))
  .filter((way) => way.coordinates.length >= 2);
const waterWays = osm.ways
  .filter((way) => (way.tags.waterway || way.tags.natural === "water") && way.coordinates.some(inContextBounds))
  .map((way) => ({
    id: way.id,
    class: way.tags.waterway || "water",
    name: way.tags["name:en"] || way.tags.name || null,
    coordinates: way.coordinates.filter((coordinate) => (
      coordinate[0] >= contextBounds.west - 0.01
      && coordinate[0] <= contextBounds.east + 0.01
      && coordinate[1] >= contextBounds.south - 0.01
      && coordinate[1] <= contextBounds.north + 0.01
    )),
  }))
  .filter((way) => way.coordinates.length >= 2);
const places = osm.nodes
  .filter((node) => node.tags.place && (node.tags.name || node.tags["name:en"]))
  .map((node) => ({
    name: node.tags["name:en"] || node.tags.name,
    name_local: node.tags.name || null,
    type: node.tags.place,
    latitude: node.latitude,
    longitude: node.longitude,
    distance_km: round(haversineKm(
      siteGeolocation.latitude,
      siteGeolocation.longitude,
      node.latitude,
      node.longitude,
    ), 1),
  }))
  .sort((a, b) => a.distance_km - b.distance_km);
const naturalPoints = osm.nodes
  .filter((node) => ["peak", "spring", "saddle"].includes(node.tags.natural))
  .map((node) => ({
    name: node.tags["name:en"] || node.tags.name || node.tags.natural,
    type: node.tags.natural,
    elevation_m: Number(node.tags.ele) || null,
    latitude: node.latitude,
    longitude: node.longitude,
    distance_km: round(haversineKm(
      siteGeolocation.latitude,
      siteGeolocation.longitude,
      node.latitude,
      node.longitude,
    ), 1),
  }))
  .sort((a, b) => a.distance_km - b.distance_km);

export const geographyEvidence = {
  availability: "available-probable-geolocation",
  confidence: "strong-probable",
  confirmed_location: {
    en: "Baneh Verdeh, Bayangan District, Paveh County, Kermanshah Province, Iran",
    fa: "بانه‌ورده، بخش باینگان، شهرستان پاوه، استان کرمانشاه، ایران",
    reverse_geocoder_label: nominatimRaw.display_name,
  },
  coordinate_reference_system: {
    assumed_source: "WGS 84 / UTM zone 38N",
    epsg: "EPSG:32638",
    evidence: bi(
      "The UTM interpretation converts the survey centre to the matching Baneh Verdeh settlement and preserves metre-scale geometry. The original drawing still lacks a certified CRS declaration.",
      "تفسیر UTM مرکز نقشه را به سکونتگاه منطبق بانه‌ورده تبدیل می‌کند و هندسه متری را حفظ می‌کند؛ با این حال نقشه اولیه هنوز فاقد اعلامیه معتبر CRS است.",
    ),
  },
  center: siteGeolocation,
  scales: [
    {
      scale: "250 m",
      status: "preliminary-inference",
      title: bi("Parcel and immediate hillside", "ملک و دامنه بلافصل"),
      features: bi(
        "Steep northeast-falling parcel embedded in hillside settlement fabric; local access must be field-checked.",
        "ملک پرشیب با افت شمال‌شرقی در بافت سکونتگاهی دامنه؛ دسترسی محلی باید میدانی کنترل شود.",
      ),
    },
    {
      scale: "1 km",
      status: "regional-data",
      title: bi("Baneh Verdeh settlement", "سکونتگاه بانه‌ورده"),
      features: bi(
        "Residential street network on dissected mountain terrain; built obstructions and exact road grades are not surveyed.",
        "شبکه معابر مسکونی روی زمین کوهستانی بریده‌بریده؛ موانع ساخته‌شده و شیب دقیق راه‌ها برداشت نشده‌اند.",
      ),
    },
    {
      scale: "5 km",
      status: "regional-data",
      title: bi("Local valley and road network", "دره و شبکه راه محلی"),
      features: bi(
        `${roadWays.length} mapped road segments and ${waterWays.length} mapped watercourse segments in the local OSM extract; mountainous relief controls movement, drainage and views.`,
        `${roadWays.length} قطعه راه و ${waterWays.length} قطعه آبراه در برداشت محلی OSM؛ ناهمواری کوهستانی حرکت، زهکشی و دید را کنترل می‌کند.`,
      ),
    },
    {
      scale: "20 km",
      status: "regional-data",
      title: bi("Paveh–Shahu mountain context", "زمینه کوهستانی پاوه–شاهو"),
      features: bi(
        "Zagros mountain setting with close ridges, incised valleys, Paveh County settlements and strong topographic exposure.",
        "محیط کوهستانی زاگرس با یال‌های نزدیک، دره‌های عمیق، سکونتگاه‌های شهرستان پاوه و مواجهه شدید توپوگرافی.",
      ),
    },
  ],
  context_map: {
    bounds: contextBounds,
    roads: roadWays,
    water: waterWays,
    places: places.filter((place) => place.distance_km <= 20).slice(0, 18),
    natural_points: naturalPoints.filter((point) => point.distance_km <= 20).slice(0, 12),
    attribution: "© OpenStreetMap contributors · ODbL",
  },
  exposures: [
    bi("High-elevation mountain exposure and strong local slope", "مواجهه کوهستانی مرتفع و شیب محلی زیاد"),
    bi("Valley/ridge effects may channel wind and create rapid shade transitions", "اثر دره/یال ممکن است باد را کانالیزه و تغییرات سریع سایه ایجاد کند"),
    bi("Downslope drainage routes are consequential during intense precipitation and snowmelt", "مسیرهای زهکشی پایین‌دست در بارش شدید و ذوب برف اهمیت دارند"),
    bi("Important outward views are likely across the downslope northeast sector; verify on site", "دیدهای مهم احتمالاً در بخش پایین‌دست شمال‌شرق قرار دارند؛ در محل کنترل شود"),
  ],
  required_next: bi(
    "Before permit or boundary work, a surveyor must certify EPSG:32638 (or identify the correct CRS) against a known control point.",
    "پیش از کار مجوز یا مرزی، نقشه‌بردار باید EPSG:32638 را با نقطه کنترل شناخته‌شده تأیید کند یا CRS درست را مشخص نماید.",
  ),
};

export const environmentalSources = [
  {
    id: "osm-nominatim",
    dataset: bi("OpenStreetMap Nominatim reverse geocoding", "ژئوکد معکوس OpenStreetMap Nominatim"),
    organisation: bi("OpenStreetMap contributors", "مشارکت‌کنندگان OpenStreetMap"),
    accessed: "2026-07-30",
    period: bi("current database snapshot", "نسخه فعلی پایگاه داده"),
    resolution: bi("point reverse geocode", "ژئوکد نقطه‌ای"),
    status: "regional-data",
    url: "https://nominatim.openstreetmap.org/",
    limitation: bi("Addresses and boundaries are community mapped and approximate.", "نشانی‌ها و مرزها مشارکتی و تقریبی‌اند."),
  },
  {
    id: "osm-context",
    dataset: bi("OpenStreetMap 5 km context extract", "برداشت زمینه ۵ کیلومتری OpenStreetMap"),
    organisation: bi("OpenStreetMap contributors", "مشارکت‌کنندگان OpenStreetMap"),
    accessed: "2026-07-30",
    period: bi("current database snapshot", "نسخه فعلی پایگاه داده"),
    resolution: bi("vector roads, places, waterways and natural features", "بردار راه، سکونتگاه، آبراه و عوارض طبیعی"),
    status: "regional-data",
    url: "https://www.openstreetmap.org/copyright",
    limitation: bi("Completeness varies; it is not a legal or topographic survey.", "کامل‌بودن متغیر است و جایگزین نقشه قانونی یا توپوگرافی نیست."),
  },
  {
    id: "era5-land-climate",
    dataset: bi("ERA5-Land daily climate", "اقلیم روزانه ERA5-Land"),
    organisation: bi("ECMWF/Copernicus via Open-Meteo", "ECMWF/Copernicus از طریق Open-Meteo"),
    accessed: "2026-07-30",
    period: "1991–2020",
    resolution: bi("daily; 0.1° (~11 km)", "روزانه؛ ۰٫۱ درجه (حدود ۱۱ کیلومتر)"),
    status: "regional-data",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
    limitation: climateEvidence.limitations,
  },
  {
    id: "nasa-power",
    dataset: bi("NASA POWER meteorological and solar climatology", "اقلیم‌نمای هواشناسی و خورشیدی NASA POWER"),
    organisation: bi("NASA Langley Research Center", "مرکز پژوهشی لنگلی ناسا"),
    accessed: "2026-07-30",
    period: "2001–2020",
    resolution: bi("monthly; source-native MERRA-2 / SYN1DEG grids", "ماهانه؛ شبکه‌های بومی MERRA-2 / SYN1DEG"),
    status: "regional-data",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/",
    limitation: bi("Gridded climatology; local terrain and horizon are unresolved.", "اقلیم‌نمای شبکه‌ای؛ زمین و افق محلی حل‌نشده‌اند."),
  },
  {
    id: "era5-land-wind",
    dataset: bi("ERA5-Land hourly 10 m wind", "باد ساعتی ۱۰ متری ERA5-Land"),
    organisation: bi("ECMWF/Copernicus via Open-Meteo", "ECMWF/Copernicus از طریق Open-Meteo"),
    accessed: "2026-07-30",
    period: "2011–2020",
    resolution: bi("hourly; 0.1° (~11 km)", "ساعتی؛ ۰٫۱ درجه (حدود ۱۱ کیلومتر)"),
    status: "regional-data",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
    limitation: bi("Does not resolve parcel-scale valley channeling, vegetation or buildings.", "کانالیزه‌شدن دره، پوشش گیاهی یا ساختمان‌ها در مقیاس ملک را حل نمی‌کند."),
  },
  {
    id: "cmip6",
    dataset: bi("HighResMIP / CMIP6 climate projections", "پیش‌نگری اقلیم HighResMIP / CMIP6"),
    organisation: bi("CMIP6 model centres via Open-Meteo", "مراکز مدل‌سازی CMIP6 از طریق Open-Meteo"),
    accessed: "2026-07-30",
    period: "2001–2020 vs 2031–2050",
    resolution: bi("daily; statistically downscaled to 10 km", "روزانه؛ ریزمقیاس‌نمایی آماری تا ۱۰ کیلومتر"),
    status: "preliminary-inference",
    url: "https://open-meteo.com/en/docs/climate-api",
    limitation: climateEvidence.future.scenario_note,
  },
  {
    id: "usgs-earthquakes",
    dataset: bi("USGS Earthquake Catalog regional query", "پرس‌وجوی منطقه‌ای فهرست زلزله USGS"),
    organisation: bi("U.S. Geological Survey", "سازمان زمین‌شناسی ایالات متحده"),
    accessed: "2026-07-30",
    period: "1900–2026",
    resolution: bi("M≥4.5 events within 200 km", "رخدادهای بزرگی ۴٫۵ و بیشتر در شعاع ۲۰۰ کیلومتر"),
    status: "regional-data",
    url: "https://earthquake.usgs.gov/fdsnws/event/1/",
    limitation: bi("Catalog history and detection are non-uniform; it is not a design response spectrum.", "تاریخچه و آشکارسازی فهرست یکنواخت نیست و طیف پاسخ طراحی محسوب نمی‌شود."),
  },
  {
    id: "macrostrat",
    dataset: bi("Macrostrat regional geologic map query", "پرس‌وجوی نقشه زمین‌شناسی منطقه‌ای Macrostrat"),
    organisation: bi("Macrostrat; source map National Geoscience Database of Iran", "Macrostrat؛ نقشه منبع پایگاه ملی علوم زمین ایران"),
    accessed: "2026-07-30",
    period: bi("published regional mapping", "نقشه‌برداری منطقه‌ای منتشرشده"),
    resolution: "1:1,000,000",
    status: "regional-data",
    url: "https://macrostrat.org/",
    limitation: bi("Regional bedrock unit only; no parcel outcrop or discontinuity survey.", "فقط واحد سنگ‌بستر منطقه‌ای؛ بدون برداشت رخنمون یا ناپیوستگی در ملک."),
  },
  {
    id: "soilgrids",
    dataset: bi("SoilGrids 2.0 predicted soil properties", "ویژگی‌های پیش‌بینی‌شده خاک SoilGrids 2.0"),
    organisation: bi("ISRIC — World Soil Information", "ISRIC — اطلاعات جهانی خاک"),
    accessed: "2026-07-30",
    period: bi("global model release 2.0", "نسخه ۲٫۰ مدل جهانی"),
    resolution: "250 m",
    status: "regional-data",
    url: "https://soilgrids.org/",
    limitation: bi("Prediction intervals are wide; no bearing capacity, depth to rock or fill verification.", "بازه پیش‌بینی گسترده است؛ ظرفیت باربری، عمق سنگ یا خاک‌ریزی را تأیید نمی‌کند."),
  },
];

/*
  Derived statistics. Everything below is computed from bundled raw data, and
  every entry is named for what it is rather than for the code parameter it
  resembles. Nothing here is a design value: degree-days are not an energy
  demand, a percentile temperature is not a design temperature, and a gust
  return period is not a basic wind speed.
*/

const dailyMeans = daily.temperature_2m_mean;
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.round(fraction * (sorted.length - 1));
  return round(sorted[Math.min(sorted.length - 1, Math.max(0, index))], 1);
};

const degreeDayBases = [
  ["hdd", 18, "heating"],
  ["hdd", 15.5, "heating"],
  ["cdd", 10, "cooling"],
  ["cdd", 18, "cooling"],
];
const degreeDayTotals = degreeDayBases.map(([kind, base]) => {
  const monthly = Array.from({ length: 12 }, () => 0);
  let total = 0;
  daily.time.forEach((date, index) => {
    const value = dailyMeans[index];
    if (!valid(value)) return;
    const degrees = kind === "hdd"
      ? Math.max(0, base - value)
      : Math.max(0, value - base);
    total += degrees;
    monthly[Number(date.slice(5, 7)) - 1] += degrees;
  });
  return {
    id: `${kind}${String(base).replace(".", "_")}`,
    kind,
    base_c: base,
    annual_k_day: round(total / yearsInClimateRecord, 0),
    monthly_k_day: monthly.map((value) => round(value / yearsInClimateRecord, 0)),
  };
});

const dailyMinima = daily.temperature_2m_min.filter(valid);
const dailyMaxima = daily.temperature_2m_max.filter(valid);
const validMeans = dailyMeans.filter(valid);

/*
  Spring and autumn frost dates.

  This is the statistic that decides fruit rather than shade: a tree can be hardy
  to −30 °C in January and still lose every flower to −3 °C in April. It is a
  direct reading of `temperature_2m_min` — the last day of the first half of the
  year at or below a threshold, and the first day of the second half — with no
  model in between.

  Dates are held as a day-of-year in a fixed 365-day calendar rather than the
  real one, so a leap year cannot shift 1 April by a day against the other
  twenty-nine years in the record.
*/
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const nominalDay = (date) => MONTH_STARTS[Number(date.slice(5, 7)) - 1] + Number(date.slice(8, 10));
const nominalDate = (day) => {
  const month = MONTH_STARTS.findLastIndex((start) => start < day);
  return `${String(month + 1).padStart(2, "0")}-${String(day - MONTH_STARTS[month]).padStart(2, "0")}`;
};
const quantileDay = (days, fraction) => {
  const sorted = [...days].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))))];
};

const frostYears = new Map();
daily.time.forEach((date, index) => {
  const minimum = daily.temperature_2m_min[index];
  if (!valid(minimum)) return;
  const year = date.slice(0, 4);
  if (!frostYears.has(year)) frostYears.set(year, []);
  frostYears.get(year).push({ day: nominalDay(date), minimum });
});

// The mid-year split has to sit clear of both frost seasons or a late spring
// frost and an early autumn one land in the same bucket. Nothing in the record
// freezes in July.
const MIDYEAR_DAY = 200;
const frostThresholds = [0, -2, -4].map((threshold) => {
  const lastSpring = [];
  const firstAutumn = [];
  const seasonLengths = [];
  for (const rows of frostYears.values()) {
    const spring = rows.filter((row) => row.day <= MIDYEAR_DAY && row.minimum <= threshold);
    const autumn = rows.filter((row) => row.day > MIDYEAR_DAY && row.minimum <= threshold);
    const last = spring.length ? Math.max(...spring.map((row) => row.day)) : null;
    const first = autumn.length ? Math.min(...autumn.map((row) => row.day)) : null;
    if (last !== null) lastSpring.push(last);
    if (first !== null) firstAutumn.push(first);
    if (last !== null && first !== null) seasonLengths.push(first - last);
  }
  return {
    threshold_c: threshold,
    years_with_a_spring_frost: lastSpring.length,
    last_spring_frost: {
      earliest: nominalDate(Math.min(...lastSpring)),
      median: nominalDate(quantileDay(lastSpring, 0.5)),
      later_than_in_9_years_of_10: nominalDate(quantileDay(lastSpring, 0.9)),
      latest: nominalDate(Math.max(...lastSpring)),
    },
    first_autumn_frost: {
      earliest: nominalDate(Math.min(...firstAutumn)),
      median: nominalDate(quantileDay(firstAutumn, 0.5)),
    },
    frost_free_days_median: quantileDay(seasonLengths, 0.5),
  };
});

const springMonthMinima = [3, 4, 5].map((month) => {
  const key = String(month).padStart(2, "0");
  const values = daily.time
    .map((date, index) => (date.slice(5, 7) === key ? daily.temperature_2m_min[index] : null))
    .filter((value) => value !== null && valid(value));
  return {
    month,
    lowest_daily_min_c: round(Math.min(...values), 1),
    mean_daily_min_c: round(mean(values), 1),
  };
});

// Annual maxima of the DAILY gust series, not the hourly means. A Gumbel fit on
// the hourly file returns about 7 m/s at 50 years — wrong by a factor of four,
// and an artefact of averaging an already area-averaged reanalysis field. The
// daily series is the one whose own 30-year maximum equals the 117 km/h this
// dashboard already publishes, which is what makes the fit checkable.
const gustsByYear = new Map();
daily.time.forEach((date, index) => {
  const gust = daily.wind_gusts_10m_max[index];
  if (!valid(gust)) return;
  const year = date.slice(0, 4);
  gustsByYear.set(year, Math.max(gustsByYear.get(year) ?? 0, gust));
});
const annualGustMaxima = [...gustsByYear.values()];
const gustMean = mean(annualGustMaxima);
const gustSd = Math.sqrt(
  annualGustMaxima.reduce((total, value) => total + (value - gustMean) ** 2, 0)
    / (annualGustMaxima.length - 1),
);
// Gumbel by method of moments.
const gumbelScale = gustSd * Math.sqrt(6) / Math.PI;
const gumbelLocation = gustMean - 0.5772 * gumbelScale;
const gustReturnPeriod = (years) => round(
  gumbelLocation - gumbelScale * Math.log(-Math.log(1 - 1 / years)),
  1,
);

const distanceToSiteKm = (longitude, latitude) => round(
  haversineKm(siteGeolocation.latitude, siteGeolocation.longitude, latitude, longitude),
  3,
);

const amenityNodes = osm.nodes
  .filter((node) => node.tags.amenity || node.tags.place)
  .map((node) => ({
    kind: node.tags.amenity || `place:${node.tags.place}`,
    name: node.tags["name:en"] || node.tags.name || null,
    distance_km: distanceToSiteKm(node.longitude, node.latitude),
  }))
  .filter((item) => Number.isFinite(item.distance_km))
  .sort((a, b) => a.distance_km - b.distance_km);

const powerWays = osm.ways
  .filter((way) => way.tags.power)
  .map((way) => ({
    kind: way.tags.power,
    voltage: way.tags.voltage || null,
    distance_km: Math.min(...way.coordinates.map(([longitude, latitude]) => (
      distanceToSiteKm(longitude, latitude)
    ))),
  }))
  .sort((a, b) => a.distance_km - b.distance_km);

const vegetationWays = osm.ways
  .filter((way) => way.tags.natural === "wood" || way.tags.landuse === "forest")
  .map((way) => ({
    kind: way.tags.natural || way.tags.landuse,
    distance_km: Math.min(...way.coordinates.map(([longitude, latitude]) => (
      distanceToSiteKm(longitude, latitude)
    ))),
  }))
  .sort((a, b) => a.distance_km - b.distance_km);

const buildingCount = osm.ways.filter((way) => way.tags.building).length
  + osm.nodes.filter((node) => node.tags.building).length;

export const derivedEvidence = {
  status: "derived-regional-statistic",
  source_period: "1991–2020 daily ERA5-Land, 10,958 days",
  degree_days: {
    method: "Daily mean temperature against each base, summed and divided by 30 years.",
    note: bi(
      "Degree-days describe the climate, not the building. They are not an energy demand, and converting them into one needs a fabric, a system and an occupancy that do not exist yet.",
      "درجه-روز اقلیم را توصیف می‌کند، نه ساختمان را. این عدد تقاضای انرژی نیست و تبدیل آن به تقاضا نیازمند پوسته، سامانه و الگوی سکونتی است که هنوز وجود ندارند.",
    ),
    totals: degreeDayTotals,
  },
  temperature_percentiles: {
    // Named for the statistic. "Design temperature" is a code term with a
    // defined derivation this data cannot supply, and a number under that name
    // would be sized against.
    method_note: bi(
      "These are empirical percentiles of a 30-year gridded daily series. They are not ASHRAE design conditions, which are defined against station observations and a specified derivation.",
      "این‌ها صدک‌های تجربی یک سری روزانه شبکه‌ای ۳۰ ساله‌اند. شرایط طراحی ASHRAE نیستند، که بر پایه مشاهدات ایستگاهی و روش تعریف‌شده مشخص می‌شوند.",
    ),
    percentile_daily_min_c: percentile(dailyMinima, 0.004),
    percentile_daily_max_c: percentile(dailyMaxima, 0.996),
    percentile_daily_mean_low_c: percentile(validMeans, 0.004),
    percentile_daily_mean_high_c: percentile(validMeans, 0.996),
    absolute_min_c: round(Math.min(...dailyMinima), 1),
    absolute_max_c: round(Math.max(...dailyMaxima), 1),
  },
  spring_frost: {
    status: "derived-regional-statistic",
    series: "daily temperature_2m_min, 1991–2020",
    method: "Last day at or below each threshold before day 200 of a fixed 365-day calendar, and the first day after it; quantiles across the 30 years.",
    dem_elevation_m: climateRaw.elevation,
    thresholds: frostThresholds,
    spring_month_minima: springMonthMinima,
    // Left null on purpose. Chill accumulation is defined on hourly temperature
    // and only the daily file is bundled; a day-count against a 7.2 °C mean
    // would be compared against a cultivar's chill-hour requirement, which is a
    // different quantity. What can be said without the number is that at this
    // elevation chill is not the limiting factor — spring frost is.
    chill_hours: null,
    chill_note: bi(
      "Winter chill is not quantified here: chill hours are defined on hourly temperature and only the daily series is bundled. At this elevation, with the frost record below, chill accumulation is not the factor that limits temperate fruit here — the date of the last spring frost is.",
      "سرمانیاز زمستانه اینجا کمّی نشده است: ساعات سرما بر پایه دمای ساعتی تعریف می‌شود و تنها سری روزانه همراه بسته شده است. در این ارتفاع و با رکورد یخبندان زیر، انباشت سرما عامل محدودکننده میوه معتدل اینجا نیست — تاریخ آخرین یخبندان بهاره است.",
    ),
    bias_note: bi(
      "These dates are a floor on the risk, not a bound on it, and the reason is the same one that made the hourly wind fit unusable: the series is an area-averaged reanalysis cell. A single cell cannot resolve cold air draining downhill and pooling on a bench at night, and it averages a whole grid box of terrain into one minimum. The real last frost on this parcel is therefore at least as late as the date given, and the real minimum at least as cold — never the other way round. Treat a date here as the earliest a bud is safe, not the day it is.",
      "این تاریخ‌ها کف خطرند، نه سقف آن، و دلیلش همان چیزی است که برازش باد ساعتی را بی‌استفاده کرد: این سری یک سلول بازتحلیل با میانگین پهنه‌ای است. یک سلول نمی‌تواند فرونشست شبانه هوای سرد و جمع‌شدنش روی یک سکو را تفکیک کند و یک جعبه کامل از زمین را به یک کمینه میانگین می‌گیرد. پس آخرین یخبندان واقعی این قطعه دست‌کم به‌اندازه تاریخ داده‌شده دیر است و کمینه واقعی دست‌کم به همان اندازه سرد — هرگز برعکس. هر تاریخ اینجا را زودترین زمان ایمنی جوانه بدانید، نه روز ایمنی آن.",
    ),
    elevation_note: bi(
      `The reanalysis cell sits at ${climateRaw.elevation} m. The surveyed parcel is above it, and it faces north-east — the coldest aspect available — so the cell describes the neighbourhood rather than this bench.`,
      `سلول بازتحلیل در ارتفاع ${climateRaw.elevation} متر قرار دارد. قطعه برداشت‌شده بالاتر از آن است و رو به شمال‌شرق — سردترین جهت ممکن — پس این سلول محله را توصیف می‌کند نه این سکو را.`,
    ),
  },
  wind_return_periods: {
    status: "derived-regional-statistic",
    series: "daily wind_gusts_10m_max, 30 annual maxima",
    distribution: "Gumbel, method of moments",
    observed_max_kmh: round(Math.max(...annualGustMaxima), 1),
    gust_return_period_kmh: {
      10: gustReturnPeriod(10),
      25: gustReturnPeriod(25),
      50: gustReturnPeriod(50),
      100: gustReturnPeriod(100),
    },
    factors_applied: [],
    factors_required: [
      bi("terrain and exposure category", "رده زمین و مواجهه"),
      bi("topographic speed-up over the ridge", "ضریب تشدید توپوگرافی روی یال"),
      bi("directionality and importance factors from the applicable code", "ضرایب جهت و اهمیت از آیین‌نامه مربوط"),
      bi("gust-to-mean conversion appropriate to the code's reference averaging time", "تبدیل تندباد به میانگین متناسب با زمان میانگین‌گیری مرجع آیین‌نامه"),
    ],
    rejected_fit: {
      // Published on purpose. A negative result is what makes the accepted
      // number checkable rather than merely asserted.
      series: "hourly wind_speed_10m, 2011–2020",
      result_50_year_ms: 7,
      reason: bi(
        "Fitting annual maxima of the hourly mean series gives about 7 m/s at 50 years — roughly four times too low. Hourly means of an already area-averaged reanalysis field smooth away the peaks a return period is meant to capture.",
        "برازش بیشینه‌های سالانه سری میانگین ساعتی حدود ۷ متر بر ثانیه در دوره بازگشت ۵۰ ساله می‌دهد — نزدیک به یک‌چهارم مقدار درست. میانگین ساعتیِ میدانی که خود میانگین‌گیری پهنه‌ای شده، قله‌هایی را که دوره بازگشت باید بگیرد هموار می‌کند.",
      ),
    },
  },
  context: {
    status: "regional-data",
    extract: "OpenStreetMap 5 km bounding box",
    nearest_amenities: amenityNodes.slice(0, 8),
    nearest_power_infrastructure: powerWays.slice(0, 3),
    nearest_vegetation: vegetationWays.slice(0, 3),
    // The absence is the finding. It is also the evidence line for the
    // field-survey row in the investigations register.
    building_footprints_in_extract: buildingCount,
    building_note: bi(
      "The 5 km extract contains no building footprints at all. Neighbour heights, overshadowing and party boundaries therefore cannot be assessed from this source at any confidence, and need a field survey.",
      "استخراج ۵ کیلومتری هیچ ردپای ساختمانی ندارد. بنابراین ارتفاع همسایه، سایه‌اندازی و مرزهای مشترک از این منبع با هیچ درجه اطمینانی ارزیابی‌پذیر نیست و برداشت میدانی لازم دارد.",
    ),
    utility_note: bi(
      "The nearest mapped power infrastructure is a transmission line several kilometres away that imposes no easement here. It is not a connection point, and no distribution network is mapped near the parcel.",
      "نزدیک‌ترین زیرساخت برق نقشه‌شده، خط انتقالی در چند کیلومتری است که حریمی بر این قطعه تحمیل نمی‌کند. نقطه انشعاب نیست و هیچ شبکه توزیعی نزدیک قطعه نقشه نشده است.",
    ),
  },
};
