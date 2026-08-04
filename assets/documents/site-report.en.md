# Site Survey Geometry Analysis

> Scope: geometry extraction and verification only. No house design and no property ownership assumption were made.

## Source integrity and conversion

- Original found at: [original source location withheld]
- Preserved project copy: `site-base source/original-survey.dwg`
- DWG SHA-256: `5d784e17a4efeeeae61235b729369ed28786317d6bacbeb2e529db6177309898`
- DWG header/version: `AC1027` / AutoCAD 2013
- Local converter: GNU LibreDWG `dwg2dxf` 0.14.8547, repository commit `e0a152d728cd5b794dc9361a65417fa12d920509`
- Conversion: local ASCII R2013 DXF; no online service used
- Converted DXF SHA-256: `4f9a98871c861b0de421126f6561c951cb35fa8725b0c04170e30de0c98f621e`
- Exact conversion command: `tools/libredwg/programs/dwg2dxf --as r2013 -y -o site-base source/survey-converted.dxf site-base source/original-survey.dwg`

## Geometry interpretation

- Three active closed boundary polylines occur in model space. The first two close by repeating their first vertex even though their DXF closed flag is false; the third has the formal closed flag.
- Labels are neutral (Polygon A, B and C). No polygon is identified as the user's property.
- Boundary X/Y values and embedded dimensions are in metres (`$INSUNITS=6`). Plan area is calculated in the XY plane.
- Each corner Z below is the elevation printed by the uniquely nearest `Pt` label. The constant raw LWPOLYLINE entity elevation is retained separately because it conflicts with the spot elevations.
- Two unreferenced legacy block definitions contain six additional closed-looking polylines, but there are zero INSERT references to either block. They are not placed in model space and are excluded from active boundary results.

## Polygon summary

| Polygon | Source handle | Layer | Source type | Corners | Plan area (m²) | Horizontal perimeter (m) | 3D perimeter (m) | Bounds X × Y × relief (m) | Raw entity Z (m) |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|
| Polygon A | 271 | 0 | LWPOLYLINE | 4 | 160.330387 | 50.994682 | 53.286465 | 15.639194 × 17.773728 × 6.860 | 1655.558 |
| Polygon B | 272 | 0 | LWPOLYLINE | 4 | 126.022556 | 46.703086 | 48.843645 | 13.323719 × 17.310493 × 6.610 | 1655.558 |
| Polygon C | 273 | 0 | LWPOLYLINE | 5 | 201.075625 | 59.140547 | 60.860605 | 22.550307 × 17.579035 × 6.168 | 1603.558 |

### Polygon A

| Corner | Survey point | X (m) | Y (m) | Z spot elevation (m) | To next (horizontal m) | To next (3D m) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Pt3 | 623736.707000005 | 3870706.660000000 | 1655.849 | 11.865189 | 11.940616 |
| 2 | Pt8 | 623747.302942028 | 3870701.320644192 | 1654.509 | 14.605413 | 15.613727 |
| 3 | Pt5 | 623752.346193953 | 3870715.027711411 | 1648.989 | 10.930168 | 10.991550 |
| 4 | Pt4 | 623742.200710278 | 3870719.094371719 | 1650.149 | 13.593912 | 14.740572 |

- Plan area: **160.330387409 m²**; embedded label: 160.33 m²; difference before rounding: +0.000387 m².
- X range: 623736.707000005–623752.346193953 m; Y range: 3870701.320644192–3870719.094371719 m; spot-elevation range: 1648.989–1655.849 m.
- Source layer/type: `0` / `LWPOLYLINE`; handle `271`.

### Polygon B

| Corner | Survey point | X (m) | Y (m) | Z spot elevation (m) | To next (horizontal m) | To next (3D m) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Pt8 | 623747.302942028 | 3870701.320644192 | 1654.509 | 8.007574 | 8.072783 |
| 2 | Pt7 | 623754.453925548 | 3870697.717217947 | 1653.485 | 15.080099 | 16.081442 |
| 3 | Pt6 | 623760.626660687 | 3870711.476096191 | 1647.899 | 9.010000 | 9.075693 |
| 4 | Pt5 | 623752.346193953 | 3870715.027711411 | 1648.989 | 14.605413 | 15.613727 |

- Plan area: **126.022555896 m²**; embedded label: 126.02 m²; difference before rounding: +0.002556 m².
- X range: 623747.302942028–623760.626660687 m; Y range: 3870697.717217947–3870715.027711411 m; spot-elevation range: 1647.899–1654.509 m.
- Source layer/type: `0` / `LWPOLYLINE`; handle `272`.

### Polygon C

| Corner | Survey point | X (m) | Y (m) | Z spot elevation (m) | To next (horizontal m) | To next (3D m) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Pt8 | 623747.302942028 | 3870701.320644192 | 1654.509 | 11.865189 | 11.940616 |
| 2 | Pt3 | 623736.707000005 | 3870706.660000000 | 1655.849 | 11.885729 | 12.479622 |
| 3 | Pt2 | 623731.903618153 | 3870695.788106064 | 1659.653 | 10.270569 | 10.274663 |
| 4 | Pt1 | 623739.681719334 | 3870689.080965455 | 1659.363 | 17.111485 | 18.092922 |
| 5 | Pt7 | 623754.453925548 | 3870697.717217947 | 1653.485 | 8.007574 | 8.072783 |

- Plan area: **201.075624641 m²**; embedded label: 201.07 m²; difference before rounding: +0.005625 m².
- X range: 623731.903618153–623754.453925548 m; Y range: 3870689.080965455–3870706.660000000 m; spot-elevation range: 1653.485–1659.653 m.
- Source layer/type: `0` / `LWPOLYLINE`; handle `273`.

## Survey points

The DWG does not contain active model-space `POINT` entities for the eight spots. It contains `SurveyPoint` MTEXT labels. Each label is uniquely closest to one boundary vertex (next-nearest candidates are much farther away), so the label's elevation was associated with that vertex. This inference is recorded explicitly rather than hidden.

| Point | X (m) | Y (m) | Elevation Z (m) | Label-to-vertex offset (m) | Boundary membership |
|---|---:|---:|---:|---:|---|
| Pt1 | 623739.681719334 | 3870689.080965455 | 1659.363 | 1.273 | Polygon C |
| Pt2 | 623731.903618153 | 3870695.788106064 | 1659.653 | 2.975 | Polygon C |
| Pt3 | 623736.707000005 | 3870706.660000000 | 1655.849 | 3.875 | Polygon A, Polygon C |
| Pt4 | 623742.200710278 | 3870719.094371719 | 1650.149 | 1.670 | Polygon A |
| Pt5 | 623752.346193953 | 3870715.027711411 | 1648.989 | 1.441 | Polygon A, Polygon B |
| Pt6 | 623760.626660687 | 3870711.476096191 | 1647.899 | 1.451 | Polygon B |
| Pt7 | 623754.453925548 | 3870697.717217947 | 1653.485 | 0.652 | Polygon B, Polygon C |
| Pt8 | 623747.302942028 | 3870701.320644192 | 1654.509 | 1.900 | Polygon A, Polygon B, Polygon C |

## Dimension annotation check

- Seven of the nine displayed perimeter dimensions agree with the corresponding boundary edge after rounding to 0.01 m.
- The displayed `13.75` dimension uses extension points offset from the actual Polygon A Pt3–Pt4 vertices; the boundary-coordinate length is **13.593912 m**.
- The displayed `9.03` dimension similarly uses a slightly offset endpoint; the Polygon B Pt5–Pt6 boundary-coordinate length is **9.010000 m**.
- Reported metrics therefore use the closed LWPOLYLINE coordinates, not potentially offset dimension extension points.

## Drawing metadata and site clues

- UTM zone: **not stated**. Coordinates are UTM-like, but a zone cannot be inferred reliably from X/Y alone.
- Datum: **not stated**; GEODATA objects found: 0.
- North: `$NORTHDIRECTION=0.0` is present, but no north-arrow entity, north text, or validated georeferencing record exists. Drawing +Y must not be treated as certified north.
- Header latitude/longitude: 37.795, -122.394. With no GEODATA object and no datum/zone, these are unverified template metadata and were not used.
- Elevations: eight explicit point labels range from 1647.899 m to 1659.653 m. Raw boundary objects also carry constant entity elevations of 1603.558 or 1655.558 m, which conflict with the labelled spot elevations.
- Road/access boundary: **none identified** by entity type, layer name, block reference, or text.
- Textual parcel labels: three English area labels (`201.07`, `126.02`, `160.33`) and eight point/elevation labels (`Pt1`–`Pt8`). No parcel number, owner name, Persian parcel text, road label, UTM zone, or datum text is present in active model space.

## Entity and layer audit

- Active model-space entities: `{"DIMENSION": 9, "LWPOLYLINE": 3, "MTEXT": 11}`
- Layers: `0`, `SurveyPoint`, `Defpoints`
- Unreferenced blocks: `rrrrrrrrrrr` (3 closed polylines, 0 inserts); `tttttttt` (3 closed polylines, 0 inserts)

## FreeCAD import assessment

- Tested with running FreeCAD 1.1.3 (revision 20260725).
- FreeCAD's native DXF importer reproduced the three active XY boundaries and horizontal lengths after converting metres to its internal millimetres (factor 1000). Reopened-file checks found 0.0 mm maximum XY vertex deviation and less than 0.000001 mm length deviation.
- Native import is **not fully faithful**: it flattened the source LWPOLYLINE elevations to Z=0, omitted MTEXT/dimension annotations, and materialized unreferenced block definitions under `_UnreferencedBlocks`.
- `site-analysis.FCStd` therefore retains the raw import for audit (hidden) and adds validated analysis objects with source X/Y, labelled spot elevations, metrics, corner labels, and survey points.

## Verification

- The source DWG was decoded independently by LibreDWG and compared with the ezdxf parse of the converted ASCII DXF.
- Plan areas use a translated-origin shoelace calculation to avoid large-coordinate cancellation. Horizontal and 3D distances use independent Euclidean calculations.
- Polygon A and B areas agree with their embedded labels when rounded to two decimals. Polygon C computes as 201.075625 m², which rounds to 201.08 m²; its embedded label is 201.07 m² (absolute difference 0.005625 m²). The independently calculated geometry value is used.
- A separate Node.js verifier recomputes all side lengths, perimeters, areas, and bounds from the exported CSV; its results are stored in `work/independent-verification.json`.
- FreeCAD shape lengths and bounds are checked separately against the DXF-derived values after closing and reopening the FCStd. Maximum survey-point deviation was 0.0 mm; all boundary length and bounding-box deviations were below 0.000001 mm.

## Output files

- `output/site-analysis.FCStd` — raw import plus validated analysis
- `output/site-boundaries.dxf` — ASCII R2013 3D boundaries and survey points
- `output/site-coordinates.csv` — corners, point elevations, sides, perimeters, areas, bounds, layers, and source types
- `output/site-top-view.png` — active polygons with neutral corner numbers and survey-point elevations
