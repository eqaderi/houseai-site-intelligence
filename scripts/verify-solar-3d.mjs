/**
 * Analytic verification of the shipped terrain-3d.js solar geometry.
 *
 * terrain-3d.js touches no DOM at load time — it declares functions and assigns
 * window.HOUSEAI_TERRAIN_3D — so it can be evaluated in Node against a stubbed
 * THREE. That means these assertions run against the file the browser actually
 * loads, not a copy of the maths.
 *
 * Run directly, or via validate-static.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { solarPosition } from "./solar-math.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, "..");

class Vector3Stub {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(other) {
    return this.set(other.x, other.y, other.z);
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
}

export function loadTerrainApi() {
  const source = fs.readFileSync(path.join(dashboardDir, "terrain-3d.js"), "utf8");
  const sandboxWindow = {};
  const fn = new Function(
    "window",
    "THREE",
    "document",
    "getComputedStyle",
    `${source}\nreturn window.HOUSEAI_TERRAIN_3D;`,
  );
  return fn(
    sandboxWindow,
    { Vector3: Vector3Stub },
    { querySelector: () => null, querySelectorAll: () => [], createElement: () => null },
    () => ({ fontFamily: "sans-serif" }),
  );
}

const site = { latitude: 34.97131638, longitude: 46.35559359, utc_offset_hours: 3.5 };
const TEST_HEIGHTS = [2, 3];

/** Returns { checks, failures: [string] }. */
export function verifySolarGeometry() {
  const api = loadTerrainApi();
  const solar = JSON.parse(
    fs.readFileSync(path.join(dashboardDir, "data/solar.json"), "utf8"),
  );
  const failures = [];
  let checks = 0;
  const fail = (message) => {
    if (failures.length < 12) failures.push(message);
  };

  if (typeof api?.__sunDirection !== "function") {
    return { checks: 0, failures: ["terrain-3d.js does not expose __sunDirection"] };
  }

  const days = [...solar.seasons, ...solar.monthly];
  for (const day of days) {
    for (const position of day.positions) {
      const { altitude_deg: altitude, azimuth_deg: azimuth } = position;
      const direction = api.__sunDirection(altitude, azimuth);
      checks += 1;

      if (Math.abs(direction.length() - 1) > 1e-12) {
        fail(`${day.date} ${position.clock_hour}h: |dir| = ${direction.length()}`);
      }

      const expectedY = Math.sin(altitude * Math.PI / 180);
      if (Math.abs(direction.y - expectedY) > 1e-12) {
        fail(`${day.date} ${position.clock_hour}h: dir.y ${direction.y} != sin(alt) ${expectedY}`);
      }

      // Shadows fall opposite the sun. In scene space north is -Z, so the
      // bearing of the shadow direction is atan2(-dx, +dz).
      if (altitude > 0.5) {
        const bearing = ((Math.atan2(-direction.x, direction.z) * 180 / Math.PI) + 360) % 360;
        const expectedBearing = (azimuth + 180) % 360;
        const delta = Math.abs(((bearing - expectedBearing + 540) % 360) - 180);
        if (delta > 1e-9) {
          fail(`${day.date} ${position.clock_hour}h: shadow bearing ${bearing} != ${expectedBearing}`);
        }

        for (const height of TEST_HEIGHTS) {
          const shadow = api.__shadowLength(height, altitude);
          const analytic = height / Math.tan(altitude * Math.PI / 180);
          if (!Number.isFinite(shadow) || Math.abs(shadow - analytic) > 1e-9) {
            fail(`${day.date} ${position.clock_hour}h h=${height}: shadow ${shadow} != ${analytic}`);
          }
          // The tip offset the renderer uses must equal the same length.
          const tipOffset = Math.hypot(
            direction.x / direction.y * height,
            direction.z / direction.y * height,
          );
          if (Math.abs(tipOffset - analytic) > 1e-9) {
            fail(`${day.date} ${position.clock_hour}h h=${height}: tip offset ${tipOffset} != ${analytic}`);
          }
        }
      } else if (api.__shadowLength(2, altitude) !== null) {
        fail(`${day.date} ${position.clock_hour}h: shadow length should be withheld at alt ${altitude}`);
      }

      // solar.json really is the output of the shipped astronomy, to its own
      // published rounding.
      const recomputed = solarPosition(site, day.date, position.clock_hour);
      if (Math.abs(recomputed.altitude_deg - altitude) > 0.05
        || Math.abs(((recomputed.azimuth_deg - azimuth + 540) % 360) - 180) > 0.05) {
        fail(
          `${day.date} ${position.clock_hour}h: solar.json (${altitude}, ${azimuth}) `
          + `!= recomputed (${recomputed.altitude_deg}, ${recomputed.azimuth_deg})`,
        );
      }
    }
  }

  return { checks, failures };
}

/**
 * The runtime slider blends two neighbouring samples, so `solar.json` publishes
 * the worst-case deviation from the exact NOAA position. This re-derives that
 * deviation from the astronomy and fails if the published figure understates it
 * — which is what a step-size change without a regeneration would look like.
 *
 * Returns { intervals, failures: [string] }.
 */
export function verifyInterpolationBound() {
  const solar = JSON.parse(
    fs.readFileSync(path.join(dashboardDir, "data/solar.json"), "utf8"),
  );
  const failures = [];
  const bound = solar.controls?.interpolation;
  if (!bound) return { intervals: 0, failures: ["solar.controls.interpolation is missing"] };

  const stepHours = bound.step_minutes / 60;
  let intervals = 0;
  let worstAltitude = 0;
  let worstAzimuth = 0;
  for (const season of solar.seasons) {
    for (let index = 0; index < season.positions.length - 1; index += 1) {
      const from = season.positions[index];
      const to = season.positions[index + 1];
      intervals += 1;
      // A sample table with a wider gap than advertised would silently widen
      // the interpolation error, so the spacing is asserted, not assumed.
      if (Math.abs(to.clock_hour - from.clock_hour - stepHours) > 1e-3) {
        if (failures.length < 6) {
          failures.push(
            `${season.date}: ${from.clock_hour}h→${to.clock_hour}h is not a `
            + `${bound.step_minutes}-minute step`,
          );
        }
        continue;
      }
      let sweep = to.azimuth_deg - from.azimuth_deg;
      if (sweep > 180) sweep -= 360;
      if (sweep < -180) sweep += 360;
      for (let fraction = 0.05; fraction < 1; fraction += 0.05) {
        const exact = solarPosition(
          site,
          season.date,
          from.clock_hour + fraction * (to.clock_hour - from.clock_hour),
        );
        worstAltitude = Math.max(
          worstAltitude,
          Math.abs(from.altitude_deg + fraction * (to.altitude_deg - from.altitude_deg)
            - exact.altitude_deg),
        );
        let error = Math.abs(from.azimuth_deg + fraction * sweep - exact.azimuth_deg);
        if (error > 180) error = 360 - error;
        worstAzimuth = Math.max(worstAzimuth, error);
      }
    }
  }
  if (worstAltitude > bound.max_altitude_deviation_deg) {
    failures.push(
      `altitude deviation ${worstAltitude.toFixed(4)}° exceeds the published `
      + `${bound.max_altitude_deviation_deg}°`,
    );
  }
  if (worstAzimuth > bound.max_azimuth_deviation_deg) {
    failures.push(
      `azimuth deviation ${worstAzimuth.toFixed(4)}° exceeds the published `
      + `${bound.max_azimuth_deviation_deg}°`,
    );
  }
  return { intervals, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { checks, failures } = verifySolarGeometry();
  const interpolation = verifyInterpolationBound();
  [...failures, ...interpolation.failures].forEach((message) => console.log(`FAIL  ${message}`));
  console.log(
    `\n${checks} solar positions and ${interpolation.intervals} interpolation `
    + `intervals verified, ${failures.length + interpolation.failures.length} failures.`,
  );
  if (failures.length || interpolation.failures.length) process.exit(1);
}
