(() => {
  "use strict";

  const data = window.HOUSEAI_DATA;
  if (!data) {
    document.body.insertAdjacentText("afterbegin", "Dashboard data could not be loaded.");
    return;
  }

  const state = {
    lang: readPreference("houseai-language", "en"),
    theme: readPreference(
      "houseai-theme",
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    ),
    pointSort: { key: "id", direction: 1 },
    pointQuery: "",
    documentQuery: "",
    documentLanguage: "all",
    documentType: "all",
    profile: "longitudinal",
    profileHover: null,
    contours: true,
    labels: true,
    hazardFilter: "all",
    climateView: "temperature",
    climateHover: null,
    solarSeason: "winter",
    // Decimal local clock hour. Continuous, not a sample index: the slider and
    // the playback loop both need positions between the precomputed samples.
    solarHour: 12,
    solarPlaying: false,
    solarObject: "pole",
    solarBoundary: true,
    solarContours: true,
    windSeason: "annual",
    conceptOption: "option-c",
    investigationGate: "all",
    speciesFilter: "all",
    // Metres across the geo context map (250 m … 20 km).
    geoScaleM: 5000,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const t = (key) => data.translations[state.lang][key] ?? data.translations.en[key] ?? key;
  const local = (value) => {
    if (value == null) return "";
    return typeof value === "object" && ("en" in value || "fa" in value)
      ? value[state.lang] ?? value.en ?? ""
      : String(value);
  };
  // `fa-IR` renders Persian digits with the Arabic decimal separator, which is
  // what every authored Persian string in this project already uses — the
  // hero's ۴۸۷٫۴۲۸۵۶۸ is byte-identical to this formatter's output. A latn
  // numbering-system override used to force Latin digits here, so a Persian
  // sentence sat beside a Latin stat tile quoting the same number.
  const format = (value, digits = 3) =>
    new Intl.NumberFormat(state.lang === "fa" ? "fa-IR" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    }).format(value);

  // Clock times and other pre-formatted strings never pass through the number
  // formatter, so their digits need transliterating on their own. Separators
  // (the colon in 07:28, the en dash in a year range) are script-neutral.
  const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const localizeDigits = (text) => (state.lang === "fa"
    ? String(text ?? "").replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)])
    : String(text ?? ""));

  // Canvas text does not inherit CSS, so every context.font had to name a family
  // — and they all named a generic stack rather than the bundled Vazirmatn,
  // which drew Persian labels in whatever fallback the OS offered. Read once per
  // repaint rather than per label: this ran inside per-point loops.
  let canvasFontFamily = "ui-sans-serif";
  function refreshCanvasFont() {
    canvasFontFamily = getComputedStyle(document.body).fontFamily || "ui-sans-serif";
  }
  const canvasFont = (weight, sizePx) => `${weight} ${sizePx}px ${canvasFontFamily}`;

  /** 16-sector direction name from the generator's single vocabulary. */
  const compass = (code) => local(data.wind?.direction_vocabulary?.[code]) || code;

  const I18N_ATTRS = [
    ["[data-i18n-aria-label]", "i18nAriaLabel", "aria-label"],
    ["[data-i18n-title]", "i18nTitle", "title"],
    ["[data-i18n-alt]", "i18nAlt", "alt"],
  ];

  function readPreference(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function storePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // file:// privacy modes may disable storage; the interface still works.
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /** Exclusive segmented controls: visual .active plus programmatic aria-pressed. */
  function setExclusivePressed(buttons, isActive) {
    buttons.forEach((button) => {
      const active = typeof isActive === "function" ? isActive(button) : button === isActive;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  /** Isolate mixed LTR values (numbers, units, codes) inside RTL prose. */
  function bdi(value) {
    return `<bdi>${escapeHtml(value)}</bdi>`;
  }

  function statusLabel(status) {
    const labels = {
      verified: { en: "Verified", fa: "تأییدشده" },
      "verified-derived": { en: "Verified derivative", fa: "مشتق تأییدشده" },
      "verified-integrity": { en: "Integrity verified", fa: "صحت تأییدشده" },
      passed: { en: "Passed", fa: "موفق" },
      unavailable: { en: "Unavailable", fa: "ناموجود" },
      unresolved: { en: "Unresolved", fa: "حل‌نشده" },
      partial: { en: "Partial", fa: "جزئی" },
      complete: { en: "Complete", fa: "کامل" },
      "from-brief": { en: "From design brief", fa: "از شرح طراحی" },
      "household-stated": { en: "Household stated", fa: "به گفتهٔ خانوار" },
      "climate-briefing": { en: "Climate briefing", fa: "توجیه اقلیمی" },
      "client-reported": { en: "Client-reported", fa: "به گفتهٔ کارفرما" },
      "regional-data": { en: "Regional data", fa: "داده منطقه‌ای" },
      "preliminary-inference": { en: "Preliminary inference", fa: "استنباط اولیه" },
      "preliminary-engineering-inference": { en: "Preliminary engineering", fa: "مهندسی اولیه" },
      "requires-field-investigation": { en: "Field investigation", fa: "بررسی میدانی" },
    };
    return local(labels[status] || { en: status.replaceAll("-", " "), fa: status.replaceAll("-", " ") });
  }

  function statusClass(status) {
    if (["verified", "verified-derived", "verified-integrity", "passed"].includes(status)) return "verified";
    if (["preliminary-inference", "preliminary-engineering-inference", "regional-data", "from-brief", "household-stated", "climate-briefing", "partial", "complete", "client-reported"].includes(status)) return "preliminary";
    return "unresolved";
  }

  function applyLanguage() {
    const html = document.documentElement;
    html.lang = state.lang;
    html.dir = state.lang === "fa" ? "rtl" : "ltr";
    document.title =
      state.lang === "fa"
        ? "خانه خانوادگی ۰۰۱ — شناخت سایت"
        : "Family House 001 — Site Intelligence";

    $$("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    $$("[data-i18n-html]").forEach((element) => {
      element.innerHTML = t(element.dataset.i18nHtml);
    });
    $$("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    // Accessible names used to stay English in both languages, so a Persian
    // screen-reader user got an entirely English interface over Persian content.
    // #terrain-3d-stage is deliberately absent: terrain-3d.js owns that label,
    // and #theme-toggle belongs to applyTheme, whose text depends on the theme
    // rather than the language. Two writers on one attribute is a race.
    I18N_ATTRS.forEach(([selector, property, attribute]) => {
      $$(selector).forEach((element) => {
        element.setAttribute(attribute, t(element.dataset[property]));
      });
    });
    // The lightbox buttons already carried both languages; the <img> they wrap
    // did not, so the alt text never changed.
    $$("[data-lightbox] img").forEach((image) => {
      const button = image.closest("[data-lightbox]");
      const alt = state.lang === "fa" ? button.dataset.altFa : button.dataset.altEn;
      if (alt) image.alt = alt;
    });

    $("#project-status").textContent = local(data.project.status_label);
    $("#hero-location").textContent = local(data.project.probable_project_location);
    $("#survey-methodology").textContent = local(data.survey.methodology);
    renderLabelAssociation();
    renderBuildIdentity();
    renderPropertyVerification();
    renderArchitecturalReadiness();
    renderArchitectHandoff();
    renderPlantingPrerequisites();
    renderFieldEvidenceSlots();
    renderFutureAnalysis();
    renderClaimMatrix();
    renderRawFiles();
    renderPageToc();
    renderClientBrief();
    $("#geo-note").textContent = local(data.project.geolocation_note);
    $("#geo-next").textContent = local(data.geography.required_next);
    $("#climate-warning").textContent = local(data.climate.warning);
    $("#wind-warning").textContent = local(data.wind.warning);

    renderStaticMetrics();
    renderPolygons();
    renderPoints();
    renderTerrainData();
    renderProfileMetadata();
    // Writes localized number tooltips, so it has to re-run on a language
    // change rather than only from init().
    renderElevationStrip();
    renderEnvironmentalGates();
    renderHazards();
    renderRecommendations();
    renderDerivedStatistics();
    renderConcepts();
    renderSpecies();
    renderInvestigations();
    renderDocuments();
    renderSources();
    $("#profile-title").textContent = profileTitle();
    // Both track state rather than a fixed key, so neither can be a data-i18n
    // element without two writers fighting over one node.
    syncSolarPlayButtons();
    $("#theme-toggle").setAttribute(
      "aria-label",
      t(state.theme === "dark" ? "themeToLight" : "themeToDark"),
    );
    refreshCanvases();
    window.HOUSEAI_TERRAIN_3D?.setLanguage(state.lang);
    storePreference("houseai-language", state.lang);
  }

  function applyTheme() {
    // Theme only recolors; document height stays the same. Browser scroll
    // anchoring and smooth scrolling still jump the long page, so freeze both
    // and re-pin scrollY after canvases repaint.
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const root = document.documentElement;
    const priorAnchor = root.style.overflowAnchor;
    const priorBehavior = root.style.scrollBehavior;
    root.style.overflowAnchor = "none";
    root.style.scrollBehavior = "auto";
    root.dataset.theme = state.theme;
    // Owned here rather than by a data-i18n-aria-label hook because the wording
    // depends on the theme, not the language. applyLanguage re-runs it.
    $("#theme-toggle").setAttribute(
      "aria-label",
      t(state.theme === "dark" ? "themeToLight" : "themeToDark"),
    );
    storePreference("houseai-theme", state.theme);
    window.HOUSEAI_TERRAIN_3D?.setTheme(state.theme);
    const restoreScroll = () => {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    };
    restoreScroll();
    requestAnimationFrame(() => {
      refreshCanvases();
      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        root.style.overflowAnchor = priorAnchor;
        root.style.scrollBehavior = priorBehavior;
        restoreScroll();
      });
    });
  }

  /**
   * The hero tiles and both elevation legends used to hold their numbers as
   * literals in the markup, so they stayed in Latin digits while the Persian
   * prose beside them quoted the same value in Persian digits. Rendering them
   * from the bundle routes every one through the locale formatter.
   */
  function renderLabelAssociation() {
    const association = data.survey.label_association;
    if (!association) return;
    const maxEl = $("#label-association-max");
    const noteEl = $("#label-association-note");
    if (maxEl) maxEl.textContent = `${format(association.max_offset_m, 3)} m · ${association.max_offset_point_id || ""}`.trim();
    if (noteEl) noteEl.textContent = local(association.note);
  }

  function renderBuildIdentity() {
    const project = data.project;
    const meta = data.releaseMetadata || {};
    const buildId = project.build_id || meta.build_id || `dashboard-${project.generated_on || "unknown"}`;
    const generated = project.generated_on || meta.generated_on || "";
    const siteVersion = project.site_version || meta.site_version || "";
    const version = project.dashboard_version || meta.dashboard_version || "";
    const setText = (id, value) => {
      const el = $(id);
      if (el && value) el.textContent = value;
    };
    setText("#repro-build-id", buildId);
    setText("#repro-generated", generated);
    setText("#repro-site-version", siteVersion);
    const canonical = $("#canonical-build-note");
    if (canonical) canonical.textContent = local(project.canonical_build_note);
    const privacy = $("#privacy-boundary-text");
    if (privacy) privacy.textContent = local(project.privacy_boundary) || t("privacyBoundaryLead");
    const footerBuild = $("#footer-build");
    if (footerBuild) {
      footerBuild.innerHTML = `${escapeHtml(t("buildId"))}: <bdi>${escapeHtml(buildId)}</bdi> · ${escapeHtml(t("generated"))}: <bdi>${escapeHtml(generated)}</bdi> · ${escapeHtml(siteVersion)}${version ? ` · v${escapeHtml(version)}` : ""}`;
    }
  }

  function windSeasonTitleKey(season) {
    const keys = {
      annual: "windTitleAnnual",
      winter: "windTitleWinter",
      spring: "windTitleSpring",
      summer: "windTitleSummer",
      autumn: "windTitleAutumn",
    };
    return keys[season] || "windTitle";
  }

  function renderStaticMetrics() {
    const elevation = data.site.elevation;
    const metrics = {
      area: () => format(data.site.verified_area_m2, 6),
      relief: () => `${format(elevation.relief_m, 3)}`,
      elevationMin: () => `${format(elevation.min_m, 3)} m`,
      elevationMax: () => `${format(elevation.max_m, 3)} m`,
      elevationRange: () => `${format(elevation.min_m, 3)}–${format(elevation.max_m, 3)}`,
      roadLength: () => `${format(data.site.road.length_m, 6)} m`,
    };
    $$("[data-metric]").forEach((element) => {
      const render = metrics[element.dataset.metric];
      if (!render) return;
      // Wrap values so mixed LTR numbers/units stay isolated in RTL headings.
      if (element.tagName === "BDI" || element.closest("bdi")) {
        element.textContent = render();
      } else {
        element.innerHTML = bdi(render());
      }
    });
  }

  function renderPropertyVerification() {
    const verification = data.site.property_verification;
    $("#property-verification-scope").textContent = local(verification.scope);
    $("#property-verification-list").innerHTML = verification.items
      .map((item) => `
        <div>
          <dt>${escapeHtml(local(item.label))}</dt>
          <dd><span class="status-pill ${statusClass(item.status)}"><span class="status-dot"></span>${escapeHtml(statusLabel(item.status))}</span></dd>
        </div>
      `)
      .join("");
  }

  function renderArchitecturalReadiness() {
    const readiness = data.architecturalReadiness;
    if (!readiness) return;
    $("#readiness-summary").textContent = local(readiness.summary);
    $("#readiness-grid").innerHTML = readiness.states
      .map((item, index) => `
        <article class="readiness-card readiness-${escapeHtml(item.id)}">
          <span class="readiness-index">0${index + 1}</span>
          <div class="readiness-card-heading">
            <h4>${escapeHtml(local(item.label))}</h4>
            <span>${escapeHtml(local(item.purpose))}</span>
          </div>
          <ul>${item.evidence.map((entry) => `<li>${escapeHtml(local(entry))}</li>`).join("")}</ul>
        </article>`)
      .join("");
  }

  function renderArchitectHandoff() {
    const handoff = data.architectHandoff;
    const root = $("#handoff-grid");
    if (!handoff || !root) return;
    root.innerHTML = handoff.sections
      .map((section) => `
        <article class="handoff-card handoff-${escapeHtml(section.id)}">
          <h4>${escapeHtml(local(section.label))}</h4>
          <ul>${section.items.map((item) => `<li>${escapeHtml(local(item))}</li>`).join("")}</ul>
        </article>`)
      .join("");
  }

  function renderPageToc() {
    const list = $("#page-toc-list");
    if (!list) return;
    const sections = $$("main section.section[id], main section[id].section, main > section[id]");
    const items = sections
      .map((section) => {
        const title =
          section.querySelector(".section-header h2, header h2, h2")?.textContent?.trim()
          || section.id;
        return { id: section.id, title };
      })
      .filter((item) => item.id);
    list.innerHTML = items
      .map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a></li>`)
      .join("");
  }

  function renderPlantingPrerequisites() {
    const register = data.plantingPrerequisites;
    const root = $("#planting-prerequisites");
    if (!register || !root) return;
    const intro = $("#planting-prereq-intro");
    if (intro) intro.textContent = local(register.intro);
    root.innerHTML = register.items
      .map((item) => `
        <article class="evidence-slot unresolved">
          <h4>${escapeHtml(local(item.label))}</h4>
          <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(statusLabel(item.status))}</span>
          <p>${escapeHtml(local(item.note))}</p>
        </article>`)
      .join("");
  }

  function renderFieldEvidenceSlots() {
    const register = data.fieldEvidenceSlots;
    const root = $("#field-evidence-groups");
    if (!register || !root) return;
    root.innerHTML = register.groups
      .map((group) => `
        <article class="field-evidence-group">
          <h3>${escapeHtml(local(group.title))}</h3>
          <div class="evidence-slot-grid">
            ${group.slots.map((slot) => {
              const noteHtml = slot.note
                ? `<p class="evidence-slot-note">${escapeHtml(local(slot.note))}</p>`
                : "";
              return `
              <div class="evidence-slot unresolved">
                <h4>${escapeHtml(local(slot.label))}</h4>
                <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(t("unresolvedSlot"))}</span>
                ${noteHtml}
              </div>`;
            }).join("")}
          </div>
        </article>`)
      .join("");
  }

  function renderFutureAnalysis() {
    const register = data.futureAnalysis;
    const root = $("#future-analysis-grid");
    if (!register || !root) return;
    root.innerHTML = register.modules
      .map((module) => {
        const parameters = module.parameters
          ? `<div class="future-parameters">
              <h4>${escapeHtml(t("futureParameters"))}</h4>
              <div class="evidence-slot-grid">
                ${module.parameters.map((param) => `
                  <div class="evidence-slot unresolved">
                    <h4>${escapeHtml(local(param.label))}</h4>
                    <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(statusLabel(param.status))}</span>
                    <p><strong>—</strong></p>
                    <p>${escapeHtml(local(param.provenance))}</p>
                    <p>${escapeHtml(local(param.applicability))}</p>
                  </div>`).join("")}
              </div>
            </div>`
          : "";
        return `
        <article class="future-module" id="future-${escapeHtml(module.id)}">
          <header>
            <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(t("futureStatusBlocked"))}</span>
            <small class="future-backlog">${escapeHtml(module.backlog)}</small>
            <h3>${escapeHtml(local(module.title))}</h3>
            <p>${escapeHtml(local(module.summary))}</p>
          </header>
          <div class="future-columns">
            <div>
              <h4>${escapeHtml(t("futurePrerequisites"))}</h4>
              <ul>${module.prerequisites.map((item) => `<li>${escapeHtml(local(item))}</li>`).join("")}</ul>
            </div>
            <div>
              <h4>${escapeHtml(t("futureWithheld"))}</h4>
              <ul>${module.withheld.map((item) => `<li>${escapeHtml(local(item))}</li>`).join("")}</ul>
            </div>
            <div>
              <h4>${escapeHtml(t("futureWhenAvailable"))}</h4>
              <p>${escapeHtml(local(module.when_available))}</p>
            </div>
          </div>
          ${parameters}
          ${module.research_notes?.length
    ? `<div class="future-research">
              <h4>${escapeHtml(t("futureResearchNotes"))}</h4>
              <ul>${module.research_notes.map((note) => `<li>${escapeHtml(local(note))}</li>`).join("")}</ul>
            </div>`
    : ""}
        </article>`;
      })
      .join("");
  }

  function renderClaimMatrix() {
    const matrix = data.claimSourceMatrix;
    const body = $("#claim-matrix-body");
    if (!matrix || !body) return;
    body.innerHTML = matrix.rows
      .map((row) => `
        <tr>
          <th scope="row">${escapeHtml(local(row.claim))}</th>
          <td>${escapeHtml(local(row.source))}</td>
          <td>${escapeHtml(local(row.resolution))}</td>
          <td><bdi>${escapeHtml(local(row.period))}</bdi></td>
          <td class="numeric"><bdi>${escapeHtml(row.accessed)}</bdi></td>
          <td>${escapeHtml(local(row.calculation))}</td>
          <td>${escapeHtml(local(row.confidence))}</td>
          <td>${escapeHtml(local(row.design_use))}</td>
        </tr>`)
      .join("");
  }

  function renderRawFiles() {
    const register = data.rawEnvironmentalFiles;
    const root = $("#raw-files-list");
    if (!register || !root) return;
    const policy = $("#raw-files-policy");
    if (policy) policy.textContent = local(register.policy);
    root.innerHTML = register.files
      .map((file) => {
        const downloadable = file.role === "downloadable";
        const label = local(file.label);
        return `
          <div class="raw-file-row">
            <span class="status-pill ${downloadable ? "verified" : "preliminary"}"><span class="status-dot"></span>${escapeHtml(t(downloadable ? "rawFilesDownloadable" : "rawFilesInternal"))}</span>
            ${downloadable
    ? `<a href="${escapeHtml(file.path)}">${escapeHtml(label)}</a>`
    : `<span>${escapeHtml(label)}</span>`}
            <small><bdi>${escapeHtml(file.path)}</bdi></small>
          </div>`;
      })
      .join("");
  }

  function renderClientBrief() {
    const brief = data.clientBrief;
    if (!brief) return;
    $("#client-brief-note").textContent = local(brief.note);
    $("#client-brief-grid").innerHTML = brief.fields
      .map((item) => {
        const valueHtml = item.value
          ? `<p class="client-brief-value">${escapeHtml(local(item.value))}</p>`
          : "";
        const noteHtml = item.note
          ? `<p class="client-brief-field-note">${escapeHtml(local(item.note))}</p>`
          : "";
        return `
        <div>
          <dt>${escapeHtml(local(item.label))}</dt>
          <dd>
            <span class="status-pill ${statusClass(item.status)}"><span class="status-dot"></span>${escapeHtml(statusLabel(item.status))}</span>
            ${valueHtml}
            ${noteHtml}
          </dd>
        </div>`;
      })
      .join("");
  }

  function renderElevationStrip() {
    const strip = $("#elevation-strip");
    const sorted = [...data.survey.points].sort((a, b) => a.number - b.number);
    const min = data.terrain.min_elevation_m;
    const max = data.terrain.max_elevation_m;
    strip.replaceChildren(
      ...sorted.map((point) => {
        const bar = document.createElement("i");
        bar.style.height = `${20 + ((point.elevation_m - min) / (max - min)) * 80}%`;
        bar.title = `${point.id} · ${format(point.elevation_m, 3)} m`;
        return bar;
      }),
    );
  }

  function renderPolygons() {
    const root = $("#polygon-cards");
    root.innerHTML = data.survey.original_polygons
      .map(
        (polygon) => `
          <article class="polygon-card">
            <span class="polygon-letter">${escapeHtml(polygon.id)}</span>
            <h3>${escapeHtml(t("polygonLabel"))} <bdi>${escapeHtml(polygon.id)}</bdi></h3>
            <p><bdi>${escapeHtml(polygon.point_order.join(" → "))}</bdi></p>
            <dl>
              <div><dt>${escapeHtml(t("areaShort"))}</dt><dd><bdi>${format(polygon.area_m2, 6)} m²</bdi></dd></div>
              <div><dt>${escapeHtml(t("perimeter"))}</dt><dd><bdi>${format(polygon.perimeter_m, 3)} m</bdi></dd></div>
            </dl>
          </article>`,
      )
      .join("");
  }

  function roleLabel(role) {
    if (role === "interior-terrain") return t("roleInterior");
    return t("roleOuter");
  }

  function renderPoints() {
    const query = state.pointQuery.trim().toLowerCase();
    const points = data.survey.points
      .filter((point) => `${point.id} ${point.role} ${roleLabel(point.role)}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const left = a[state.pointSort.key];
        const right = b[state.pointSort.key];
        const result =
          typeof left === "number"
            ? left - right
            : String(left).localeCompare(String(right), undefined, { numeric: true });
        return result * state.pointSort.direction;
      });
    $("#points-table tbody").innerHTML = points
      .map(
        (point) => `
          <tr>
            <td><strong>${escapeHtml(point.id)}</strong></td>
            <td class="numeric"><bdi>${format(point.x_m, 3)}</bdi></td>
            <td class="numeric"><bdi>${format(point.y_m, 3)}</bdi></td>
            <td class="numeric"><bdi>${format(point.latitude, 8)}</bdi></td>
            <td class="numeric"><bdi>${format(point.longitude, 8)}</bdi></td>
            <td class="numeric"><bdi>${format(point.elevation_m, 3)}</bdi></td>
            <td><span class="role-badge">${escapeHtml(roleLabel(point.role))}</span></td>
            <td class="numeric"><bdi>${format(point.association_distance_m, 3)}</bdi></td>
          </tr>`,
      )
      .join("");
  }

  function renderTerrainData() {
    $("#slope-bars").innerHTML = data.terrain.triangles
      .map(
        (triangle) => `
          <div class="slope-row">
            <span>${escapeHtml(triangle.points.join("–"))}</span>
            <span class="slope-track"><i style="width:${Math.min(100, (triangle.slope_percent / 50) * 100)}%"></i></span>
            <strong><bdi>${format(triangle.slope_percent, 2)}%</bdi></strong>
          </div>`,
      )
      .join("");

    $("#terrain-risks").innerHTML = data.terrain.risks
      .map(
        (risk) => `
          <div class="risk-item">
            <span class="risk-level">${escapeHtml(t(risk.level === "high" ? "riskHigh" : "riskMedium"))}</span>
            <strong>${escapeHtml(local(risk.title))}</strong>
            <p>${escapeHtml(local(risk.detail))}</p>
          </div>`,
      )
      .join("");

    $("#terrain-limits").innerHTML = data.terrain.limitations
      .map((item) => `<li>${escapeHtml(local(item))}</li>`)
      .join("");
  }

  function renderEnvironmentalGates() {
    $("#geo-location").textContent = local(data.geography.probable_project_location);
    $("#geo-place").textContent = local(data.geography.probable_project_location);
    $("#geo-coordinates").innerHTML =
      `<bdi>${format(data.geography.center.latitude, 8)}° N · ${format(data.geography.center.longitude, 8)}° E</bdi>`;
    $("#geo-scales").innerHTML = data.geography.scales
      .map(
        (item) => `
          <div class="scale-row detailed">
            <strong><bdi>${escapeHtml(item.scale)}</bdi></strong>
            <div>
              <b>${escapeHtml(local(item.title))}</b>
              <p>${escapeHtml(local(item.features))}</p>
            </div>
            <span>${escapeHtml(statusLabel(item.status))}</span>
          </div>`,
      )
      .join("");
    $("#geo-exposures").innerHTML = data.geography.exposures
      .map((item) => `<li>${escapeHtml(local(item))}</li>`)
      .join("");

    $("#climate-fields").innerHTML = data.climate.fields
      .map(
        (item) => `
          <div class="climate-field">
            <span>${escapeHtml(local(item.label) || item.field)}</span>
            <span><bdi>${escapeHtml(item.value)}</bdi></span>
          </div>`,
      )
      .join("");

    renderClimateEvidence();
    renderSolarEvidence();
    renderWindEvidence();
  }

  function seasonLabel(season) {
    const labels = {
      annual: { en: "Annual", fa: "سالانه" },
      winter: { en: "Winter", fa: "زمستان" },
      spring: { en: "Spring", fa: "بهار" },
      summer: { en: "Summer", fa: "تابستان" },
      autumn: { en: "Autumn", fa: "پاییز" },
      equinox: { en: "Equinox", fa: "اعتدال" },
    };
    return local(labels[season] || { en: season, fa: season });
  }

  function renderClimateEvidence() {
    const annual = data.climate.annual;
    const summary = [
      [t("annualMeanTemperature"), annual.mean_temperature_c, "°C", 1],
      [t("annualPrecipitation"), annual.precipitation_mm, "mm", 0],
      [t("annualSnowfall"), annual.snowfall_cm, "cm", 0],
      [t("frostDays"), annual.frost_days, t("unitDays"), 0],
      [t("solarResource"), annual.solar_radiation_kwh_m2_day, "kWh/m²/day", 2],
      [t("annualHumidity"), annual.relative_humidity_percent, "%", 0],
    ];
    $("#climate-summary").innerHTML = summary
      .map(([label, value, unit, digits]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong><bdi>${format(value, digits)}</bdi> <small>${escapeHtml(unit)}</small></strong>
        </article>`)
      .join("");

    const extremes = data.climate.extremes_1991_2020;
    const extremeItems = [
      [t("extremeDailyHigh"), extremes.highest_daily_max_c, "°C", 1],
      [t("extremeDailyLow"), extremes.lowest_daily_min_c, "°C", 1],
      [t("extremeWettestDay"), extremes.highest_daily_precipitation_mm, "mm", 1],
      [t("extremePeakGust"), extremes.highest_daily_gust_kmh, "km/h", 0],
    ];
    $("#climate-extremes").innerHTML = extremeItems
      .map(([label, value, unit, digits]) => `
        <div><span>${escapeHtml(label)}</span><strong><bdi>${format(value, digits)}</bdi> ${escapeHtml(unit)}</strong></div>`)
      .join("");

    $("#future-climate").innerHTML = data.climate.future.models
      .map((model) => `
        <article>
          <strong>${escapeHtml(model.model)}</strong>
          <span><bdi>+${format(model.mean_temperature_change_c, 1)}°C</bdi></span>
          <span><bdi>${model.annual_precipitation_change_percent > 0 ? "+" : ""}${format(model.annual_precipitation_change_percent, 1)}%</bdi> ${escapeHtml(t("precipitation"))}</span>
        </article>`)
      .join("");

    $("#climate-table tbody").innerHTML = data.climate.monthly
      .map((month) => `
        <tr>
          <th scope="row">${escapeHtml(local(month.label))}</th>
          <td class="numeric"><bdi>${format(month.temperature_mean_c, 1)}°</bdi></td>
          <td class="numeric"><bdi>${format(month.temperature_max_c, 1)}°</bdi></td>
          <td class="numeric"><bdi>${format(month.temperature_min_c, 1)}°</bdi></td>
          <td class="numeric"><bdi>${format(month.precipitation_mm, 1)} mm</bdi></td>
          <td class="numeric"><bdi>${format(month.snowfall_cm, 1)} cm</bdi></td>
          <td class="numeric"><bdi>${format(month.relative_humidity_percent, 0)}%</bdi></td>
          <td class="numeric"><bdi>${format(month.solar_radiation_kwh_m2_day, 2)}</bdi></td>
          <td class="numeric"><bdi>${format(month.frost_days, 1)}</bdi></td>
        </tr>`)
      .join("");
    $("#climate-chart-title").textContent =
      state.climateView === "temperature" ? t("temperatureAndRain") : t("snowFrostSolar");
    renderClimateLegend();
  }

  function renderClimateLegend() {
    const entries = state.climateView === "temperature"
      ? [
          ["var(--clay)", t("precipitation")],
          ["var(--moss)", t("meanTemperature")],
          ["var(--ink)", t("meanMaxMin")],
        ]
      : [
          ["var(--blue)", t("snowfall")],
          ["var(--clay)", t("frostDays")],
          ["var(--gold)", t("solarResource")],
        ];
    $("#climate-legend").innerHTML = entries
      .map(([color, label]) => `<span><i style="background:${color}"></i>${escapeHtml(label)}</span>`)
      .join("");
  }

  function renderSolarEvidence() {
    $("#solar-winter-note").textContent = local(data.solar.design_summary.winter);
    $("#solar-summer-note").textContent = local(data.solar.design_summary.summer);
    $("#solar-warning").textContent = local(data.solar.warning);
    $("#solar-table tbody").innerHTML = data.solar.monthly
      .map((month) => `
        <tr>
          <th scope="row">${escapeHtml(local(month.label))}</th>
          <td class="numeric"><bdi>${escapeHtml(localizeDigits(month.sunrise))}</bdi></td>
          <td class="numeric"><bdi>${escapeHtml(localizeDigits(month.sunset))}</bdi></td>
          <td class="numeric"><bdi>${format(month.day_length_hours, 2)} h</bdi></td>
          <td class="numeric"><bdi>${format(month.noon_altitude_deg, 1)}°</bdi></td>
          <td class="numeric"><bdi>${format(month.sunrise_azimuth_deg, 1)}°</bdi></td>
          <td class="numeric"><bdi>${format(month.sunset_azimuth_deg, 1)}°</bdi></td>
          <td class="numeric"><bdi>${format(month.radiation_kwh_m2_day, 2)}</bdi></td>
        </tr>`)
      .join("");
    updateSolarReadout();
  }

  function currentSolarSeason() {
    return data.solar.seasons.find((season) => season.id === state.solarSeason)
      || data.solar.seasons[0];
  }

  function solarSamples() {
    return currentSolarSeason().positions || [];
  }

  /**
   * The slider is continuous; the evidence is a 10-minute table. Blending two
   * neighbouring samples keeps one provenance story — every value on screen is
   * either a precomputed NOAA sample or a linear blend of two, bounded by
   * `solar.controls.interpolation` and re-derived by verify-solar-3d.mjs.
   * Porting the astronomy into the runtime would duplicate the maths and
   * contradict the page's own "precomputed" claim.
   */
  function solarPositionAtHour(hour) {
    const samples = solarSamples();
    if (!samples.length) return null;
    const last = samples[samples.length - 1];
    if (hour <= samples[0].clock_hour) return { ...samples[0], interpolated: false };
    if (hour >= last.clock_hour) return { ...last, interpolated: false };
    let index = 0;
    while (index < samples.length - 2 && samples[index + 1].clock_hour <= hour) index += 1;
    const from = samples[index];
    const to = samples[index + 1];
    const span = to.clock_hour - from.clock_hour;
    const fraction = span > 0 ? (hour - from.clock_hour) / span : 0;
    // Short way round, so an arc that crosses due north cannot interpolate
    // backwards through 360°.
    let sweep = to.azimuth_deg - from.azimuth_deg;
    if (sweep > 180) sweep -= 360;
    if (sweep < -180) sweep += 360;
    return {
      clock_hour: hour,
      altitude_deg: from.altitude_deg + fraction * (to.altitude_deg - from.altitude_deg),
      azimuth_deg: (from.azimuth_deg + fraction * sweep + 360) % 360,
      interpolated: fraction > 0,
    };
  }

  function currentSolarPosition() {
    return solarPositionAtHour(state.solarHour);
  }

  function currentSolarObject() {
    return data.solar.controls.test_objects.find((item) => item.id === state.solarObject)
      || data.solar.controls.test_objects[0];
  }

  /**
   * Analytic shadow length on level ground, or null when the sun is too low to
   * state one. Single implementation: the readout and the plan view used to
   * disagree, so at the equinox's last sample the plan printed "572.42 m"
   * beside a readout showing "—", and at altitude 0 it was Infinity.
   */
  function shadowLengthFor(heightM, altitudeDeg) {
    if (!(altitudeDeg > 0.5)) return null;
    return heightM / Math.tan(altitudeDeg * Math.PI / 180);
  }

  /** Single entry point: 2D readout, 2D canvas and the 3D sun stay in step. */
  function updateSolar() {
    updateSolarReadout();
    drawSolar();
    window.HOUSEAI_TERRAIN_3D?.setSun(currentSolarPosition());
  }

  function updateSolarReadout() {
    const season = currentSolarSeason();
    const position = currentSolarPosition();
    if (!position) return;
    const object = currentSolarObject();
    const shadowLength = shadowLengthFor(object.height_m, position.altitude_deg);
    const clockLabel = localizeDigits(decimalHour(position.clock_hour));
    $$("[data-solar-time-label]").forEach((element) => {
      element.textContent = clockLabel;
    });
    $$("[data-solar-time]").forEach((slider) => {
      slider.setAttribute("aria-valuetext", clockLabel);
    });
    // An interpolated pair is not one the astronomy produced, so the deviation
    // is stated rather than implied. The bound comes from the data.
    const note = $("#solar-interpolation-note");
    const bounds = data.solar.controls.interpolation;
    if (note) {
      note.hidden = !(position.interpolated && bounds);
      if (!note.hidden) {
        note.textContent = `${t("solarInterpolated")} ≤${format(bounds.max_altitude_deviation_deg, 2)}° / ≤${format(bounds.max_azimuth_deviation_deg, 2)}°`;
      }
    }
    // Effective, not astronomical. The sun clears the terrain later than it
    // rises and meets it again before it sets, and those are different figures.
    const access = $("#solar-access");
    if (access && season.effective_first_sun != null) {
      access.innerHTML = `
        <div><span>${escapeHtml(t("firstSun"))}</span><strong><bdi>${escapeHtml(localizeDigits(decimalHour(season.effective_first_sun)))}</bdi></strong></div>
        <div><span>${escapeHtml(t("lastSun"))}</span><strong><bdi>${escapeHtml(localizeDigits(decimalHour(season.effective_last_sun)))}</bdi></strong></div>
        <div><span>${escapeHtml(t("solarAccess"))}</span><strong><bdi>${format(season.solar_access_hours, 2)} h</bdi></strong></div>
        <div><span>${escapeHtml(t("terrainShaded"))}</span><strong><bdi>${format(season.terrain_shaded_hours, 2)} h</bdi></strong></div>`;
      $("#solar-horizon-note").textContent = local(data.horizon.resolution.note);
    }
    $("#solar-readout").innerHTML = `
      <div><span>${escapeHtml(t("solarAltitude"))}</span><strong><bdi>${format(position.altitude_deg, 1)}°</bdi></strong></div>
      <div><span>${escapeHtml(t("solarAzimuth"))}</span><strong><bdi>${format(position.azimuth_deg, 1)}°</bdi></strong></div>
      <div><span>${escapeHtml(t("shadowLength"))}</span><strong><bdi>${shadowLength == null ? "—" : `${format(shadowLength, 2)} m`}</bdi></strong></div>
      <div><span>${escapeHtml(t("sunriseSunset"))}</span><strong><bdi>${escapeHtml(localizeDigits(season.sunrise))} / ${escapeHtml(localizeDigits(season.sunset))}</bdi></strong></div>`;
  }

  function decimalHour(value) {
    let hours = Math.floor(value);
    let minutes = Math.round((value - hours) * 60);
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function clockToDecimal(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours + minutes / 60;
  }

  /** Range bounds follow the season, whose daylight window is 9.6–14.3 hours. */
  function solarTimeValueText() {
    return localizeDigits(decimalHour(state.solarHour));
  }

  function configureSolarSlider() {
    const samples = solarSamples();
    if (!samples.length) return;
    const first = samples[0].clock_hour;
    const last = samples[samples.length - 1].clock_hour;
    state.solarHour = Math.min(last, Math.max(first, state.solarHour));
    const valueText = solarTimeValueText();
    $$("[data-solar-time]").forEach((slider) => {
      slider.min = String(first);
      slider.max = String(last);
      slider.step = "any";
      slider.value = String(state.solarHour);
      slider.setAttribute("aria-valuetext", valueText);
    });
  }

  function syncSolarSlider() {
    const valueText = solarTimeValueText();
    $$("[data-solar-time]").forEach((slider) => {
      slider.value = String(state.solarHour);
      slider.setAttribute("aria-valuetext", valueText);
    });
  }

  function syncSolarSeasonButtons() {
    setExclusivePressed(
      $$("[data-solar-season]"),
      (button) => button.dataset.solarSeason === state.solarSeason,
    );
  }

  function resetSolarToNoon() {
    state.solarHour = clockToDecimal(currentSolarSeason().solar_noon);
    configureSolarSlider();
    updateSolarReadout();
  }

  // A whole daylight period in this many seconds of wall clock.
  const SOLAR_PLAY_SECONDS = 20;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const playback = { frame: 0, last: 0 };

  function syncSolarPlayButtons() {
    $$("[data-solar-play]").forEach((button) => {
      button.textContent = t(state.solarPlaying ? "pause" : "play");
      button.setAttribute("aria-pressed", String(state.solarPlaying));
    });
  }

  function stopSolarPlayback() {
    if (!state.solarPlaying) return;
    state.solarPlaying = false;
    cancelAnimationFrame(playback.frame);
    playback.frame = 0;
    syncSolarPlayButtons();
  }

  function stepSolarPlayback(timestamp) {
    if (!state.solarPlaying) return;
    const samples = solarSamples();
    if (samples.length < 2) return stopSolarPlayback();
    const first = samples[0].clock_hour;
    const last = samples[samples.length - 1].clock_hour;
    const elapsed = playback.last ? Math.min(0.25, (timestamp - playback.last) / 1000) : 0;
    playback.last = timestamp;
    const next = state.solarHour + elapsed * (last - first) / SOLAR_PLAY_SECONDS;
    state.solarHour = next >= last ? first : next;
    syncSolarSlider();
    updateSolar();
    playback.frame = requestAnimationFrame(stepSolarPlayback);
  }

  /**
   * The loop exists only while playing, so a parked page costs nothing. It never
   * auto-starts, stops on tab-hide, on the section scrolling away and on Escape,
   * and is unavailable under `prefers-reduced-motion: reduce`.
   */
  function startSolarPlayback() {
    if (state.solarPlaying || reducedMotion?.matches) return;
    state.solarPlaying = true;
    playback.last = 0;
    syncSolarPlayButtons();
    playback.frame = requestAnimationFrame(stepSolarPlayback);
  }

  function renderArchitectClimate() {
    const root = $("#architect-climate-body");
    if (!root || !data.climate) return;
    const climate = data.climate;
    const derived = climate.derived;
    const byId = new Map(derived?.degree_days?.totals?.map((total) => [total.id, total]) || []);
    const seasons = climate.seasons || {};
    const listMonths = (months = []) => months
      .map((month) => local(climate.monthly?.[month - 1]?.label) || String(month))
      .join(" · ");
    const hdd18 = byId.get("hdd18")?.annual_k_day;
    const cdd18 = byId.get("cdd18")?.annual_k_day;
    const cdd10 = byId.get("cdd10")?.annual_k_day;
    const overheating = t("overheatingRiskText").replace("{cdd18}", format(cdd18 ?? 0, 0));
    const limits = local(climate.limitations);
    root.innerHTML = `
      <div class="architect-climate-metrics">
        ${metricRow(t("hdd18Label"), format(hdd18 ?? 0, 0), "K·day")}
        ${metricRow(t("cdd18Label"), format(cdd18 ?? 0, 0), "K·day")}
        ${metricRow(t("cdd10Label"), format(cdd10 ?? 0, 0), "K·day")}
      </div>
      <div class="architect-climate-grid">
        <article>
          <h4>${escapeHtml(t("heatingSeason"))}</h4>
          <p><bdi>${escapeHtml(listMonths(seasons.heating_months))}</bdi></p>
          <p>${escapeHtml(local(seasons.summary))}</p>
        </article>
        <article>
          <h4>${escapeHtml(t("coolingSeason"))}</h4>
          <p><bdi>${escapeHtml(listMonths(seasons.cooling_months))}</bdi></p>
          <p>${escapeHtml(local(climate.classification?.label))}</p>
        </article>
        <article>
          <h4>${escapeHtml(t("passiveOpportunities"))}</h4>
          <p>${escapeHtml(t("passiveOpportunitiesText"))}</p>
        </article>
        <article>
          <h4>${escapeHtml(t("overheatingRisk"))}</h4>
          <p>${escapeHtml(overheating)}</p>
        </article>
        <article class="architect-climate-limits">
          <h4>${escapeHtml(t("gridLimitations"))}</h4>
          <p>${escapeHtml(limits)}</p>
          <p>${escapeHtml(local(climate.classification?.method_note))}</p>
        </article>
      </div>`;
  }

  function renderWindEvidence() {
    $("#wind-season-tabs").innerHTML = data.wind.seasons
      .map((season) => {
        const active = season.season === state.windSeason;
        return `
        <button class="${active ? "active" : ""}" type="button" data-wind-season="${escapeHtml(season.season)}" aria-pressed="${active}">${escapeHtml(seasonLabel(season.season))}</button>`;
      })
      .join("");
    $$("[data-wind-season]").forEach((button) => {
      button.addEventListener("click", () => {
        state.windSeason = button.dataset.windSeason;
        renderWindEvidence();
        drawWind();
      });
    });
    const season = data.wind.seasons.find((item) => item.season === state.windSeason)
      || data.wind.seasons[0];
    const windTitle = $("#wind-title");
    if (windTitle) windTitle.textContent = t(windSeasonTitleKey(season.season));
    $("#wind-stats").innerHTML = `
      <div><span>${escapeHtml(t("prevailing"))}</span><strong><bdi>${escapeHtml(compass(season.prevailing_direction))}</bdi></strong></div>
      <div><span>${escapeHtml(t("meanSpeed"))}</span><strong><bdi>${format(season.mean_speed_ms, 1)} m/s</bdi></strong></div>
      <div><span><bdi>P90</bdi></span><strong><bdi>${format(season.p90_speed_ms, 1)} m/s</bdi></strong></div>
      <div><span>${escapeHtml(t("calmHours"))}</span><strong><bdi>${format(season.calm_percent, 1)}%</bdi></strong></div>`;
    $("#wind-speed-bins").innerHTML = season.speed_distribution
      .map((bin) => `
        <div>
          <span><bdi>${escapeHtml(bin.label_ms)} m/s</bdi></span>
          <i><b style="width:${Math.min(100, bin.percent * 2.4)}%"></b></i>
          <strong><bdi>${format(bin.percent, 1)}%</bdi></strong>
        </div>`)
      .join("");
    $("#wind-notes").innerHTML = data.wind.exposure_notes
      .map((note) => `<p>${escapeHtml(local(note))}</p>`)
      .join("");
  }

  function renderHazards() {
    const seismic = data.hazards.seismic_gate;
    if (seismic) {
      const regional = seismic.regional_context;
      $("#seismic-gate").innerHTML = `
        <div class="seismic-gate-copy">
          <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(statusLabel("unavailable"))}</span>
          <h3>${escapeHtml(local(seismic.title))}</h3>
          <p>${escapeHtml(local(seismic.finding))}</p>
          <ul>${seismic.missing_inputs.map((item) => `<li>${escapeHtml(local(item))}</li>`).join("")}</ul>
        </div>
        <details>
          <summary>${escapeHtml(local(regional.title))}</summary>
          <p>${escapeHtml(local(regional.finding))}</p>
          <dl>
            <div><dt>≤ 50 km</dt><dd><bdi>${format(regional.counts.within_50_km, 0)}</bdi></dd></div>
            <div><dt>≤ 100 km</dt><dd><bdi>${format(regional.counts.within_100_km, 0)}</bdi></dd></div>
            <div><dt>≤ 200 km</dt><dd><bdi>${format(regional.counts.within_200_km, 0)}</bdi></dd></div>
            <div><dt>M max</dt><dd><bdi>${format(regional.strongest.magnitude, 1)} · ${format(regional.strongest.distance_km, 1)} km</bdi></dd></div>
          </dl>
        </details>`;
    }
    $("#hazard-grid").innerHTML = data.hazards.categories
      .map(
        (item, index) => `
          <article class="hazard-card${state.hazardFilter !== "all" && item.status !== state.hazardFilter ? " hidden" : ""}" data-status="${escapeHtml(item.status)}">
            <span class="story-index">${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(local(item.title))}</h3>
            <p>${escapeHtml(local(item.finding))}</p>
            <span class="status-pill ${statusClass(item.status)}"><span class="status-dot"></span>${escapeHtml(local(data.hazards.status_legend[item.status] || statusLabel(item.status)))}</span>
          </article>`,
      )
      .join("");
  }

  function renderRecommendations() {
    $("#confidence-legend").innerHTML = Object.entries(data.recommendations.confidence_legend)
      .map(
        ([key, label]) => `<span class="${escapeHtml(key)}"><i></i>${escapeHtml(local(label))}</span>`,
      )
      .join("");

    $("#recommendation-grid").innerHTML = data.recommendations.items
      .map(
        (item, index) => `
          <article class="recommendation-card" data-confidence="${escapeHtml(item.confidence)}">
            <span>${String(index + 1).padStart(2, "0")} / ${String(data.recommendations.items.length).padStart(2, "0")}</span>
            <h3>${escapeHtml(local(item.category))}</h3>
            <p>${escapeHtml(local(item.detail))}</p>
            <small>${escapeHtml(local(data.recommendations.confidence_legend[item.confidence]))}</small>
          </article>`,
      )
      .join("");
  }

  function languageLabel(language) {
    const labels = {
      en: t("english"),
      fa: t("persian"),
      neutral: t("neutral"),
    };
    return labels[language] || language;
  }

  function renderDocuments() {
    const query = state.documentQuery.trim().toLowerCase();
    const items = data.documents.items.filter((item) => {
      const haystack = `${local(item.title)} ${local(item.description)} ${item.type} ${item.phase}`.toLowerCase();
      const languageMatches =
        state.documentLanguage === "all" || item.language === state.documentLanguage;
      const typeMatches = state.documentType === "all" || item.kind === state.documentType;
      return haystack.includes(query) && languageMatches && typeMatches;
    });

    $("#document-grid").innerHTML = items
      .map((item) => {
        const isImage = item.kind === "image";
        const primaryAction = isImage
          ? `<button type="button" data-doc-lightbox="${escapeHtml(item.href)}" data-doc-alt="${escapeHtml(local(item.title))}">${escapeHtml(t("open"))} ↗</button>`
          : `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">${escapeHtml(t("open"))} ↗</a>`;
        return `
          <article class="document-card">
            <div class="doc-top">
              <span class="file-chip">${escapeHtml(item.type)}</span>
              <span class="status-pill ${statusClass(item.status)}"><span class="status-dot"></span>${escapeHtml(statusLabel(item.status))}</span>
            </div>
            <h3>${escapeHtml(local(item.title))}</h3>
            <p>${escapeHtml(local(item.description))}</p>
            <div class="doc-meta">
              <span>${escapeHtml(languageLabel(item.language))} · ${escapeHtml(item.phase)}</span>
              <span>${primaryAction} &nbsp; <a href="${escapeHtml(item.href)}" download>${escapeHtml(t("download"))} ↓</a></span>
            </div>
          </article>`;
      })
      .join("");

    $$("[data-doc-lightbox]").forEach((button) => {
      button.addEventListener("click", () => {
        openLightbox(button.dataset.docLightbox, button.dataset.docAlt);
      });
    });
  }

  function currentConcept() {
    const options = data.concepts?.options || [];
    return options.find((option) => option.id === state.conceptOption) || options[0];
  }

  /**
   * A design study, not evidence. The banner and caveat are rendered from the
   * data rather than written into the markup so they cannot drift away from what
   * `concepts.json` actually claims — including that nothing is selected.
   */
  function renderConcepts() {
    const concepts = data.concepts;
    if (!concepts) return;
    const option = currentConcept();
    if (!option) return;

    $("#concepts-banner").textContent = local(concepts.selection.note);
    $("#concepts-caveat").textContent = local(concepts.caveat);
    const overview = $("#concepts-overview");
    if (overview) {
      overview.textContent = concepts.overview ? local(concepts.overview) : "";
    }
    const comparisonNote = $("#concepts-comparison-note");
    if (comparisonNote) {
      if (concepts.selection.comparison_note) {
        comparisonNote.hidden = false;
        comparisonNote.textContent = `${t("conceptComparisonNote")}: ${local(concepts.selection.comparison_note)}`;
      } else {
        comparisonNote.hidden = true;
        comparisonNote.textContent = "";
      }
    }
    setExclusivePressed(
      $$("[data-concept-option]"),
      (button) => button.dataset.conceptOption === state.conceptOption,
    );

    $("#concept-title").textContent = local(option.title);
    $("#concept-concept").textContent = local(option.concept);
    const profile = option.profile || {};
    const setText = (id, value) => {
      const el = $(id);
      if (el) el.textContent = value ? local(value) : "";
    };
    setText("#concept-what", profile.what_it_is);
    setText("#concept-how", profile.how_it_works);
    setText("#concept-program", profile.program);
    const fillList = (id, items) => {
      const el = $(id);
      if (!el) return;
      el.innerHTML = (items || [])
        .map((item) => `<li>${escapeHtml(local(item))}</li>`)
        .join("");
    };
    fillList("#concept-strengths", profile.strengths);
    fillList("#concept-tradeoffs", profile.tradeoffs);
    const briefFit = $("#concept-brief-fit");
    if (briefFit) {
      briefFit.textContent = option.brief_alignment ? local(option.brief_alignment) : "";
    }
    const isoWrap = $("#concept-isometric-wrap");
    const isoImg = $("#concept-isometric");
    if (isoWrap && isoImg) {
      if (option.isometric_image) {
        isoWrap.hidden = false;
        isoImg.src = option.isometric_image;
        isoImg.alt = `${t("conceptIsometricAlt")} ${option.letter}`;
      } else {
        isoWrap.hidden = true;
        isoImg.removeAttribute("src");
        isoImg.alt = "";
      }
    }
    $("#concept-levels").innerHTML = option.levels
      .map((level) => `
        <div>
          <dt>${escapeHtml(local(level.name))}</dt>
          <dd><bdi>${format(level.elevation_m, 1)} m</bdi></dd>
        </div>`)
      .join("");
    $("#concept-checks").innerHTML = option.validation
      .map((item) => `
        <span class="status-pill ${item.passed ? "verified" : "unresolved"}">
          <span class="status-dot"></span>${escapeHtml(local(item.check))}
        </span>`)
      .join("");
    if (!option.validation.length && option.source_validation_withheld) {
      $("#concept-checks").innerHTML = `<p class="source-note">${escapeHtml(local(option.source_validation_withheld))}</p>`;
    }

    const rows = [
      ["conceptInternalArea", "internal_area_m2", 2],
      ["conceptGarageArea", "garage_workshop_area_m2", 2],
      ["conceptCourtyardArea", "courtyard_area_m2", 2],
      ["conceptFootprint", "footprint_m2", 2],
    ];
    $("#concepts-table tbody").innerHTML = rows
      .map(([key, metric, digits]) => `
        <tr>
          <th scope="row">${escapeHtml(t(key))}</th>
          ${concepts.options
    .map((item) => `<td class="numeric"><bdi>${format(item.metrics[metric], digits)}</bdi></td>`)
    .join("")}
        </tr>`)
      .join("");

    // The frame is auditable: the same two points that define it also test it.
    const frame = concepts.frame;
    $("#concept-frame-note").textContent = `${t("conceptFrame")} ${
      format(frame.survey_round_trip_max_error_m, 6)} m`;
  }

  const metricRow = (label, value, unit) => `
    <div><span>${escapeHtml(label)}</span><strong><bdi>${value}${unit ? ` ${unit}` : ""}</bdi></strong></div>`;

  /**
   * Statistics derived from the bundled series. Each is labelled for what it is:
   * degree-days are not an energy demand and a percentile temperature is not a
   * design temperature, and the notes beside them say so rather than relying on
   * the reader to know.
   */
  function renderDerivedStatistics() {
    const derived = data.climate?.derived;
    if (derived) {
      const byId = new Map(derived.degree_days.totals.map((total) => [total.id, total]));
      const percentiles = derived.temperature_percentiles;
      // CDD18 leads for comfort/overheating; CDD10 stays as the published companion.
      $("#climate-derived").innerHTML = [
        metricRow(t("hdd18Label"), format(byId.get("hdd18").annual_k_day, 0), "K·day"),
        metricRow(t("cdd18Label"), format(byId.get("cdd18").annual_k_day, 0), "K·day"),
        metricRow(t("cdd10Label"), format(byId.get("cdd10").annual_k_day, 0), "K·day"),
        metricRow(t("coldPercentile"), format(percentiles.percentile_daily_min_c, 1), "°C"),
        metricRow(t("warmPercentile"), format(percentiles.percentile_daily_max_c, 1), "°C"),
      ].join("");
      $("#climate-derived-note").textContent =
        `${local(derived.degree_days.note)} ${local(percentiles.method_note)}`;
      renderArchitectClimate();

      const wind = derived.wind_return_periods;
      $("#wind-return").innerHTML = [10, 25, 50, 100]
        .map((years) => metricRow(
          `${localizeDigits(years)} ${t("yearReturn")}`,
          format(wind.gust_return_period_kmh[years], 1),
          "km/h",
        ))
        .join("");
      $("#wind-return-note").textContent = local(wind.rejected_fit.reason);
    }

    const metrics = data.terrainMetrics;
    if (metrics) {
      const steepest = metrics.slope_classes.find((item) => item.facet_count > 0);
      $("#terrain-metrics").innerHTML = [
        metricRow(t("planArea"), format(metrics.plan_area_m2, 4), "m²"),
        metricRow(t("surfaceArea"), format(metrics.surface_area_m2, 4), "m²"),
        metricRow(t("surfaceRatio"), format(metrics.surface_to_plan_ratio, 4), ""),
        metricRow(
          `${t("slopeBand")} ${localizeDigits(steepest.from_percent)}–${localizeDigits(steepest.to_percent)}%`,
          format(steepest.share_percent, 1),
          "%",
        ),
      ].join("");
      $("#terrain-metrics-note").textContent =
        `${local(metrics.note)} ${local(metrics.excluded)}`;
    }

    renderPlatform();
  }

  /**
   * Plan area against surface area, and what a level platform costs in depth.
   *
   * The question this answers is a live one on a 33–50% site: the verified area is
   * a horizontal projection, the ground's own skin is 7.18% larger, and neither
   * number is the size of a level floor. Depth is what limits that, so the table
   * is levels against depths rather than a single "buildable area" figure, which
   * would be a siting decision dressed as a measurement.
   */
  function renderPlatform() {
    const platform = data.platform;
    if (!platform) return;
    $("#platform-design-use").innerHTML = `
      <strong>${escapeHtml(local(platform.design_use.label))}</strong>
      <p>${escapeHtml(local(platform.design_use.note))}</p>`;
    $("#platform-difference").textContent = local(platform.difference_note);
    const best = platform.best_level_for_band["1.5"];
    $("#platform-metrics").innerHTML = [
      metricRow(t("surfaceExcess"), format(platform.surface_excess_m2, 2),
        `m² (${format(platform.surface_excess_percent, 2)}%)`),
      metricRow(t("balanceLevel"), format(platform.balance_level_m, 3), "m"),
      // Two rows rather than a level folded into the label: metric labels are
      // uppercased by the stylesheet, which turned a trailing unit into "M".
      metricRow(t("bestPlatformLevel"), format(best.level_m, 2), "m"),
      metricRow(t("bestPlatform"), format(best.area_m2, 1), "m²"),
    ].join("");
    $("#platform-table tbody").innerHTML = platform.levels
      .map((entry) => `
        <tr>
          <td>${escapeHtml(format(entry.level_m, 2))} m</td>
          <td>${escapeHtml(format(entry.cut_area_m2, 1))} m²</td>
          <td>${escapeHtml(format(entry.fill_area_m2, 1))} m²</td>
          <td>${escapeHtml(format(entry.max_cut_depth_m, 2))} m</td>
          <td>${escapeHtml(format(entry.max_fill_depth_m, 2))} m</td>
          <td>${escapeHtml(format(entry.area_within_depth_m2["1.5"], 1))} m²</td>
        </tr>`)
      .join("");
    $("#platform-note").textContent =
      `${local(platform.balance_note)} ${local(platform.raster.note)} ${local(platform.limits)}`;
  }

  /**
   * Trees, tested rather than recommended.
   *
   * Two rules run through this renderer. Every horticultural figure is shown
   * with the source's own wording available beside it, because the difference
   * between "hardy to −25 °C" and "zone 4-9 so probably about −29 °C" is the
   * difference between a fact and an inference and the reader is entitled to
   * see which they are getting. And no verdict is softened: a species whose
   * published hardiness fails this site is drawn as failing it, with its
   * photograph, so the mistake is recognisable in a nursery.
   *
   * External links are built from data here and never written into this file —
   * the offline guarantee is checked by scanning app.js for URLs, and a link the
   * reader chooses to follow is not a dependency of the page.
   */
  function renderSpecies() {
    const register = data.species;
    if (!register) return;
    const sourceById = new Map(register.sources.map((source) => [source.id, source]));

    $("#species-headline").textContent = local(register.headline);
    $("#species-rule").textContent =
      `${local(register.test_rule)} ${local(register.hardiness_derivation)}`;
    $("#species-limits").textContent =
      `${local(register.limitations)} ${local(register.illustrative_planting_note)} ${local(register.client_reported_note)}`;

    const chipPlain = (label, value) => `
      <div class="species-chip">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>`;

    const fruit = register.fruit;
    $("#species-fruit").innerHTML = `
      <p class="species-fruit-headline">${escapeHtml(local(fruit.headline))}</p>
      <div class="species-chips">
        ${chipPlain(t("speciesFruitCount"), format(fruit.count, 0))}
        ${chipPlain(t("speciesFruitFrostClear"), format(fruit.clear_of_the_frost_window, 0))}
        ${chipPlain(t("speciesFruitPartner"), format(fruit.needs_a_pollination_partner, 0))}
        ${chipPlain(t("speciesFruitClean"), format(fruit.crops_cleanly, 0))}
      </div>
      <p>${escapeHtml(local(fruit.position_note))}</p>
      <p>${escapeHtml(local(fruit.irrigation_note))}</p>
      <p class="source-note">${escapeHtml(local(fruit.test_rule))} ${escapeHtml(local(fruit.no_yield_note))}</p>`;

    $("#species-constraints").innerHTML = Object.values(register.constraints)
      .map((constraint) => `
        <article class="species-constraint">
          <h4>${escapeHtml(local(constraint.title))}</h4>
          ${constraint.applies_to
    ? `<p class="species-scope"><span>${escapeHtml(t("speciesAppliesToFruit"))}</span> ${escapeHtml(local(constraint.applies_to_note))}</p>`
    : ""}
          <p>${escapeHtml(local(constraint.statement))}</p>
          ${constraint.caveat
    ? `<p class="species-caution">${escapeHtml(local(constraint.caveat))}</p>`
    : ""}
          ${constraint.chill_note
    ? `<p class="species-evidence">${escapeHtml(local(constraint.chill_note))}</p>`
    : ""}
          <p class="source-note">${escapeHtml(constraint.source)}</p>
        </article>`)
      .join("");

    const verdictClass = { pass: "verified", marginal: "preliminary", fail: "unresolved", unknown: "unresolved" };
    const verdictKey = {
      pass: "verdictPass", marginal: "verdictMarginal", fail: "verdictFail", unknown: "verdictUnknown",
    };
    const growthKey = { fast: "growthFast", medium: "growthMedium", slow: "growthSlow" };
    const waterKey = { high: "waterHigh", moderate: "waterModerate", low: "waterLow" };
    const alkalineKey = { very: "alkalineVery", mildly: "alkalineMildly" };
    const testKey = {
      cold: "testCold", drought: "testDrought", soil: "testSoil", exposure: "testExposure",
      bloom_frost: "testBloomFrost", pollination: "testPollination",
    };
    const selfFertileKey = {
      yes: "selfFertileYes", partial: "selfFertilePartial", no: "selfFertileNo",
    };
    // Bloom months are printed as month names in both languages rather than as
    // numbers: a Persian reader gets Persian month names everywhere else on this
    // page, and "3–4" in a frost discussion invites being read as a temperature.
    const bloomLabel = (months) => (months
      ? (months[0] === months[1]
        ? local(data.climate.monthly[months[0] - 1].label)
        : `${local(data.climate.monthly[months[0] - 1].label)}–${local(data.climate.monthly[months[1] - 1].label)}`)
      : "—");
    const range = (values) => (values[0] === values[1]
      ? format(values[0], 0)
      : `${format(values[0], 0)}–${format(values[1], 0)}`);

    const chip = (label, value, title) => `
      <div class="species-chip"${title ? ` title="${escapeHtml(title)}"` : ""}>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>`;

    const links = (species) => [
      // Source labels are mixed-script — one is a Persian conference-paper title —
      // so each label is isolated: without bdi the bracketed "(Civilica)" jumps
      // to the wrong end of its own link.
      species.wikipedia_en
        ? `<a href="${escapeHtml(species.wikipedia_en)}" rel="noreferrer"><bdi>${escapeHtml(t("speciesWikipedia"))}</bdi></a>`
        : "",
      species.wikipedia_fa
        ? `<a href="${escapeHtml(species.wikipedia_fa)}" rel="noreferrer"><bdi>${escapeHtml(t("speciesWikipediaFa"))}</bdi></a>`
        : "",
      ...(species.sources ?? []).map((id) => {
        const source = sourceById.get(id);
        return source
          ? `<a href="${escapeHtml(source.url)}" rel="noreferrer"><bdi>${escapeHtml(source.label)}</bdi></a>`
          : "";
      }),
    ].filter(Boolean).join("");

    const photo = (species) => (species.image
      ? `<figure class="species-photo">
          <img src="${escapeHtml(species.image.src)}" alt="${escapeHtml(species.latin)}" loading="lazy">
          <figcaption>${escapeHtml(t("speciesPhotoCredit"))}: ${escapeHtml(species.image.author)} · ${escapeHtml(species.image.licence)}</figcaption>
        </figure>`
      : "");

    // The crop block is deliberately a block of its own rather than two more
    // chips. Surviving and cropping are separate verdicts on this page, and a
    // reader has to be able to see that a tree cleared for the site can still be
    // the wrong tree for fruit.
    const cropBlock = (species) => {
      if (!species.fruit) return "";
      const fruit = species.fruit;
      return `
        <section class="species-crop">
          <p class="species-crop-head">
            <span class="status-pill ${verdictClass[species.crop_verdict]}"><span class="status-dot"></span>${escapeHtml(t("speciesCropVerdict"))}: ${escapeHtml(t(verdictKey[species.crop_verdict]))}</span>
            <strong>${escapeHtml(local(fruit.crop))}</strong>
          </p>
          <div class="species-chips">
            ${chip(t("speciesBloom"), bloomLabel(fruit.bloom_months), fruit.bloom_source_text)}
            ${chip(t("speciesSelfFertile"), t(selfFertileKey[fruit.self_fertile] ?? "verdictUnknown"), fruit.self_fertile_source_text)}
            ${chip(t("speciesBudKill"), fruit.bud_kill_c
    ? `${format(fruit.bud_kill_c.kill_10, 1)} / ${format(fruit.bud_kill_c.kill_90, 1)} °C`
    : "—", fruit.bud_kill_source_text ?? t("speciesBudKillAbsent"))}
          </div>
          <ul class="species-tests" aria-label="${escapeHtml(t("speciesCropTests"))}">
            ${Object.entries(species.crop_tests).map(([id, verdict]) => `
              <li class="test-${escapeHtml(verdict)}">${escapeHtml(t(testKey[id]))}: ${escapeHtml(t(verdictKey[verdict]))}</li>`).join("")}
          </ul>
          <p>${escapeHtml(local(fruit.note))}</p>
          ${fruit.rootstock
    ? `<p class="species-evidence"><strong>${escapeHtml(t("speciesRootstock"))}:</strong> ${escapeHtml(local(fruit.rootstock.note))}</p>`
    : ""}
        </section>`;
    };

    const shortlistIds = new Set(data.speciesShortlist?.ids || []);
    const speciesCard = (species, { compact = false, hidden = false } = {}) => `
        <article class="species-card${hidden ? " hidden" : ""}${compact ? " species-card-shortlist" : ""}" data-verdict="${escapeHtml(species.verdict)}">
          ${photo(species)}
          <header>
            <span class="status-pill ${verdictClass[species.verdict]}"><span class="status-dot"></span>${escapeHtml(t(verdictKey[species.verdict]))}</span>
            <h4><em>${escapeHtml(species.latin)}</em></h4>
            <p class="species-common">${escapeHtml(local(species.common))} · ${escapeHtml(local(species.role))}</p>
            <p class="species-tags">
              <span>${escapeHtml(t(species.deciduous ? "speciesDeciduous" : "speciesEvergreen"))}</span>
              ${species.native_to_iran ? `<span>${escapeHtml(t("speciesNative"))}</span>` : ""}
              ${species.fruit ? `<span>${escapeHtml(t("speciesFruiting"))}</span>` : ""}
              ${species.client_reported ? `<span>${escapeHtml(t("speciesClientReported"))}</span>` : ""}
              ${species.hardiness.disputed ? `<span class="warn">${escapeHtml(t("speciesDisputed"))}</span>` : ""}
            </p>
          </header>
          <div class="species-chips">
            ${chip(t("speciesHeight"), `${range(species.mature_height_m)} m`)}
            ${chip(t("speciesCrown"), species.crown_spread_m ? `${range(species.crown_spread_m)} m` : "—",
    species.crown_spread_m ? undefined : local(species.crown_spread_note))}
            ${chip(t("speciesShadeArea"), species.crown_plan_area_m2 === null
    ? "—"
    : `${format(species.crown_plan_area_m2, 0)} m²`, species.crown_plan_area_m2 === null
    ? local(species.crown_spread_note)
    : `${format(species.crown_share_of_parcel_percent, 0)}% ${t("speciesOfParcel")}`)}
            ${chip(t("speciesGrowth"), t(growthKey[species.growth_rate.class]), species.growth_rate.source_text)}
            ${chip(t("speciesHardiness"), species.hardiness.min_c === null
    ? "—"
    : `${format(species.hardiness.min_c, 1)} °C`, species.hardiness.source_text)}
            ${chip(t("speciesWater"), t(waterKey[species.water.class]), species.water.source_text)}
            ${chip(t("speciesSoil"), t(alkalineKey[species.soil.alkaline] ?? "alkalineUnknown"), species.soil.source_text)}
          </div>
          ${compact ? "" : `
          <ul class="species-tests" aria-label="${escapeHtml(t("speciesTests"))}">
            ${Object.entries(species.tests).map(([id, verdict]) => `
              <li class="test-${escapeHtml(verdict)}">${escapeHtml(t(testKey[id]))}: ${escapeHtml(t(verdictKey[verdict]))}</li>`).join("")}
          </ul>
          <p>${escapeHtml(local(species.note))}</p>
          ${cropBlock(species)}
          ${species.native_note
    ? `<p class="species-evidence">${escapeHtml(local(species.native_note))}</p>`
    : ""}
          <p class="species-caution">${escapeHtml(local(species.caution))}</p>
          ${species.hardiness.dispute
    ? `<p class="species-dispute">${escapeHtml(local(species.hardiness.dispute))}</p>`
    : ""}
          <p class="species-links">${links(species)}</p>`}
        </article>`;

    const shortlistRoot = $("#species-shortlist-grid");
    if (shortlistRoot) {
      shortlistRoot.innerHTML = register.species
        .filter((species) => shortlistIds.has(species.id))
        .map((species) => speciesCard(species, { compact: true }))
        .join("");
    }

    $("#species-grid").innerHTML = register.species
      .map((species) => {
        const hidden = state.speciesFilter === "fruit"
          ? !species.fruit
          : state.speciesFilter !== "all" && species.verdict !== state.speciesFilter;
        return speciesCard(species, { hidden });
      })
      .join("");

    $("#species-avoid").innerHTML = register.do_not_plant
      .map((species) => `
        <article class="species-card species-card-avoid">
          ${photo(species)}
          <header>
            <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(t("verdictFail"))}</span>
            <h4><em>${escapeHtml(species.latin)}</em></h4>
            <p class="species-common">${escapeHtml(local(species.common))} · ${escapeHtml(t(growthKey[species.growth_rate.class]))}</p>
          </header>
          <p>${escapeHtml(local(species.reason))}</p>
          <p class="species-links">${links(species)}</p>
        </article>`)
      .join("");

    $("#species-ask").innerHTML = register.ask_locally
      .map((species) => `
        <article class="species-card species-card-ask">
          ${photo(species)}
          <header>
            <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(t("verdictUnknown"))}</span>
            <h4><em>${escapeHtml(species.latin)}</em></h4>
            <p class="species-common">${escapeHtml(local(species.common))}</p>
          </header>
          <p>${escapeHtml(local(species.gap))}</p>
          <p class="species-links">${links(species)}</p>
        </article>`)
      .join("");

    $("#species-placement").innerHTML = [
      ...register.placement.zones.map((zone) => `
        <article class="species-zone">
          <h4>${escapeHtml(local(zone.title))}</h4>
          <p class="species-evidence">${escapeHtml(local(zone.evidence))}</p>
          <p>${escapeHtml(local(zone.guidance))}</p>
        </article>`),
      `<p class="source-note">${escapeHtml(local(register.placement.note))}</p>`,
    ].join("");

    $("#species-care").innerHTML = [
      ...register.care.items.map((item) => `
        <article class="species-care-item">
          <h4>${escapeHtml(local(item.title))}</h4>
          <p>${escapeHtml(local(item.body))}</p>
        </article>`),
      `<p class="source-note">${escapeHtml(local(register.care.note))} ${escapeHtml(local(register.image_credit_note))}</p>`,
    ].join("");
  }

  /**
   * The procurement register. Rendered as instructions with an owner rather than
   * as a list of gaps, because every row is something someone has to go and get.
   */
  function renderInvestigations() {
    const register = data.investigations;
    if (!register) return;
    $("#investigations-intro").textContent = local(register.intro);

    const gates = [{ id: "all", label: { en: "All", fa: "همه" } }, ...register.gates];
    $("#investigation-gates").innerHTML = gates
      .map((gate) => {
        const active = gate.id === state.investigationGate;
        return `
        <button class="${active ? "active" : ""}" type="button" data-investigation-gate="${escapeHtml(gate.id)}" aria-pressed="${active}">${escapeHtml(local(gate.label))}</button>`;
      })
      .join("");
    $$("[data-investigation-gate]").forEach((button) => {
      button.addEventListener("click", () => {
        state.investigationGate = button.dataset.investigationGate;
        renderInvestigations();
      });
    });

    const familyLabel = new Map(register.families.map((family) => [family.id, family.label]));
    const rows = register.items.filter((item) => (
      state.investigationGate === "all" || item.gate === state.investigationGate
    ));
    $("#investigations-table tbody").innerHTML = rows
      .map((item) => `
        <tr>
          <th scope="row">
            <strong>${escapeHtml(local(item.title))}</strong>
            <span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(local(familyLabel.get(item.family)))}</span>
          </th>
          <td>${escapeHtml(local(item.owner) || local(item.procure_via))}</td>
          <td>${escapeHtml(local(item.prerequisite) || "—")}</td>
          <td><span class="status-pill unresolved"><span class="status-dot"></span>${escapeHtml(statusLabel(item.status))}</span></td>
          <td>${escapeHtml(local(item.expected_deliverable) || "—")}</td>
          <td>${escapeHtml(local(item.dependency) || local(item.blocks))}</td>
          <td>${escapeHtml(local(item.scope_note) || "—")}</td>
          <td>${escapeHtml(local(item.blocks))}</td>
          <td>${escapeHtml(local(item.proxy_available))}</td>
        </tr>`)
      .join("");
  }

  function renderSources() {
    $("#source-count").textContent =
      `${localizeDigits(data.sources.items.length)} ${t("registeredDatasets")}`;
    $("#sources-table tbody").innerHTML = data.sources.items
      .map(
        (item) => `
          <tr>
            <td><strong>${escapeHtml(local(item.dataset))}</strong></td>
            <td>${escapeHtml(local(item.organisation) || "—")}</td>
            <td class="numeric"><bdi>${escapeHtml(item.accessed || "—")}</bdi></td>
            <td>${escapeHtml(local(item.resolution) || "—")}</td>
            <td><span class="status-pill ${statusClass(item.status)}"><span class="status-dot"></span>${escapeHtml(statusLabel(item.status))}</span></td>
            <td>${escapeHtml(local(item.limitation))}</td>
          </tr>`,
      )
      .join("");
    $("#method-list").innerHTML = data.sources.methods
      .map((method) => `<li>${escapeHtml(local(method))}</li>`)
      .join("");
  }

  function profileTitle() {
    return local(data.terrain.sections[state.profile].label);
  }

  function renderProfileMetadata() {
    const section = data.terrain.sections[state.profile];
    if (!section) return;
    const startDirection = local(section.direction?.start);
    const endDirection = local(section.direction?.end);
    $("#profile-summary").innerHTML = [
      metricRow(`${t("sectionStartElevation")} · ${startDirection}`, format(section.start_elevation_m, 3), "m"),
      metricRow(`${t("sectionEndElevation")} · ${endDirection}`, format(section.end_elevation_m, 3), "m"),
      metricRow(t("sectionFall"), format(section.fall_m, 3), "m"),
      metricRow(t("sectionGrade"), format(section.average_grade_percent, 1), "%"),
    ].join("");
    $("#profile-scope").textContent = local(section.scope);
  }

  function canvasSetup(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
  }

  function pointMapper(points, width, height, padding = 60) {
    const xs = points.map((point) => point.x_m ?? point[0]);
    const ys = points.map((point) => point.y_m ?? point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const scale = Math.min(usableW / (maxX - minX), usableH / (maxY - minY));
    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxY - minY) * scale) / 2;
    return (point) => {
      const x = point.x_m ?? point[0];
      const y = point.y_m ?? point[1];
      return {
        x: offsetX + (x - minX) * scale,
        y: height - (offsetY + (y - minY) * scale),
      };
    };
  }

  function drawPath(context, points, mapper, close = true) {
    context.beginPath();
    points.forEach((point, index) => {
      const mapped = mapper(point);
      if (index === 0) context.moveTo(mapped.x, mapped.y);
      else context.lineTo(mapped.x, mapped.y);
    });
    if (close) context.closePath();
  }

  function drawHeroSite() {
    const canvas = $("#hero-site-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const ring = data.site.outer_boundary_points;
    const all = [...ring, data.survey.points.find((point) => point.id === "Pt8")];
    const map = pointMapper(all, width, height, Math.min(width, height) * 0.15);

    context.save();
    drawPath(context, ring, map);
    context.fillStyle = "rgba(169, 185, 170, 0.12)";
    context.fill();
    context.strokeStyle = "#a9b9aa";
    context.lineWidth = 2.2;
    context.stroke();

    const pt8 = data.survey.points.find((point) => point.id === "Pt8");
    ring.forEach((point) => {
      context.beginPath();
      const a = map(pt8);
      const b = map(point);
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = "rgba(169,185,170,0.16)";
      context.lineWidth = 1;
      context.stroke();
    });

    const roadA = map(data.survey.points.find((point) => point.id === "Pt2"));
    const roadB = map(data.survey.points.find((point) => point.id === "Pt1"));
    context.beginPath();
    context.moveTo(roadA.x, roadA.y);
    context.lineTo(roadB.x, roadB.y);
    context.strokeStyle = "#bd6d4d";
    context.lineWidth = 6;
    context.lineCap = "round";
    context.stroke();

    all.forEach((point) => {
      const mapped = map(point);
      const interior = point.id === "Pt8";
      context.beginPath();
      context.arc(mapped.x, mapped.y, interior ? 7 : 5, 0, Math.PI * 2);
      context.fillStyle = interior ? "#bd6d4d" : "#f6f1e6";
      context.fill();
      context.strokeStyle = "#15201c";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#e8ece8";
      context.font = canvasFont(600, Math.max(10, Math.min(12, width / 44)));
      context.textAlign = "center";
      context.fillText(point.id, mapped.x, mapped.y - 13);
    });

    drawDirectionArrow(context, width * 0.78, height * 0.23, 44, -44, "#bd6d4d", compass("NE"));
    drawNorthArrow(context, width - 36, 50, "#a9b9aa");
    context.restore();
  }

  function drawNorthArrow(context, x, y, color) {
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y + 30);
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - 5, y + 9);
    context.lineTo(x + 5, y + 9);
    context.closePath();
    context.fill();
    context.font = canvasFont(600, 10);
    context.textAlign = "center";
    context.fillText(compass("N"), x, y - 8);
    context.restore();
  }

  function drawDirectionArrow(context, x, y, dx, dy, color, label) {
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + dx, y + dy);
    context.stroke();
    const angle = Math.atan2(dy, dx);
    context.beginPath();
    context.moveTo(x + dx, y + dy);
    context.lineTo(x + dx - 10 * Math.cos(angle - Math.PI / 6), y + dy - 10 * Math.sin(angle - Math.PI / 6));
    context.lineTo(x + dx - 10 * Math.cos(angle + Math.PI / 6), y + dy - 10 * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
    context.font = canvasFont(700, 9);
    context.textAlign = "center";
    context.fillText(label, x + dx + 8, y + dy - 8);
    context.restore();
  }

  function drawTerrain() {
    const canvas = $("#terrain-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const ring = data.site.outer_boundary_points;
    const all = data.survey.points;
    const map = pointMapper(all, width, height, Math.min(width, height) * 0.14);
    const pointByName = Object.fromEntries(all.map((point) => [point.id, point]));

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#17241e");
    background.addColorStop(1, "#0d1511");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    data.terrain.triangles.forEach((triangle, index) => {
      const points = triangle.points.map((name) => pointByName[name]);
      drawPath(context, points, map);
      context.fillStyle = `hsla(${38 + index * 4}, 22%, ${25 + index * 1.5}%, 0.32)`;
      context.fill();
      context.strokeStyle = "rgba(210,221,214,0.12)";
      context.lineWidth = 1;
      context.stroke();
    });

    if (state.contours) {
      Object.entries(data.terrain.contour_segments).forEach(([level, segments]) => {
        context.beginPath();
        segments.forEach((segment) => {
          const a = map(segment[0]);
          const b = map(segment[1]);
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
        });
        context.strokeStyle = Number(level) % 5 === 0 ? "rgba(235,214,160,0.75)" : "rgba(235,214,160,0.36)";
        context.lineWidth = Number(level) % 5 === 0 ? 1.8 : 1;
        context.stroke();
      });
    }

    drawPath(context, ring, map);
    context.strokeStyle = "#e6ebe5";
    context.lineWidth = 2.5;
    context.stroke();

    const roadA = map(pointByName.Pt2);
    const roadB = map(pointByName.Pt1);
    context.beginPath();
    context.moveTo(roadA.x, roadA.y);
    context.lineTo(roadB.x, roadB.y);
    context.strokeStyle = "#bd6d4d";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.stroke();

    const min = data.terrain.min_elevation_m;
    const max = data.terrain.max_elevation_m;
    all.forEach((point) => {
      const mapped = map(point);
      const ratio = (point.elevation_m - min) / (max - min);
      context.beginPath();
      context.arc(mapped.x, mapped.y, point.id === "Pt8" ? 8 : 6, 0, Math.PI * 2);
      context.fillStyle = mixColor("#7d9fa8", "#bd6d4d", ratio);
      context.fill();
      context.strokeStyle = "#101713";
      context.lineWidth = 2;
      context.stroke();
      if (state.labels) {
        context.fillStyle = "#edf1ed";
        context.font = canvasFont(600, width < 600 ? 10 : 12);
        context.textAlign = "center";
        context.fillText(`${point.id} · ${format(point.elevation_m, 3)}`, mapped.x, mapped.y - 14);
      }
    });

    drawDirectionArrow(context, width * 0.68, height * 0.68, 62, -62, "#bd6d4d", "FALL · NE");
    drawNorthArrow(context, width - 42, 54, "#d8ded9");
  }

  function mixColor(low, high, amount) {
    const parse = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const a = parse(low);
    const b = parse(high);
    const result = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
    return `rgb(${result.join(",")})`;
  }

  function drawProfile() {
    const canvas = $("#profile-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const section = data.terrain.sections[state.profile];
    const samples = section.distance_m
      .map((distance, index) => ({ distance, elevation: section.elevation_m[index] }))
      .filter((sample) => Number.isFinite(sample.distance) && Number.isFinite(sample.elevation));
    if (samples.length < 2) return;
    const distances = samples.map((sample) => sample.distance);
    const elevations = samples.map((sample) => sample.elevation);
    const padding = { top: 34, right: 28, bottom: 58, left: 72 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const minX = distances[0];
    const maxX = distances[distances.length - 1];
    const minY = Math.floor(Math.min(...elevations));
    const maxY = Math.ceil(Math.max(...elevations));
    const x = (value) => padding.left + ((value - minX) / (maxX - minX)) * innerW;
    const y = (value) => padding.top + (1 - (value - minY) / (maxY - minY)) * innerH;
    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue("--line").trim();
    const muted = styles.getPropertyValue("--muted").trim();
    const moss = styles.getPropertyValue("--moss").trim();
    const surfaceAlt = styles.getPropertyValue("--surface-alt").trim();

    context.strokeStyle = line;
    context.fillStyle = muted;
    context.lineWidth = 1;
    context.font = canvasFont(500, width < 520 ? 10 : 11);
    context.textAlign = "right";
    for (let value = minY; value <= maxY; value += 1) {
      const py = y(value);
      context.beginPath();
      context.moveTo(padding.left, py);
      context.lineTo(width - padding.right, py);
      context.stroke();
      context.fillText(String(value), padding.left - 8, py + 3);
    }

    context.beginPath();
    elevations.forEach((value, index) => {
      const px = x(distances[index]);
      const py = y(value);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.lineTo(x(maxX), y(minY));
    context.lineTo(x(minX), y(minY));
    context.closePath();
    const fill = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    fill.addColorStop(0, `${moss}80`);
    fill.addColorStop(1, `${surfaceAlt}20`);
    context.fillStyle = fill;
    context.fill();

    context.beginPath();
    elevations.forEach((value, index) => {
      const px = x(distances[index]);
      const py = y(value);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.strokeStyle = moss;
    context.lineWidth = 3.5;
    context.stroke();

    context.fillStyle = muted;
    context.textAlign = "center";
    for (let step = 0; step <= 4; step += 1) {
      const value = minX + ((maxX - minX) * step) / 4;
      context.fillText(`${format(value, 1)}`, x(value), height - 26);
    }

    context.font = canvasFont(650, width < 520 ? 10 : 12);
    context.fillStyle = moss;
    context.textAlign = "left";
    context.fillText(local(section.direction?.start), padding.left, height - 8);
    context.textAlign = "right";
    context.fillText(local(section.direction?.end), width - padding.right, height - 8);

    context.fillStyle = muted;
    context.font = canvasFont(500, width < 520 ? 9 : 10);
    context.textAlign = "center";
    context.fillText(t("distanceAxis"), padding.left + innerW / 2, height - 8);
    context.save();
    context.translate(14, padding.top + innerH / 2);
    context.rotate(-Math.PI / 2);
    context.fillText(t("elevationAxis"), 0, 0);
    context.restore();

    if (state.profileHover != null) {
      const hoverIndex = Math.max(
        0,
        Math.min(elevations.length - 1, Math.round(state.profileHover * (elevations.length - 1))),
      );
      const px = x(distances[hoverIndex]);
      const py = y(elevations[hoverIndex]);
      context.beginPath();
      context.moveTo(px, padding.top);
      context.lineTo(px, height - padding.bottom);
      context.strokeStyle = "rgba(189,109,77,0.55)";
      context.lineWidth = 1;
      context.stroke();
      context.beginPath();
      context.arc(px, py, 5, 0, Math.PI * 2);
      context.fillStyle = "#bd6d4d";
      context.fill();
      const label = `${format(distances[hoverIndex], 2)} m · ${format(elevations[hoverIndex], 3)} m`;
      context.font = canvasFont(600, 10);
      const boxW = context.measureText(label).width + 20;
      const boxX = Math.min(width - padding.right - boxW, Math.max(padding.left, px - boxW / 2));
      const boxY = Math.max(4, py - 36);
      context.fillStyle = "#18201d";
      roundedRect(context, boxX, boxY, boxW, 26, 8);
      context.fill();
      context.fillStyle = "#f4f2ed";
      context.textAlign = "center";
      context.fillText(label, boxX + boxW / 2, boxY + 17);
    }
  }

  function geoViewBounds(scaleM) {
    const center = data.geography.center;
    const extract = data.geography.context_map.bounds;
    const latHalf = (scaleM / 2) / 111_320;
    const lonHalf = (scaleM / 2) / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
    // Crop within the offline extract so empty space does not invent map data.
    return {
      west: Math.max(extract.west, center.longitude - lonHalf),
      east: Math.min(extract.east, center.longitude + lonHalf),
      south: Math.max(extract.south, center.latitude - latHalf),
      north: Math.min(extract.north, center.latitude + latHalf),
    };
  }

  function drawGeography() {
    const canvas = $("#geo-map-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const mapData = data.geography.context_map;
    const bounds = geoViewBounds(state.geoScaleM || 5000);
    const x = (longitude) => (longitude - bounds.west) / (bounds.east - bounds.west) * width;
    const y = (latitude) => height - (latitude - bounds.south) / (bounds.north - bounds.south) * height;
    const styles = getComputedStyle(document.documentElement);
    const muted = styles.getPropertyValue("--muted").trim();
    const clay = styles.getPropertyValue("--clay").trim();

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#111d18");
    background.addColorStop(1, "#23332b");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(214,224,217,0.045)";
    context.lineWidth = 1;
    for (let row = 0; row < 10; row += 1) {
      context.beginPath();
      for (let px = -20; px <= width + 20; px += 8) {
        const py = height * (row + 0.5) / 10
          + Math.sin(px * 0.018 + row * 0.9) * 11
          + Math.sin(px * 0.005 - row) * 7;
        if (px === -20) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.stroke();
    }

    const drawLines = (features, color, widths) => {
      features.forEach((feature) => {
        context.beginPath();
        feature.coordinates.forEach(([longitude, latitude], index) => {
          const px = x(longitude);
          const py = y(latitude);
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.strokeStyle = color(feature);
        context.lineWidth = widths(feature);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.stroke();
      });
    };
    drawLines(
      mapData.water,
      () => "rgba(101,163,183,0.78)",
      (feature) => feature.class === "river" ? 2.5 : 1.5,
    );
    drawLines(
      mapData.roads,
      (feature) => ["primary", "secondary", "tertiary"].includes(feature.class)
        ? "rgba(236,216,174,0.82)"
        : "rgba(216,225,217,0.32)",
      (feature) => ["primary", "secondary"].includes(feature.class)
        ? 2.7
        : feature.class === "tertiary" ? 2 : 1,
    );

    const siteX = x(data.geography.center.longitude);
    const siteY = y(data.geography.center.latitude);
    const kmPerPixel = 111.32 * Math.cos(data.geography.center.latitude * Math.PI / 180)
      * (bounds.east - bounds.west) / width;
    const ringKm = [0.125, 0.25, 0.5, 1, 2.5, 5, 10].filter((radiusKm) => radiusKm * 2000 <= (state.geoScaleM || 5000) * 1.2);
    ringKm.forEach((radiusKm, index) => {
      const radiusPx = radiusKm / kmPerPixel;
      if (radiusPx < 8 || radiusPx > Math.min(width, height)) return;
      context.beginPath();
      context.arc(siteX, siteY, radiusPx, 0, Math.PI * 2);
      context.strokeStyle = index === ringKm.length - 1 ? "rgba(189,109,77,0.45)" : "rgba(189,109,77,0.25)";
      context.lineWidth = index === ringKm.length - 1 ? 1.5 : 1;
      context.setLineDash(index === ringKm.length - 1 ? [5, 5] : [2, 4]);
      context.stroke();
    });
    context.setLineDash([]);

    mapData.places.slice(0, 8).forEach((place) => {
      const px = x(place.longitude);
      const py = y(place.latitude);
      if (px < 0 || px > width || py < 0 || py > height) return;
      context.beginPath();
      context.arc(px, py, place.type === "town" ? 4 : 2.5, 0, Math.PI * 2);
      context.fillStyle = place.type === "town" ? "#e8d7ad" : "#a9b9aa";
      context.fill();
      context.font = canvasFont(place.type === "town" ? 600 : 500, width < 600 ? 8 : 10);
      context.fillStyle = "#edf2ee";
      context.textAlign = "left";
      context.fillText(place.name, px + 6, py - 5);
    });

    context.beginPath();
    context.arc(siteX, siteY, 7, 0, Math.PI * 2);
    context.fillStyle = clay;
    context.fill();
    context.strokeStyle = "#f7f0e1";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#f7f0e1";
    context.font = canvasFont(700, width < 600 ? 9 : 11);
    context.textAlign = "center";
    context.fillText(t("canvasSite"), siteX, siteY - 13);

    context.fillStyle = muted;
    context.font = canvasFont(400, 9);
    context.textAlign = "right";
    context.fillText("OSM · local vector extract", width - 12, height - 12);
    drawNorthArrow(context, width - 34, 42, "#d9e1db");
  }

  function drawClimate() {
    const canvas = $("#climate-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const months = data.climate.monthly;
    const padding = { top: 28, right: 46, bottom: 42, left: 48 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const bandWidth = innerWidth / 12;
    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue("--line").trim();
    const muted = styles.getPropertyValue("--muted").trim();
    const ink = styles.getPropertyValue("--ink").trim();
    const moss = styles.getPropertyValue("--moss").trim();
    const clay = styles.getPropertyValue("--clay").trim();

    context.strokeStyle = line;
    context.fillStyle = muted;
    context.font = canvasFont(400, 9);
    context.lineWidth = 1;
    for (let step = 0; step <= 4; step += 1) {
      const py = padding.top + innerHeight * step / 4;
      context.beginPath();
      context.moveTo(padding.left, py);
      context.lineTo(width - padding.right, py);
      context.stroke();
    }

    if (state.climateView === "temperature") {
      const minTemperature = -10;
      const maxTemperature = 35;
      const maxPrecipitation = Math.max(...months.map((month) => month.precipitation_mm)) * 1.12;
      const tempY = (value) => padding.top
        + (1 - (value - minTemperature) / (maxTemperature - minTemperature)) * innerHeight;
      const precipitationY = (value) => padding.top
        + (1 - value / maxPrecipitation) * innerHeight;
      months.forEach((month, index) => {
        const barWidth = bandWidth * 0.54;
        const px = padding.left + bandWidth * (index + 0.5) - barWidth / 2;
        const py = precipitationY(month.precipitation_mm);
        context.fillStyle = `${clay}b8`;
        context.fillRect(px, py, barWidth, padding.top + innerHeight - py);
      });
      [
        ["temperature_min_c", `${ink}7a`, 1.5],
        ["temperature_max_c", `${ink}b0`, 1.5],
        ["temperature_mean_c", moss, 3],
      ].forEach(([key, color, lineWidth]) => {
        context.beginPath();
        months.forEach((month, index) => {
          const px = padding.left + bandWidth * (index + 0.5);
          const py = tempY(month[key]);
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.stroke();
      });
      context.fillStyle = muted;
      context.textAlign = "right";
      [-10, 0, 10, 20, 30].forEach((value) => context.fillText(`${value}°`, padding.left - 8, tempY(value) + 3));
      context.textAlign = "left";
      [0, maxPrecipitation / 2, maxPrecipitation].forEach((value) => context.fillText(`${Math.round(value)}`, width - padding.right + 7, precipitationY(value) + 3));
    } else {
      const maxSnow = Math.max(...months.map((month) => month.snowfall_cm)) * 1.12;
      const maxFrost = Math.max(...months.map((month) => month.frost_days)) * 1.12;
      const maxSolar = Math.max(...months.map((month) => month.solar_radiation_kwh_m2_day)) * 1.08;
      const leftY = (value, max) => padding.top + (1 - value / max) * innerHeight;
      months.forEach((month, index) => {
        const barWidth = bandWidth * 0.48;
        const px = padding.left + bandWidth * (index + 0.5) - barWidth / 2;
        const py = leftY(month.snowfall_cm, maxSnow);
        context.fillStyle = "rgba(103,157,178,0.72)";
        context.fillRect(px, py, barWidth, padding.top + innerHeight - py);
        const frostY = leftY(month.frost_days, maxFrost);
        context.beginPath();
        context.arc(px + barWidth / 2, frostY, 3.5, 0, Math.PI * 2);
        context.fillStyle = clay;
        context.fill();
      });
      context.beginPath();
      months.forEach((month, index) => {
        const px = padding.left + bandWidth * (index + 0.5);
        const py = leftY(month.solar_radiation_kwh_m2_day, maxSolar);
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.strokeStyle = "#c6a15b";
      context.lineWidth = 3;
      context.stroke();
    }

    context.fillStyle = muted;
    context.textAlign = "center";
    months.forEach((month, index) => {
      // Authored short label, not a slice: cutting the Persian names to three
      // characters split them mid-word and changed the final letter's form.
      context.fillText(
        local(month.label_short ?? month.label),
        padding.left + bandWidth * (index + 0.5),
        height - 16,
      );
    });

    if (state.climateHover != null) {
      const index = Math.max(0, Math.min(11, Math.floor(state.climateHover * 12)));
      const px = padding.left + bandWidth * (index + 0.5);
      context.beginPath();
      context.moveTo(px, padding.top);
      context.lineTo(px, height - padding.bottom);
      context.strokeStyle = "rgba(189,109,77,0.65)";
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawSolar() {
    const canvas = $("#solar-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const selectedSeason = currentSolarSeason();
    const selectedPosition = currentSolarPosition();
    if (!selectedPosition) return;
    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue("--line").trim();
    const muted = styles.getPropertyValue("--muted").trim();
    const moss = styles.getPropertyValue("--moss").trim();
    const clay = styles.getPropertyValue("--clay").trim();
    const skyCenter = width >= 720
      ? { x: width * 0.29, y: height * 0.49, radius: Math.min(width * 0.22, height * 0.37) }
      : { x: width * 0.5, y: height * 0.27, radius: Math.min(width * 0.36, height * 0.21) };
    const planBox = width >= 720
      ? { x: width * 0.56, y: height * 0.12, width: width * 0.39, height: height * 0.76 }
      : { x: width * 0.12, y: height * 0.53, width: width * 0.76, height: height * 0.40 };

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "rgba(244,237,221,0.02)");
    background.addColorStop(1, "rgba(189,109,77,0.07)");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const skyPoint = (position) => {
      const radial = (90 - position.altitude_deg) / 90 * skyCenter.radius;
      const angle = (position.azimuth_deg - 90) * Math.PI / 180;
      return {
        x: skyCenter.x + Math.cos(angle) * radial,
        y: skyCenter.y + Math.sin(angle) * radial,
      };
    };
    // Measured terrain horizon, drawn in the same equidistant projection as the
    // sun paths: r(φ) = (90 − horizon(φ))/90 · R. The ring is the sky the site
    // actually has, so an arc crossing into the shaded band is genuinely blocked.
    const horizonProfile = data.horizon?.combined?.profile;
    if (horizonProfile?.length) {
      context.beginPath();
      context.arc(skyCenter.x, skyCenter.y, skyCenter.radius, 0, Math.PI * 2);
      horizonProfile.forEach((entry, index) => {
        const point = skyPoint({
          altitude_deg: entry.horizon_deg,
          azimuth_deg: entry.azimuth_deg,
        });
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fillStyle = "rgba(20, 28, 24, 0.55)";
      context.fill("evenodd");
      context.beginPath();
      horizonProfile.forEach((entry, index) => {
        const point = skyPoint({
          altitude_deg: entry.horizon_deg,
          azimuth_deg: entry.azimuth_deg,
        });
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.strokeStyle = "rgba(226, 178, 122, 0.55)";
      context.lineWidth = 1.2;
      context.stroke();
    }

    [0.33, 0.66, 1].forEach((ratio) => {
      context.beginPath();
      context.arc(skyCenter.x, skyCenter.y, skyCenter.radius * ratio, 0, Math.PI * 2);
      context.strokeStyle = ratio === 1 ? "rgba(223,230,224,0.28)" : "rgba(223,230,224,0.10)";
      context.lineWidth = ratio === 1 ? 1.5 : 1;
      context.stroke();
    });
    context.beginPath();
    context.moveTo(skyCenter.x - skyCenter.radius, skyCenter.y);
    context.lineTo(skyCenter.x + skyCenter.radius, skyCenter.y);
    context.moveTo(skyCenter.x, skyCenter.y - skyCenter.radius);
    context.lineTo(skyCenter.x, skyCenter.y + skyCenter.radius);
    context.strokeStyle = "rgba(223,230,224,0.12)";
    context.stroke();

    data.solar.seasons.forEach((season) => {
      context.beginPath();
      season.positions.forEach((position, index) => {
        const point = skyPoint(position);
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.strokeStyle = season.id === state.solarSeason ? "#d9b563" : "rgba(223,230,224,0.20)";
      context.lineWidth = season.id === state.solarSeason ? 3 : 1.4;
      context.stroke();
    });
    const sun = skyPoint(selectedPosition);
    context.beginPath();
    context.arc(sun.x, sun.y, 7, 0, Math.PI * 2);
    context.fillStyle = "#e1b550";
    context.shadowBlur = 14;
    context.shadowColor = "#e1b550";
    context.fill();
    context.shadowBlur = 0;
    [
      ["N", 0, -skyCenter.radius - 12],
      ["E", skyCenter.radius + 12, 3],
      ["S", 0, skyCenter.radius + 18],
      ["W", -skyCenter.radius - 12, 3],
    ].forEach(([code, dx, dy]) => {
      context.fillStyle = muted;
      context.font = canvasFont(700, 9);
      context.textAlign = "center";
      context.fillText(compass(code), skyCenter.x + dx, skyCenter.y + dy);
    });

    context.strokeStyle = line;
    context.fillStyle = "rgba(255,255,255,0.015)";
    context.lineWidth = 1;
    roundedRect(context, planBox.x, planBox.y, planBox.width, planBox.height, 16);
    context.fill();
    context.stroke();

    const allPoints = data.survey.points;
    const minX = Math.min(...allPoints.map((point) => point.x_m));
    const maxX = Math.max(...allPoints.map((point) => point.x_m));
    const minY = Math.min(...allPoints.map((point) => point.y_m));
    const maxY = Math.max(...allPoints.map((point) => point.y_m));
    const scale = Math.min(planBox.width * 0.70 / (maxX - minX), planBox.height * 0.70 / (maxY - minY));
    const mapSite = (point) => ({
      x: planBox.x + (planBox.width - (maxX - minX) * scale) / 2 + (point.x_m - minX) * scale,
      y: planBox.y + planBox.height - ((planBox.height - (maxY - minY) * scale) / 2 + (point.y_m - minY) * scale),
    });

    if (state.solarContours) {
      Object.values(data.terrain.contour_segments).forEach((segments) => {
        context.beginPath();
        segments.forEach((segment) => {
          const a = mapSite({ x_m: segment[0][0], y_m: segment[0][1] });
          const b = mapSite({ x_m: segment[1][0], y_m: segment[1][1] });
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
        });
        context.strokeStyle = "rgba(218,190,128,0.18)";
        context.lineWidth = 0.8;
        context.stroke();
      });
    }
    if (state.solarBoundary) {
      drawPath(context, data.site.outer_boundary_points, mapSite);
      context.strokeStyle = "rgba(234,239,235,0.72)";
      context.lineWidth = 2;
      context.stroke();
    }

    const object = currentSolarObject();
    const objectCenter = mapSite(data.survey.points.find((point) => point.id === "Pt8"));
    const shadowLength = shadowLengthFor(object.height_m, selectedPosition.altitude_deg);
    if (shadowLength !== null) {
      const shadowAzimuth = (selectedPosition.azimuth_deg + 180) % 360;
      const shadowPixels = Math.min(planBox.width * 0.36, shadowLength * scale);
      const shadowAngle = (shadowAzimuth - 90) * Math.PI / 180;
      const shadowEnd = {
        x: objectCenter.x + Math.cos(shadowAngle) * shadowPixels,
        y: objectCenter.y + Math.sin(shadowAngle) * shadowPixels,
      };
      context.beginPath();
      context.moveTo(objectCenter.x, objectCenter.y);
      context.lineTo(shadowEnd.x, shadowEnd.y);
      context.strokeStyle = "rgba(16,24,20,0.78)";
      context.lineWidth = state.solarObject === "pole" ? 4 : 10;
      context.lineCap = "round";
      context.stroke();
    }
    context.beginPath();
    if (state.solarObject === "generic-volume") {
      context.rect(objectCenter.x - 8, objectCenter.y - 8, 16, 16);
    } else if (state.solarObject === "wall") {
      context.rect(objectCenter.x - 13, objectCenter.y - 3, 26, 6);
    } else {
      context.arc(objectCenter.x, objectCenter.y, 5, 0, Math.PI * 2);
    }
    context.fillStyle = clay;
    context.fill();

    context.fillStyle = muted;
    context.font = canvasFont(400, 9);
    context.textAlign = "left";
    context.fillText(`${format(selectedPosition.altitude_deg, 1)}° ALT`, planBox.x + 12, planBox.y + 20);
    context.fillText(`${format(selectedPosition.azimuth_deg, 1)}° AZ`, planBox.x + 12, planBox.y + 34);
    context.fillText(
      shadowLength === null ? "— SHADOW" : `${format(shadowLength, 2)} m SHADOW`,
      planBox.x + 12,
      planBox.y + 48,
    );
    drawNorthArrow(context, planBox.x + planBox.width - 24, planBox.y + 34, "#cad5cc");
  }

  function drawWind() {
    const canvas = $("#wind-canvas");
    const { context, width, height } = canvasSetup(canvas);
    const season = data.wind.seasons.find((item) => item.season === state.windSeason)
      || data.wind.seasons[0];
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) * 0.38;
    const maxPercent = Math.max(...season.direction_distribution.map((item) => item.percent));
    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue("--line").trim();
    const muted = styles.getPropertyValue("--muted").trim();
    const clay = styles.getPropertyValue("--clay").trim();
    const moss = styles.getPropertyValue("--moss").trim();

    [0.25, 0.5, 0.75, 1].forEach((ratio) => {
      context.beginPath();
      context.arc(center.x, center.y, radius * ratio, 0, Math.PI * 2);
      context.strokeStyle = line;
      context.lineWidth = 1;
      context.stroke();
    });
    for (let index = 0; index < 16; index += 1) {
      const angle = (index * 22.5 - 90) * Math.PI / 180;
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
      context.strokeStyle = "rgba(95,111,102,0.15)";
      context.stroke();
    }

    season.direction_distribution.forEach((item, index) => {
      const angle = (index * 22.5 - 90) * Math.PI / 180;
      const halfWidth = Math.PI / 25;
      const length = item.percent / maxPercent * radius;
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(center.x + Math.cos(angle - halfWidth) * length, center.y + Math.sin(angle - halfWidth) * length);
      context.arc(center.x, center.y, length, angle - halfWidth, angle + halfWidth);
      context.closePath();
      const gradient = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
      gradient.addColorStop(0, `${moss}70`);
      gradient.addColorStop(1, `${clay}d8`);
      context.fillStyle = gradient;
      context.fill();
    });

    [["N", 0, -radius - 15], ["E", radius + 15, 3], ["S", 0, radius + 20], ["W", -radius - 15, 3]]
      .forEach(([code, dx, dy]) => {
        context.fillStyle = muted;
        context.font = canvasFont(700, 10);
        context.textAlign = "center";
        context.fillText(compass(code), center.x + dx, center.y + dy);
      });
    context.beginPath();
    context.arc(center.x, center.y, 22, 0, Math.PI * 2);
    context.fillStyle = "#f2eee4";
    context.fill();
    context.fillStyle = "#26352e";
    context.font = canvasFont(700, 11);
    context.textAlign = "center";
    context.fillText(compass(season.prevailing_direction), center.x, center.y + 4);
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function refreshCanvases() {
    refreshCanvasFont();
    drawHeroSite();
    drawTerrain();
    drawProfile();
    drawGeography();
    drawClimate();
    drawSolar();
    drawWind();
  }

  function openLightbox(src, alt) {
    const dialog = $("#lightbox");
    $("#lightbox-image").src = src;
    $("#lightbox-image").alt = alt || "";
    $("#lightbox-caption").textContent = alt || "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function bindEvents() {
    $("#language-toggle").addEventListener("click", () => {
      state.lang = state.lang === "en" ? "fa" : "en";
      applyLanguage();
    });

    $("#theme-toggle").addEventListener("click", () => {
      state.theme = state.theme === "light" ? "dark" : "light";
      applyTheme();
    });

    $("#menu-toggle").addEventListener("click", () => {
      const nav = $("#mobile-nav");
      const expanded = $("#menu-toggle").getAttribute("aria-expanded") === "true";
      $("#menu-toggle").setAttribute("aria-expanded", String(!expanded));
      nav.hidden = expanded;
    });

    $$("#mobile-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        $("#mobile-nav").hidden = true;
        $("#menu-toggle").setAttribute("aria-expanded", "false");
      });
    });

    $("#point-search").addEventListener("input", (event) => {
      state.pointQuery = event.currentTarget.value;
      renderPoints();
    });

    $$("#points-table [data-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sort;
        state.pointSort.direction =
          state.pointSort.key === key ? state.pointSort.direction * -1 : 1;
        state.pointSort.key = key;
        renderPoints();
      });
    });

    $("#contour-toggle").addEventListener("change", (event) => {
      state.contours = event.currentTarget.checked;
      drawTerrain();
    });

    $("#label-toggle").addEventListener("change", (event) => {
      state.labels = event.currentTarget.checked;
      drawTerrain();
    });

    $$("[data-section]").forEach((button) => {
      button.addEventListener("click", () => {
        state.profile = button.dataset.section;
        state.profileHover = null;
        setExclusivePressed($$("[data-section]"), button);
        $("#profile-title").textContent = profileTitle();
        renderProfileMetadata();
        drawProfile();
      });
    });

    $("#profile-canvas").addEventListener("pointermove", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const paddingLeft = 72;
      const paddingRight = 28;
      state.profileHover = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left - paddingLeft) / (rect.width - paddingLeft - paddingRight)),
      );
      drawProfile();
    });

    $("#profile-canvas").addEventListener("pointerleave", () => {
      state.profileHover = null;
      drawProfile();
    });

    $$("[data-climate-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.climateView = button.dataset.climateView;
        setExclusivePressed($$("[data-climate-view]"), button);
        renderClimateEvidence();
        drawClimate();
      });
    });

    $("#climate-canvas").addEventListener("pointermove", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const left = 48;
      const right = 46;
      state.climateHover = Math.max(
        0,
        Math.min(0.999, (event.clientX - rect.left - left) / (rect.width - left - right)),
      );
      const month = data.climate.monthly[Math.floor(state.climateHover * 12)];
      const tooltip = $("#climate-tooltip");
      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(rect.width - 176, Math.max(12, event.clientX - rect.left + 12))}px`;
      tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 76)}px`;
      tooltip.innerHTML = state.climateView === "temperature"
        ? `<strong>${escapeHtml(local(month.label))}</strong><span><bdi>${format(month.temperature_mean_c, 1)}°C</bdi> · <bdi>${format(month.precipitation_mm, 1)} mm</bdi></span><small><bdi>${format(month.temperature_min_c, 1)}° / ${format(month.temperature_max_c, 1)}°C</bdi></small>`
        : `<strong>${escapeHtml(local(month.label))}</strong><span><bdi>${format(month.snowfall_cm, 1)} cm</bdi> · <bdi>${format(month.frost_days, 1)} ${escapeHtml(t("unitDays"))}</bdi></span><small><bdi>${format(month.solar_radiation_kwh_m2_day, 2)} kWh/m²/day</bdi></small>`;
      drawClimate();
    });
    $("#climate-canvas").addEventListener("pointerleave", () => {
      state.climateHover = null;
      $("#climate-tooltip").hidden = true;
      drawClimate();
    });

    $$("[data-solar-season]").forEach((button) => {
      button.addEventListener("click", () => {
        state.solarSeason = button.dataset.solarSeason;
        syncSolarSeasonButtons();
        resetSolarToNoon();
        window.HOUSEAI_TERRAIN_3D?.setSeason(currentSolarSeason());
        updateSolar();
      });
    });
    $$("[data-solar-time]").forEach((slider) => {
      slider.addEventListener("input", (event) => {
        stopSolarPlayback();
        state.solarHour = Number(event.currentTarget.value);
        syncSolarSlider();
        updateSolar();
      });
    });
    if (reducedMotion?.matches) {
      $$("[data-solar-play]").forEach((button) => {
        button.disabled = true;
        button.hidden = true;
      });
    }
    reducedMotion?.addEventListener?.("change", (event) => {
      if (event.matches) stopSolarPlayback();
      $$("[data-solar-play]").forEach((button) => {
        button.disabled = event.matches;
        button.hidden = event.matches;
      });
    });
    $$("[data-solar-play]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.solarPlaying) stopSolarPlayback();
        else startSolarPlayback();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stopSolarPlayback();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopSolarPlayback();
    });
    // Animating a sun the reader has scrolled past is pure battery cost. Both
    // views carry sun controls, so playback survives while either is on screen.
    const sunSections = ["#terrain", "#solar"].map((id) => $(id)).filter(Boolean);
    if (sunSections.length && "IntersectionObserver" in window) {
      const onScreen = new Set();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        });
        if (!onScreen.size) stopSolarPlayback();
      }, { threshold: 0 });
      sunSections.forEach((section) => observer.observe(section));
    }
    $$("[data-solar-object]").forEach((button) => {
      button.addEventListener("click", () => {
        state.solarObject = button.dataset.solarObject;
        setExclusivePressed($$("[data-solar-object]"), button);
        window.HOUSEAI_TERRAIN_3D?.setTestObject(state.solarObject);
        updateSolar();
      });
    });
    $("#solar-boundary-toggle").addEventListener("change", (event) => {
      state.solarBoundary = event.currentTarget.checked;
      drawSolar();
    });
    $("#solar-contour-toggle").addEventListener("change", (event) => {
      state.solarContours = event.currentTarget.checked;
      drawSolar();
    });

    $$("[data-lightbox]").forEach((button) => {
      button.addEventListener("click", () => {
        const alt =
          state.lang === "fa" ? button.dataset.altFa : button.dataset.altEn;
        openLightbox(button.dataset.lightbox, alt);
      });
    });

    $(".lightbox-close").addEventListener("click", () => $("#lightbox").close());
    $("#lightbox").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });

    $$("[data-concept-option]").forEach((button) => {
      button.addEventListener("click", () => {
        state.conceptOption = button.dataset.conceptOption;
        setExclusivePressed($$("[data-concept-option]"), button);
        renderConcepts();
        window.HOUSEAI_TERRAIN_3D?.setConceptOption(state.conceptOption);
      });
    });

    $$("[data-hazard-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.hazardFilter = button.dataset.hazardFilter;
        setExclusivePressed($$("[data-hazard-filter]"), button);
        renderHazards();
      });
    });

    $$("[data-species-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.speciesFilter = button.dataset.speciesFilter;
        setExclusivePressed($$("[data-species-filter]"), button);
        renderSpecies();
      });
    });

    $$("[data-geo-scale]").forEach((button) => {
      button.addEventListener("click", () => {
        state.geoScaleM = Number(button.dataset.geoScale) || 5000;
        setExclusivePressed($$("[data-geo-scale]"), button);
        drawGeography();
      });
    });

    $("#document-search").addEventListener("input", (event) => {
      state.documentQuery = event.currentTarget.value;
      renderDocuments();
    });
    $("#document-language").addEventListener("change", (event) => {
      state.documentLanguage = event.currentTarget.value;
      renderDocuments();
    });
    $("#document-type").addEventListener("change", (event) => {
      state.documentType = event.currentTarget.value;
      renderDocuments();
    });

    const sections = $$("main section[id], main details[id]");
    const navLinks = $$(".desktop-nav a, .mobile-nav a");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const href = `#${visible.target.id}`;
        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === href;
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "page");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-28% 0px -60% 0px", threshold: [0.01, 0.1, 0.3] },
    );
    sections.forEach((section) => observer.observe(section));

    let resizeFrame;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(refreshCanvases);
    });
  }

  /**
   * Deferred until the stage is near the viewport. The cost worth deferring is
   * the WebGL context and the 2048² shadow map, not the local script parse, so
   * this defers init rather than the load.
   */
  function mountTerrain3D() {
    const stage = $("#terrain-3d-stage");
    if (!stage || !window.HOUSEAI_TERRAIN_3D) return;
    const start = () => {
      window.HOUSEAI_TERRAIN_3D.init({ data, language: state.lang, theme: state.theme });
      window.HOUSEAI_TERRAIN_3D.setSeason(currentSolarSeason());
      window.HOUSEAI_TERRAIN_3D.setTestObject(state.solarObject);
      window.HOUSEAI_TERRAIN_3D.setSun(currentSolarPosition());
      window.HOUSEAI_TERRAIN_3D.setConceptOption(state.conceptOption);
    };
    if (!("IntersectionObserver" in window)) {
      start();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    }, { rootMargin: "200px 0px", threshold: 0.01 });
    observer.observe(stage);
  }

  function init() {
    applyTheme();
    $("#dwg-hash").textContent = data.survey.integrity.dwg_sha256;
    $("#dxf-hash").textContent = data.survey.integrity.dxf_sha256;
    $("#profile-title").textContent = profileTitle();
    bindEvents();
    syncSolarSeasonButtons();
    resetSolarToNoon();
    applyLanguage();
    mountTerrain3D();
  }

  init();
})();
