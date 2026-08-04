# Dashboard QA Report

Date: 2026-07-30, hillside rebuilt and re-verified 2026-08-03, planting section added and verified 2026-08-04  
Target: `dashboard/index.html` opened locally with no network dependency

## Automated and structural checks

| Check | Result | Evidence |
|---|---|---|
| Required local entry point | Pass | `index.html` exists |
| Required 12 content sections | Pass | Overview through Sources & Methodology present, including Trees & planting |
| Local assets and document links | Pass | 0 missing across HTML and document registry |
| Offline dependency audit | Pass | No HTTP(S), CDN, external font or imported-network references |
| Structured data architecture | Pass | 14 JSON files plus a local `data.js` file-safe bundle |
| English/Persian translation parity | Pass | Matching translation-key sets |
| RTL implementation | Pass | Persian switches document language and direction; RTL-specific CSS present |
| Survey point count | Pass | 8 points |
| Unified outer boundary | Pass | 7 points; Pt8 excluded from outer ring |
| Verified site area | Pass | 487.428568 m² |
| Elevation range and relief | Pass | 1647.899–1659.653 m; 11.754 m |
| Road and north assumptions | Pass | Pt2–Pt1; drawing +Y |
| TIN slope range | Pass | 34.5192406–44.0310687% |
| Environmental science integration | Pass | Geolocation, climate, solar, wind, geography, hazard, geology, soil and projections are bundled from local research outputs |
| Rejected concepts | Pass | Not bundled and not shown as recommendations |
| Visible absolute Mac paths | Pass | None in UI or safe report copies |
| Immutable site base | Pass | Before/after file hashes identical; source manifest check passes |
| JavaScript syntax | Pass | `app.js`, `terrain-3d.js`, `data.js` and the scripts parse successfully |
| Static validation suite | Pass | 75/75 checks |
| Anti-fabrication gate | Pass | Recursive scan of all 18 data files: no key matching `design_wind|basic_wind|base_acceleration|seismic_zone|bearing_capacity|snow_load|frost_depth|setback|far_ratio|allowable_` ships outside a `requires-*` status. Written **before** the Stage 4 derivations so it gates them rather than auditing them |
| Degree-days reconcile | Pass | Monthly sums match the published annual totals: HDD18 **2585**, HDD15.5 2062, CDD10 **2399**, CDD18 965 K·day/yr from 10,958 days |
| Percentile temperatures | Pass | −16.3 °C / +37.2 °C daily extremes; never named `design_temperature`, and the ASHRAE distinction is stated in the data rather than assumed |
| Wind return periods | Pass | Gumbel on 30 annual maxima of the **daily** gust series: 50-yr **116.2 km/h**, with the 30-year observed 117.0 km/h sitting between the 50 and 100-year fits. `factors_applied: []` beside four required factors |
| Rejected wind fit is published | Pass | The hourly-mean fit (~7 m/s at 50 years, four times too low) ships as a documented negative — which is what makes the accepted figure checkable rather than merely asserted |
| TIN facet areas reconcile | Pass | Facet plan areas sum to **487.4286 m²** against the verified 487.428568; 3D surface **522.42 m²**, ratio 1.0718; **100%** of the parcel in the 33–50% slope band |
| No earthwork quantities | Pass | Cut/fill volumes and balance elevations are deliberately absent; an eight-point TIN cannot carry them |
| Procurement register | Pass | 19 rows, every one `requires-*` with a `procure_via`, a `blocks` and a bounded `proxy_available`, each resolving to a known gate and family |
| Terrain horizon replaces the flat assumption | Pass | 72 azimuths × 15 radii from 100 m to 27 km; every solar position annotated with `horizon_deg` and `above_horizon`; no surviving flat-horizon claim in markup, data, translations or the methodology document |
| Near/far split is enforced | Pass | Far field (>500 m) is `regional-data`; near field and combined are `preliminary-inference`, because one 90 m DEM cell is wider than the 25 m parcel |
| Observer datum gap is published, not hidden | Pass | DEM reads **1640 m** at the site against a surveyed 1647.899–1659.653 m; the difference is a field, not a silent substitution |
| Concept frame transform | Pass | Two points fix it, all eight test it: worst survey round-trip error is exactly **0 m** |
| Concept heights are derived, not invented | Pass | All 44 rooms declare a `height_source`; every one resolves to 3.08–3.10 m from the underside of its bar's mono-pitch roof |
| 3D solar geometry | Pass | 506 precomputed positions verified analytically in Node against the shipped `terrain-3d.js` |
| Interpolation bound | Pass | 213 sample intervals; measured deviation never exceeds the published ≤0.11° altitude / ≤0.23° azimuth |
| Vendored Three.js integrity | Pass | SHA-256 pinned (r160 UMD build) |
| Offline `file://` preconditions | Pass | No ES modules, no `fetch`/XHR, data arrives as a global from a classic script |

Run the repeatable checks with:

```text
node scripts/generate-data.mjs
node scripts/validate-static.mjs
node scripts/verify-solar-3d.mjs
```

The solar table is sampled every **10 minutes** for the three season arcs and
every 30 for the monthly days. That step is not cosmetic: the slider is
continuous and blends two neighbouring samples, and at 30 minutes the blend
deviated by up to 1.38° in azimuth near summer noon, where the sun sweeps 32.5°
between samples. The published bound is regenerated with the data, so a step
change that is not regenerated fails the suite rather than silently widening the
error.

## Browser and visual QA

Status: **Partially complete.** The 3D and RTL-legend work below was verified in
Chrome over a localhost server; several older items remain unclaimed.

### Verified in Chrome

| Check | Result | Evidence |
|---|---|---|
| 3D viewer mounts | Pass | Canvas inserted on scroll; TIN, contours, boundary, road, 8 point labels, sun marker and sun-path arc all render |
| Shadows are sun-driven | Pass | Cast shadow appears and tracks the sun; direction correct for an east sun (shadow falls west) |
| Shadow length is geometrically right | Pass | Rendered shadow agrees with the analytic ruler; module and closed form both give 11.196 m for a 3 m wall at 15° |
| Slope self-shading | Pass | Facet normal · sun direction is negative for SW sun (−0.072 at 220°/15°, −0.239 at the winter sunset azimuth), so the parcel correctly receives no direct sun there |
| Language toggle preserves the road label | Pass | Regression check: `setLanguage` used to dispose the sprite permanently. Now reads `راه · Pt2–Pt1` |
| Labels survive a terrain rebuild | Pass | After vertical scale 1×→2× then EN→FA, the in-scene north label retextures to `شمال` and widens; registry holds 1 scenery + 9 terrain labels |
| Elevation legend direction | Pass | Measured label order against the rendered gradient in both directions; all four combinations now put the colour under its own value |
| Whole-day shadow trace | Pass | Ray-to-TIN intersection, not the level-ground formula. Across the 35 drawn winter vertices the bearing from the object base to each traced point differs from `(azimuth + 180) mod 360` by at most **1.0 × 10⁻⁶ degrees**. Distances run 5.86–13.54 m against a flat-ground 3.34 m at noon — the ground falls away downslope, which is the reason for drawing it |
| Shadow trace breaks rather than bridges | Pass | 3 leading and 19 trailing winter samples miss the seven verified facets and are omitted; the polyline is not carried across unmeasured ground |
| Shadow trace is legible | Pass | Regression: it first shipped in a dark slate indistinguishable from the TIN facet edges, which all radiate from the Pt8 hub the object stands on. Now blue |
| Continuous time and playback | Pass | 12:22 → 12:56 in 1.2 s of playback; Escape stops it and the clock freezes; `aria-pressed` returns to `false`; label reads پخش/توقف in Persian |
| Interpolated readings are labelled | Pass | Off a sample the note reads `درون‌یابی میان نمونه‌های ۱۰ دقیقه‌ای · بیشترین انحراف ≤۰٫۱۱° / ≤۰٫۲۳°` |
| Mirrored sun controls stay in step | Pass | 6 season buttons and 2 sliders across two sections; both time labels read ۱۲:۲۲ together, both season groups mark `winter` |
| Vertical exaggeration withholds visibly | Pass | At ×2 the trace checkbox disables and the note appears in both languages rather than leaving a checked box that silently draws nothing |
| Persian table headers | Pass | All 31 header cells localized. Read back from the DOM: `ماه · میانگین دما · بیشینه دما · … · یخبندان` |
| Wide tables scroll | Pass | `.table-shell` had no rules at all while its tables are `min-width: 920px`; now `overflow-x: auto`, so longer Persian headers do not push overflow toward the unreachable inline-start edge |
| Accessible names localize | Pass | 35 hooked attributes; the theme toggle reads `استفاده از پوسته تاریک`, the brand `خانه شناخت سایت`, the seven gate tooltips their section names. Only 2 bare `aria-label`s remain, both owned by JS on purpose |
| Image alt text follows the language | Pass | The lightbox buttons already carried both languages; the `<img>` they wrap did not. Now `سه چندضلعی اولیه نقشه‌برداری با تراز نقاط` |
| Canvas text uses Vazirmatn | Pass | All 14 `context.font` sites went through one helper reading the computed body family. Verified `"Vazirmatn Local", "Noto Sans Arabic", …` |
| Compass points read as words | Pass | Wind rose ticks render شمال / شرق / جنوب / غرب and the hub شرق — full words, because ش alone is ambiguous between شمال and شرق. Geometry is **not** mirrored; only the text changes |
| Cursive joining | Pass | 10 selectors reset `letter-spacing` to `normal` under `html[lang="fa"]`; `th` measured `normal` in Persian and `0.54px` in English |
| Smallest Persian text | Pass | 31 selectors floored at 10.5px so Vazirmatn's nuqta resolve; measured 10.5px in Persian, 9px in English |
| No LTR→RTL flash | Pass | An inline `<head>` script restores `lang`, `dir` and theme before the stylesheet. On load with `houseai-language=fa` the document already read `lang="fa" dir="rtl"` |
| Logical padding replaced RTL twins | Pass | `.limits-card li` and `.document-toolbar select` measured 28px/0 and 14px/38px on the correct sides with their `html[dir="rtl"]` overrides deleted |
| English is unchanged | Pass | Same read-back in English: 9px, 0.54px tracking, Latin `E`, `Longitudinal Section L–L (South–North)`, `14 registered datasets` |
| Concept massing renders inside the boundary | Pass | 23 volumes for option A; centres span x −7.0…7.5, z −7.5…8.5 against a boundary of −13.7…15.0 / −14.6…15.4. Rooms, retaining zones, garage platform, courtyard and mono-pitch roofs all present |
| A/B/C switcher drives both views | Pass | 23 / 21 / 24 concept meshes for A / B / C, with the section title repainting to `گزینه B — خانه دوطبقه با پارکینگ هم‌تراز راه` |
| Horizon silhouette ring | Pass | 73 vertices — 72 azimuths plus the closing point — with `fog: false`, and its own label owner in the registry so a rebuild drops only its sprite |
| Effective-sun readout | Pass | Winter reads ۰۸:۱۰ / ۱۶:۳۰ with ۸٫۵۰ h access and ۱٫۱۷ h terrain-shaded, against an astronomical 07:28–17:16 |
| Procurement register | Pass | 19 rows render; the gate filter narrows to 9 for before-permit and back to 19 for all; headers and bodies both localize |
| Derived statistics render in both languages | Pass | Persian ۲۵۸۵ K·day, ‎−۱۶٫۳ °C, ۱۱۶٫۲ km/h, ۴۸۷٫۴۲۸۶ m², ۱۰۰٫۰ %; English `Heating degree-days, base 18°C`, `Coldest 0.4% of daily minima` |
| 13 sections in document order | Pass | overview → survey → terrain → geography → climate → solar → wind → hazards → architecture → concepts → investigations → documents → methodology |
| Surrounding hillside renders | Pass | A 300 m square surface: the surveyed 38.27% slope out to 45 m, easing into the smoothed 90 m DEM by 150 m. Ground rises about 34 m to a crest due south past the road edge and falls about 21 m to a valley floor to the north. The N–S profile was printed before rendering to confirm the blend stays monotonic uphill — no false terrace across the approach |
| The field is continuous with the hill | Pass | Regression fixed: the parcel used to sit in a squared-off opening with walls down to a moat, which read as the site standing inside a hole. The surface now runs under the parcel, set 0.6 m below the fitted plane — more than the plane's largest positive residual (0.305 m) — so the measured TIN is above it everywhere and the two read as one slope |
| No caption plate over the terrain | Pass | The `Surrounding hillside · DEM, not surveyed` sprite is deleted. The caveat is in the section's evidence line in both languages: `the hillside is the surveyed 38.27% slope carried out into a 90 m DEM · trees are illustrative` |
| The datum shift is visible in the data | Pass | The DEM reads 1640 m at the site and 1627.77 m after smoothing, against the plane's 1654.23 m at the origin. `datum.offset_m` publishes the single constant (26.461 m); the generator applies it once and a static check asserts the viewer does not shift the surface again |
| The hillside layer is unlit and casts nothing | Pass | Fixed north-west relief shade baked into vertex colours. It hangs off `scene`, not `terrainRoot`, so `updateShadowExtent` never sees it — asserted statically. The datum plane and its metre grid now hide while the layer is on; at hillside range the grid read as a dark hatch patch over the site |
| Illustrative trees render and cast | Pass | Four trees, positions derived from the boundary rather than typed. Shadows land on the TIN at winter 12:22 and are visible under each crown. They hang off `terrainRoot` and `updateShadowExtent` unions `plantingGroup`, so the 23 mm texel survives — four crowns under 7 m barely move a 24 m bounding sphere |
| Trees are withheld under exaggeration | Pass | At any scale other than ×1 the trees are not built and their toggle is disabled, alongside the existing ruler and shadow-trace withholding. A 7 m crown over a stretched slope would read as a measurable shadow that is not |
| Blockiness is a sampling artefact, and it is removed | Pass | The elevation endpoint returns the DEM cell value rather than an interpolation, so 40 m sampling of a 90 m raster came back as flat 80 m blocks — whole rows identical. Two binomial passes restore a landform; the kernel and pass count ship in `smoothing`. The drawn grid is 5 m so the surface meets a 25 m parcel without a facet crossing its boundary |
| Prevailing wind renders | Pass | Solid arrow (`ArrowHelper`'s shaft is a 1 px line and vanished against the slope) pointing west for the published `E`, since the convention is the direction the wind blows from. Label reads `Wind from E · 1.7 m/s mean` and fits its plate at full size |
| Wind motion is contained | Pass | Off by default. Turning it on starts the only persistent rAF loop in the project; turning it off cancels it and the crowns settle. It bails while the tab is hidden and never starts under `prefers-reduced-motion`. 40 frames observed while on, none after |
| Hillside is about twenty times the field | Pass | 100 m square against 487.428568 m² — a ratio of 20.5, held between 10 and 25 by a static check. Cut back from the earlier 300 m patch, which carried landform nobody asked about |
| Roads are level benches carved into the slope | Pass | Regression fixed twice: laid on the surface a level deck was buried on its uphill side, and carving with a 5 m grid produced fragments. The corridor is now carved in the hillside data at 2.5 m spacing, capped at 6 m of cut or fill, and the renderer only drapes the deck on it. The carve stops at the parcel boundary — a downhill batter is an embankment and would be invented fill on measured ground |
| The two roads read as different evidence | Pass | Upper: surveyed Pt2–Pt1 frontage, solid dark deck. Lower: client-reported, paler and semi-transparent, named in the caption as `lower road client-reported`. Levels 1659.508 m and 1648.444 m, each the mean of the two surveyed elevations on its own edge |
| Trees stand at the downhill end | Pass | All four sit below the parcel's midpoint elevation on the fitted plane, asserted statically. Their crowns reach about 1655–1659 m, under the high corner at 1659.653, so the shadow bounding box and its 23 mm texel are unchanged |
| Persian pass with every new layer on | Pass | Roads, trees and wind all on, `lang="fa"`, `dir="rtl"`: the toolbar wraps to three rows with zero horizontal overflow, and the wind label reads `باد از شرق · میانگین ۱٫۷ م/ث` — Persian digits, fitting its plate at full size |
| Sun marker clears the hillside | Pass | The day arc and marker moved from 34 m to 62 m radius, just outside the 100 m patch, with the light at 200 m. The default orbit widened from 64 m to 92 m so the marker is in frame rather than past its edge |
| Wind follows the season on screen | Pass | Winter and equinox draw `Winter wind from E · 1.6 m/s mean` and the spring row; the summer solstice draws `Summer wind from W · 1.9 m/s mean` and the arrow flips to point east. The solar-date-to-wind-season map is published and statically checked |
| Scene has a sky and matched fog | Pass | Canvas-built vertical gradient, theme-aware, with the fog colour taken from its own horizon stop, so the hillside rim settles into the sky instead of ending on a hard cut against a flat panel. No image file and no environment map — `file://` still works |
| Trees read as trees | Pass | Deterministic per-tree variation from the id: crown hue, scale, rotation, trunk lean, and a second smaller lobe. Four copies of one sphere read as furniture before this |
| Plan against surface area | Pass | Renders in both languages: surface excess 34.99 m² (7.18%), equal-depth level 1653.907 m, and the note that the excess is not buildable land. The 0.25 m raster reproduces the verified plan area to 0.009 m² |
| Level-platform table | Pass | 24 rows from 1648.00 m to 1659.50 m, each with area to cut, area to fill, deepest cut, deepest fill and area within ±1.5 m. Most area within ±1.5 m is 154.1 m² at 1651.50 m. No volumes anywhere, asserted statically |
| Console | Pass | Clean apart from the known r160 UMD deprecation notice emitted by the vendored bundle. Read with tracking started before the load: zero errors or exceptions across the load, the FA and EN toggles, ×2, Reset view, and the hillside layer off and on |

Note: `document.visibilityState` must be `visible` for these checks. Chrome
suspends `requestAnimationFrame` and `IntersectionObserver` in a hidden tab, so
a backgrounded window shows an un-mounted stage and no rendering — an artefact of
the harness, not the page.

### Trees and planting — verified in Chrome, 2026-08-04

Verified over a localhost server in **both languages** and in **both themes**.

| Check | Result | Evidence |
|---|---|---|
| Section renders complete | Pass | 5 constraint cards, 11 shortlist cards, 4 do-not-plant cards, 2 ask-locally cards, 4 placement zones, 6 care items |
| Photographs load and are attributed | Pass | All 17 bundled images display; each caption carries the author and licence recorded in the manifest, e.g. `Photograph: Katrin Schneider / korina.info · CC BY-SA 4.0` |

| Verdicts render distinctly | Pass | `Clears` / `Marginal` / `Fails` pills use the same vocabulary as the hazards section; *Cercis siliquastrum* draws `COLD: FAILS` in the danger colour while its other three tests read `CLEARS` |
| Verdict filter | Pass | 11 cards → 1 on `Fails` → 5 on `Marginal` → 11 on `All` |
| Disputed sources are visible, not smoothed | Pass | *Platanus orientalis* and *Quercus brantii* both carry the `SOURCES DISAGREE` tag and print the contradiction under the card |
| Persian numerals in generated prose | Pass | Interpolated figures arrive as Persian digits (`۲۹۹٫۵ درجه`, `۴۸۷٫۴۲۸۵۶۸ مترمربع`, `منفی ۲۶٫۱`); a tagged template in `species-data.mjs` makes the Latin-digit version unwritable |
| RTL layout | Pass | Chips, test pills, quote rules and the photo caption all mirror; mixed-script source labels are `bdi`-isolated, so the Persian conference-paper title no longer throws its bracket to the wrong end of its own link |
| Dark theme | Pass | Cards, chips, quote rules and photo captions all legible in dark; this is the first section whose dark pass was actually done |
| Console | Pass | Only the known Three.js r160 deprecation warning |

Not claimed for this section: `file://` (same extension limitation as everywhere
else — the mechanical preconditions are asserted statically instead), the
narrow-mobile breakpoint, the print stylesheet, and whether the Wikipedia links
resolve, which needs a network the package deliberately does not use.

### Fruit and the crop verdict — verified in Chrome, 2026-08-04

Same conditions: localhost, **both languages**, **both themes**.

| Check | Result | Evidence |
|---|---|---|
| Section grew coherently | Pass | Heading reads `21 trees, tested against 5 things this site already measures — and one more for the 12 that fruit`, and its Persian counterpart; 6 constraint cards, 21 shortlist cards, 12 crop blocks. Every count comes from the data, so the heading cannot go stale |
| The frost constraint says who it applies to | Pass | Its card alone carries a `FRUIT TREES ONLY` / `فقط درختان میوه` pill and the sentence that the other five apply to every species. The first draft counted it as a sixth site-wide constraint and claimed all 21 trees were tested against it |
| Spring-frost constraint card | Pass | Renders the statement, then the ERA5 bias caveat in a quote rule, then the chill note in a moss rule, then the source line — four distinct registers, visibly not one paragraph |
| Frost dates are readable, not machine format | Pass | `5 Apr` / `17 Apr` / `24 Apr` and `۵ آوریل` / `۱۷ آوریل` / `۲۴ آوریل`. The raw `MM-DD` stays in the JSON for the checks; the first render showed `04-05` in prose and was fixed |
| Crop block is visibly a second verdict | Pass | Tinted panel inside the card with its own pill — *Prunus armeniaca* shows `COLD: CLEARS` in the survival row and `Crop: Fails` in the panel below, with `BLOOM VS FROST: FAILS` beside `POLLINATION: CLEARS` |
| Withheld figures render as withheld | Pass | *Punica granatum* draws `FLOWERS —` and `BUD KILL 10% / 90% —` with the reason on hover, and `BLOOM VS FROST: UNTESTED` rather than a guess. Orchard entries with no published spread draw `CROWN —` and `SHADE FOOTPRINT —` |
| Filter gained a fruit axis | Pass | 21 → 12 on `Fruiting` → 5 on `Clears` → 12 on `Marginal` → 4 on `Fails` → 21 on `All` |
| Fruit summary panel | Pass | Headline plus four counted chips (`12` listed, `2` flower after the last frost, `2` need a second tree, `1` clear on every crop test), then the position note, the irrigation note and the rule; 4 chips on desktop, 2 columns under 900 px |
| Photographs | Pass | 26 of 28 bundled images load and carry author plus licence; the two absences are the licence gate working — *Malus domestica* refused on `GFDL 1.2`, *Vitis vinifera* on CC BY-SA with no named author. The apple card renders correctly with no photograph |
| Persian numerals and month names | Pass | No Latin digits leak into any Persian leaf outside the Latin-identifier allowlist. Bloom months in prose now use the same Gregorian month names the chips render (`مارس`, `آوریل`, `مه`) — the first draft mixed Jalali names into new prose beside Gregorian chips |
| RTL layout | Pass | Crop panel, its chips and its test pills all mirror; the tinted panel keeps its inline-start edge |
| Dark theme | Pass | Crop panel's `color-mix` tint stays distinguishable from the card behind it in dark without going muddy |
| Console | Pass | Clean; no messages at all on the species interactions |

Not claimed here: the same four as above, plus whether any of these species is
actually available in a Kermanshah nursery — which is the register's own stated
limitation and not a browser question.

One known nit, pre-existing and not introduced by this change: in RTL the unit
in `6–8 m` renders as `m ۸–۶`, because the chip concatenates the unit as text
rather than isolating it. It affects the height, crown and shade chips that were
already shipping, so it is recorded here rather than fixed inside this change.

### Deliberately not done

`font-weight` is used at 17 distinct values against the 4 bundled Vazirmatn
faces, so everything from 610 upward resolves to 700 and Persian loses the
distinction between a 650 label and a 760 heading that Latin keeps. Fixing it
properly means tokenising ~40 declarations into `--fw-*` and remapping them
under `html[lang="fa"]`; remapping is what would restore the contrast, since no
remap can conjure a weight the font does not ship. That is an aesthetic
fidelity loss rather than a legibility failure, and it is recorded here rather
than half-done.

### Still unclaimed

- navigation interaction across every section
- image lightbox and every document-link click
- narrow-mobile viewport inspection
- dark theme visual pass for every section other than Trees & planting
- `file://` confirmation in a browser. The Chrome extension cannot open `file://`
  URLs, so the three mechanical preconditions are asserted in
  `validate-static.mjs` instead: no ES modules, no `fetch`/XHR, and runtime data
  arriving as a global from a classic script tag.
- refreshed captures of every section. **All seven files in `screenshots/` are
  now stale.** `terrain-3d-section.png` and `terrain-3d-persian.png` show the
  2.2 km regional disc and its `Region` preset, both deleted; the other five
  predate the 3D feature entirely. They are retained only as prior evidence and
  none of them documents the shipped viewer.

### Fixed as a result of this pass

A resize while the tab was hidden left the stage blank, because rendering is
on-demand and browsers suspend `requestAnimationFrame` in a hidden tab, so the
cleared framebuffer had no frame to repaint it. `terrain-3d.js` now redraws on
`visibilitychange`.
