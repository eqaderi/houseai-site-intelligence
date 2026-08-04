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

- Product tasks complete: 1 / 57
- External investigations complete: 0 / 20
- Current release stage: pre-design site intelligence
- Architect decision status: site strategy may begin; concept design is blocked by the client brief, planning controls, certified survey data, road geometry, and preliminary ground assessment

## P0 — Truth, safety, and design-authorisation boundaries

- [ ] **P0-01 — Correct geolocation and completion claims.** Replace `geolocation_confirmed: true` with a provisional state consistent with `strong-probable`; rename “confirmed location” to “probable project location”; state that the CRS is not surveyor-certified; replace “analysis complete” with “pre-design environmental analysis complete”; do not report zero unresolved environmental modules while parcel-scale questions remain.
  - Acceptance: English, Persian, structured JSON, generated bundle, hero, geography section, status chips, and methodology use the same terminology.
- [ ] **P0-02 — Distinguish drawing geometry from legal property verification.** Replace wording such as “verified boundary” where it could imply cadastral/title verification with “verified drawing geometry” or an equally precise term.
  - Acceptance: area calculation remains verified while legal ownership, cadastral boundary, easements, and rights-of-way remain explicitly unresolved.
- [ ] **P0-03 — Add an architectural-readiness gate to the overview.** Present three visible states: usable now, preliminary only, and blocks concept design.
  - Acceptance: the gate names the evidence in each state and is equally complete in English and Persian.
- [ ] **P0-04 — Add a structured client/project brief.** Record household composition, room program, target area, accessibility, privacy and cultural needs, budget, phasing, timeline, construction preferences, garage/workshop needs, energy/carbon goals, and future expansion.
  - Acceptance: unanswered items render as unresolved; the dashboard does not infer answers.
- [ ] **P0-05 — Remove concept ranking from the primary design story.** Do not identify A, B, or C as a winner or recommended direction while planning, survey, road, geotechnical, and client inputs are missing.
  - Acceptance: concepts are absent from primary navigation and recommendation flows.
- [ ] **P0-06 — Move retained concepts into a hidden rejected archive.** If the experiments remain, place them behind a closed disclosure labelled “Rejected and unvalidated concept experiments — not for selection.”
  - Acceptance: no ranking, precise recommendation, or claim that vehicle access/courtyard drainage works; the archive is hidden by default in both languages.
- [ ] **P0-07 — Demote unsupported room-placement advice.** Reframe bedroom, kitchen, service, office, courtyard, and similar typology assumptions as questions/options to test until the client brief exists.
- [ ] **P0-08 — Demote garage/workshop placement confidence.** Keep it preliminary until road gradient, turning, gate, fire access, and construction access are measured.
- [ ] **P0-09 — Reframe terrain precision.** Make clear that an eight-point, seven-facet TIN without surveyed breaklines cannot provide construction quantities.
  - Acceptance: one-metre contours, 0.1 m² platform areas, 0.5 m platform steps, and cut/fill outputs are labelled exploratory and not suitable for pricing.
- [ ] **P0-10 — Make seismic design limitations lead the hazard story.** Lead with unavailable design spectrum, site class, and Standard 2800 parameters; place regional earthquake-event counts in expandable context.

## P0 — Release integrity and privacy

- [ ] **P0-11 — Define one canonical build and URL.** Eliminate content drift between ports/query versions and show a build identifier/date in the methodology footer.
  - Acceptance: English and Persian are tested by switching language inside the same deployed build.
- [ ] **P0-12 — Add a repeatable public-release privacy check.** Reject names, private emails, phone numbers, account identifiers, absolute home paths, credentials, and personal source filenames from the publishable tree.
  - Acceptance: the check covers text, Git metadata used by the public mirror, raw OSM contact tags, downloadable documents, and common image metadata.
- [ ] **P0-13 — Document the privacy boundary.** Explain that precise coordinates identify the studied site but do not identify an owner and are not evidence of ownership.
- [x] **P0-14 — Keep the reproducible source repository private.** Publish only a clean-history, dashboard-only mirror; never expose the private repository history, archived working files, original named source path, or personal commit metadata.
  - Completed 2026-08-04. Public mirror commit `5b51f61`; source completion record is the next backlog commit.
  - Evidence: the source repository remains private; the public mirror contains only the 18 MB dashboard in one privacy-neutral root commit; GitHub Pages built successfully; the live HTML and data-bundle SHA-256 hashes match the sanitized release.
  - Remaining limitation: GitHub necessarily displays the account that owns the public repository. Moving the mirror to a neutral organisation/account is required if repository-account separation is also desired.

## P1 — Responsive layout, navigation, and accessibility

- [ ] **P1-01 — Fix mobile horizontal overflow in Terrain.** At 390 px the document must not grow to approximately 690 px; terrain insight/table cards and 3D controls must remain within the viewport.
  - Acceptance: `document.documentElement.scrollWidth <= window.innerWidth` at 320, 360, 390, and 430 px in both languages.
- [ ] **P1-02 — Make the 3D mobile toolbar usable.** Wrap or stack viewpoint, vertical-scale, layer, and time controls without clipping or off-screen content.
- [ ] **P1-03 — Expand desktop navigation.** Make Geography, Climate, Wind, Hazards, Architecture, Investigations, Sources, and other major sections discoverable without relying on mobile navigation.
- [ ] **P1-04 — Add programmatic selected states.** Climate, solar, wind, hazard, 3D, and other segmented controls must expose `aria-pressed`, `aria-selected`, or the correct equivalent.
- [ ] **P1-05 — Give the mobile menu an accessible name.** The icon-only state must retain a localized accessible label.
- [ ] **P1-06 — Make solar time accessible.** Provide localized `aria-valuetext` such as “12:35,” not a decimal clock value.
- [ ] **P1-07 — Stop theme changes from moving the viewport.** Preserve the current section and visual offset while canvases and 3D content redraw.
- [ ] **P1-08 — Fix Persian mixed-direction values.** Use appropriate `bdi`/direction isolation for area, ranges, units, coordinates, technical terms, and dynamically assembled headings.
- [ ] **P1-09 — Add automated accessibility checks.** Cover keyboard navigation, focus visibility/order, control names/states, landmarks, headings, table semantics, alt text, dialog/lightbox behavior, reduced motion, and contrast.
- [ ] **P1-10 — Add automated responsive regression checks.** Test the complete page at representative desktop, tablet, and narrow-mobile widths in English and Persian.

## P1 — Section and evidence improvements

- [ ] **P1-11 — Surface survey-label association uncertainty.** Show the maximum elevation-label association offset (approximately 3.875 m) prominently in Survey and Terrain methodology.
- [ ] **P1-12 — Add evidence provenance to every 3D layer.** Mark parcel geometry, regional hillside, roads, trees, wind, and concepts as drawing-derived, regional, client-reported, illustrative, or experimental.
  - Acceptance: the default view is measured/drawing-derived parcel evidence only, or non-measured layers are visually unmistakable.
- [ ] **P1-13 — Add true multi-scale geographic views.** Provide useful 250 m, 1 km, 5 km, and 20 km context views or a clearly explained multi-scale inset.
- [ ] **P1-14 — Add an architect-oriented climate summary.** Explain heating/cooling seasons, passive opportunities, overheating risk, and the limits of monthly gridded data; show CDD18 alongside or ahead of CDD10.
- [ ] **P1-15 — Clarify solar interpolation and design limits.** State visibly that continuous values interpolate ten-minute samples and that neighbors, vegetation, and a surveyed horizon are not modeled.
- [ ] **P1-16 — Make the wind heading follow the selected season.** Winter, summer, spring, autumn, and annual selections must update the title as well as the rose and statistics.
- [ ] **P1-17 — Keep dust and parcel-flow conclusions unresolved.** Do not infer dusty winds, cold-air drainage, turbulence, or slope acceleration from the 11 km regional grid alone.
- [ ] **P1-18 — Prioritize the investigations register.** Add owner/consultant, prerequisite, status, expected deliverable, dependency, and downloadable scope note.
- [ ] **P1-19 — Move critical gates earlier.** Require legal/title boundary and preliminary ground/slope assessment before concept; treat utilities, road geometry, construction access, and logistics cost as early feasibility inputs.
- [ ] **P1-20 — Add one bilingual architect handoff brief.** Summarize what may be used, what is provisional, what must not be used, immediate investigations, key geometry, and environmental implications.

## P2 — Information architecture and product focus

- [ ] **P2-01 — Reduce the main-page planting section.** Keep a shortlist of roughly five to seven robust candidates and move the full species explorer to a landscape annex or separate page.
- [ ] **P2-02 — Add planting prerequisites.** Foreground soil testing, irrigation source/quantity/quality, nursery availability, retaining-wall root conflicts, and final microclimate.
- [ ] **P2-03 — Add a compact section table of contents.** Show progress/location through the unusually long report and support direct keyboard navigation.
- [ ] **P2-04 — Improve progressive disclosure.** Move detailed source rows, platform tables, seismic catalogs, exhaustive species evidence, and other specialist material behind clear expandable summaries or annexes.
- [ ] **P2-05 — Add site-observation media placeholders without fabricating evidence.** Provide unresolved slots for site photos, 360° panorama, neighboring buildings/heights, privacy, view corridors, existing trees/structures, and utilities.
- [ ] **P2-06 — Add road and access evidence slots.** Record road width, longitudinal/crossfall grade, gate position, turning swept path, emergency access, and construction access when measured.
- [ ] **P2-07 — Add hydrology evidence slots.** Record upstream catchment, concentrated flows, legal outfall, drainage rights, parcel flood study, and erosion-control strategy when investigated.
- [ ] **P2-08 — Add utilities and logistics evidence slots.** Record electricity, water, wastewater, communications, capacities, connection points, construction staging, delivery constraints, and probable cost impacts.

## P2 — Sources, documents, and methodology

- [ ] **P2-09 — Complete the rendered source register.** Include elevation/horizon sources, local terrain grid, all CMIP6 files, reverse geocoder, species science/image provenance, client-reported lower road, and concept-workspace evidence if concepts remain.
- [ ] **P2-10 — Add a claim-to-source matrix.** For important claims show source, resolution, period, access date, calculation, confidence, and design-use limit.
- [ ] **P2-11 — Expose useful raw environmental files consistently.** Either register every retained raw dataset in Documents or explain why it is internal-only; never expose personal/contact metadata unnecessarily.
- [ ] **P2-12 — Update generated metadata on every release.** Keep `generated_on`, dashboard version, source dates, validation results, and visible footer synchronized.
- [ ] **P2-13 — Make regeneration location-independent.** Remove hard-coded private filesystem paths from scripts and source references; resolve paths relative to the project or explicit command arguments.
- [ ] **P2-14 — Replace the deprecated Three.js distribution safely.** Remove the UMD deprecation warning without introducing CDN, server, module/CORS, or offline `file://` regressions.

## P2 — QA and release evidence

- [ ] **P2-15 — Rewrite `QA-REPORT.md` as a current release matrix.** Remove stale change-log material and contradictions; report the current section count and current validator totals.
- [ ] **P2-16 — Add semantic assertions to validation.** Detect contradictions such as “rejected concepts excluded” while ranked concepts remain visible, or “confirmed” alongside “strong-probable.”
- [ ] **P2-17 — Recapture every required screenshot.** Replace stale screenshots after responsive, content, RTL, and concept-archive work is complete.
- [ ] **P2-18 — Add broken-link and downloadable-file validation.** Verify every local document/image link under both `file://` and the hosted subpath.
- [ ] **P2-19 — Add an offline-network test.** Prove that the final dashboard makes no external request after generation.

## P3 — Future architectural-analysis capabilities

- [ ] **P3-01 — Add hourly comfort analysis when a defensible weather file exists.** Do not derive an EPW or psychrometric conclusion from monthly summaries alone.
- [ ] **P3-02 — Add neighbor and field-horizon shadow studies after survey.** Keep them separate from the regional DEM horizon.
- [ ] **P3-03 — Add an abstract buildable-envelope study after planning controls are verified.** Do not present a floor plan or preferred house option.
- [ ] **P3-04 — Add design-weather and engineering parameters when formally obtained.** Include provenance and applicability for snow, frost, wind, seismic, and thermal design values.

## External investigations — never complete from internet research alone

- [ ] **EXT-01 — Surveyor-certified CRS and control point** — required before concept design.
- [ ] **EXT-02 — Certified legal/cadastral boundary, title, easements, and rights-of-way** — required before concept design.
- [ ] **EXT-03 — Municipal zoning, setbacks, FAR, height, parking, fire access, and permit workflow** — required before concept design.
- [ ] **EXT-04 — Detailed topographic survey with breaklines, curbs, walls, structures, trees, and utilities** — required before concept design.
- [ ] **EXT-05 — Preliminary geotechnical reconnaissance, boreholes/test pits, bearing capacity, and likely foundation constraints** — begin before concept design.
- [ ] **EXT-06 — Slope-stability assessment** — begin before concept design.
- [ ] **EXT-07 — Standard 2800 seismic design parameters and site class** — required before structural design.
- [ ] **EXT-08 — Applicable structural snow, wind, rain, and temperature loads** — required before structural design.
- [ ] **EXT-09 — Groundwater and seasonal seepage investigation** — required before excavation/foundation design.
- [ ] **EXT-10 — Local frost depth and frost-susceptible soil assessment** — required before foundation and external-works design.
- [ ] **EXT-11 — Field horizon, site photographs, and 360° panorama** — required before final solar/view decisions.
- [ ] **EXT-12 — Neighbor heights, openings, privacy, and overshadowing survey** — required before concept design.
- [ ] **EXT-13 — On-site wind and cold-air-flow observation** — required before final openings and outdoor-space design.
- [ ] **EXT-14 — Hydrology, upstream catchment, flash-flood route, legal discharge, and erosion assessment** — required before drainage design.
- [ ] **EXT-15 — Radon, wildfire/fuel, and other locally applicable environmental screening** — determine scope with local professionals.
- [ ] **EXT-16 — Utility location, capacity, ownership, and connection conditions** — establish during early feasibility.
- [ ] **EXT-17 — Road width/grade, gate geometry, vehicle swept path, and emergency access** — required before concept design.
- [ ] **EXT-18 — Construction access, staging, crane/delivery constraints, spoil handling, and logistics cost** — assess during early feasibility.
- [ ] **EXT-19 — Site noise survey and relevant time periods** — required before final room/opening placement.
- [ ] **EXT-20 — Soil, irrigation water, and local nursery assessment for planting** — required before landscape specification.

## Validation required before marking a product task complete

Run from the dashboard directory as applicable:

```text
node scripts/generate-data.mjs
node scripts/validate-static.mjs
node scripts/verify-solar-3d.mjs
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
