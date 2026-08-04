(() => {
  "use strict";

  const api = {
    initialized: false,
    language: "en",
    theme: "light",
  };

  let stage;
  let fallback;
  let renderer;
  let scene;
  let camera;
  let terrainRoot;
  let terrainMesh;
  let contourGroup;
  let pointGroup;
  let objectGroup;
  let sunPathGroup;
  let shadowTraceGroup;
  let conceptGroup;
  let horizonGroup;
  let hillGroup;
  let plantingGroup;
  let datumPlane;
  let datumGrid;
  let currentSeason = null;
  let currentConceptId = "option-a";
  let sun;
  let hemisphere;
  let sunMarker;
  let shadowRuler;
  let resizeObserver;
  let renderQueued = false;
  let currentView = "perspective";
  let verticalScale = 1;
  let centerX = 0;
  let centerY = 0;
  let minElevation = 0;
  let targetY = 5;
  let yaw = 0.72;
  let pitch = 0.62;
  let distance = 92;
  let pinchDistance = 0;
  let siteData = null;
  let currentObjectId = "pole";
  let currentSun = null;
  // Verification aid, off by default; survives terrain rebuilds.
  let rulerHidden = true;
  let traceHidden = true;
  let conceptsHidden = true;
  let horizonHidden = true;
  // On by default: this is the ground the parcel stands on, not an extra.
  let hillHidden = false;
  // Illustrative shadow probes, on by default: a bare TIN casts nothing.
  let plantingHidden = false;
  // Illustrative wind motion. Off by default: it animates, and nothing else here
  // moves unless asked.
  let windHidden = true;
  let windFrame = 0;
  let windStart = 0;
  let windGroup;
  let roadGroup;
  let roadsHidden = false;
  let hillSurface;
  const pointers = new Map();
  const labels = [];

  const PLANE_SIZE = 60;
  const PLANE_Y = -1.25;
  // The light sits well outside the drawn hillside, and the sun marker with its
  // day arc sits just beyond the 50 m patch rather than inside it — at the old
  // 34 m the disc hung over the slope it was supposed to be lighting.
  const SUN_DISTANCE = 200;
  const DOME_RADIUS = 62;
  // Beyond the sun dome, inside the camera far plane.
  const HORIZON_RADIUS = 130;
  // Constructed lazily: this file is evaluated before the THREE guard in init,
  // and also in Node by the verification harness, where only Vector3 is stubbed.
  let raycaster;

  // Fallback footprints for the solar test objects. The generator now emits a
  // `footprint` on each object so the 2D plan and this scene read the same
  // numbers; these cover a stale data.js.
  const DEFAULT_FOOTPRINTS = {
    pole: { shape: "circle", diameter_m: 0.2 },
    wall: { shape: "box", length_m: 6, thickness_m: 0.3, orientation: "contour-parallel" },
    "generic-volume": { shape: "box", length_m: 4, width_m: 4 },
  };

  const presets = {
    // Pulled back from 64 so the sun marker, now just outside the 50 m hillside
    // patch, is in frame at the default view rather than beyond its edge.
    perspective: { yaw: 0.72, pitch: 0.62, distance: 92 },
    top: { yaw: 0, pitch: 1.49, distance: 68 },
    road: { yaw: 0, pitch: 0.42, distance: 62 },
    // The hillside patch is 100 m across against a 25 m parcel — wider than any
    // site preset frames, so it gets its own viewpoint.
    hillside: { yaw: 0.72, pitch: 0.46, distance: 235 },
  };

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function supportsWebGL2() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
    } catch {
      return false;
    }
  }

  function showFallback() {
    if (!stage || !fallback) return;
    fallback.hidden = false;
    stage.dataset.webgl = "unavailable";
    const toolbar = document.querySelector(".terrain-3d-toolbar");
    if (!toolbar) return;
    toolbar.setAttribute("aria-disabled", "true");
    toolbar.inert = true;
    toolbar.querySelectorAll("button, input, select").forEach((control) => {
      control.disabled = true;
    });
  }

  /**
   * Sun direction in scene space: a unit vector pointing from the site toward
   * the sun. Azimuth is degrees clockwise from north, and this scene is Y-up
   * with Z = negated survey north, so north is -Z and east is +X.
   */
  function sunDirection(altitudeDeg, azimuthDeg) {
    const altitude = altitudeDeg * Math.PI / 180;
    const azimuth = azimuthDeg * Math.PI / 180;
    const horizontal = Math.cos(altitude);
    return new THREE.Vector3(
      horizontal * Math.sin(azimuth),
      Math.sin(altitude),
      -horizontal * Math.cos(azimuth),
    );
  }

  /** Analytic shadow length on level ground. Matches app.js. */
  function shadowLength(heightM, altitudeDeg) {
    if (!(altitudeDeg > 0.5)) return null;
    return heightM / Math.tan(altitudeDeg * Math.PI / 180);
  }

  function bodyFont(weight, sizePx) {
    const family = getComputedStyle(document.body).fontFamily || "sans-serif";
    return `${weight} ${sizePx}px ${family}`;
  }

  function pointPosition(point, lift = 0) {
    return new THREE.Vector3(
      point.x_m - centerX,
      (point.elevation_m - minElevation) * verticalScale + lift,
      -(point.y_m - centerY),
    );
  }

  const TRACE_COLOUR = 0x4f7fe0;

  // Room categories. Warm for lived-in, cool for served, grey for circulation —
  // deliberately unlike the elevation ramp, so massing never reads as terrain.
  const CATEGORY_COLOURS = {
    entry: 0xd8a35f,
    living: 0xc9784f,
    kitchen: 0xbf8f4a,
    bedroom: 0x8fa4b8,
    bath: 0x7f9aa3,
    office: 0xa08fb5,
    service: 0x9a9a8c,
    storage: 0x8b8b80,
    circulation: 0xb5b3a6,
  };

  // These three must stay equal to --elev-low / --elev-mid / --elev-high in
  // styles.css: they colour the mesh that the on-screen elevation legend keys.
  // validate-static.mjs asserts the equality.
  const ELEV_LOW = 0x7d9fa8;
  const ELEV_MID = 0xd5bd79;
  const ELEV_HIGH = 0xbd6d4d;

  function colourForElevation(elevation, min, max) {
    const ratio = clamp((elevation - min) / (max - min), 0, 1);
    const low = new THREE.Color(ELEV_LOW);
    const middle = new THREE.Color(ELEV_MID);
    const high = new THREE.Color(ELEV_HIGH);
    return ratio < 0.5
      ? low.lerp(middle, ratio * 2)
      : middle.lerp(high, (ratio - 0.5) * 2);
  }

  function drawLabel(sprite, text) {
    const { canvas, context, colour } = sprite.userData;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(15, 23, 19, 0.82)";
    context.beginPath();
    context.roundRect(10, 14, 300, 68, 18);
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.18)";
    context.stroke();
    context.fillStyle = colour;
    // The canvas is a fixed 320 px and the labels are authored in two languages,
    // so a long one silently ran off both ends of its own plate. Shrink to fit
    // rather than clip: an unreadable caveat is the same as no caveat.
    let size = 34;
    context.font = bodyFont(600, size);
    while (size > 15 && context.measureText(text).width > 280) {
      size -= 1;
      context.font = bodyFont(600, size);
    }
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 160, 49);
    sprite.material.map.needsUpdate = true;
  }

  /**
   * Labels keep their text function so a language change retextures the
   * existing canvas in place. The previous implementation disposed the sprite
   * and never rebuilt it, so one toggle deleted the road label permanently.
   */
  function makeLabel(getText, colour = "#f1f2ed", owner = "terrain") {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }));
    // `owner` scopes registry cleanup: a terrain rebuild must drop only its own
    // labels, or scenery sprites survive in the scene while falling out of the
    // registry and silently stop tracking the language.
    sprite.userData = { canvas, context, colour, getText, owner };
    sprite.scale.set(5.4, 1.62, 1);
    sprite.renderOrder = 20;
    drawLabel(sprite, getText(api.language));
    labels.push(sprite);
    return sprite;
  }

  function forgetLabels(owner) {
    for (let index = labels.length - 1; index >= 0; index -= 1) {
      if (labels[index].userData.owner === owner) labels.splice(index, 1);
    }
  }

  function retextLabels() {
    labels.forEach((sprite) => {
      drawLabel(sprite, sprite.userData.getText(api.language));
      sprite.userData.resize?.(api.language);
    });
  }

  function makeCylinderBetween(start, end, radius, colour) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
    const material = new THREE.MeshStandardMaterial({
      color: colour,
      roughness: 0.72,
      metalness: 0,
    });
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.position.copy(start).add(end).multiplyScalar(0.5);
    cylinder.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    cylinder.castShadow = true;
    return cylinder;
  }

  function disposeGroup(group) {
    if (!group) return;
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    });
    group.removeFromParent();
  }

  function buildTerrain(data) {
    const points = data.survey.points;
    const byId = new Map(points.map((point) => [point.id, point]));
    minElevation = data.terrain.min_elevation_m;
    targetY = data.terrain.relief_m * 0.42 * verticalScale;

    terrainRoot = new THREE.Group();
    scene.add(terrainRoot);

    const positions = [];
    const colours = [];
    points.forEach((point) => {
      const position = pointPosition(point);
      positions.push(position.x, position.y, position.z);
      const colour = colourForElevation(
        point.elevation_m,
        data.terrain.min_elevation_m,
        data.terrain.max_elevation_m,
      );
      colours.push(colour.r, colour.g, colour.b);
    });

    const indexOf = new Map(points.map((point, index) => [point.id, index]));
    const indices = [];
    data.terrain.triangles.forEach((triangle) => {
      triangle.points.forEach((id) => indices.push(indexOf.get(id)));
    });

    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    indexed.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    indexed.setIndex(indices);

    // Edges come from the indexed geometry — taken after toNonIndexed() every
    // triangle edge would survive instead of just the facet boundaries.
    const edgeGeometry = new THREE.EdgesGeometry(indexed, 1);

    // Non-indexed gives each of the seven facets its own true normal, so
    // shadow normalBias is exact rather than approximate.
    const geometry = indexed.toNonIndexed();
    geometry.computeVertexNormals();
    indexed.dispose();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
      // Without this a zero-thickness TIN writes front and back depth at the
      // same value and self-shadows across the whole 40% slope.
      shadowSide: THREE.FrontSide,
    });
    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    terrainRoot.add(terrainMesh);

    terrainRoot.add(new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({ color: 0x26372f, transparent: true, opacity: 0.62 }),
    ));

    const boundaryPositions = [];
    data.site.outer_boundary_order.forEach((id) => {
      const position = pointPosition(byId.get(id), 0.24);
      boundaryPositions.push(position.x, position.y, position.z);
    });
    const boundaryGeometry = new THREE.BufferGeometry();
    boundaryGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(boundaryPositions, 3),
    );
    terrainRoot.add(
      new THREE.Line(
        boundaryGeometry,
        new THREE.LineBasicMaterial({ color: 0xf0f0e9, transparent: true, opacity: 0.92 }),
      ),
    );

    const roadStart = pointPosition(byId.get("Pt2"), 0.38);
    const roadEnd = pointPosition(byId.get("Pt1"), 0.38);
    terrainRoot.add(makeCylinderBetween(roadStart, roadEnd, 0.16, 0xde7652));
    const roadLabel = makeLabel(
      (language) => (language === "fa" ? "راه · Pt2–Pt1" : "ROAD · Pt2–Pt1"),
      "#f4b093",
    );
    roadLabel.position.copy(roadStart).add(roadEnd).multiplyScalar(0.5);
    roadLabel.position.y += 2.2;
    terrainRoot.add(roadLabel);

    contourGroup = new THREE.Group();
    Object.entries(data.terrain.contour_segments).forEach(([level, segments]) => {
      const contourPositions = [];
      segments.forEach((segment) => {
        segment.forEach(([x, y, elevation]) => {
          contourPositions.push(
            x - centerX,
            (elevation - minElevation) * verticalScale + 0.16,
            -(y - centerY),
          );
        });
      });
      const contourGeometry = new THREE.BufferGeometry();
      contourGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(contourPositions, 3),
      );
      const major = Number(level) % 5 === 0;
      contourGroup.add(
        new THREE.LineSegments(
          contourGeometry,
          new THREE.LineBasicMaterial({
            color: major ? 0xf0d6a1 : 0xd9cbb0,
            transparent: true,
            opacity: major ? 0.88 : 0.56,
          }),
        ),
      );
    });
    terrainRoot.add(contourGroup);

    pointGroup = new THREE.Group();
    points.forEach((point) => {
      const isInterior = point.role === "interior-terrain";
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(isInterior ? 0.34 : 0.27, 18, 12),
        new THREE.MeshStandardMaterial({
          color: isInterior ? 0xe0b35d : 0xf4f3ed,
          roughness: 0.55,
          metalness: 0.05,
        }),
      );
      sphere.position.copy(pointPosition(point, 0.38));
      sphere.castShadow = true;
      pointGroup.add(sphere);
      const elevation = point.elevation_m.toFixed(3);
      const label = makeLabel(
        () => `${point.id} · ${elevation} m`,
        isInterior ? "#f6ce80" : "#f2f3ee",
      );
      label.position.copy(pointPosition(point, 1.65));
      pointGroup.add(label);
    });
    terrainRoot.add(pointGroup);
  }

  function buildStaticScenery() {
    const northOrigin = new THREE.Vector3(-18, 0.1, 14);
    scene.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      northOrigin,
      8,
      0xe8ece7,
      1.25,
      0.6,
    ));
    const northLabel = makeLabel(
      (language) => (language === "fa" ? "شمال" : "N"),
      "#f1f2ed",
      "scenery",
    );
    northLabel.position.set(-18, 1.25, 4.7);
    // A four-glyph Persian word squeezes into a box sized for a single "N".
    northLabel.userData.resize = (language) => {
      const width = language === "fa" ? 3.4 : 1.8;
      northLabel.scale.set(width, 0.7, 1);
    };
    northLabel.userData.resize(api.language);
    scene.add(northLabel);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x18231e, roughness: 1, metalness: 0 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = PLANE_Y;
    // Deliberately does NOT receive shadows. The plane is a datum, not surveyed
    // ground; letting an 80 m low-sun shadow land on it would both overflow the
    // shadow frustum and imply evidence that does not exist.
    plane.receiveShadow = false;
    scene.add(plane);
    datumPlane = plane;

    // One division per metre, so a shadow can be counted against the grid.
    const grid = new THREE.GridHelper(PLANE_SIZE, PLANE_SIZE, 0x38473f, 0x27342e);
    grid.position.y = PLANE_Y + 0.07;
    grid.material.transparent = true;
    grid.material.opacity = 0.52;
    datumGrid = grid;
    scene.add(grid);
  }

  /**
   * A bounding sphere projects to a disc of the same radius from any direction,
   * so this frustum is valid for every sun position and only needs recomputing
   * when the geometry changes.
   */
  function updateShadowExtent() {
    if (!sun || !terrainRoot) return;
    const box = new THREE.Box3().setFromObject(terrainRoot);
    if (objectGroup && objectGroup.children.length) {
      box.union(new THREE.Box3().setFromObject(objectGroup));
    }
    // The trees cast, so they have to be inside the frustum. Four crowns under
    // 7 m barely move a 24 m bounding sphere, and the texel holds.
    if (plantingGroup && plantingGroup.children.length) {
      box.union(new THREE.Box3().setFromObject(plantingGroup));
    }
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2 + 1.5;
    sun.target.position.copy(centre);
    sun.target.updateMatrixWorld();
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -radius;
    shadowCamera.right = radius;
    shadowCamera.top = radius;
    shadowCamera.bottom = -radius;
    shadowCamera.near = Math.max(0.5, SUN_DISTANCE - radius);
    shadowCamera.far = SUN_DISTANCE + radius;
    shadowCamera.updateProjectionMatrix();
    if (currentSun) applySun(currentSun);
  }

  function testObjectDefinition(id) {
    const objects = siteData?.solar?.controls?.test_objects || [];
    const found = objects.find((item) => item.id === id) || objects[0];
    if (!found) return null;
    return { ...found, footprint: found.footprint || DEFAULT_FOOTPRINTS[found.id] };
  }

  /** Lays the wall along the contour, matching the orientation recommendation. */
  function contourHeadingAt(point) {
    const triangles = siteData?.terrain?.triangles || [];
    const facet = triangles.find((triangle) => triangle.points?.includes(point.id))
      || triangles[0];
    if (!facet || !Number.isFinite(facet.aspect_degrees_from_north)) return 0;
    return (facet.aspect_degrees_from_north + 90) * Math.PI / 180;
  }

  function buildTestObject() {
    disposeGroup(objectGroup);
    objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const definition = testObjectDefinition(currentObjectId);
    const anchor = siteData?.survey?.points?.find((point) => point.id === "Pt8");
    if (!definition || !anchor) return;

    const height = definition.height_m;
    const footprint = definition.footprint || {};
    const base = pointPosition(anchor);
    let geometry;
    if (footprint.shape === "circle") {
      const radius = (footprint.diameter_m || 0.2) / 2;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    } else {
      geometry = new THREE.BoxGeometry(
        footprint.length_m || 4,
        height,
        footprint.thickness_m || footprint.width_m || 4,
      );
    }
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xc98b52,
      roughness: 0.8,
      metalness: 0.02,
    }));
    mesh.position.set(base.x, base.y + height / 2, base.z);
    if (footprint.orientation === "contour-parallel") {
      mesh.rotation.y = contourHeadingAt(anchor);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    objectGroup.add(mesh);

    // A bright line to the analytically computed shadow tip. If the rendered
    // shadow lands on it, light direction, shadow map and the formula in
    // app.js all agree — verification anyone can screenshot.
    const rulerGeometry = new THREE.BufferGeometry();
    rulerGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    shadowRuler = new THREE.Line(rulerGeometry, new THREE.LineBasicMaterial({
      color: 0xffd8a8,
      transparent: true,
      opacity: 0.95,
    }));
    shadowRuler.userData = { base, height, hidden: rulerHidden };
    shadowRuler.visible = false;
    shadowRuler.renderOrder = 12;
    objectGroup.add(shadowRuler);

    updateShadowExtent();
  }

  function updateShadowRuler() {
    if (!shadowRuler || !currentSun) return;
    const { base, height, hidden } = shadowRuler.userData;
    const length = shadowLength(height, currentSun.altitude_deg);
    const lit = currentSun.above_horizon !== false && currentSun.altitude_deg > 0.5;
    // Vertical exaggeration makes the geometry a steeper site than the survey,
    // so a metric shadow claim would be false. Withhold it instead.
    if (hidden || !lit || length === null || verticalScale !== 1) {
      shadowRuler.visible = false;
      return;
    }
    const direction = sunDirection(currentSun.altitude_deg, currentSun.azimuth_deg);
    const tip = new THREE.Vector3(
      base.x - direction.x / direction.y * height,
      base.y,
      base.z - direction.z / direction.y * height,
    );
    const array = shadowRuler.geometry.attributes.position.array;
    array[0] = base.x;
    array[1] = base.y + 0.02;
    array[2] = base.z;
    array[3] = tip.x;
    array[4] = base.y + 0.02;
    array[5] = tip.z;
    shadowRuler.geometry.attributes.position.needsUpdate = true;
    shadowRuler.geometry.computeBoundingSphere();
    shadowRuler.visible = true;
  }

  /**
   * Where the shadow of the test object's highest point lands on the surveyed
   * TIN across the whole selected day. This is a real ray-to-surface
   * intersection, not the level-ground formula: on a 34.5–44% grade the two
   * disagree by metres, and the disagreement is the point of drawing it.
   *
   * Gaps are gaps. When the ray misses the TIN the shadow has left the seven
   * verified facets, and the polyline breaks rather than being bridged across
   * ground this project has not measured.
   */
  function buildShadowTrace() {
    disposeGroup(shadowTraceGroup);
    shadowTraceGroup = new THREE.Group();
    scene.add(shadowTraceGroup);
    // Exaggerated relief is a steeper site than the survey, so a traced shadow
    // on it would be a measurement of geometry that does not exist. Same rule
    // as the analytic ruler.
    if (traceHidden || verticalScale !== 1) return;

    const definition = testObjectDefinition(currentObjectId);
    const anchor = siteData?.survey?.points?.find((point) => point.id === "Pt8");
    const positions = currentSeason?.positions || [];
    if (!definition || !anchor || !terrainMesh || positions.length < 2) return;

    raycaster = raycaster || new THREE.Raycaster();
    scene.updateMatrixWorld(true);
    const top = pointPosition(anchor, definition.height_m);
    const runs = [];
    let run = [];
    positions.forEach((position) => {
      let hit = null;
      if (position.altitude_deg > 0.5) {
        const toGround = sunDirection(position.altitude_deg, position.azimuth_deg).negate();
        raycaster.set(top, toGround);
        [hit] = raycaster.intersectObject(terrainMesh, false);
      }
      if (!hit) {
        if (run.length >= 6) runs.push(run);
        run = [];
        return;
      }
      run.push(hit.point.x, hit.point.y + 0.05, hit.point.z);
    });
    if (run.length >= 6) runs.push(run);

    runs.forEach((vertices) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      // Cool blue on purpose. A dark line would read as shadow but is
      // indistinguishable from the TIN facet edges, which all radiate from the
      // Pt8 hub the object stands on — exactly where this curve lives.
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: TRACE_COLOUR,
        transparent: true,
        opacity: 0.95,
      }));
      line.renderOrder = 11;
      shadowTraceGroup.add(line);
    });
  }

  /**
   * Preliminary concept massing. Off by default, and drawn translucent with a
   * visible wireframe so it never reads as coordinated construction geometry:
   * nothing has been selected, and the volumes carry a derived ceiling height
   * rather than a stated one. It casts shadows, which is the whole point of
   * putting it in this view — the sun study is what makes it useful.
   */
  function buildConceptMassing() {
    disposeGroup(conceptGroup);
    conceptGroup = new THREE.Group();
    scene.add(conceptGroup);
    if (conceptsHidden) return;

    const concepts = siteData?.concepts;
    const option = concepts?.options?.find((item) => item.id === currentConceptId)
      || concepts?.options?.[0];
    if (!option) return;
    const rotation = concepts.frame.rotation_y_rad;

    const place = (source, height, colour, opacity) => {
      const geometry = new THREE.BoxGeometry(source.width_m, height, source.depth_m);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: colour,
        roughness: 0.72,
        metalness: 0.02,
        transparent: opacity < 1,
        opacity,
      }));
      const base = pointPosition({
        x_m: source.x_m,
        y_m: source.y_m,
        elevation_m: source.level_m ?? source.elevation_m,
      });
      mesh.position.set(base.x, base.y + height / 2 * verticalScale, base.z);
      mesh.scale.y = verticalScale;
      mesh.rotation.y = rotation;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      conceptGroup.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x1d2622, transparent: true, opacity: 0.55 }),
      );
      edges.position.copy(mesh.position);
      edges.rotation.y = rotation;
      edges.scale.y = verticalScale;
      conceptGroup.add(edges);
      return mesh;
    };

    option.rooms.forEach((room) => {
      if (!(room.height_m > 0)) return;
      place(room, room.height_m, CATEGORY_COLOURS[room.category] ?? 0xb9a98c, 0.72);
    });
    option.retaining.forEach((wall) => place(wall, wall.height_m, 0x8a8578, 0.9));
    // No height anywhere in the concept data, so they stay platforms rather than
    // being given an invented volume.
    if (option.garage) place(option.garage, 0.18, 0x9aa39b, 0.95);
    if (option.courtyard) place(option.courtyard, 0.12, 0x6f8a76, 0.85);
    // Mono-pitch roofs: the slope is a percentage in the concept data, applied
    // about the bar's cross-slope axis.
    option.roofs.forEach((roof) => {
      const mesh = place(roof, 0.22, 0xc98b52, 0.9);
      mesh.rotation.z = Math.atan(roof.slope_percent / 100);
    });
  }

  /**
   * The measured terrain horizon as a silhouette ring at a fixed radius.
   *
   * `fog: false` is not cosmetic: the scene fog is camera-distance based, so a
   * ring at a constant world radius would fog and unfog wildly while orbiting.
   *
   * A line, and only a line. The sampled landform surface is a separate layer
   * with its own toggle (`buildLocalTerrain`) — this one stays the pure angular
   * profile that drives the solar mask, so the two are never confused.
   */
  function buildHorizonRing() {
    disposeGroup(horizonGroup);
    horizonGroup = new THREE.Group();
    scene.add(horizonGroup);
    if (horizonHidden) return;
    const profile = siteData?.horizon?.combined?.profile;
    if (!profile?.length) return;

    const vertices = [];
    profile.concat(profile[0]).forEach((entry) => {
      const point = sunDirection(entry.horizon_deg, entry.azimuth_deg)
        .multiplyScalar(HORIZON_RADIUS);
      vertices.push(point.x, point.y + targetY, point.z);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const ring = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: 0x9a8f7a,
      transparent: true,
      opacity: 0.9,
      fog: false,
    }));
    ring.renderOrder = 5;
    horizonGroup.add(ring);
    horizonGroup.add(makeLabel(
      (language) => (language === "fa"
        ? "افق زمین · مدل رقومی ارتفاع"
        : "Terrain horizon · DEM-derived"),
      "#e0cba6",
      "horizon",
    ));
    const label = horizonGroup.children[horizonGroup.children.length - 1];
    const north = sunDirection(profile[0].horizon_deg, 0).multiplyScalar(HORIZON_RADIUS);
    label.position.set(north.x, north.y + targetY + 6, north.z);
    label.scale.set(9, 2.7, 1);
  }

  /**
   * Illustrative planting. Four trees standing on the TIN so the sun study has
   * something of building height to cast from — a bare surveyed surface casts
   * nothing but its own slope.
   *
   * These are not survey data. No bundled source records vegetation inside the
   * parcel, and `planting.status` says `illustrative-only`. They hang off
   * `terrainRoot` so they scale and rebuild with it, and they are folded into
   * `updateShadowExtent` because unlike the hillside they do cast.
   *
   * Their base comes from a raycast onto the TIN rather than from the plane fit,
   * so each trunk meets measured ground at its own facet.
   */
  function buildPlanting() {
    disposeGroup(plantingGroup);
    plantingGroup = new THREE.Group();
    if (terrainRoot) terrainRoot.add(plantingGroup);
    else scene.add(plantingGroup);
    if (plantingHidden || verticalScale !== 1) return;
    const trees = siteData?.planting?.trees || [];
    if (!trees.length || !terrainMesh) return;

    const origin = siteData.survey.points.find(
      (point) => point.id === (siteData.planting.origin_point || "Pt8"),
    );
    if (!origin) return;
    if (!raycaster) raycaster = new THREE.Raycaster();

    trees.forEach((tree) => {
      const x = (origin.x_m - centerX) + tree.east_m;
      const z = -((origin.y_m - centerY) + tree.north_m);
      raycaster.set(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0));
      const hit = raycaster.intersectObject(terrainMesh, false)[0];
      if (!hit) return;
      const groundY = hit.point.y;

      // Deterministic per-tree variation from the id, so no two are identical and
      // a rebuild never reshuffles them. Trees in a field are not a repeated
      // asset, and four copies of one mesh read as furniture.
      const seed = [...tree.id].reduce((total, character) => total + character.charCodeAt(0), 0);
      const vary = (index, spread) => ((seed * (index + 7) % 97) / 97 - 0.5) * spread;

      const trunkHeight = tree.height_m * 0.42;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(tree.height_m * 0.035, tree.height_m * 0.05, trunkHeight, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: 0.9, metalness: 0 }),
      );
      trunk.position.set(x, groundY + trunkHeight / 2, z);
      trunk.rotation.z = vary(1, 0.09);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      plantingGroup.add(trunk);

      // A low-detail icosahedron rather than a sphere: the silhouette is what
      // shapes the shadow, and a faceted crown reads as a tree at this scale
      // without pretending to be a species.
      const foliage = new THREE.MeshStandardMaterial({
        // Hue shifts a little tree to tree, the way a mixed row does.
        color: new THREE.Color(0x51703f).offsetHSL(vary(2, 0.05), vary(3, 0.12), vary(4, 0.07)),
        roughness: 0.95,
        metalness: 0,
        flatShading: true,
      });
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(tree.crown_radius_m, 1),
        foliage,
      );
      crown.position.set(x, groundY + trunkHeight + tree.crown_radius_m * 0.82, z);
      crown.scale.set(1 + vary(5, 0.22), 1.25 + vary(6, 0.3), 1 + vary(7, 0.22));
      crown.rotation.set(vary(8, 0.5), vary(9, 2), vary(10, 0.4));
      crown.castShadow = true;
      crown.receiveShadow = true;
      crown.userData.sway = { x, z, baseY: crown.position.y };
      plantingGroup.add(crown);

      // A second, smaller lobe offset off the main crown. Two overlapping masses
      // break the single-sphere silhouette, which is what made these read as
      // lollipops, and they thicken the shadow the trees exist to cast.
      const lobe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(tree.crown_radius_m * (0.62 + vary(11, 0.12)), 1),
        foliage,
      );
      lobe.position.set(
        x + vary(12, tree.crown_radius_m * 1.1),
        crown.position.y + tree.crown_radius_m * (0.35 + vary(13, 0.3)),
        z + vary(14, tree.crown_radius_m * 1.1),
      );
      lobe.rotation.set(vary(15, 1), vary(16, 2), vary(17, 1));
      lobe.castShadow = true;
      lobe.receiveShadow = true;
      lobe.userData.sway = {
        x: lobe.position.x,
        z: lobe.position.z,
        baseY: lobe.position.y,
      };
      plantingGroup.add(lobe);
    });
  }

  /**
   * The two roads bounding the field, laid on the hillside outside the boundary.
   *
   * The upper one follows the surveyed Pt2–Pt1 frontage: that line and which side
   * of the parcel it is on are measured. Its width, its length and the batter each
   * side are not. The lower one is client-reported and appears in no bundled
   * source, so it is drawn in a different, paler material — the evidence classes
   * must not look alike.
   *
   * The bench itself is cut into the hillside by the generator, because a level
   * carriageway laid over a 38% slope is buried on its uphill side. Here that
   * leaves only the deck to draw, raycast onto the corridor that was carved for
   * it, so the two can never drift apart. Neither casts: this scene's shadow study
   * covers the surveyed parcel, and a strip of inferred carriageway has no
   * business in it.
   */
  function buildRoads() {
    disposeGroup(roadGroup);
    roadGroup = new THREE.Group();
    scene.add(roadGroup);
    if (roadsHidden || hillHidden || !hillSurface) return;
    const published = siteData?.roads;
    if (!published?.roads?.length) return;
    const origin = siteData.survey.points.find(
      (point) => point.id === (published.origin_point || "Pt8"),
    );
    if (!origin) return;
    if (!raycaster) raycaster = new THREE.Raycaster();

    const originX = origin.x_m - centerX;
    const originZ = -(origin.y_m - centerY);
    const groundAt = (x, z) => {
      raycaster.set(new THREE.Vector3(x, 900, z), new THREE.Vector3(0, -1, 0));
      const hit = raycaster.intersectObject(hillSurface, false)[0];
      return hit ? hit.point.y : null;
    };

    published.roads.forEach((road) => {
      const [from, to] = road.centreline;
      const ax = originX + from[0];
      const az = originZ - from[1];
      const bx = originX + to[0];
      const bz = originZ - to[1];
      const length = Math.hypot(bx - ax, bz - az);
      if (!length) return;
      const ux = (bx - ax) / length;
      const uz = (bz - az) / length;
      const half = road.width_m / 2;

      // The carriageway is level, at the elevation published with it. Everything
      // vertical here follows from that: where the hill stands above the bench the
      // strip needs a cut face, where it falls below it needs fill.
      const roadY = (road.level_elevation_m - minElevation) * verticalScale;
      // The corridor is already carved into the hillside data, so the deck only
      // has to be laid on it. Runs break where the carve stopped — past the
      // published cut limit, or past the edge of the drawn hillside.
      const limit = (road.max_cut_or_fill_drawn_m ?? 6) * verticalScale;
      const runs = [];
      let run = null;
      const steps = Math.max(2, Math.round(length / 1.5));
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const cx = ax + (bx - ax) * t;
        const cz = az + (bz - az) * t;
        const leftX = cx - uz * half;
        const leftZ = cz + ux * half;
        const rightX = cx + uz * half;
        const rightZ = cz - ux * half;
        const leftGround = groundAt(leftX, leftZ);
        const rightGround = groundAt(rightX, rightZ);
        // Draped on the corridor rather than held at the published level: the
        // carve is what defines the bench, and drawing the deck anywhere else
        // would let the two drift apart. The run breaks where the carve stopped —
        // past the cut limit, or past the edge of the drawn hillside.
        const carved = leftGround !== null && rightGround !== null
          && Math.abs(leftGround - roadY) <= limit
          && Math.abs(rightGround - roadY) <= limit;
        if (!carved) {
          run = null;
          continue;
        }
        if (!run) {
          run = { deck: [], count: 0 };
          runs.push(run);
        }
        const lift = 0.06 * verticalScale;
        run.deck.push(leftX, leftGround + lift, leftZ);
        run.deck.push(rightX, rightGround + lift, rightZ);
        run.count += 1;
      }

      const ribbon = (values, count, colour, opacity) => {
        const indices = [];
        for (let i = 0; i < count - 1; i += 1) {
          const a = i * 2;
          indices.push(a, a + 2, a + 3);
          indices.push(a, a + 3, a + 1);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
        geometry.setIndex(indices);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
          color: colour,
          side: THREE.DoubleSide,
          fog: false,
          transparent: opacity < 1,
          opacity,
        }));
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        roadGroup.add(mesh);
      };

      const surveyed = road.status !== "client-reported";
      runs.filter((entry) => entry.count >= 2).forEach((entry) => {
        // A worn gravel grey rather than near-black: at this scale a very dark
        // deck read as a scar cut across the hillside.
        ribbon(entry.deck, entry.count, surveyed ? 0x6a6459 : 0x9b9488,
          surveyed ? 1 : 0.72);
      });
    });
  }

  /** The 16-point compass this project publishes, as a bearing in degrees. */
  const COMPASS_BEARINGS = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };

  /** Persian-Indic digits, to match the numerals every fa string on this page uses. */
  function faDigits(text) {
    return String(text).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
      .replace(".", "٫");
  }

  /**
   * The wind row for the season being drawn, not the annual average: direction
   * here is seasonal — easterly for three quarters of the year and westerly in
   * summer — so an annual arrow would be wrong half the time the summer solstice
   * is on screen. The solar-date-to-wind-season map is published in the data.
   */
  function seasonalWind() {
    const seasons = siteData?.wind?.seasons || [];
    const mapped = siteData?.wind?.season_for_solar_date?.[currentSeason?.id];
    return seasons.find((season) => season.season === mapped)
      || seasons.find((season) => season.season === "annual")
      || seasons[0]
      || null;
  }

  /**
   * Prevailing wind, as an arrow over the parcel and a sway on the tree crowns.
   *
   * The direction and the speeds are measured — `wind.direction_convention` says
   * the code is the direction the wind blows *from*, so the arrow points the other
   * way. The sway is not measured: at a 1.7 m/s area-averaged mean nothing visible
   * would move, and the amplitude here is a fixed few degrees chosen to be
   * legible. The label says so, in both languages.
   */
  function buildWind() {
    disposeGroup(windGroup);
    forgetLabels("wind");
    windGroup = new THREE.Group();
    scene.add(windGroup);
    stopWindLoop();
    if (windHidden) return;
    const row = seasonalWind();
    const bearing = COMPASS_BEARINGS[row?.prevailing_direction];
    if (!row || bearing === undefined) return;

    // Meteorological convention: the code is where it comes from.
    const heading = (bearing + 180) * Math.PI / 180;
    const along = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
    const anchor = siteData.survey.points.find((point) => point.id === "Pt8");
    const base = pointPosition(anchor, 4.5);
    const from = base.clone().addScaledVector(along, -13);

    // Solid geometry rather than ArrowHelper: its shaft is a line, and a 1 px
    // line 26 m long across a lit slope is invisible at every useful zoom.
    const material = new THREE.MeshBasicMaterial({ color: 0x6fb2c4, fog: false });
    const shaftLength = 19;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, shaftLength, 10), material);
    shaft.position.copy(from).addScaledVector(along, shaftLength / 2);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.4, 12), material);
    head.position.copy(from).addScaledVector(along, shaftLength + 2.2);
    head.quaternion.copy(shaft.quaternion);
    [shaft, head].forEach((mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      windGroup.add(mesh);
    });
    const label = makeLabel(
      (language) => (language === "fa"
        // Short enough to fit the plate at full size in both languages. That the
        // motion is illustrative is said on the control itself, not here, where a
        // third clause shrank the whole line past legibility.
        ? `باد ${row.season_label?.fa ?? ""} از ${row.prevailing_direction_label.fa} · میانگین ${faDigits(row.mean_speed_ms)} م/ث`
        : `${row.season_label?.en ?? ""} wind from ${row.prevailing_direction_label.en} · ${row.mean_speed_ms} m/s mean`),
      "#a9dbe6",
      "wind",
    );
    label.position.copy(from).addScaledVector(along, 11).setY(base.y + 8);
    label.scale.set(19, 5.7, 1);
    windGroup.add(label);

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    windStart = performance.now();
    windLoop();
  }

  /**
   * The only animation loop in this file, and it exists only while the layer is
   * on. Everything else renders on demand through `requestRender`.
   */
  function windLoop() {
    windFrame = requestAnimationFrame(windLoop);
    if (document.hidden || !plantingGroup) return;
    const elapsed = (performance.now() - windStart) / 1000;
    const row = seasonalWind();
    const bearing = COMPASS_BEARINGS[row?.prevailing_direction];
    if (bearing === undefined) return;
    const heading = (bearing + 180) * Math.PI / 180;
    let phase = 0;
    plantingGroup.children.forEach((child) => {
      const sway = child.userData.sway;
      if (!sway) return;
      phase += 1.1;
      // A few degrees of lean, gusting on a slow beat. Fixed amplitude: deriving
      // it from a 1.7 m/s regional mean would dress a guess up as a measurement.
      const lean = 0.055 * (0.65 + 0.35 * Math.sin(elapsed * 0.7 + phase))
        * Math.sin(elapsed * 1.9 + phase);
      child.position.set(
        sway.x + Math.sin(heading) * lean * 6,
        sway.baseY,
        sway.z - Math.cos(heading) * lean * 6,
      );
    });
    render();
  }

  function stopWindLoop() {
    if (!windFrame) return;
    cancelAnimationFrame(windFrame);
    windFrame = 0;
  }

  // Deliberately unlike the elevation ramp on the parcel. This surface is a
  // sampled hillside and must never read as the surveyed TIN. These are final
  // on-screen colours, not albedo: the layer is drawn unlit.
  const HILL_LOW = 0x3c4a41;
  const HILL_HIGH = 0x8a9273;
  const HILL_FLOOR = 0x2c352e;

  /**
   * The hillside the field sits on: the DEM sampled on a square grid and drawn
   * out to 200 m, which reaches past the crest south of the road and past the
   * valley floor to the north. It is the landform under the parcel, not a
   * region — the surveyed ground is a visible opening in the middle of it.
   *
   * Five things here are load-bearing rather than stylistic:
   *
   * - It hangs off `scene`, not `terrainRoot`, so `updateShadowExtent` never
   *   sees it. Folding a 400 m surface into that bounding sphere would take the
   *   shadow-map texel from 23 mm to roughly a third of a metre and quietly
   *   degrade the shadow study this view exists for. It neither casts nor
   *   receives.
   * - `fog: false`, because the scene fog ends at 145 m and would otherwise
   *   render everything past the near slope as a flat disc of background.
   * - Unlit, with a fixed cartographic relief shade baked into the vertex
   *   colours, lit from the north-west as a map is. That light is a drawing
   *   convention, not the sun: this surface casts and receives no shadow, and
   *   shading it from the sun's own direction would imply it takes part in a
   *   solar study it is excluded from.
   * - The parcel is cut out of it, with clearance. The TIN carries 11.754 m of
   *   relief inside 25 m while one DEM cell spans the lot, so an uncut sheet
   *   would pass straight through the surveyed ground.
   * - Elevations arrive on the DEM's own datum and are shifted by the single
   *   published constant in `datum.offset_m`, which puts the drawn surface onto
   *   the surveyed elevation of Pt8. That shift is alignment, not correction: it
   *   changes no relative relief, and it is published rather than folded in.
   */
  function buildLocalTerrain() {
    disposeGroup(hillGroup);
    hillGroup = new THREE.Group();
    hillSurface = null;
    scene.add(hillGroup);
    // The plane and its metre grid are a datum for when there is no ground. With
    // the hillside drawn there is ground: the plane reads as a second floor
    // stacked under it, and the grid reads as a dark hatch patch at hillside
    // range. The grid is the shadow measuring rule, which only means anything at
    // site scale anyway.
    if (datumPlane) datumPlane.visible = hillHidden;
    if (datumGrid) datumGrid.visible = hillHidden;
    if (hillHidden) return;
    const hill = siteData?.localTerrain;
    if (!hill?.elevations_m?.length) return;

    const axis = hill.axis_m;
    const rows = [...axis].reverse();
    // The grid was built about Pt8, which is not the centroid the scene is
    // built around. Elevations already carry the survey's datum — the generator
    // publishes `datum.offset_m` and applies it there, so the surface and the
    // TIN are in one vertical system before either is drawn.
    const originX = hill.origin.x_m - centerX;
    const originZ = -(hill.origin.y_m - centerY);
    const elevationY = (elevation) => (elevation - minElevation) * verticalScale;

    const positions = [];
    rows.forEach((north, r) => {
      axis.forEach((east, c) => {
        positions.push(originX + east, elevationY(hill.elevations_m[r][c]), originZ - north);
      });
    });

    // Continuous, including under the parcel. Near the boundary this surface is
    // the surveyed plane dropped by 0.6 m, which is more than the plane's largest
    // positive residual, so the measured TIN sits above it everywhere and the two
    // read as one slope instead of a patch inset in a hole.
    const indices = [];
    for (let r = 0; r < rows.length - 1; r += 1) {
      for (let c = 0; c < axis.length - 1; c += 1) {
        const a = r * axis.length + c;
        const b = a + 1;
        const d = (r + 1) * axis.length + c;
        const e = d + 1;
        indices.push(a, d, e);
        indices.push(a, e, b);
      }
    }

    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    indexed.setIndex(indices);
    const geometry = indexed.toNonIndexed();
    geometry.computeVertexNormals();
    indexed.dispose();

    // Percentile-stretched ramp, then hillshaded. The stretch matters because
    // the distribution is skewed: a ramp across the full range leaves most of
    // the slope on one tone.
    const span = Math.max(1e-6, hill.ramp_high_m - hill.ramp_low_m);
    const relief = new THREE.Vector3(-0.612, 0.5, -0.612).normalize();
    const low = new THREE.Color(HILL_LOW);
    const high = new THREE.Color(HILL_HIGH);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const colours = new Float32Array(position.count * 3);
    const colour = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const elevation = position.getY(index) / (verticalScale || 1) + minElevation;
      colour.copy(low).lerp(high, clamp((elevation - hill.ramp_low_m) / span, 0, 1));
      // Winding on a double-sided sheet can send a normal either way, so flip it
      // upward first. Taking the magnitude of the dot instead would light both
      // faces of every slope equally and flatten the whole surface to one tone.
      let nx = normal.getX(index);
      let ny = normal.getY(index);
      let nz = normal.getZ(index);
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const facing = Math.max(0, nx * relief.x + ny * relief.y + nz * relief.z);
      const shade = 0.2 + 0.8 * facing;
      colours[index * 3] = colour.r * shade;
      colours[index * 3 + 1] = colour.g * shade;
      colours[index * 3 + 2] = colour.b * shade;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));

    const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      // Fogged, unlike the old 2.2 km layer: at 100 m the fog is a depth cue that
      // settles the rim into the horizon rather than a wall that swallows it.
      fog: true,
    }));
    surface.castShadow = false;
    surface.receiveShadow = false;
    hillGroup.add(surface);
    // Kept so the roads can be laid on the ground they actually run over.
    hillSurface = surface;

    // A sheet floating in black reads as a rendering artefact rather than as
    // ground. Dropping the rim to a floor makes it a block model, which is the
    // map convention for "this is an extract, and it was cut here".
    // Scaled with the terrain so the block keeps its proportions under the
    // exaggeration control rather than flattening into a plate.
    const floorY = elevationY(hill.min_elevation_m) - 8 * verticalScale;
    hillGroup.add(buildHillSkirt(hill, rectangleRim(0, axis.length - 1, 0,
      axis.length - 1), rows, axis, originX, originZ, elevationY, floorY));
    // Closes the bottom of the extract, so the cut faces read as a block rather
    // than as four walls standing in nothing.
    const reachM = axis[axis.length - 1];
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(reachM * 2, reachM * 2),
      new THREE.MeshBasicMaterial({ color: HILL_FLOOR, side: THREE.DoubleSide, fog: true }),
    );
    base.rotation.x = Math.PI / 2;
    base.position.set(originX, floorY, originZ);
    base.castShadow = false;
    base.receiveShadow = false;
    hillGroup.add(base);
  }

  /** A closed loop of grid indices around a rectangle, clockwise in index space. */
  function rectangleRim(rowFrom, rowTo, columnFrom, columnTo) {
    const rim = [];
    for (let c = columnFrom; c <= columnTo; c += 1) rim.push([rowFrom, c]);
    for (let r = rowFrom + 1; r <= rowTo; r += 1) rim.push([r, columnTo]);
    for (let c = columnTo - 1; c >= columnFrom; c -= 1) rim.push([rowTo, c]);
    for (let r = rowTo - 1; r > rowFrom; r -= 1) rim.push([r, columnFrom]);
    return rim;
  }

  /** One set of cut faces, from a rim of grid nodes down to a common floor. */
  function buildHillSkirt(hill, rim, rows, axis, originX, originZ, elevationY, floorY) {
    const positions = [];
    rim.forEach(([r, c]) => {
      const x = originX + axis[c];
      const z = originZ - rows[r];
      positions.push(x, elevationY(hill.elevations_m[r][c]), z);
      positions.push(x, floorY, z);
    });
    const indices = [];
    for (let i = 0; i < rim.length; i += 1) {
      const next = (i + 1) % rim.length;
      const a = i * 2;
      const b = next * 2;
      indices.push(a, a + 1, b + 1);
      indices.push(a, b + 1, b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const wall = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: HILL_FLOOR,
      side: THREE.DoubleSide,
      fog: true,
    }));
    wall.castShadow = false;
    wall.receiveShadow = false;
    return wall;
  }

  function buildSunPath(season) {
    disposeGroup(sunPathGroup);
    sunPathGroup = new THREE.Group();
    scene.add(sunPathGroup);
    if (!season?.positions?.length) return;

    const centre = new THREE.Vector3(0, targetY, 0);
    const arc = [];
    season.positions.forEach((position) => {
      if (position.altitude_deg <= 0) return;
      const point = sunDirection(position.altitude_deg, position.azimuth_deg)
        .multiplyScalar(DOME_RADIUS)
        .add(centre);
      arc.push(point.x, point.y, point.z);
    });
    if (arc.length >= 6) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(arc, 3));
      sunPathGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: 0xd9b563,
        transparent: true,
        opacity: 0.85,
      })));
    }

    // Sunrise and sunset bearings as ground ticks — the 55 degree seasonal
    // swing on each side is the most useful orientation fact in the dataset.
    [season.sunrise_azimuth_deg, season.sunset_azimuth_deg].forEach((azimuth) => {
      if (!Number.isFinite(azimuth)) return;
      const inner = sunDirection(0, azimuth).multiplyScalar(DOME_RADIUS - 3);
      const outer = sunDirection(0, azimuth).multiplyScalar(DOME_RADIUS);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        inner.x, PLANE_Y + 0.1, inner.z,
        outer.x, PLANE_Y + 0.1, outer.z,
      ], 3));
      sunPathGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: 0xe6b98a,
        transparent: true,
        opacity: 0.8,
      })));
    });

    sunMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffe6ad }),
    );
    sunMarker.visible = false;
    sunPathGroup.add(sunMarker);
  }

  function applySun(position) {
    if (!sun) return;
    const direction = sunDirection(position.altitude_deg, position.azimuth_deg);
    sun.position.copy(direction)
      .multiplyScalar(SUN_DISTANCE)
      .add(sun.target.position);
    const lit = position.above_horizon !== false && position.altitude_deg > 0;
    sun.visible = lit;
    sun.castShadow = lit;
    sun.intensity = lit ? 3.3 * clamp(position.altitude_deg / 12, 0.35, 1) : 0;
    sun.color.setHex(position.altitude_deg < 12 ? 0xffb478 : 0xffe5bc);
    if (hemisphere) hemisphere.intensity = lit ? 1.8 : 2.6;
    if (sunMarker) {
      sunMarker.visible = lit;
      if (lit) {
        sunMarker.position.copy(direction)
          .multiplyScalar(DOME_RADIUS)
          .add(new THREE.Vector3(0, targetY, 0));
      }
    }
  }

  /**
   * A two-stop vertical gradient standing in for sky. Not a photograph and not an
   * environment map — it is there so the terrain has something to sit against
   * instead of a flat panel, and so the horizon line reads as a horizon.
   *
   * Built on a canvas rather than fetched: this page has to open from `file://`
   * with no network at all.
   */
  function skyTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    if (api.theme === "dark") {
      gradient.addColorStop(0, "#0a1016");
      gradient.addColorStop(0.62, "#16232a");
      gradient.addColorStop(1, "#2b3a37");
    } else {
      gradient.addColorStop(0, "#1d3040");
      gradient.addColorStop(0.58, "#3f5b62");
      gradient.addColorStop(1, "#8d9b8a");
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function applySky() {
    if (!scene) return;
    scene.background?.dispose?.();
    scene.background = skyTexture();
    // Fog matched to the sky's lower stop, so distance fades into the horizon
    // rather than into a different colour.
    // Near/far chosen against the 100 m hillside and the 92 m default orbit: the
    // surveyed parcel stays crisp, the far rim of the patch fades toward the
    // horizon stop instead of ending on a hard cut line against the sky.
    scene.fog = new THREE.Fog(api.theme === "dark" ? 0x2b3a37 : 0x8d9b8a, 135, 340);
  }

  function configureScene(data) {
    scene = new THREE.Scene();

    // The far plane clears the hillside extract seen from its own preset. Near
    // moves off 0.1 to keep the depth ratio at 3e3 rather than 2e6 — the orbit
    // never gets closer than about eight metres to any geometry, so nothing is
    // clipped by it.
    camera = new THREE.PerspectiveCamera(38, 1, 1, 3000);

    applySky();

    hemisphere = new THREE.HemisphereLight(0xdce8df, 0x28342e, 1.8);
    scene.add(hemisphere);

    // Position is always set from solar data via setSun; there is no default
    // sun direction, so an unset sun renders unlit rather than plausibly wrong.
    sun = new THREE.DirectionalLight(0xffe5bc, 0);
    sun.visible = false;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // World-space offset, so it survives a frustum resize. shadow.bias is in
    // the shadow camera's NDC depth and would need retuning instead.
    sun.shadow.normalBias = 0.03;
    sun.shadow.bias = 0;
    scene.add(sun);
    // three.js only updates a light target that is in the scene graph. Without
    // this the shadow camera silently stays aimed at the origin.
    scene.add(sun.target);

    const fill = new THREE.DirectionalLight(0x86aab0, 0.9);
    fill.position.set(25, 18, -30);
    scene.add(fill);

    const points = data.survey.points;
    centerX = points.reduce((total, point) => total + point.x_m, 0) / points.length;
    centerY = points.reduce((total, point) => total + point.y_m, 0) / points.length;

    buildTerrain(data);
    buildStaticScenery();
    buildTestObject();
    buildConceptMassing();
    buildHorizonRing();
    buildLocalTerrain();
    buildRoads();
    buildPlanting();
    buildWind();
  }

  /**
   * At any vertical exaggeration the geometry is a steeper site than the survey,
   * so the metric shadow ruler and the traced shadow path are both withheld.
   * Saying so beats leaving a checked box that silently draws nothing.
   */
  function updateWithheldNote() {
    const note = document.querySelector("#terrain-3d-withheld");
    if (note) note.hidden = verticalScale === 1;
    const traceToggle = document.querySelector("#terrain-3d-trace");
    if (traceToggle) traceToggle.disabled = verticalScale !== 1;
    // The trees are the one thing here at real building height, so an
    // exaggerated slope under them would read as a measurable shadow that is
    // not. They come out with the ruler and the trace rather than stretch.
    const treeToggle = document.querySelector("#terrain-3d-trees");
    if (treeToggle) treeToggle.disabled = verticalScale !== 1;
  }

  function rebuildTerrain() {
    if (!siteData || !scene) return;
    disposeGroup(terrainRoot);
    forgetLabels("terrain");
    buildTerrain(siteData);
    buildRoads();
    buildPlanting();
    buildWind();
    buildTestObject();
    buildShadowTrace();
    buildConceptMassing();
    // The hillside is continuous with the surveyed ground, so it follows the
    // scale control rather than staying at true relief beside an exaggerated TIN.
    buildLocalTerrain();
    if (currentSun) {
      applySun(currentSun);
      updateShadowRuler();
    }
    requestRender();
  }

  function updateCamera() {
    const cosPitch = Math.cos(pitch);
    camera.position.set(
      Math.sin(yaw) * cosPitch * distance,
      targetY + Math.sin(pitch) * distance,
      Math.cos(yaw) * cosPitch * distance,
    );
    camera.lookAt(0, targetY, 0);
  }

  function render() {
    renderQueued = false;
    if (!renderer || !scene || !camera) return;
    updateCamera();
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  function resize() {
    if (!renderer || !stage || !camera) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function applyPreset(name) {
    const preset = presets[name] || presets.perspective;
    currentView = name in presets ? name : "perspective";
    yaw = preset.yaw;
    pitch = preset.pitch;
    distance = preset.distance;
    document.querySelectorAll("[data-terrain-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.terrainView === currentView);
    });
    requestRender();
  }

  function pointerDistance() {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  function bindInteraction() {
    stage.addEventListener("pointerdown", (event) => {
      stage.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
      });
      if (pointers.size === 2) pinchDistance = pointerDistance();
    });

    stage.addEventListener("pointermove", (event) => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      const dx = event.clientX - pointer.lastX;
      const dy = event.clientY - pointer.lastY;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      if (pointers.size === 1) {
        yaw -= dx * 0.008;
        pitch = clamp(pitch + dy * 0.006, 0.16, 1.5);
      } else if (pointers.size === 2) {
        const nextPinch = pointerDistance();
        if (pinchDistance > 0 && nextPinch > 0) {
          distance = clamp(distance * (pinchDistance / nextPinch), 28, 460);
        }
        pinchDistance = nextPinch;
      }
      requestRender();
    });

    const releasePointer = (event) => {
      pointers.delete(event.pointerId);
      pinchDistance = pointers.size === 2 ? pointerDistance() : 0;
      pointers.forEach((pointer) => {
        pointer.lastX = pointer.x;
        pointer.lastY = pointer.y;
      });
    };
    stage.addEventListener("pointerup", releasePointer);
    stage.addEventListener("pointercancel", releasePointer);

    stage.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        distance = clamp(distance * Math.exp(event.deltaY * 0.0012), 28, 460);
        requestRender();
      },
      { passive: false },
    );

    stage.addEventListener("keydown", (event) => {
      const actions = {
        ArrowLeft: () => {
          yaw += 0.1;
        },
        ArrowRight: () => {
          yaw -= 0.1;
        },
        ArrowUp: () => {
          pitch = Math.min(1.5, pitch + 0.08);
        },
        ArrowDown: () => {
          pitch = Math.max(0.16, pitch - 0.08);
        },
        "+": () => {
          distance = Math.max(28, distance * 0.9);
        },
        "=": () => {
          distance = Math.max(28, distance * 0.9);
        },
        "-": () => {
          distance = Math.min(115, distance * 1.1);
        },
        Home: () => applyPreset("perspective"),
      };
      if (!actions[event.key]) return;
      event.preventDefault();
      actions[event.key]();
      requestRender();
    });

    document.querySelectorAll("[data-terrain-view]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.terrainView));
    });
    document.querySelector("#terrain-3d-contours")?.addEventListener("change", (event) => {
      if (contourGroup) contourGroup.visible = event.currentTarget.checked;
      requestRender();
    });
    document.querySelector("#terrain-3d-points")?.addEventListener("change", (event) => {
      if (pointGroup) pointGroup.visible = event.currentTarget.checked;
      requestRender();
    });
    document.querySelector("#terrain-3d-trace")?.addEventListener("change", (event) => {
      api.setShadowTraceVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-concepts")?.addEventListener("change", (event) => {
      api.setConceptsVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-horizon")?.addEventListener("change", (event) => {
      api.setHorizonVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-hillside")?.addEventListener("change", (event) => {
      api.setHillsideVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-trees")?.addEventListener("change", (event) => {
      api.setPlantingVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-roads")?.addEventListener("change", (event) => {
      api.setRoadsVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-wind")?.addEventListener("change", (event) => {
      api.setWindVisible(event.currentTarget.checked);
    });
    document.querySelector("#terrain-3d-scale")?.addEventListener("change", (event) => {
      api.setVerticalScale(Number(event.currentTarget.value) || 1);
    });
    document.querySelector("#terrain-3d-reset")?.addEventListener("click", () => {
      const scaleSelect = document.querySelector("#terrain-3d-scale");
      if (scaleSelect) scaleSelect.value = "1";
      const contourToggle = document.querySelector("#terrain-3d-contours");
      const pointToggle = document.querySelector("#terrain-3d-points");
      if (contourToggle) contourToggle.checked = true;
      if (pointToggle) pointToggle.checked = true;
      if (contourGroup) contourGroup.visible = true;
      if (pointGroup) pointGroup.visible = true;
      const traceToggle = document.querySelector("#terrain-3d-trace");
      if (traceToggle) traceToggle.checked = false;
      traceHidden = true;
      const conceptToggle = document.querySelector("#terrain-3d-concepts");
      if (conceptToggle) conceptToggle.checked = false;
      conceptsHidden = true;
      const horizonToggle = document.querySelector("#terrain-3d-horizon");
      if (horizonToggle) horizonToggle.checked = false;
      horizonHidden = true;
      const hillToggle = document.querySelector("#terrain-3d-hillside");
      if (hillToggle) hillToggle.checked = true;
      hillHidden = false;
      const treeToggle = document.querySelector("#terrain-3d-trees");
      if (treeToggle) treeToggle.checked = true;
      plantingHidden = false;
      const roadToggle = document.querySelector("#terrain-3d-roads");
      if (roadToggle) roadToggle.checked = true;
      roadsHidden = false;
      const windToggle = document.querySelector("#terrain-3d-wind");
      if (windToggle) windToggle.checked = false;
      windHidden = true;
      api.setVerticalScale(1);
      applyPreset("perspective");
    });
  }

  api.init = ({ data, language = "en", theme = "light" }) => {
    if (api.initialized) return;
    api.initialized = true;
    api.language = language;
    api.theme = theme;
    siteData = data;
    stage = document.querySelector("#terrain-3d-stage");
    fallback = document.querySelector("#terrain-3d-fallback");
    if (!stage || !window.THREE || !supportsWebGL2()) {
      showFallback();
      return;
    }

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(theme === "dark" ? 0x0e1511 : 0x111a16, 1);
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        api.initialized = false;
        showFallback();
      });
      stage.insertBefore(renderer.domElement, stage.firstChild);
      configureScene(data);
      bindInteraction();
      api.setLanguage(language);
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(stage);
      // Rendering is on-demand, and a browser suspends requestAnimationFrame in
      // a hidden tab. A resize while hidden clears the framebuffer with no frame
      // to repaint it, so the stage comes back blank. Redraw on return.
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) requestRender();
      });
      applyPreset("perspective");
      resize();
    } catch {
      showFallback();
    }
  };

  /** Season object from data.solar.seasons — rebuilds the day arc. */
  api.setSeason = (season) => {
    currentSeason = season;
    if (!scene) return;
    buildSunPath(season);
    // The prevailing wind turns with the season, so the arrow follows the date.
    buildWind();
    buildShadowTrace();
    if (currentSun) applySun(currentSun);
    requestRender();
  };

  /** { altitude_deg, azimuth_deg, above_horizon? } */
  api.setSun = (position) => {
    if (!position) return;
    currentSun = position;
    if (!scene) return;
    applySun(position);
    updateShadowRuler();
    requestRender();
  };

  api.setTestObject = (id) => {
    currentObjectId = id;
    if (!scene) return;
    buildTestObject();
    buildShadowTrace();
    if (currentSun) updateShadowRuler();
    requestRender();
  };

  api.setVerticalScale = (scale) => {
    verticalScale = Number(scale) || 1;
    updateWithheldNote();
    rebuildTerrain();
  };

  /** The whole-day shadow track of the test object on the TIN. Off by default. */
  api.setShadowTraceVisible = (visible) => {
    traceHidden = !visible;
    if (!scene) return;
    buildShadowTrace();
    requestRender();
  };

  /** DEM-derived terrain horizon silhouette. Off by default. */
  api.setHorizonVisible = (visible) => {
    horizonHidden = !visible;
    if (!scene) return;
    forgetLabels("horizon");
    buildHorizonRing();
    requestRender();
  };

  /** Illustrative planting, the only shadow-casting thing this scene invents. */
  api.setPlantingVisible = (visible) => {
    plantingHidden = !visible;
    if (!scene) return;
    buildPlanting();
    buildWind();
    updateShadowExtent();
    requestRender();
  };

  /** The bounding roads, drawn on the hillside when that layer is on. */
  api.setRoadsVisible = (visible) => {
    roadsHidden = !visible;
    if (!scene) return;
    buildRoads();
    requestRender();
  };

  /**
   * Prevailing-wind arrow, plus an illustrative sway on the tree crowns. Off by
   * default, and the only thing in this scene that animates.
   */
  api.setWindVisible = (visible) => {
    windHidden = !visible;
    if (!scene) return;
    buildWind();
    requestRender();
  };

  /**
   * The hillside the parcel sits on, sampled from the DEM. On by default.
   *
   * Switching it back on from a close orbit pulls the camera out to the hillside
   * preset: the surface reaches 50 m past the parcel, so from in
   * close it would fill the frame with slope and read as a bug.
   */
  api.setHillsideVisible = (visible) => {
    hillHidden = !visible;
    if (!scene) return;
    buildLocalTerrain();
    // The roads are laid on that surface, so they follow it in and out.
    buildRoads();
    if (visible && distance < 300) applyPreset("hillside");
    requestRender();
  };

  /** Concept massing layer. Off by default; `option-a|b|c`. */
  api.setConceptsVisible = (visible) => {
    conceptsHidden = !visible;
    if (!scene) return;
    buildConceptMassing();
    // The massing changes what casts shadows, so the frustum has to refit.
    updateShadowExtent();
    requestRender();
  };

  api.setConceptOption = (id) => {
    if (!id) return;
    currentConceptId = id;
    if (!scene || conceptsHidden) return;
    buildConceptMassing();
    updateShadowExtent();
    requestRender();
  };

  api.setShadowRulerVisible = (visible) => {
    rulerHidden = !visible;
    if (shadowRuler) shadowRuler.userData.hidden = rulerHidden;
    updateShadowRuler();
    requestRender();
  };

  api.setLanguage = (language) => {
    api.language = language;
    if (!stage) return;
    stage.setAttribute(
      "aria-label",
      language === "fa"
        ? "مدل سه‌بعدی تعاملی زمین TIN از هشت تراز برداشت‌شده"
        : "Interactive three-dimensional TIN terrain model from eight surveyed elevations",
    );
    retextLabels();
    requestRender();
  };

  api.setTheme = (theme) => {
    api.theme = theme;
    if (!renderer || !scene) return;
    renderer.setClearColor(theme === "dark" ? 0x0e1511 : 0x111a16, 1);
    // The sky texture and the fog colour are one decision: the fog has to fade
    // into the sky's own horizon stop or the distance turns a different colour.
    applySky();
    requestRender();
  };

  api.resize = resize;

  // Exposed for scripts/verify-solar-3d.mjs, which evaluates this file in Node
  // against a stubbed THREE and asserts the geometry of every precomputed
  // solar position. Not used by the page.
  api.__sunDirection = sunDirection;
  api.__shadowLength = shadowLength;
  // Lets a browser QA pass assert that every label tracks the language after a
  // terrain rebuild, which is not observable from the DOM.
  api.__labels = labels;

  window.HOUSEAI_TERRAIN_3D = api;
})();
