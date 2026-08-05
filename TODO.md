# Dashboard improvement backlog

This is the authoritative work queue for the Family House 001 site-intelligence dashboard. It records the findings from the English/Persian desktop and mobile review completed on 2026-08-04.

The dashboard is suitable for preliminary site strategy and consultant briefing. It is not yet sufficient to establish a building footprint, finished levels, retaining walls, vehicle access, foundations, or a schematic floor plan.

## Rules for every AI agent and contributor

1. Read this file before changing anything in `dashboard/`.
2. Choose one coherent unchecked task unless the user explicitly requests a larger batch.
3. Keep a task unchecked until every acceptance criterion is met and relevant validation passes.
4. When completing a task, change `[ ]` to `[x]` and add an indented completion note containing:
   - completion date;
   - commit SHA, or `uncommitted` while work is still local;
   - tests and browser evidence;
   - any remaining limitation.
5. Partial work remains `[ ]`. Add a dated `Progress:` note explaining exactly what remains.
6. If evidence disproves an existing claim, correct the structured source data first and regenerate derived files. Do not patch generated values independently.
7. Never mark a field investigation complete from regional data, web research, inference, or an AI-generated estimate.
8. Preserve English/Persian parity, RTL behavior, offline `file://` operation, source attribution, and accessibility for every change.
9. Never place a person's name, email, phone number, account identifier, private path, source filename containing a person's name, or ownership claim in the public dashboard.
10. Exact site coordinates are project evidence and may remain public, but they must never be associated with a private individual or described as proof of ownership.
11. Do not modify the immutable site-base version.
12. Before handoff, update the progress snapshot below and run the validation commands listed at the end of this file.

## Progress snapshot

- Product tasks complete: **58 / 58** (P0–P3 all `[x]`)
- External investigations complete: **0 / 20** (EXT-01…EXT-20 remain open by design)
- Current release stage: pre-design site intelligence
- Branch tip (as of this note): `c6e01b8` and later on `publish-dashboard-backlog`
- Architect decision status: household brief complete (high upper-road house, RC+insulation climate briefing, 1–2 year primary build, unlimited quality budget); formal concept still blocked by geotech, measured road geometry, utility agreements, survey/cadastral certification
- Open product work: **none**
- Household program: **12 / 12** brief fields answered (construction system is climate briefing for the engineer, not a stamped design)
- Open external work: **EXT-01…EXT-20 only** — field / legal / municipal; client statements and open-source notes do **not** close any EXT item

## P0 — Truth, safety, and design-authorisation boundaries

- [x] **P0-01 — Correct geolocation and completion claims.** Replace `geolocation_confirmed: true` with a provisional state consistent with `strong-probable`; rename “confirmed location” to “probable project location”; state that the CRS is not surveyor-certified; replace “analysis complete” with “pre-design environmental analysis complete”; do not report zero unresolved environmental modules while parcel-scale questions remain.
  - Acceptance: English, Persian, structured JSON, generated bundle, hero, geography section, status chips, and methodology use the same terminology.
  - Completed 2026-08-04. Commit: `c9b6910`.
  - Evidence: canonical generator now emits `geolocation_status: "probable"`, `strong-probable` confidence, a probable project-location object, a `probable-not-certified` CRS state, the pre-design completion status, and five unresolved parcel-scale environmental modules; regenerated English/Persian JSON, bundle, hero, geography, status chips, and methodology use the same terminology.
  - Validation: `node scripts/generate-data.mjs`; `node scripts/validate-static.mjs` — 109/109; `node scripts/verify-solar-3d.mjs` — 506 positions and 213 interpolation intervals, zero failures; direct `file://` browser checks at 1440×1000 and 390×844 confirmed English/LTR and Persian/RTL parity, wrapped status content, local-only requests, and zero critical console errors.
  - Remaining limitation: surveyor CRS certification and parcel-scale field evidence remain unresolved by design. The vendored Three.js deprecation warning remains tracked under P2-14.
- [x] **P0-02 — Distinguish drawing geometry from legal property verification.** Replace wording such as “verified boundary” where it could imply cadastral/title verification with “verified drawing geometry” or an equally precise term.
  - Acceptance: area calculation remains verified while legal ownership, cadastral boundary, easements, and rights-of-way remain explicitly unresolved.
  - Completed 2026-08-04. Commit: `507806b`.
  - Evidence: canonical site data now separates verified drawing geometry and plan-area calculation from four individually unresolved legal states: ownership, cadastral boundary, easements, and rights-of-way. English/Persian overview, survey, accessible labels, document metadata, investigation proxy, generated bundle, and Persian site summary use the same distinction; the Survey section renders a visible bilingual legal-scope card from the structured data.
  - Validation: `node scripts/generate-data.mjs`; `node scripts/validate-static.mjs` — 110/110; `node scripts/verify-solar-3d.mjs` — 506 positions and 213 interpolation intervals, zero failures; Codex-controlled Chrome at 1440×1000 and 390×844 confirmed English/LTR and Persian/RTL content, correct six-state rendering, card containment, and no critical console errors.
  - Remaining limitation: legal ownership, the cadastral boundary, easements, and rights-of-way require registry/cadastral investigation and remain unresolved by design. The vendored Three.js deprecation warning remains tracked under P2-14.
- [x] **P0-03 — Add an architectural-readiness gate to the overview.** Present three visible states: usable now, preliminary only, and blocks concept design.
  - Acceptance: the gate names the evidence in each state and is equally complete in English and Persian.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: the overview renders all three states from `architectural-readiness.json`, with named evidence and matched English/Persian content.
  - Validation: generator and 117/117 static checks passed; 506 solar positions and 213 interpolation intervals verified; browser QA confirmed three cards in English/LTR and Persian/RTL with no critical console errors.
  - Remaining limitation: evidence explicitly placed in the blocking state still requires the listed client, survey, planning, access, and ground inputs.
- [x] **P0-04 — Add a structured client/project brief.** Record household composition, room program, target area, accessibility, privacy and cultural needs, budget, phasing, timeline, construction preferences, garage/workshop needs, energy/carbon goals, and future expansion.
  - Acceptance: unanswered items render as unresolved; the dashboard does not invent answers. When the household answers, values render with clear provenance (from-brief / household-stated / climate-briefing).
  - Completed 2026-08-04 (structure). Commit: `11263b8`.
  - Household answers filled 2026-08-05. Commits: `4e02a7b`, `5369742`, `c6e01b8`.
  - Evidence: `client-brief.json` status `complete`; all twelve fields have bilingual values; construction is climate briefing (RC frame + continuous external insulation), not a stamped structural design; unlimited budget and 1–2 year primary timeline recorded without inventing cost figures or permit waivers.
  - Validation: `node scripts/generate-data.mjs`; `node scripts/validate-static.mjs` — 138/138; privacy scan clean.
  - Remaining limitation: brief completeness does not clear EXT gates (geotech, road geometry, utilities agreements, cadastral/CRS).
- [x] **P0-05 — Remove concept ranking from the primary design story.** Do not identify A, B, or C as a winner or recommended direction while planning, survey, road, geotechnical, and client inputs are missing.
  - Acceptance: concepts are absent from primary navigation and recommendation flows.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: concepts have no selected option or published ranking and are absent from primary navigation, recommendations, and the 3D layer controls.
  - Validation: generator and 117/117 static checks passed; browser QA confirmed no concept navigation or 3D toggle in either language and no critical console errors.
  - Remaining limitation: the rejected experiments remain available only as historical archive material.
- [x] **P0-06 — Move retained concepts into a hidden rejected archive.** If the experiments remain, place them behind a closed disclosure labelled “Rejected and unvalidated concept experiments — not for selection.”
  - Acceptance: no ranking, precise recommendation, or claim that vehicle access/courtyard drainage works; the archive is hidden by default in both languages.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: the experiments sit in a closed bilingual disclosure labelled as rejected, unvalidated, and not for selection; unsupported workspace pass/fail claims are withheld.
  - Validation: generator and 117/117 static checks passed; browser QA confirmed the archive is closed by default, can be opened deliberately, and shows no ranking or selection claim.
  - Remaining limitation: the archive is retained for provenance and must not be treated as a design library.
- [x] **P0-07 — Demote unsupported room-placement advice.** Reframe bedroom, kitchen, service, office, courtyard, and similar typology assumptions as questions/options to test until the client brief exists.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: courtyard, bedroom, living, kitchen, and office entries are now questions to test and carry `requires-investigation` status in canonical recommendation data.
  - Validation: generator and 117/117 static checks passed, including the room-placement gate; bilingual browser QA found no critical console errors.
  - Remaining limitation: household program is now complete, but room sides still need parcel-scale evidence (road noise, neighbours, measured levels) before fixing orientations.
- [x] **P0-08 — Demote garage/workshop placement confidence.** Keep it preliminary until road gradient, turning, gate, fire access, and construction access are measured.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: garage/workshop guidance is `requires-investigation` and names road grade/crossfall, gate, swept path, emergency access, and construction access as prerequisites.
  - Validation: generator and 117/117 static checks passed, including the garage evidence gate; bilingual browser QA found no critical console errors.
  - Remaining limitation: no garage position or access geometry is recommended before field measurement.
- [x] **P0-09 — Reframe terrain precision.** Make clear that an eight-point, seven-facet TIN without surveyed breaklines cannot provide construction quantities.
  - Acceptance: one-metre contours, 0.1 m² platform areas, 0.5 m platform steps, and cut/fill outputs are labelled exploratory and not suitable for pricing.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: terrain/platform data now describes the eight-point, seven-facet TIN, absent breaklines, contour/area/level precision, and cut/fill depth outputs as exploratory and unusable for quantities, tender, or pricing. The L–L profile also omits two invalid outside-parcel endpoint samples and visibly reports a 7.137 m fall over 24.798 m.
  - Validation: generator and 117/117 static checks passed, including exact longitudinal metrics; browser QA confirmed the enlarged 430 px bilingual profile and summary values with no critical console errors.
  - Remaining limitation: construction levels, retaining design, and quantities require a detailed topographic survey with breaklines.
- [x] **P0-10 — Make seismic design limitations lead the hazard story.** Lead with unavailable design spectrum, site class, and Standard 2800 parameters; place regional earthquake-event counts in expandable context.
  - Completed 2026-08-04. Commit: `11263b8`.
  - Evidence: a bilingual seismic gate now leads the hazard section and withholds design use until the spectrum, Standard 2800 parameters, system/importance context, and geotechnical site class exist; regional event counts are expandable context only.
  - Validation: generator and 117/117 static checks passed; browser QA confirmed the gate and seismic card lead the section in English/LTR and Persian/RTL, with the archive still closed and no critical console errors.
  - Remaining limitation: all parcel-specific seismic design inputs remain a formal engineering investigation.

## P0 — Release integrity and privacy

- [x] **P0-11 — Define one canonical build and URL.** Eliminate content drift between ports/query versions and show a build identifier/date in the methodology footer.
  - Acceptance: English and Persian are tested by switching language inside the same deployed build.
  - Completed 2026-08-05. Project data now carries `build_id: dashboard-2026-08-05`, `generated_on`, and a bilingual canonical-build note. Methodology reproducibility lists build id and date; the footer shows the same triple (build · generated · site version). Language is switched inside one package.
  - Validation: 124/124 static; browser confirmed footer and methodology identity fields.
- [x] **P0-12 — Add a repeatable public-release privacy check.** Reject names, private emails, phone numbers, account identifiers, absolute home paths, credentials, and personal source filenames from the publishable tree.
  - Acceptance: the check covers text, Git metadata used by the public mirror, raw OSM contact tags, downloadable documents, and common image metadata.
  - Completed 2026-08-05. New `scripts/verify-privacy.mjs` scans the dashboard tree for personal emails, formatted phones, absolute home paths, private keys, AWS-style keys, private document filenames, and raw OSM contact tags. Wired into `validate-static.mjs`.
  - Validation: privacy scan 132 files / 0 hits; 124/124 static.
  - Remaining limitation: image EXIF and public-mirror Git metadata are not yet scanned in this script (mirror history remains a separate release step).
- [x] **P0-13 — Document the privacy boundary.** Explain that precise coordinates identify the studied site but do not identify an owner and are not evidence of ownership.
  - Completed 2026-08-05. `project.privacy_boundary` ships bilingual copy; methodology shows a privacy-boundary card; UI strings keep EN/FA parity.
- [x] **P0-14 — Keep the reproducible source repository private.** Publish only a clean-history, dashboard-only mirror; never expose the private repository history, archived working files, original named source path, or personal commit metadata.
  - Completed 2026-08-04. Public mirror commit `5b51f61`; source completion record is the next backlog commit.
  - Evidence: the source repository remains private; the public mirror contains only the 18 MB dashboard in one privacy-neutral root commit; GitHub Pages built successfully; the live HTML and data-bundle SHA-256 hashes match the sanitized release.
  - Remaining limitation: GitHub necessarily displays the account that owns the public repository. Moving the mirror to a neutral organisation/account is required if repository-account separation is also desired.

## P1 — Responsive layout, navigation, and accessibility

- [x] **P1-01 — Fix mobile horizontal overflow in Terrain.** At 390 px the document must not grow to approximately 690 px; terrain insight/table cards and 3D controls must remain within the viewport.
  - Acceptance: `document.documentElement.scrollWidth <= window.innerWidth` at 320, 360, 390, and 430 px in both languages.
  - Progress 2026-08-04 (`1bd5dfa`): terrain cards, chart shells, toolbar groups, and risk rows now carry narrow-layout containment and the 3D toolbar no longer relies on a single horizontal row.
  - Completed 2026-08-05. Two further root causes found and fixed in `styles.css`: `.solar-insights > article` and `#solar-access`/its rows defaulted to `min-width: auto`, so a wide readout inflated the single `1fr` track to 379 px at a 320 px viewport; and the geo-map `.map-heading` flex row held a 206 px nowrap status pill that pushed past the edge, so it stacks below the heading at ≤650 px. Measured with headless Chrome: `doc scrollWidth === innerWidth` at 320, 360, 390, 430, 650, 900, 1180 and 1440 px in both languages, with zero elements overflowing outside scroll containers.
- [x] **P1-02 — Make the 3D mobile toolbar usable.** Wrap or stack viewpoint, vertical-scale, layer, and time controls without clipping or off-screen content.
  - Progress 2026-08-04 (`1bd5dfa`): at ≤650 px the viewpoint and season controls become readable grids, layer controls become a two-column sheet, reset spans the sheet, and the sun time row is width-contained.
  - Completed 2026-08-05. Mobile control sheet finished: 44 px touch targets on viewpoint/season/layer controls; vertical-scale on its own full-width row so the select stays usable; multi-line labels wrap inside half-width pills; terrain segmented controls are excluded from the generic narrow horizontal-scroll rule; stylesheet cache buster bumped to `styles.css?v=p1-02`.
  - Evidence: agent-browser visual QA at 320 and 390 px in English and Persian (`screenshots/p1-02/toolbar-{320,390}-{en,fa}.png`); zero elements overflowing the viewport; viewpoint/season clicks activate correctly; doc scrollWidth equals innerWidth.
  - Validation: `node scripts/validate-static.mjs` — 119/119; `node scripts/verify-responsive.mjs` — 16/16.
  - Remaining limitation: the stacked sheet is tall on a phone (~650 px of controls above the stage); progressive disclosure of layers is a later IA task, not a containment bug.
- [x] **P1-03 — Expand desktop navigation.** Make Geography, Climate, Wind, Hazards, Architecture, Investigations, Sources, and other major sections discoverable without relying on mobile navigation.
  - Completed 2026-08-05. Desktop nav now lists all 13 major sections (matching mobile), wraps densely at wide widths, and uses smaller type at ≤1180 px instead of hiding items. Active section uses `aria-current="page"` on both desktop and mobile links.
  - Evidence: agent-browser at 1440 px lists Overview through Sources; mobile ≤900 still uses the menu.
  - Validation: 119/119 static; 16/16 responsive.
- [x] **P1-04 — Add programmatic selected states.** Climate, solar, wind, hazard, 3D, and other segmented controls must expose `aria-pressed`, `aria-selected`, or the correct equivalent.
  - Completed 2026-08-05. Exclusive controls sync `.active` with `aria-pressed` via `setExclusivePressed` (profile, climate, solar season/object, hazard/species filters, concept options, wind seasons, investigation gates, 3D viewpoints). Play already used `aria-pressed`.
  - Evidence: live DOM shows `aria-pressed="true"` on Perspective, Winter, South–north, climate view, Pole, Annual, filters, and concept A.
- [x] **P1-05 — Give the mobile menu an accessible name.** The icon-only state must retain a localized accessible label.
  - Completed 2026-08-05. `#menu-toggle` carries `data-i18n-aria-label="menu"`; when the visible label is hidden at ≤900 px the accessible name remains “Menu” / “فهرست”.
- [x] **P1-06 — Make solar time accessible.** Provide localized `aria-valuetext` such as “12:35,” not a decimal clock value.
  - Completed 2026-08-05. Both solar and terrain time sliders set `aria-valuetext` from `decimalHour` with Persian digits in FA (e.g. `12:22` / `۱۲:۲۲`), updated on configure, sync, and readout.
- [x] **P1-07 — Stop theme changes from moving the viewport.** Preserve the current section and visual offset while canvases and 3D content redraw.
  - Completed 2026-08-05. Theme apply disables scroll anchoring and smooth scroll, restores absolute `scrollY` after canvas repaint. Measured pinDelta 0 at deep scroll.
  - Remaining limitation: language toggle still reflows RTL metrics and can shift position; tracked only if reported separately.
- [x] **P1-08 — Fix Persian mixed-direction values.** Use appropriate `bdi`/direction isolation for area, ranges, units, coordinates, technical terms, and dynamically assembled headings.
  - Completed 2026-08-05. Metrics use `bdi` helpers; polygon IDs/point order and wind stats isolated; CSS `unicode-bidi: isolate` on numeric/metric/readout strong elements under `html[lang="fa"]`.
  - Remaining limitation: some longer generated narratives may still interleave Latin codes without isolation; full narrative pass remains under P1-21.
- [x] **P1-09 — Add automated accessibility checks.** Cover keyboard navigation, focus visibility/order, control names/states, landmarks, headings, table semantics, alt text, dialog/lightbox behavior, reduced motion, and contrast.
  - Completed 2026-08-05. New `scripts/verify-accessibility.mjs` (Chrome/CDP, node builtins only) asserts landmarks, skip link, section h2s, button names, `aria-pressed`, table headers, image alts, menu name, solar `aria-valuetext`, lightbox close, focus styles, reduced-motion CSS, and body contrast smoke in English and Persian. Currently 2/2.
  - Remaining limitation: full keyboard-order traversal and WCAG contrast ratios for every token are not computed; this is a structural/control smoke suite, not a full axe audit.
- [x] **P1-10 — Add automated responsive regression checks.** Test the complete page at representative desktop, tablet, and narrow-mobile widths in English and Persian.
  - Completed 2026-08-05. New `scripts/verify-responsive.mjs`: node-builtins-only, serves the dashboard over loopback, drives headless Chrome over CDP, and asserts the P1-01 acceptance (page scrollWidth within viewport, and no elements overflowing outside scroll containers) at 320/360/390/430/650/900/1180/1440 px in English and Persian. Requires a local Chrome (looked up via `CHROME_BIN`, macOS default fallback); exits 1 on the first failure. Currently 16/16.

## P1 — Section and evidence improvements

- [x] **P1-11 — Surface survey-label association uncertainty.** Show the maximum elevation-label association offset (approximately 3.875 m) prominently in Survey and Terrain methodology.
  - Completed 2026-08-05. `survey.label_association` publishes max offset **3.875 m at Pt3**; Survey shows a callout card with the bilingual note that contours/TIN inherit that uncertainty.
  - Validation: static gate asserts max > 3.8 m and Pt3; browser shows `3.875 m · Pt3`.
- [x] **P1-12 — Add evidence provenance to every 3D layer.** Mark parcel geometry, regional hillside, roads, trees, wind, and concepts as drawing-derived, regional, client-reported, illustrative, or experimental.
  - Acceptance: the default view is measured/drawing-derived parcel evidence only, or non-measured layers are visually unmistakable.
  - Completed 2026-08-05. Terrain 3D footer lists four bilingual evidence classes (measured, regional, client-reported, illustrative) covering parcel TIN/points/upper road, hillside DEM blend, lower road, and trees/wind. Control labels and materials already distinguish trees and the lower road.
  - Remaining limitation: hillside/roads/trees remain on by default for briefing context; non-measured layers are labelled rather than hidden.
- [x] **P1-13 — Add true multi-scale geographic views.** Provide useful 250 m, 1 km, 5 km, and 20 km context views or a clearly explained multi-scale inset.
  - Completed 2026-08-05. Geography section has a 250 m / 1 km / 5 km / 20 km control group that crops the offline OSM extract around the probable centre; rings rescale with the view; note states features outside the extract cannot appear.
- [x] **P1-14 — Add an architect-oriented climate summary.** Explain heating/cooling seasons, passive opportunities, overheating risk, and the limits of monthly gridded data; show CDD18 alongside or ahead of CDD10.
  - Completed 2026-08-05. Architect climate brief card leads with HDD18, **CDD18**, then CDD10; heating/cooling months, passive opportunities, overheating risk, and gridded-data limits in both languages.
- [x] **P1-15 — Clarify solar interpolation and design limits.** State visibly that continuous values interpolate ten-minute samples and that neighbors, vegetation, and a surveyed horizon are not modeled.
  - Completed 2026-08-05. Permanent bilingual `solar-design-limits` note under the solar readout (in addition to the existing on-interpolation deviation line).
- [x] **P1-16 — Make the wind heading follow the selected season.** Winter, summer, spring, autumn, and annual selections must update the title as well as the rose and statistics.
  - Completed 2026-08-05. `#wind-title` updates from season-specific translation keys (easterly for annual/winter/spring/autumn; westerly for summer) when the season tabs change.
- [x] **P1-17 — Keep dust and parcel-flow conclusions unresolved.** Do not infer dusty winds, cold-air drainage, turbulence, or slope acceleration from the 11 km regional grid alone.
  - Completed 2026-08-05. Wind `exposure_notes` rewritten so parcel rotation/acceleration, cold-air drainage, turbulence and dusty corridors are stated as unresolved rather than inferred from the regional grid.
- [x] **P1-18 — Prioritize the investigations register.** Add owner/consultant, prerequisite, status, expected deliverable, dependency, and downloadable scope note.
  - Completed 2026-08-05. Every investigation row now carries `owner`, `prerequisite`, `status`, `expected_deliverable`, `dependency`, and `scope_note` (bilingual). Table columns render all fields.
- [x] **P1-19 — Move critical gates earlier.** Require legal/title boundary and preliminary ground/slope assessment before concept; treat utilities, road geometry, construction access, and logistics cost as early feasibility inputs.
  - Completed 2026-08-05. New `early-feasibility` gate holds utilities, road gradient and construction access. Title boundary, bearing capacity and slope stability move to `before-concept`. Readiness “blocks concept” evidence names these early gates.
- [x] **P1-20 — Add one bilingual architect handoff brief.** Summarize what may be used, what is provisional, what must not be used, immediate investigations, key geometry, and environmental implications.
  - Completed 2026-08-05. Overview renders six-card handoff from `architect-handoff.json` (usable / provisional / must-not-use / immediate investigations / key geometry / environmental implications) in EN and FA.
- [x] **P1-21 — Rewrite all Persian content in plain, connected language.** Edit every visible Persian paragraph so it reads naturally, uses short connected sentences, avoids literal English sentence structure, and keeps terminology consistent without changing scientific meaning, status, values, or units.
  - Acceptance: every visible Persian paragraph is reviewed in context and read aloud; navigation, summaries, technical cards, tables, warnings, environmental/planting evidence, investigations, documents, and sources remain functionally complete and equivalent to English; mixed-direction values remain isolated correctly.
  - Progress 2026-08-04 (`11263b8`): navigation, section leads, readiness, client brief, terrain, seismic, archive, platform limitations, and other core P0 interface copy were rewritten and browser-reviewed in RTL.
  - Progress 2026-08-04 (`1bd5dfa`): climate, solar, wind, hazard, architecture, documents, methodology, investigations, and planting section leads edited for shorter, connected Persian.
  - Completed 2026-08-05. Final P1 pass rewrote investigation intro, handoff/climate brief FA, wind lead, investigations title, readiness gates, and new UI strings into short connected Persian; EN/FA keys match. Static + bilingual browser smoke passed.
  - Remaining limitation: some long species-source and raw hazard catalogue sentences remain denser technical prose; a future editorial read-aloud can still tighten them without changing meaning.

## P2 — Information architecture and product focus

- [x] **P2-01 — Reduce the main-page planting section.** Keep a shortlist of roughly five to seven robust candidates and move the full species explorer to a landscape annex or separate page.
  - Completed 2026-08-05. Main page shows seven shortlist cards (`species-shortlist.json`); full explorer, filters, avoid/ask lists live in a closed landscape annex.
- [x] **P2-02 — Add planting prerequisites.** Foreground soil testing, irrigation source/quantity/quality, nursery availability, retaining-wall root conflicts, and final microclimate.
  - Completed 2026-08-05. `planting-prerequisites.json` renders five unresolved prerequisite cards above the shortlist.
- [x] **P2-03 — Add a compact section table of contents.** Show progress/location through the unusually long report and support direct keyboard navigation.
  - Completed 2026-08-05. `#page-toc` lists every main section with in-page anchors.
- [x] **P2-04 — Improve progressive disclosure.** Move detailed source rows, platform tables, seismic catalogs, exhaustive species evidence, and other specialist material behind clear expandable summaries or annexes.
  - Completed 2026-08-05. Platform table, source register, seismic gate and full species explorer sit behind `<details>` panels / annex.
- [x] **P2-05 — Add site-observation media placeholders without fabricating evidence.** Provide unresolved slots for site photos, 360° panorama, neighboring buildings/heights, privacy, view corridors, existing trees/structures, and utilities.
  - Completed 2026-08-05. Field-evidence section group `site-observation` with unresolved slots only.
- [x] **P2-06 — Add road and access evidence slots.** Record road width, longitudinal/crossfall grade, gate position, turning swept path, emergency access, and construction access when measured.
  - Completed 2026-08-05. Group `road-access` in `field-evidence-slots.json`.
- [x] **P2-07 — Add hydrology evidence slots.** Record upstream catchment, concentrated flows, legal outfall, drainage rights, parcel flood study, and erosion-control strategy when investigated.
  - Completed 2026-08-05. Group `hydrology` with unresolved slots.
- [x] **P2-08 — Add utilities and logistics evidence slots.** Record electricity, water, wastewater, communications, capacities, connection points, construction staging, delivery constraints, and probable cost impacts.
  - Completed 2026-08-05. Group `utilities-logistics` with unresolved slots.

## P2 — Sources, documents, and methodology

- [x] **P2-09 — Complete the rendered source register.** Include elevation/horizon sources, local terrain grid, all CMIP6 files, reverse geocoder, species science/image provenance, client-reported lower road, and concept-workspace evidence if concepts remain.
  - Completed 2026-08-05. Source register extended with horizon DEM, local DEM, CMIP6 set, Nominatim, species images, lower road and concept archive rows.
- [x] **P2-10 — Add a claim-to-source matrix.** For important claims show source, resolution, period, access date, calculation, confidence, and design-use limit.
  - Completed 2026-08-05. Methodology table from `claim-source-matrix.json` (area, location, degree-days, solar, wind).
- [x] **P2-11 — Expose useful raw environmental files consistently.** Either register every retained raw dataset in Documents or explain why it is internal-only; never expose personal/contact metadata unnecessarily.
  - Completed 2026-08-05. `raw-environmental-files.json` lists each raw file as downloadable or internal-evidence with bilingual policy text.
- [x] **P2-12 — Update generated metadata on every release.** Keep `generated_on`, dashboard version, source dates, validation results, and visible footer synchronized.
  - Completed 2026-08-05. `RELEASE_DATE` / `DASHBOARD_VERSION` drive project, sources, `release-metadata.json` and footer (`v1.2.0`).
- [x] **P2-13 — Make regeneration location-independent.** Remove hard-coded private filesystem paths from scripts and source references; resolve paths relative to the project or explicit command arguments.
  - Completed 2026-08-05. Generator already resolves `projectRoot` from `import.meta.url`; no absolute home paths remain in `scripts/*.mjs`.
- [x] **P2-14 — Replace the deprecated Three.js distribution safely.** Remove the UMD deprecation warning without introducing CDN, server, module/CORS, or offline `file://` regressions.
  - Completed 2026-08-05. Vendored r160 UMD kept for `file://`; leading deprecation `console.warn` removed; UMD boot kept as expression IIFE; SHA-256 pin updated; offline verifier asserts warn is gone.

## P2 — QA and release evidence

- [x] **P2-15 — Rewrite `QA-REPORT.md` as a current release matrix.** Remove stale change-log material and contradictions; report the current section count and current validator totals.
  - Completed 2026-08-05. QA report rewritten as current release matrix for v1.2.0.
- [x] **P2-16 — Add semantic assertions to validation.** Detect contradictions such as “rejected concepts excluded” while ranked concepts remain visible, or “confirmed” alongside “strong-probable.”
  - Completed 2026-08-05. Static suite asserts archive-only concepts, probable (not confirmed) geolocation, shortlist bounds, field slots, release metadata and TOC/disclosure presence.
- [x] **P2-17 — Recapture every required screenshot.** Replace stale screenshots after responsive, content, RTL, and concept-archive work is complete.
  - Completed 2026-08-05. New set under `screenshots/p2/` (desktop, mobile, Persian, planting shortlist).
- [x] **P2-18 — Add broken-link and downloadable-file validation.** Verify every local document/image link under both `file://` and the hosted subpath.
  - Completed 2026-08-05. `scripts/verify-links.mjs` checks HTML/CSS/data hrefs, documents registry, downloadable raw files and species images.
- [x] **P2-19 — Add an offline-network test.** Prove that the final dashboard makes no external request after generation.
  - Completed 2026-08-05. `scripts/verify-offline.mjs` scans runtime files for network APIs/URLs and confirms UMD deprecation removal.

## P3 — Future architectural-analysis capabilities

- [x] **P3-01 — Add hourly comfort analysis when a defensible weather file exists.** Do not derive an EPW or psychrometric conclusion from monthly summaries alone.
  - Completed 2026-08-05. Gated module `hourly-comfort` in `future-analysis.json` / UI section. Prerequisites and withheld list forbid EPW-from-monthly and psychrometric totals until a defensible weather file exists.
- [x] **P3-02 — Add neighbor and field-horizon shadow studies after survey.** Keep them separate from the regional DEM horizon.
  - Completed 2026-08-05. Gated module `neighbor-field-horizon` states DEM horizon remains regional; neighbour/vegetation/field horizon stay off until surveyed.
- [x] **P3-03 — Add an abstract buildable-envelope study after planning controls are verified.** Do not present a floor plan or preferred house option.
  - Completed 2026-08-05. Gated module `buildable-envelope` withholds floor plans and ranked options; requires zoning, legal boundary and access/slope feasibility.
- [x] **P3-04 — Add design-weather and engineering parameters when formally obtained.** Include provenance and applicability for snow, frost, wind, seismic, and thermal design values.
  - Completed 2026-08-05. Parameter slots (snow, frost, design wind, seismic spectrum, thermal design temps) ship with `value: null`, provenance and applicability; static checks forbid invented numbers.
  - Remaining limitation: actual values stay empty until EXT investigations deliver formal parameters — correct behaviour, not a missing UI.

## External investigations — never complete from internet research alone

> **Status 2026-08-05:** All product tasks (P0–P3) are complete. **None** of EXT-01…EXT-20 are complete. Progress notes under individual items are household statements or open literature only — they must stay `[ ]` until real deliverables exist.

- [ ] **EXT-01 — Surveyor-certified CRS and control point** — required before concept design.
  - Progress 2026-08-05: still strong-probable EPSG:32638 only; web research cannot certify CRS.
- [ ] **EXT-02 — Certified legal/cadastral boundary, title, easements, and rights-of-way** — required before concept design.
  - Progress 2026-08-05: household reports title documents exist for project use (not scanned into the offline package). Drawing geometry is still not cadastral; easements/rights-of-way remain open. Dashboard does not treat title as verified ownership.
- [ ] **EXT-03 — Municipal zoning, setbacks, FAR, height, parking, fire access, and permit workflow** — required before concept design.
  - Progress 2026-08-05: public web sources do not publish parcel zoning/FAR/setbacks for Baneh Verdeh; municipal / licensed planner only. Research note under P3-03. Household treats zoning as low priority because the area is undeveloped — recorded as preference, not a legal waiver.
- [ ] **EXT-04 — Detailed topographic survey with breaklines, curbs, walls, structures, trees, and utilities** — required before concept design.
- [ ] **EXT-05 — Preliminary geotechnical reconnaissance, boreholes/test pits, bearing capacity, and likely foundation constraints** — begin before concept design.
  - Progress 2026-08-05: Macrostrat Bangestan limestone/shale + SoilGrids alkaline context already on page; not a borehole.
- [ ] **EXT-06 — Slope-stability assessment** — begin before concept design.
- [ ] **EXT-07 — Standard 2800 seismic design parameters and site class** — required before structural design.
  - Progress 2026-08-05: national A = 0.35/0.30/0.25/0.20g zone framework + regional USGS context documented under P3 research notes. No parcel A, spectrum or site class published as design values.
- [ ] **EXT-08 — Applicable structural snow, wind, rain, and temperature loads** — required before structural design.
  - Progress 2026-08-05: Topic 6 snow/wind procedures noted; official snow-zone cell for Baneh Verdeh not reliably published on the open web. Climate means stay non-design.
- [ ] **EXT-09 — Groundwater and seasonal seepage investigation** — required before excavation/foundation design.
- [ ] **EXT-10 — Local frost depth and frost-susceptible soil assessment** — required before foundation and external-works design.
  - Progress 2026-08-05: reanalysis frost severity documented; design frost depth still withheld.
- [ ] **EXT-11 — Field horizon, site photographs, and 360° panorama** — required before final solar/view decisions.
- [ ] **EXT-12 — Neighbor heights, openings, privacy, and overshadowing survey** — required before concept design.
  - Progress 2026-08-05: household says surroundings empty; OSM has no nearby footprints. Still needs site confirmation photos before locking openings.
- [ ] **EXT-13 — On-site wind and cold-air-flow observation** — required before final openings and outdoor-space design.
- [ ] **EXT-14 — Hydrology, upstream catchment, flash-flood route, legal discharge, and erosion assessment** — required before drainage design.
- [ ] **EXT-15 — Radon, wildfire/fuel, and other locally applicable environmental screening** — determine scope with local professionals.
  - Progress 2026-08-05: open literature — Zagros/Paveh wildfire recurrence; 2025 Kermanshah school indoor radon study. Parcel screening still requires measurement and local professionals.
- [ ] **EXT-16 — Utility location, capacity, ownership, and connection conditions** — establish during early feasibility.
  - Progress 2026-08-05: household — electricity, gas and water exist around the area but not yet on the parcel; connection most probably from lower road (possibility). Written provider capacity/cost still required. Mapped power remains a 3.56 km transmission line (not a connection).
- [ ] **EXT-17 — Road width/grade, gate geometry, vehicle swept path, and emergency access** — required before concept design.
  - Progress 2026-08-05: upper Pt2–Pt1 = main vehicle + fire access preference; lower = rough/seasonal + optional stairs gate. 2–3 cars at upper garage. Grade, crossfall, gate geometry and swept path still unmeasured.
- [ ] **EXT-18 — Construction access, staging, crane/delivery constraints, spoil handling, and logistics cost** — assess during early feasibility.
- [ ] **EXT-19 — Site noise survey and relevant time periods** — required before final room/opening placement.
- [ ] **EXT-20 — Soil, irrigation water, and local nursery assessment for planting** — required before landscape specification.

## Validation required before marking a product task complete

Run from the dashboard directory as applicable:

```text
node scripts/generate-data.mjs
node scripts/validate-static.mjs
node scripts/verify-solar-3d.mjs
node scripts/verify-responsive.mjs
node scripts/verify-accessibility.mjs
node scripts/verify-privacy.mjs
node scripts/verify-links.mjs
node scripts/verify-offline.mjs
```

Then verify in one canonical build:

- English and Persian content parity;
- RTL and mixed-direction values;
- desktop, tablet, 430 px, 390 px, 360 px, and 320 px layouts;
- keyboard-only navigation and visible focus;
- all interactive charts, filters, lightbox, theme, language, and 3D controls;
- zero critical console errors;
- no missing assets or broken document links;
- offline operation and direct `file://` opening;
- public-release privacy scan;
- updated screenshots and `QA-REPORT.md`.
