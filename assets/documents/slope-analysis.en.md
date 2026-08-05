# Unified Site Slope Analysis

> All zoning, terrain interpretation, section alignments, access-band depths and earthwork comments below are **preliminary engineering inferences**. They are not a house design, legal setback, planning rule, approval, geotechnical conclusion or construction instruction.

## Confirmed project assumptions

- Polygons A, B and C form one property.
- True north is drawing +Y; all generated graphics are north-up.
- The southern outer Pt2–Pt1 edge is the road boundary.
- Vehicle and pedestrian access will come from Pt2–Pt1, but no exact gate position has been selected.

## Unified boundary

- Outer corner order: `Pt2 → Pt1 → Pt7 → Pt6 → Pt5 → Pt4 → Pt3 → Pt2`.
- Pt8 is an interior terrain point and the meeting point of the former parcel boundaries.
- Verified plan area: **487.428567946 m²**, reported as **487.428568 m²**.
- Independent A+B+C check: **487.428567946 m²**.
- Difference from requested 487.428568 m²: **-0.000000054 m²**.
- South Road Boundary length Pt2–Pt1: **10.270569 m**.
- Former A/B/C parcel edges are retained only in the hidden `Hidden_Parcel_References` group in FreeCAD.

## Terrain model

- Surface type: piecewise-linear TIN using Pt8 as the interior hub and the seven outer boundary points as a fan. This follows the confirmed parcel topology and introduces no invented elevation points.
- Elevation range: **1647.899–1659.653 m**; total relief **11.754 m**.
- Contours: 1 m intervals at 1648, 1649, 1650, 1651, 1652, 1653, 1654, 1655, 1656, 1657, 1658, 1659 m.
- Surface accuracy is limited by only eight spot elevations. Breaklines, walls, curbs and localized grade changes are not represented.

## TIN slope direction

| Triangle | Slope | Angle | Steepest descent aspect |
|---|---:|---:|---:|
| Pt8–Pt1–Pt7 | 35.06% | 19.32° | 48.1° clockwise from north (northeast) |
| Pt8–Pt7–Pt6 | 39.77% | 21.69° | 45.5° clockwise from north (northeast) |
| Pt8–Pt6–Pt5 | 40.34% | 21.97° | 40.7° clockwise from north (northeast) |
| Pt8–Pt5–Pt4 | 39.56% | 21.59° | 37.4° clockwise from north (northeast) |
| Pt8–Pt4–Pt3 | 44.03% | 23.76° | 41.6° clockwise from north (northeast) |
| Pt8–Pt3–Pt2 | 34.52% | 19.04° | 45.8° clockwise from north (northeast) |
| Pt8–Pt2–Pt1 | 34.63% | 19.10° | 45.4° clockwise from north (northeast) |

- Triangle slopes range from **34.52% to 44.03%**.
- All seven TIN facets fall generally toward the northeast. Surface water and loose material would therefore tend to migrate toward the Pt5/Pt6 side unless intercepted and safely conveyed.

## Preliminary sections

- Longitudinal section: true south-to-north line through the unified property centroid.
- Transverse section: west-to-east line through the same centroid.
- These are analytical centerlines selected for terrain comparison; they are not house axes or survey section monuments.

## Preliminary practical zones

### Vehicle and pedestrian access

- The full Pt2–Pt1 frontage remains a potential access edge. The graphic uses an illustrative 3 m-deep study band inside the boundary only to reserve maneuvering/transition space.
- No gate centerline, gate width, driveway width or final grade has been chosen.
- Because the site falls sharply northeast from a relatively high road edge, a long direct driveway would create significant grade and earthwork risk. Keeping initial garage/access studies close to the southern frontage is the lowest-risk starting assumption.

### Building study zone

- A broad central study band is drawn approximately northwest–southeast, broadly parallel to contours, to reduce cross-slope width.
- It is not a footprint and does not establish setbacks. Detailed survey, geotechnical advice, drainage design and access geometry may move or reject this zone.

### Courtyard study zone

- A preliminary courtyard zone is shown northeast of the building study band. It is explicitly drainage-sensitive because it lies downslope.
- Any later courtyard concept must preserve positive drainage and must not become a collection basin against a building or retaining element.

## Preliminary cut-and-fill risk notes

- **High grading sensitivity:** 34.52–44.03% TIN slopes are steep enough that a conventional level platform would likely require substantial cut, fill, retaining or a stepped solution.
- **Fill risk toward northeast:** the lowest terrain is around Pt5/Pt6. Unengineered fill here would be especially sensitive to settlement, drainage and slope stability.
- **Cut risk toward southwest:** Pt1/Pt2 are the highest points and form the road frontage. Deep excavation behind a road-level garage could require retaining and groundwater management.
- **Drainage concentration:** all preliminary facet aspects point northeast. Later grading should avoid concentrating runoff onto neighbors or trapping it behind walls; no discharge point is assumed.
- **Terrain-model limitation:** eight spots cannot reveal subsurface conditions or local breaks in slope. Cut/fill volumes must not be estimated from this TIN for construction.
- A stepped or split-level response may reduce earthwork, but that is a future design study, not a decision made here.

## Verification

- A separate Node.js calculation rebuilt the seven-corner outer ring from `site-coordinates.csv`: 487.428567951 m², which rounds to 487.428568 m² and agrees with A+B+C within 0.000000005 m².
- The saved FreeCAD file was closed and reopened. Its independent OpenCASCADE plan face measured 487.428567946 m², only 0.000000054 m² below the six-decimal target.
- Reopened model inventory: seven outer edges, seven TIN faces, twelve 1 m contour objects, two section traces and three preliminary study zones. `Hidden_Parcel_References` remained hidden.

## Files

- `output/unified-site.FCStd`
- `output/unified-site-top-view.png`
- `output/site-contours.png`
- `output/site-sections.png`
- `output/slope-analysis.md`
