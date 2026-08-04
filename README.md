# Family House 001 Dashboard

## How to open

Open `index.html` directly in a modern browser. The dashboard is self-contained and works from `file://` without a server, installation, login or internet connection.

Persian mode uses locally bundled Vazirmatn weights (400–700), sourced from Google Fonts so the interface remains readable and fully offline.

## Where the data comes from

The dashboard combines the immutable `site-base/versions/v1-three-fields` survey and terrain snapshot with locally bundled environmental source responses under `assets/data/environmental/raw/`. Those sources include OpenStreetMap, ERA5-Land, NASA POWER, CMIP6, USGS, SoilGrids and Macrostrat; every regional dataset keeps its period, resolution and limitations visible.

## How to regenerate after future site expansion

Update the `sourceDir` constant in `scripts/generate-data.mjs` to the new immutable site-base version. If the site location or evidence date changes, run `node scripts/fetch-environmental-data.mjs` with internet access; then run `node scripts/generate-data.mjs` and `node scripts/validate-static.mjs` from the dashboard folder. Repeat the visual browser QA recorded in `QA-REPORT.md`.

## How to add later house designs

Keep site evidence and house-design evidence separate. Add a new design collection under `assets/documents/` and register its files in the document-generation block inside `scripts/generate-data.mjs`; do not edit or replace the site analysis, survey points, terrain data or immutable site-base version.
