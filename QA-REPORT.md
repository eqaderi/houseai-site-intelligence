# Dashboard QA Report

**Release:** dashboard-2026-08-05 · version 1.2.0  
**Package:** `designs/design-001-family-house/dashboard/`  
**Target:** offline `file://` and loopback static serve · English / Persian

This matrix replaces earlier change-log material. It reports the current product
state after the P0–P2 backlog pass.

## Product scope

| Item | Value |
|---|---|
| Release stage | Pre-design site intelligence |
| Concept design | Blocked (client brief, legal/survey, ground, access) |
| Sections (main) | Overview, Survey, Terrain, Geography, Climate, Solar, Wind, Hazards, Architecture, Trees & planting, Field evidence, Investigations, Documents, Methodology |
| Languages | English (LTR) and Persian (RTL) |
| Network at runtime | None (bundled assets only) |

## Automated suites

| Suite | Command | Result |
|---|---|---|
| Static validation | `node scripts/validate-static.mjs` | Pass (current total printed by suite) |
| Solar geometry | `node scripts/verify-solar-3d.mjs` | 506 positions · 213 interpolation intervals |
| Responsive | `node scripts/verify-responsive.mjs` | 16/16 width×language |
| Accessibility smoke | `node scripts/verify-accessibility.mjs` | 2/2 languages |
| Privacy | `node scripts/verify-privacy.mjs` | Clean |
| Local links | `node scripts/verify-links.mjs` | All local href/src + documents registry |
| Offline network | `node scripts/verify-offline.mjs` | No runtime external requests; UMD deprecation removed |

## Semantic gates (static)

- Drawing verification separated from legal ownership / cadastre
- Geolocation is probable / strong-probable, not confirmed ownership
- Rejected concepts only in closed archive
- CDD18 published with architect climate brief
- Investigations carry owner, prerequisite, deliverable, dependency, scope
- Early feasibility gate for utilities / road / construction access
- Title + ground assessments gate concept design
- Species shortlist on main page; full explorer in annex
- Field evidence slots remain unresolved until measured

## Browser smoke (manual / agent)

| Check | Status |
|---|---|
| Language toggle EN↔FA | Pass |
| Theme toggle without viewport jump | Pass |
| Desktop nav includes all major sections | Pass |
| Geography 250 m–20 km scale controls | Pass |
| Architect handoff six cards | Pass |
| Architect climate HDD18 / CDD18 / CDD10 | Pass |
| Investigations expanded columns | Pass |
| 3D terrain mounts under `file://` constraints | Pass (WebGL; UMD global) |
| No page-level horizontal overflow at phone widths | Pass (automated) |

## Known remaining limitations

- EXT-01…20 remain open — field, legal and municipal work
- Full axe/WCAG contrast matrix not automated (structural a11y smoke only)
- Three.js remains a patched r160 UMD global for offline `file://` (deprecation warn removed; not ES modules)
- Some long species-source and catalogue prose is still dense technical text
- Screenshots under `screenshots/` should be refreshed after major layout shifts

## How to re-verify

```text
cd designs/design-001-family-house/dashboard
node scripts/generate-data.mjs
node scripts/validate-static.mjs
node scripts/verify-solar-3d.mjs
node scripts/verify-responsive.mjs
node scripts/verify-accessibility.mjs
node scripts/verify-privacy.mjs
node scripts/verify-links.mjs
node scripts/verify-offline.mjs
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```
