import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.resolve(scriptDir, "../assets/data/environmental/raw");
const latitude = 34.97131638;
const longitude = 46.35559359;
const encodedTimezone = "Asia%2FTehran";

const requests = [
  {
    file: "openmeteo-era5land-daily-1991-2020.json",
    url: `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum,shortwave_radiation_sum,sunshine_duration,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=${encodedTimezone}`,
  },
  {
    file: "openmeteo-era5land-wind-hourly-2011-2020.json",
    url: `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=2011-01-01&end_date=2020-12-31&hourly=wind_speed_10m,wind_direction_10m&timezone=${encodedTimezone}`,
  },
  {
    file: "nasa-power-climatology-2001-2020.json",
    url: `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,WS10M,CLOUD_AMT&community=RE&longitude=${longitude}&latitude=${latitude}&format=JSON`,
  },
  {
    file: "usgs-earthquakes-m45-200km-1900-2026.json",
    url: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=1900-01-01&endtime=2026-07-30&latitude=${latitude}&longitude=${longitude}&maxradiuskm=200&minmagnitude=4.5&orderby=time-asc&limit=20000`,
  },
  {
    file: "osm-nominatim-reverse.json",
    url: `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&zoom=18&format=jsonv2&accept-language=en`,
  },
  {
    file: "isric-soilgrids-site.json",
    url: `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${longitude}&lat=${latitude}&property=clay&property=sand&property=silt&property=phh2o&property=soc&property=bdod&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean&value=Q0.05&value=Q0.95`,
  },
  {
    file: "macrostrat-geology-site.json",
    url: `https://macrostrat.org/api/v2/geologic_units/map?lat=${latitude}&lng=${longitude}`,
  },
  {
    file: "openstreetmap-5km.xml",
    url: "https://api.openstreetmap.org/api/0.6/map?bbox=46.3008,34.9264,46.4104,35.0162",
  },
  ...[
    ["EC_Earth3P_HR", "ec-earth3p-hr"],
    ["MPI_ESM1_2_XR", "mpi-esm1-2-xr"],
  ].flatMap(([model, slug]) => [
    {
      file: `cmip6-${slug}-2001-2020.json`,
      url: `https://climate-api.open-meteo.com/v1/climate?latitude=${latitude}&longitude=${longitude}&start_date=2001-01-01&end_date=2020-12-31&models=${model}&daily=temperature_2m_mean,precipitation_sum`,
    },
    {
      file: `cmip6-${slug}-2031-2050.json`,
      url: `https://climate-api.open-meteo.com/v1/climate?latitude=${latitude}&longitude=${longitude}&start_date=2031-01-01&end_date=2050-12-31&models=${model}&daily=temperature_2m_mean,precipitation_sum`,
    },
  ]),
];

await fs.mkdir(rawDir, { recursive: true });

for (const request of requests) {
  const response = await fetch(request.url, {
    headers: {
      "User-Agent": "HouseAI environmental analysis/1.0",
      Accept: request.file.endsWith(".xml") ? "application/xml" : "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`${request.file}: ${response.status} ${response.statusText}`);
  }
  if (request.file.endsWith(".xml")) {
    const publishableXml = (await response.text()).replace(
      /^\s*<tag k="(?:phone|contact:phone|email|contact:email)"[^>]*\/>\s*$/gm,
      "  <!-- Contact metadata removed from the publishable offline extract. -->",
    );
    await fs.writeFile(path.join(rawDir, request.file), publishableXml);
    console.log(`${request.file}: ${Buffer.byteLength(publishableXml).toLocaleString()} bytes`);
    continue;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(path.join(rawDir, request.file), bytes);
  console.log(`${request.file}: ${bytes.byteLength.toLocaleString()} bytes`);
}

console.log("Environmental source refresh complete. Run: node scripts/generate-data.mjs");
