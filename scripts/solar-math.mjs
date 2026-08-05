/**
 * NOAA fractional-year solar-position equations.
 *
 * Extracted verbatim from environmental-data.mjs so the horizon module and the
 * verification harness can use the astronomy without importing the climate
 * pipeline, which reads twelve raw JSON files at import time.
 *
 * The site is passed in rather than closed over, so these functions stay pure.
 * `site` needs { latitude, longitude, utc_offset_hours }.
 */

const round = (value, digits = 2) => Number(value.toFixed(digits));

export function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

export function solarTerms(date, localHour = 12) {
  const days = ((date.getUTCFullYear() % 4 === 0) ? 366 : 365);
  const gamma = 2 * Math.PI / days * (dayOfYear(date) - 1 + (localHour - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918 - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);
  return { equationOfTime, declination };
}

export function solarPosition(site, dateString, localClockHour) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const latitudeRadians = site.latitude * Math.PI / 180;
  const { equationOfTime, declination } = solarTerms(date, localClockHour);
  const timeOffset = equationOfTime
    + 4 * site.longitude
    - 60 * site.utc_offset_hours;
  const trueSolarMinutes = localClockHour * 60 + timeOffset;
  const hourAngleDegrees = trueSolarMinutes / 4 - 180;
  const hourAngle = hourAngleDegrees * Math.PI / 180;
  const cosZenith = Math.sin(latitudeRadians) * Math.sin(declination)
    + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const altitude = 90 - zenith * 180 / Math.PI;
  const azimuth = (
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitudeRadians)
        - Math.tan(declination) * Math.cos(latitudeRadians),
    ) * 180 / Math.PI + 180 + 360
  ) % 360;
  return {
    // Four decimals, not two: a 10-minute step is 0.1667 h, and rounding the
    // stored hour to 0.01 h moved it by up to 18 seconds — enough that
    // recomputing the position from the published hour no longer reproduced the
    // published angles, which is exactly what verify-solar-3d.mjs asserts.
    clock_hour: round(localClockHour, 4),
    altitude_deg: round(altitude, 1),
    azimuth_deg: round(azimuth, 1),
  };
}

export function decimalHourLabel(value) {
  let hours = Math.floor(value);
  let minutes = Math.round((value - hours) * 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Inverse of decimalHourLabel — "13:45" to 13.75. */
export function clockToDecimal(label) {
  const [hours, minutes] = String(label).split(":").map(Number);
  return hours + (minutes || 0) / 60;
}

export function solarDay(site, dateString, stepHours = 0.5) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const latitudeRadians = site.latitude * Math.PI / 180;
  const { equationOfTime, declination } = solarTerms(date, 12);
  const horizonZenith = 90.833 * Math.PI / 180;
  const hourAngle = Math.acos(
    Math.cos(horizonZenith) / (Math.cos(latitudeRadians) * Math.cos(declination))
      - Math.tan(latitudeRadians) * Math.tan(declination),
  );
  const hourAngleDegrees = hourAngle * 180 / Math.PI;
  const solarNoon = (
    720 - 4 * site.longitude - equationOfTime
      + site.utc_offset_hours * 60
  ) / 60;
  const sunrise = solarNoon - hourAngleDegrees * 4 / 60;
  const sunset = solarNoon + hourAngleDegrees * 4 / 60;
  const positions = [];
  for (
    let hour = Math.ceil(sunrise / stepHours) * stepHours;
    hour <= sunset;
    hour += stepHours
  ) {
    const position = solarPosition(site, dateString, hour);
    if (position.altitude_deg > 0) positions.push(position);
  }
  const sunrisePosition = solarPosition(site, dateString, sunrise + 0.03);
  const sunsetPosition = solarPosition(site, dateString, sunset - 0.03);
  const noonPosition = solarPosition(site, dateString, solarNoon);
  return {
    date: dateString,
    sunrise: decimalHourLabel(sunrise),
    sunset: decimalHourLabel(sunset),
    solar_noon: decimalHourLabel(solarNoon),
    day_length_hours: round(sunset - sunrise, 2),
    sunrise_azimuth_deg: sunrisePosition.azimuth_deg,
    sunset_azimuth_deg: sunsetPosition.azimuth_deg,
    noon_altitude_deg: noonPosition.altitude_deg,
    positions,
  };
}
