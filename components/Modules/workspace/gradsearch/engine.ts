// @ts-nocheck
/**
 * GradSearch explorer engine — port of gradsearch/app/app.js.
 *
 * Mounts into a root element (the shadow-DOM `.gs-app` node) and returns a
 * cleanup function. Personal state uses the same `gs-*` localStorage keys as
 * the standalone explorer. `hooks.onReload` replaces `location.reload()` so
 * reverting a verified edit rebuilds from the bundled catalog.
 */
export function mountGradSearch(root, data, hooks = {}) {
  let detachKey = () => {};

  "use strict";

  const DATA = data || { programs: [], tiers: {} };
  const PROGRAMS = (DATA.programs || []).map((p) => ({
    ...p,
    components: { ...(p.components || {}) },
    ...(p.dates ? { dates: { ...p.dates, ...(Array.isArray(p.dates.breaks) ? { breaks: p.dates.breaks.slice() } : {}) } } : {}),
  }));
  const TIER_LABELS = DATA.tiers || {};
  const DEFAULT_WEIGHTS = DATA.defaultWeights || { field: 0.35, location: 0.3, funding: 0.2, duration: 0.1, accred: 0.05 };

  const ATTRS = [
    { key: "field", label: "Field fit" },
    { key: "location", label: "Location" },
    { key: "funding", label: "Funding" },
    { key: "duration", label: "Duration" },
    { key: "accred", label: "Accreditation" },
  ];

  // ---- field color palette ----
  const FIELD_COLORS = {
    "Philosophy of Science": "#6ea8fe",
    "Art-Tech / Immersive": "#f43f5e",
    "Experiential Art-Tech": "#f43f5e",
    "Experiential / Interactive Art": "#22d3ee",
    "Philosophy": "#8b7bff",
    "Design / Tech": "#34d399",
    "Exhibit / Experience Design": "#f0883e",
    "Visual Art": "#e879f9",
    "Science Communication": "#f472b6",
    "Altruistic / Beneficial AI": "#2dd4bf",
    "Beneficial AI": "#2dd4bf",
    "Paradigms / Foundations / Complexity": "#fbbf24",
    "Paradigms / Complexity": "#fbbf24",
    "Cognitive Architectures / Theory of Mind / Consciousness": "#c084fc",
    "Writing": "#facc15",
    "Adjacent": "#94a3b8",
    "Other": "#94a3b8",
  };
  const fieldColor = (f) => FIELD_COLORS[f] || "#94a3b8";
  const tierName = (t) => (t == null ? "Global / Remote" : "Tier " + t);

  function scoreColor(s) {
    if (s >= 85) return "#22c55e";
    if (s >= 75) return "#4ade80";
    if (s >= 65) return "#84cc16";
    if (s >= 55) return "#eab308";
    if (s >= 45) return "#f59e0b";
    return "#f43f5e";
  }
  const scoreGrad = (s) => `linear-gradient(135deg, ${scoreColor(s)}, ${scoreColor(Math.max(0, s - 14))})`;

  // ============================================================
  //  STABLE PROGRAM IDENTITY
  //  Persisted user state (favorites, dismissed, overrides, vibes, notes)
  //  is keyed by a CONTENT key — not the volatile numeric `id`, which gets
  //  reassigned whenever the dataset is regenerated / appended to. This is
  //  what fixes "favorites shows different programs than I favorited".
  // ============================================================
  function rawKey(p) {
    const link = (p.link || "").trim().toLowerCase();
    if (link) return "L:" + link;
    return "N:" + (p.program || "").trim().toLowerCase() + "|" + (p.institution || "").trim().toLowerCase();
  }
  // Stamp a STABLE identity key now, BEFORE any locally-applied verified edits can
  // mutate identity-bearing fields (link / program / institution). keyOf() always
  // returns this stamped key, so favorites / notes / overrides stay attached even
  // after the user applies a corrected link or program name from a verification.
  PROGRAMS.forEach((p) => { if (!p.__key) Object.defineProperty(p, "__key", { value: rawKey(p), enumerable: false }); });
  const keyOf = (p) => p.__key || rawKey(p);
  const ID_TO_KEY = new Map(PROGRAMS.map((p) => [p.id, keyOf(p)]));
  const KEY_SET = new Set(ID_TO_KEY.values());
  const keyById = (id) => ID_TO_KEY.get(id);

  // ============================================================
  //  INTERACTIVE SCORING
  // ============================================================
  function normWeights() {
    const w = state.weights;
    const sum = ATTRS.reduce((a, x) => a + (Number(w[x.key]) || 0), 0);
    if (sum <= 0) return { ...DEFAULT_WEIGHTS };
    const out = {};
    ATTRS.forEach((x) => { out[x.key] = (Number(w[x.key]) || 0) / sum; });
    return out;
  }
  function effComponents(p) {
    return Object.assign({}, p.components, state.overrides[keyOf(p)] || {});
  }
  // ---- vibes: a personal -50..+50 adjustment added straight to the score ----
  const VIBES_MAX = 50;
  function vibesOf(p) {
    const v = Number(state.vibes[keyOf(p)]) || 0;
    return Math.max(-VIBES_MAX, Math.min(VIBES_MAX, v));
  }
  const fmtVibes = (v) => (v > 0 ? "+" : "") + v;
  function isCustomized(p) {
    const o = state.overrides[keyOf(p)];
    return !!(o && Object.keys(o).length) || vibesOf(p) !== 0;
  }
  function noteOf(p) { return (state.notes[keyOf(p)] || "").trim(); }
  function hasNote(p) { return noteOf(p).length > 0; }
  function myScore(p) {
    const nw = normWeights();
    const c = effComponents(p);
    let v = (p.baseAdjust || 0);
    ATTRS.forEach((x) => { v += nw[x.key] * (Number(c[x.key]) || 0); });
    v += vibesOf(p);
    v = Math.max(0, Math.min(100, v));
    return Math.round(v * 10) / 10;
  }
  function activeScore(p) {
    return state.scoreMode === "research" ? p.score : myScore(p);
  }
  const fmtScore = (n) => (Number.isInteger(n) ? n : n.toFixed(1));

  // ============================================================
  //  DISMISS / RESTORE
  // ============================================================
  function saveDismissed() { save("gs-dismissed", Array.from(state.dismissed)); }
  function dismiss(id) {
    const k = keyById(id); if (!k) return;
    state.dismissed.add(k);
    state.compare.delete(id);
    saveDismissed();
    renderTray();
    render();
  }
  function restore(id) {
    const k = keyById(id); if (!k) return;
    state.dismissed.delete(k);
    saveDismissed();
    if (!state.dismissed.size) state.viewDismissed = false;
    render();
  }
  function restoreAll() {
    state.dismissed.clear();
    saveDismissed();
    state.viewDismissed = false;
    render();
  }

  // ============================================================
  //  FAVORITES
  // ============================================================
  function saveFavorites() { save("gs-favorites", Array.from(state.favorites)); }
  function toggleFavorite(id) {
    const k = keyById(id); if (!k) return;
    if (state.favorites.has(k)) state.favorites.delete(k);
    else state.favorites.add(k);
    saveFavorites();
    if (state.viewFavorites && !state.favorites.size) state.viewFavorites = false;
    render();
  }
  function saveNotes() { save("gs-notes", state.notes); }
  function saveDataEdits() { save("gs-dataedits", state.dataEdits); }

  // ---- state ----
  const state = {
    search: "",
    field: new Set(),
    tier: new Set(),
    degree: new Set(),
    funding: new Set(),
    country: "",
    minScore: 0,
    maxDur: 6,
    sort: "score-desc",
    view: "grid",
    compare: new Set(),
    // ---- interactive scoring (all keyed by stable content key) ----
    weights: loadJSON("gs-weights", { ...DEFAULT_WEIGHTS }),
    overrides: loadKeyMap("gs-overrides"), // { [key]: { field, location, ... } }
    vibes: loadKeyMap("gs-vibes"),         // { [key]: -50..50 } personal adjustment
    notes: loadKeyMap("gs-notes"),         // { [key]: "free text note" }
    dataEdits: loadKeyMap("gs-dataedits"), // { [key]: { field:val, … } } verified corrections applied on top of data.js
    verifyId: null,                        // session-only: program whose verify modal is open
    scoreMode: loadStr("gs-scoremode", "mine"), // "mine" | "research"
    // ---- dismissed (hidden) programs ----
    dismissed: loadKeySet("gs-dismissed"),
    viewDismissed: false, // session-only: show the hidden list instead of active list
    // ---- favorites ----
    favorites: loadKeySet("gs-favorites"),
    viewFavorites: false, // session-only: show only favorites
  };

  function loadJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (_) { return fallback; }
  }
  // Load a Set of program keys, migrating any legacy numeric ids -> keys and
  // dropping orphans (ids/keys no longer present in the dataset).
  function loadKeySet(key) {
    const arr = loadJSON(key, []);
    const out = new Set();
    (Array.isArray(arr) ? arr : []).forEach((v) => {
      if (typeof v === "number") { const k = ID_TO_KEY.get(v); if (k) out.add(k); }
      else if (typeof v === "string" && KEY_SET.has(v)) out.add(v);
    });
    return out;
  }
  // Load an object keyed by program key, migrating legacy numeric-id keys.
  function loadKeyMap(key) {
    const obj = loadJSON(key, {});
    const out = {};
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((k) => {
        if (/^-?\d+$/.test(k)) { const nk = ID_TO_KEY.get(+k); if (nk) out[nk] = obj[k]; }
        else if (KEY_SET.has(k)) out[k] = obj[k];
      });
    }
    return out;
  }
  function loadStr(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); } catch (_) {}
  }

  // ---- helpers ----
  const $ = (s, ctx = root) => ctx.querySelector(s);
  const $$ = (s, ctx = root) => Array.from(ctx.querySelectorAll(s));
  const esc = (str) =>
    String(str == null ? "" : str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ============================================================
  //  DATES & DEADLINES (optional structured `dates` block per program)
  // ============================================================
  const DATE_ROWS = [
    ["appDeadline", "Application deadline"],
    ["appWindow", "Application window"],
    ["intake", "Intake / start"],
    ["termStart", "Term start"],
    ["termEnd", "Term end"],
  ];

  // Concatenate date values into one searchable string so the search box matches them.
  function datesSearchText(p) {
    const d = p.dates;
    if (!d) return "";
    const parts = [];
    DATE_ROWS.forEach(([k]) => { if (d[k]) parts.push(d[k]); });
    if (Array.isArray(d.breaks)) parts.push(d.breaks.join(" "));
    if (d.note) parts.push(d.note);
    if (d.rolling) parts.push("rolling");
    return parts.join(" ");
  }

  // Short label for a card pill — prefers the deadline, falls back to rolling/intake.
  function deadlinePill(p) {
    const d = p.dates;
    if (!d) return "";
    if (d.appDeadline) return `<span class="tag tag-deadline" title="Application deadline">⏰ ${esc(d.appDeadline)}</span>`;
    if (d.rolling) return `<span class="tag tag-deadline" title="Rolling applications">⏰ Rolling</span>`;
    if (d.intake) return `<span class="tag tag-deadline" title="Intake / start">⏰ ${esc(d.intake)}</span>`;
    return "";
  }

  // Full "Dates & deadlines" drawer section. Returns "" when there's nothing to show.
  function datesDrawerHTML(p) {
    const d = p.dates;
    if (!d) return "";
    const rows = [];
    DATE_ROWS.forEach(([k, label]) => {
      if (d[k]) rows.push(`<div class="d-fact"><div class="k">${label}</div><div class="v">${esc(d[k])}</div></div>`);
    });
    if (d.rolling && !d.appDeadline) {
      rows.push(`<div class="d-fact"><div class="k">Applications</div><div class="v">Rolling</div></div>`);
    }
    let breaksHTML = "";
    if (Array.isArray(d.breaks) && d.breaks.length) {
      breaksHTML = `<div class="d-breaks"><div class="k">Breaks / vacations</div><ul>${
        d.breaks.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`;
    }
    const note = d.note ? `<p class="dates-note">${esc(d.note)}</p>` : "";
    const verified = d.verified
      ? `<p class="dates-verified">Verified ${esc(d.verified)}${
          d.source ? ` · <a href="${esc(d.source)}" target="_blank" rel="noopener">source ↗</a>` : ""}</p>`
      : (d.source ? `<p class="dates-verified"><a href="${esc(d.source)}" target="_blank" rel="noopener">source ↗</a></p>` : "");
    if (!rows.length && !breaksHTML && !note) return "";
    return `<div class="d-section">
      <h4>Dates &amp; deadlines</h4>
      <div class="d-facts">${rows.join("")}</div>
      ${breaksHTML}${note}${verified}
    </div>`;
  }

  const uniqueCounts = (key) => {
    const m = new Map();
    PROGRAMS.forEach((p) => {
      const v = p[key];
      if (v == null || v === "") return;
      m.set(v, (m.get(v) || 0) + 1);
    });
    return m;
  };

  // ============================================================
  //  STATS
  // ============================================================
  function renderStats() {
    const n = PROGRAMS.length;
    const funded = PROGRAMS.filter((p) => /Funded|Free|waiver/i.test(p.fundingType)).length;
    const philsci = PROGRAMS.filter((p) => p.fieldCategory === "Philosophy of Science").length;
    const tier1 = PROGRAMS.filter((p) => p.tier === 1).length;
    const countries = new Set(PROGRAMS.map((p) => p.country).filter(Boolean)).size;
    const cards = [
      { num: n, label: "Programs tracked", icon: "🎓" },
      { num: philsci, label: "Philosophy of Science", icon: "🔬" },
      { num: funded, label: "Funded / free", icon: "💰" },
      { num: tier1, label: "Tier-1 city programs", icon: "⭐" },
      { num: countries, label: "Countries", icon: "🌍" },
    ];
    $("#stats").innerHTML = cards
      .map(
        (c) => `<div class="stat-card">
          <div class="stat-num">${c.num}</div>
          <div class="stat-label">${c.label}</div>
          <div class="stat-accent">${c.icon}</div>
        </div>`
      )
      .join("");
  }

  // ============================================================
  //  FILTER CONTROLS
  // ============================================================
  function buildChips(containerId, key, options) {
    const el = $(containerId);
    const counts = uniqueCounts(key);
    el.innerHTML = options
      .map((opt) => {
        const val = opt.value;
        const count = opt.count != null ? opt.count : counts.get(val) || 0;
        const dot = opt.color ? `<span class="dot" style="background:${opt.color}"></span>` : "";
        return `<button class="chip" data-key="${key}" data-val="${esc(val)}">
          ${dot}${esc(opt.label)} <span class="chip-count">${count}</span>
        </button>`;
      })
      .join("");
  }

  function buildFilters() {
    // Field
    const fieldOrder = [
      "Philosophy of Science", "Art-Tech / Immersive", "Experiential Art-Tech",
      "Experiential / Interactive Art", "Philosophy", "Design / Tech",
      "Exhibit / Experience Design", "Visual Art", "Science Communication",
      "Altruistic / Beneficial AI", "Beneficial AI",
      "Paradigms / Foundations / Complexity", "Paradigms / Complexity",
      "Cognitive Architectures / Theory of Mind / Consciousness", "Writing", "Adjacent",
    ];
    buildChips("#filter-field", "fieldCategory",
      fieldOrder.filter((f) => uniqueCounts("fieldCategory").get(f))
        .map((f) => ({ value: f, label: shortField(f), color: fieldColor(f) })));

    // Tier (+ a Global / Remote bucket for opportunities with no location tier)
    const tierOpts = [1, 2, 3, 4].map((t) => ({ value: String(t), label: "Tier " + t,
      count: PROGRAMS.filter((p) => p.tier === t).length }));
    const nGlobal = PROGRAMS.filter((p) => p.tier == null).length;
    if (nGlobal) tierOpts.push({ value: "none", label: "Global / Remote", count: nGlobal });
    buildChips("#filter-tier", "tier", tierOpts);

    // Degree
    const degCounts = uniqueCounts("degreeLevel");
    const degOrder = ["PhD / Doctorate", "MPhil", "Master (Research)", "Master's", "Certificate", "Diploma", "Other"];
    buildChips("#filter-degree", "degreeLevel",
      degOrder.filter((d) => degCounts.get(d)).map((d) => ({ value: d, label: d })));

    // Funding
    const fundOrder = ["Funded / stipend", "Free / tuition-free", "Tuition waiver",
      "Partial scholarship", "Affordable", "Varies", "Expensive"];
    const fundCounts = uniqueCounts("fundingType");
    buildChips("#filter-funding", "fundingType",
      fundOrder.filter((f) => fundCounts.get(f)).map((f) => ({ value: f, label: f })));

    // Country select
    const countries = Array.from(new Set(PROGRAMS.map((p) => p.country).filter(Boolean))).sort();
    $("#filter-country").innerHTML =
      '<option value="">All countries</option>' +
      countries.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  }

  // ============================================================
  //  SCORING PANEL
  // ============================================================
  function buildScorePanel() {
    const nw = normWeights();
    $("#weights").innerHTML = ATTRS.map((a) => {
      const raw = Number(state.weights[a.key]) || 0;
      const pct = Math.round(nw[a.key] * 100);
      return `<div class="weight-row">
        <div class="wr-top">
          <span class="wr-name">${a.label}</span>
          <span class="wr-pct">${pct}%</span>
        </div>
        <input type="range" data-weight="${a.key}" min="0" max="1" step="0.01" value="${raw}" />
      </div>`;
    }).join("");
    updateScorePanelMeta();
  }

  function updateScorePanelMeta() {
    $$(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.scoreMode));
    const hint = $("#scoreHint");
    if (hint) hint.textContent = state.scoreMode === "research"
      ? "Showing the original research scores from the dataset. Switch to My score to re-weight and override."
      : "Adjust attribute weights — every program re-ranks live. Defaults reproduce the original research scores.";
    const editedIds = new Set(
      Object.keys(state.overrides).filter((id) => state.overrides[id] && Object.keys(state.overrides[id]).length)
    );
    Object.keys(state.vibes).forEach((id) => { if ((Number(state.vibes[id]) || 0) !== 0) editedIds.add(id); });
    const n = editedIds.size;
    const btn = $("#resetOverrides");
    if (n > 0) {
      btn.hidden = false;
      btn.textContent = `Reset ${n} edited program${n > 1 ? "s" : ""}`;
    } else {
      btn.hidden = true;
    }
    const isDefault = ATTRS.every((a) => Math.abs((Number(state.weights[a.key]) || 0) - DEFAULT_WEIGHTS[a.key]) < 1e-9);
    $("#weightSum").textContent = isDefault ? "Default rubric weights" : "Custom weights (normalized to 100%)";
  }

  function refreshWeightPcts() {
    const nw = normWeights();
    $$("#weights .weight-row").forEach((row) => {
      const key = row.querySelector("input").dataset.weight;
      row.querySelector(".wr-pct").textContent = Math.round(nw[key] * 100) + "%";
    });
    updateScorePanelMeta();
  }

  // ============================================================
  //  FILTERING + SORTING
  // ============================================================
  function matches(p) {
    const k = keyOf(p);
    // dismissed view shows only hidden programs (and ignores other filters)
    if (state.viewDismissed) return state.dismissed.has(k);
    if (state.dismissed.has(k)) return false;
    if (state.viewFavorites && !state.favorites.has(k)) return false;
    if (state.field.size && !state.field.has(p.fieldCategory)) return false;
    if (state.tier.size && !state.tier.has(p.tier == null ? "none" : String(p.tier))) return false;
    if (state.degree.size && !state.degree.has(p.degreeLevel)) return false;
    if (state.funding.size && !state.funding.has(p.fundingType)) return false;
    if (state.country && p.country !== state.country) return false;
    if (activeScore(p) < state.minScore) return false;
    if (state.maxDur < 6 && p.years != null && p.years > state.maxDur) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = `${p.program} ${p.institution} ${p.city} ${p.country} ${p.field} ${p.fieldCategory} ${p.degree} ${p.funding} ${datesSearchText(p)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function sortPrograms(list) {
    const s = state.sort;
    const arr = list.slice();
    arr.sort((a, b) => {
      switch (s) {
        case "score-asc": return activeScore(a) - activeScore(b);
        case "duration-asc": return (a.years ?? 99) - (b.years ?? 99) || activeScore(b) - activeScore(a);
        case "program-asc": return a.program.localeCompare(b.program);
        case "city-asc": return (a.city || "").localeCompare(b.city || "") || activeScore(b) - activeScore(a);
        default: return activeScore(b) - activeScore(a);
      }
    });
    return arr;
  }

  // ============================================================
  //  RENDER RESULTS
  // ============================================================
  function cardHTML(p) {
    const checked = state.compare.has(p.id);
    const sc = activeScore(p);
    const edited = isCustomized(p);
    const diff = state.scoreMode === "mine" ? Math.round((sc - p.score) * 10) / 10 : 0;
    const ref = state.scoreMode === "mine" && Math.abs(diff) >= 0.1
      ? `<span class="loc" style="font-size:11px" title="Research baseline">base ${fmtScore(p.score)} · ${diff > 0 ? "+" : ""}${fmtScore(diff)}</span>` : "";
    const dismissedView = state.viewDismissed;
    const fav = state.favorites.has(keyOf(p));
    const note = hasNote(p);
    return `<article class="card ${dismissedView ? "is-dismissed" : ""} ${fav ? "is-fav" : ""}" data-id="${p.id}">
      <div class="tier-rail" style="background:${fieldColor(p.fieldCategory)}"></div>
      ${dismissedView
        ? `<button class="card-restore" data-restore="${p.id}" title="Restore">↩ Restore</button>`
        : `<div class="card-actions">
            <button class="card-fav ${fav ? "active" : ""}" data-fav="${p.id}" title="${fav ? "Remove favorite" : "Add to favorites"}" aria-label="Favorite">${fav ? "★" : "☆"}</button>
            <button class="card-dismiss" data-dismiss="${p.id}" title="Hide this program" aria-label="Hide this program">✕</button>
          </div>`}
      <div class="card-top">
        <div class="score-badge" style="background:${scoreGrad(sc)}">${fmtScore(sc)}</div>
        <div class="card-title">
          <h3>${esc(p.program)}</h3>
          <div class="inst">${esc(p.institution)}</div>
          ${ref}
        </div>
      </div>
      <div class="card-meta">
        <span class="tag field"><span class="dot" style="background:${fieldColor(p.fieldCategory)}"></span>${esc(shortField(p.fieldCategory))}</span>
        <span class="tag">${esc(p.degreeLevel)}</span>
        ${p.duration ? `<span class="tag">${esc(p.duration)}</span>` : ""}
        <span class="tag">${esc(p.fundingType)}</span>
        ${deadlinePill(p)}
        ${edited ? '<span class="tag tag-edited">✎ edited</span>' : ""}
        ${note ? '<span class="tag tag-note" title="You have notes on this program">📝 note</span>' : ""}
      </div>
      <div class="card-foot">
        <span class="loc" title="${esc(p.city)}${p.country ? ", " + esc(p.country) : ""}">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          <span>${esc(p.city)}${p.country && p.city !== p.country ? ", " + esc(p.country) : ""}</span>
        </span>
        ${dismissedView ? "" : `<button class="compare-check ${checked ? "checked" : ""}" data-compare="${p.id}" title="Add to compare">
          ${checked ? "✓ Comparing" : "+ Compare"}
        </button>`}
      </div>
    </article>`;
  }

  function shortField(f) {
    if (f === "Exhibit / Experience Design") return "Exhibit/Exp Design";
    if (f === "Experiential / Interactive Art") return "Experiential Art";
    if (f === "Experiential Art-Tech" || f === "Art-Tech / Immersive") return "Art-Tech";
    if (f === "Altruistic / Beneficial AI") return "Altruistic AI";
    if (f === "Paradigms / Foundations / Complexity" || f === "Paradigms / Complexity") return "Paradigms/Complexity";
    if (f === "Cognitive Architectures / Theory of Mind / Consciousness") return "Cognition/Consciousness";
    return f;
  }

  function tableHTML(list) {
    return `<table class="data-table">
      <thead><tr>
        <th>Score</th><th>Program</th><th>Institution</th><th>City</th>
        <th>Degree</th><th>Dur.</th><th>Field</th><th>Funding</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map((p) => `<tr data-id="${p.id}">
          <td class="t-score" style="color:${scoreColor(activeScore(p))}">${fmtScore(activeScore(p))}${isCustomized(p) ? ' <span style="color:var(--accent)">✎</span>' : ""}</td>
          <td>${esc(p.program)}${hasNote(p) ? ' <span title="Has notes">📝</span>' : ""}</td>
          <td>${esc(p.institution)}</td>
          <td>${esc(p.city)}${p.country && p.city !== p.country ? ", " + esc(p.country) : ""}</td>
          <td>${esc(p.degreeLevel)}</td>
          <td>${esc(p.duration)}</td>
          <td><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${fieldColor(p.fieldCategory)};margin-right:6px"></span>${esc(shortField(p.fieldCategory))}</td>
          <td>${esc(p.fundingType)}</td>
          <td class="t-actions">${state.viewDismissed
            ? `<button class="compare-check" data-restore="${p.id}">↩ Restore</button>`
            : `<button class="compare-check t-fav ${state.favorites.has(keyOf(p)) ? "fav-on" : ""}" data-fav="${p.id}" title="Favorite">${state.favorites.has(keyOf(p)) ? "★" : "☆"}</button>
               <button class="compare-check ${state.compare.has(p.id) ? "checked" : ""}" data-compare="${p.id}">${state.compare.has(p.id) ? "✓" : "+"}</button>
               <button class="compare-check t-dismiss" data-dismiss="${p.id}" title="Hide">✕</button>`}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  }

  function render() {
    const filtered = sortPrograms(PROGRAMS.filter(matches));
    const box = $("#results");
    const empty = $("#empty");
    const nDismissed = state.dismissed.size;
    const nFav = state.favorites.size;

    // toolbar favorites control
    const fToggle = $("#favToggle");
    if (nFav > 0 && !state.viewDismissed) {
      fToggle.hidden = false;
      fToggle.textContent = state.viewFavorites ? "★ Showing favorites" : `☆ ${nFav} favorite${nFav > 1 ? "s" : ""}`;
      fToggle.classList.toggle("fav-active", state.viewFavorites);
      fToggle.classList.toggle("ghost", !state.viewFavorites);
    } else {
      fToggle.hidden = true;
    }

    // toolbar dismissed controls
    const dToggle = $("#dismissedToggle");
    const rAll = $("#restoreAll");
    if (nDismissed > 0 && !state.viewFavorites) {
      dToggle.hidden = false;
      dToggle.textContent = state.viewDismissed ? "← Back to programs" : `🗑 ${nDismissed} hidden`;
      dToggle.classList.toggle("ghost", !state.viewDismissed);
      rAll.hidden = !state.viewDismissed;
    } else {
      dToggle.hidden = true;
      rAll.hidden = true;
    }

    if (state.viewDismissed) {
      $("#resultCount").innerHTML = `<b>${filtered.length}</b> hidden program${filtered.length === 1 ? "" : "s"}`;
    } else if (state.viewFavorites) {
      $("#resultCount").innerHTML = `<b>${filtered.length}</b> of ${nFav} favorite${nFav === 1 ? "" : "s"}`;
    } else {
      const activeTotal = PROGRAMS.length - nDismissed;
      $("#resultCount").innerHTML = `<b>${filtered.length}</b> of ${activeTotal} programs` +
        (nFav ? ` <span style="color:var(--text-faint)">· ${nFav} ★</span>` : "") +
        (nDismissed ? ` <span style="color:var(--text-faint)">· ${nDismissed} hidden</span>` : "");
    }

    if (!filtered.length) {
      box.innerHTML = "";
      empty.classList.remove("hidden");
      $("#empty p").textContent = state.viewDismissed ? "No hidden programs."
        : state.viewFavorites ? "No favorites match your filters." : "No programs match your filters.";
    } else {
      empty.classList.add("hidden");
      box.innerHTML = state.view === "grid"
        ? filtered.map(cardHTML).join("")
        : tableHTML(filtered);
    }
    box.className = "results " + (state.view === "grid" ? "grid-view" : "table-view");
    renderActiveFilters();
    syncChips();
  }

  // ============================================================
  //  ACTIVE FILTER PILLS
  // ============================================================
  function renderActiveFilters() {
    const tags = [];
    const add = (kind, label, clear) => tags.push({ kind, label, clear });
    state.field.forEach((v) => add("field", v, () => state.field.delete(v)));
    state.tier.forEach((v) => add("tier", v === "none" ? "Global / Remote" : "Tier " + v, () => state.tier.delete(v)));
    state.degree.forEach((v) => add("degree", v, () => state.degree.delete(v)));
    state.funding.forEach((v) => add("funding", v, () => state.funding.delete(v)));
    if (state.country) add("country", state.country, () => (state.country = ""));
    if (state.minScore > 0) add("score", "Score ≥ " + state.minScore, () => (state.minScore = 0));
    if (state.maxDur < 6) add("dur", "≤ " + state.maxDur + "y", () => (state.maxDur = 6));
    if (state.search) add("search", '"' + state.search + '"', () => (state.search = ""));

    const el = $("#activeFilters");
    el.innerHTML = tags
      .map((t, i) => `<span class="af-tag">${esc(t.label)} <button data-af="${i}">✕</button></span>`)
      .join("");
    $$("#activeFilters button").forEach((btn, i) => {
      btn.onclick = () => {
        tags[i].clear();
        syncControlsFromState();
        render();
      };
    });
  }

  function syncChips() {
    $$(".chip").forEach((chip) => {
      const key = chip.dataset.key;
      const val = chip.dataset.val;
      const set = key === "tier" ? state.tier
        : key === "fieldCategory" ? state.field
        : key === "degreeLevel" ? state.degree
        : key === "fundingType" ? state.funding : null;
      if (set) chip.classList.toggle("active", set.has(val));
    });
  }

  function syncControlsFromState() {
    $("#search").value = state.search;
    $("#filter-country").value = state.country;
    $("#filter-score").value = state.minScore;
    $("#scoreVal").textContent = state.minScore;
    $("#filter-duration").value = state.maxDur;
    $("#durVal").textContent = state.maxDur >= 6 ? "Any" : state.maxDur + "y";
  }

  // ============================================================
  //  DETAIL DRAWER
  // ============================================================
  function editRow(p, attr, nw) {
    const base = p.components[attr.key] ?? 0;
    const o = state.overrides[keyOf(p)] || {};
    const cur = o[attr.key] != null ? o[attr.key] : base;
    const changed = o[attr.key] != null && o[attr.key] !== base;
    const pct = Math.round((nw[attr.key] || 0) * 100);
    const contrib = ((nw[attr.key] || 0) * cur).toFixed(1);
    return `<div class="edit-row" data-attr="${attr.key}">
      <div class="er-top">
        <span class="er-name">${attr.label}<span class="er-wt">weight ${pct}%</span></span>
        <span class="er-val ${changed ? "changed" : ""}">${cur}${changed ? ` <span style="font-weight:400;color:var(--text-faint)">(was ${base})</span>` : ""}</span>
      </div>
      <input type="range" data-edit="${attr.key}" min="0" max="100" step="1" value="${cur}" />
      <div class="er-contrib">contributes ${contrib} pts</div>
    </div>`;
  }

  function openDrawer(id) {
    const p = PROGRAMS.find((x) => x.id === id);
    if (!p) return;
    const nw = normWeights();
    const tierLabel = p.tier == null ? "Global / Remote" : (TIER_LABELS[String(p.tier)] || ("Tier " + p.tier));
    const sc = myScore(p);
    const edited = isCustomized(p);
    const diff = Math.round((sc - p.score) * 10) / 10;
    $("#drawer").innerHTML = `
      <div class="drawer-hd">
        <button class="icon-btn close" id="closeDrawer" aria-label="Close">✕</button>
        <button class="icon-btn verify-btn" id="verifyBtn" title="Verify info with web search" aria-label="Verify info with web search">🔍</button>
        <div class="drawer-score">
          <div class="score-badge" id="drawerBadge" style="background:${scoreGrad(sc)}">${fmtScore(sc)}</div>
          <div>
            <div class="ds-label">${state.scoreMode === "research" ? "Research score" : "My score"}</div>
            <div class="ds-tier">${esc(tierLabel.split("—")[0].trim())}</div>
            <div class="score-compare-line" id="drawerScoreLine">
              <span class="research-ref">Research ${fmtScore(p.score)}</span>
              <span class="delta ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff === 0 ? "" : (diff > 0 ? "▲ +" : "▼ ") + fmtScore(Math.abs(diff))}</span>
            </div>
          </div>
        </div>
        <h2>${esc(p.program)}</h2>
        <div class="d-inst">${esc(p.institution)}</div>
      </div>
      <div class="drawer-body">
        <div class="d-section">
          <h4>Key facts</h4>
          <div class="d-facts">
            <div class="d-fact"><div class="k">Location</div><div class="v">${esc(p.city)}${p.country && p.city !== p.country ? ", " + esc(p.country) : ""}</div></div>
            <div class="d-fact"><div class="k">Field</div><div class="v">${esc(p.field || p.fieldCategory)}</div></div>
            <div class="d-fact"><div class="k">Degree</div><div class="v">${esc(p.degree || p.degreeLevel)}</div></div>
            <div class="d-fact"><div class="k">Duration</div><div class="v">${esc(p.duration || "—")}</div></div>
            <div class="d-fact"><div class="k">Language</div><div class="v">${esc(p.language || "English")}</div></div>
            <div class="d-fact"><div class="k">Funding</div><div class="v">${esc(p.fundingType)}</div></div>
          </div>
        </div>
        <div class="d-section">
          <h4>My notes <span class="note-status" id="noteStatus"></span></h4>
          <textarea id="progNotes" class="notes-area" placeholder="Add your own notes — deadlines, contacts, pros &amp; cons, reminders… (saved on this device)">${esc(state.notes[keyOf(p)] || "")}</textarea>
        </div>
        <div class="d-section">
          <h4>
            Score components — drag to override
            <button class="link-btn" id="resetProgOverride" ${edited ? "" : "hidden"} style="float:right;text-transform:none">Reset to default</button>
          </h4>
          <div id="editRows">${ATTRS.map((a) => editRow(p, a, nw)).join("")}</div>
          <p class="score-hint" style="margin:6px 0 0">Overrides are saved on this device. A fixed baseline adjustment of <b>${(p.baseAdjust >= 0 ? "+" : "") + fmtScore(p.baseAdjust)}</b> (expert judgment from the research) is also applied.</p>
        </div>
        <div class="d-section">
          <h4>Vibes — bonus / penalty</h4>
          <div class="vibes-row">
            <input type="range" id="vibesSlider" min="-${VIBES_MAX}" max="${VIBES_MAX}" step="1" value="${vibesOf(p)}" />
            <span class="vibes-val" id="vibesVal">${fmtVibes(vibesOf(p))}</span>
          </div>
          <p class="score-hint" style="margin:6px 0 0">Your personal gut-feel adjustment (−${VIBES_MAX} to +${VIBES_MAX}), added straight on top of the score.</p>
        </div>
        ${datesDrawerHTML(p)}
        <div class="d-section">
          <h4>Funding / tuition detail</h4>
          <div class="funding-note">${esc(p.funding || "Not specified — verify on the official page.")}</div>
        </div>
        <div class="drawer-actions">
          <button class="btn drawer-fav ${state.favorites.has(keyOf(p)) ? "fav-active" : ""}" id="drawerFav">${state.favorites.has(keyOf(p)) ? "★ Favorited" : "☆ Favorite"}</button>
          <button class="btn ${state.compare.has(p.id) ? "primary" : ""}" id="drawerCompare">${state.compare.has(p.id) ? "✓ In compare" : "+ Compare"}</button>
          ${p.link ? `<a class="btn primary" href="${esc(p.link)}" target="_blank" rel="noopener">Official ↗</a>` : ""}
        </div>
        <button class="btn btn-dismiss" id="drawerDismiss">🗑 Hide this program</button>
      </div>`;
    const pk = keyOf(p);
    $("#drawer").classList.remove("hidden");
    $("#drawerOverlay").classList.remove("hidden");
    $("#closeDrawer").onclick = closeDrawer;
    $("#verifyBtn").onclick = () => openVerify(p.id);
    $("#drawerCompare").onclick = () => { toggleCompare(p.id); openDrawer(id); render(); };
    $("#drawerFav").onclick = () => { toggleFavorite(p.id); openDrawer(id); };
    $("#drawerDismiss").onclick = () => { dismiss(p.id); closeDrawer(); };
    $("#resetProgOverride").onclick = () => { delete state.overrides[pk]; delete state.vibes[pk]; save("gs-overrides", state.overrides); save("gs-vibes", state.vibes); openDrawer(id); afterScoreChange(); };

    // per-program notes (autosave, debounced) — keyed by stable content key
    const notesEl = $("#progNotes");
    if (notesEl) {
      let noteTimer, savedTimer;
      const flashSaved = () => {
        const s = $("#noteStatus");
        if (!s) return;
        s.textContent = "✓ saved";
        s.classList.add("show");
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => s.classList.remove("show"), 1400);
      };
      const commit = () => {
        const val = notesEl.value.trim();
        const had = !!(state.notes[pk] && state.notes[pk].trim());
        if (val) state.notes[pk] = notesEl.value;
        else delete state.notes[pk];
        saveNotes();
        flashSaved();
        if (had !== !!val) render(); // toggle the card note indicator only when presence flips
      };
      notesEl.addEventListener("input", () => { clearTimeout(noteTimer); noteTimer = setTimeout(commit, 400); });
      notesEl.addEventListener("blur", () => { clearTimeout(noteTimer); commit(); });
    }

    // vibes bonus slider
    const vibesSlider = $("#vibesSlider");
    if (vibesSlider) vibesSlider.addEventListener("input", (e) => {
      const val = Math.max(-VIBES_MAX, Math.min(VIBES_MAX, +e.target.value));
      if (val === 0) delete state.vibes[pk];
      else state.vibes[pk] = val;
      save("gs-vibes", state.vibes);
      $("#vibesVal").textContent = fmtVibes(val);
      updateDrawerScore(p);
      afterScoreChange();
    });

    // live component editing
    $$("#editRows input[data-edit]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const key = e.target.dataset.edit;
        const val = +e.target.value;
        const o = state.overrides[pk] || (state.overrides[pk] = {});
        if (val === p.components[key]) delete o[key];
        else o[key] = val;
        if (!Object.keys(o).length) delete state.overrides[pk];
        save("gs-overrides", state.overrides);
        updateDrawerScore(p);
        afterScoreChange();
      });
    });
  }

  function updateDrawerScore(p) {
    const nw = normWeights();
    const sc = myScore(p);
    const badge = $("#drawerBadge");
    if (badge) { badge.textContent = fmtScore(sc); badge.style.background = scoreGrad(sc); }
    const diff = Math.round((sc - p.score) * 10) / 10;
    const line = $("#drawerScoreLine");
    if (line) {
      line.querySelector(".delta").className = "delta " + (diff > 0 ? "up" : diff < 0 ? "down" : "");
      line.querySelector(".delta").textContent = diff === 0 ? "" : (diff > 0 ? "▲ +" : "▼ ") + fmtScore(Math.abs(diff));
    }
    // refresh the per-row value labels + contributions + reset button
    $$("#editRows .edit-row").forEach((row) => {
      const key = row.dataset.attr;
      const o = state.overrides[keyOf(p)] || {};
      const base = p.components[key] ?? 0;
      const cur = o[key] != null ? o[key] : base;
      const changed = o[key] != null && o[key] !== base;
      const valEl = row.querySelector(".er-val");
      valEl.className = "er-val " + (changed ? "changed" : "");
      valEl.innerHTML = `${cur}${changed ? ` <span style="font-weight:400;color:var(--text-faint)">(was ${base})</span>` : ""}`;
      row.querySelector(".er-contrib").textContent = `contributes ${((nw[key] || 0) * cur).toFixed(1)} pts`;
    });
    const rb = $("#resetProgOverride");
    if (rb) rb.hidden = !isCustomized(p);
  }

  // called whenever any score input changes anything that affects ranking
  function afterScoreChange() {
    updateScorePanelMeta();
    render();
  }
  function closeDrawer() {
    $("#drawer").classList.add("hidden");
    $("#drawerOverlay").classList.add("hidden");
  }

  // ============================================================
  //  COMPARE
  // ============================================================
  function toggleCompare(id) {
    if (state.compare.has(id)) state.compare.delete(id);
    else {
      if (state.compare.size >= 4) {
        flashTray("Compare up to 4 at a time");
        return;
      }
      state.compare.add(id);
    }
    renderTray();
  }

  let flashTimer;
  function flashTray(msg) {
    const tray = $("#compareTray");
    tray.classList.remove("hidden");
    const inner = $(".compare-tray-inner");
    inner.dataset.msg = msg;
    const note = inner.querySelector(".tray-note") || (() => {
      const n = document.createElement("div");
      n.className = "tray-note";
      n.style.cssText = "font-size:12px;color:var(--warn);padding:0 6px";
      inner.prepend(n);
      return n;
    })();
    note.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { note.remove(); renderTray(); }, 1800);
  }

  function renderTray() {
    const tray = $("#compareTray");
    const ids = Array.from(state.compare);
    if (!ids.length) { tray.classList.add("hidden"); return; }
    tray.classList.remove("hidden");
    $("#compareItems").innerHTML = ids
      .map((id) => {
        const p = PROGRAMS.find((x) => x.id === id);
        return `<span class="compare-pill">${esc(truncate(p.program, 26))}<button data-rm="${id}">✕</button></span>`;
      })
      .join("");
    $("#compareCount").textContent = ids.length;
    $$("#compareItems [data-rm]").forEach((b) => {
      b.onclick = () => { state.compare.delete(+b.dataset.rm); renderTray(); render(); };
    });
  }
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  function openCompareModal() {
    const ids = Array.from(state.compare);
    if (ids.length < 2) { flashTray("Pick at least 2 programs to compare"); return; }
    const progs = ids.map((id) => PROGRAMS.find((x) => x.id === id));

    const best = (key, hi = true) => {
      const vals = progs.map((p) => key(p)).filter((v) => v != null);
      if (!vals.length) return null;
      return hi ? Math.max(...vals) : Math.min(...vals);
    };
    const bestScore = best((p) => activeScore(p));
    const bestDur = best((p) => p.years, false);
    const modeLabel = state.scoreMode === "research" ? "Research score" : "My score";

    const rows = [
      { label: modeLabel, cell: (p) => `<span class="cmp-prog ${activeScore(p) === bestScore ? "cmp-best" : ""}" style="color:${scoreColor(activeScore(p))}">${fmtScore(activeScore(p))}</span>${state.scoreMode === "mine" && Math.abs(activeScore(p) - p.score) >= 0.1 ? `<div style="font-size:11px;color:var(--text-faint)">research ${fmtScore(p.score)}</div>` : ""}` },
      { label: "Institution", cell: (p) => esc(p.institution) },
      { label: "Location", cell: (p) => esc(p.city) + (p.country && p.city !== p.country ? ", " + esc(p.country) : "") },
      { label: "Tier", cell: (p) => tierName(p.tier) },
      { label: "Field", cell: (p) => `<span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${fieldColor(p.fieldCategory)};margin-right:5px"></span>${esc(p.field || p.fieldCategory)}` },
      { label: "Degree", cell: (p) => esc(p.degree || p.degreeLevel) },
      { label: "Duration", cell: (p) => `<span class="${p.years === bestDur ? "cmp-best" : ""}">${esc(p.duration || "—")}</span>` },
      { label: "Language", cell: (p) => esc(p.language || "English") },
      { label: "Funding detail", cell: (p) => `<span style="font-size:12px;color:var(--text-dim)">${esc(p.funding || "—")}</span>` },
      { label: "Field fit", cell: (p) => bar(effComponents(p).field) },
      { label: "Location fit", cell: (p) => bar(effComponents(p).location) },
      { label: "Funding fit", cell: (p) => bar(effComponents(p).funding) },
      { label: "Duration fit", cell: (p) => bar(effComponents(p).duration) },
      { label: "Accreditation fit", cell: (p) => bar(effComponents(p).accred) },
      { label: "Vibes", cell: (p) => { const v = vibesOf(p); if (v === 0) return '<span style="color:var(--text-faint)">0</span>'; return `<span style="color:${v > 0 ? "var(--accent)" : "var(--warn)"}">${fmtVibes(v)}</span>`; } },
      { label: "Link", cell: (p) => p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">Official ↗</a>` : "—" },
    ];

    function bar(v) {
      v = v || 0;
      return `${v}<div class="mini-bar"><div style="width:${v}%"></div></div>`;
    }

    $("#compareBody").innerHTML = `<table class="cmp-table">
      <thead><tr><th class="row-label"></th>${progs.map((p) => `<th><div class="cmp-prog">${esc(p.program)}</div></th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td class="row-label">${r.label}</td>${progs.map((p) => `<td>${r.cell(p)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`;
    $("#compareModal").classList.remove("hidden");
  }

  // ============================================================
  //  VERIFY WITH WEB SEARCH
  //  The app is static (file://, no backend) so it can't crawl the web itself.
  //  Instead the 🔍 button (a) opens one-click web searches for manual webnav,
  //  (b) generates a copy-ready task prompt for an AI agent that DOES have web
  //  search + navigation (e.g. Cursor), and (c) accepts the agent's JSON findings,
  //  shows a field-by-field diff (changed / missing), and lets you apply the
  //  verified data locally (persisted) and/or copy it back to the canonical store.
  // ============================================================

  // Canonical author-supplied fields (the ones add_program.py accepts + a few derived
  // ones worth verifying). Used for the diff + the corrected-record JSON.
  const VERIFY_FIELDS = [
    ["program", "Program name"],
    ["institution", "Institution"],
    ["city", "City"],
    ["country", "Country"],
    ["degree", "Degree / type"],
    ["duration", "Duration"],
    ["language", "Language (H1 gate)"],
    ["funding", "Funding / tuition detail"],
    ["field", "Field / subfield"],
    ["tier", "Location tier"],
    ["link", "Official link"],
    ["score", "Research score"],
  ];
  // Extra keys an agent may return that we still accept when applying.
  const VERIFY_EXTRA = ["fieldCategory", "fundingType", "degreeLevel", "years", "components", "dates", "baseAdjust"];

  // Apply any stored verified edits on top of the in-memory canonical records.
  // Identity (keyOf) is frozen via __key, so this never detaches favorites/notes.
  function applyDataEdits() {
    PROGRAMS.forEach((p) => {
      const e = state.dataEdits[keyOf(p)];
      if (e && typeof e === "object") Object.assign(p, e);
    });
  }
  function hasVerifiedEdits(p) {
    const e = state.dataEdits[keyOf(p)];
    return !!(e && Object.keys(e).length);
  }

  const normCmp = (v) => (v == null ? "" : String(v).trim());
  const isEmptyVal = (v) => v == null || String(v).trim() === "";

  function searchUrl(q) { return "https://www.google.com/search?q=" + encodeURIComponent(q); }

  // The task an AI agent runs (it has the web tools; the browser app doesn't).
  function buildVerifyPrompt(p) {
    const rec = {};
    ["id", ...VERIFY_FIELDS.map((f) => f[0])].forEach((k) => { if (p[k] !== undefined) rec[k] = p[k]; });
    if (p.dates) rec.dates = p.dates;
    const recJson = JSON.stringify(rec, null, 2);
    return [
      "You are verifying ONE graduate-program / opportunity record for the GradSearch dataset.",
      "Use web search AND open the official program page(s) to confirm every field below against",
      "primary sources (prefer the institution's own site). Today's context: check the CURRENT intake.",
      "",
      "RECORD TO VERIFY:",
      "```json",
      recJson,
      "```",
      "",
      "DO THIS:",
      "1. Confirm the official `link` still resolves and points to THIS program; fix it if moved.",
      "2. Verify each field: program name, institution, city/country, degree/type, duration,",
      "   language of instruction (HARD GATE: must be English OR teach the local language —",
      "   if neither, say DISQUALIFY), funding/tuition (amounts, stipend, fees, waivers), and",
      "   application deadline / intake (put deadlines in a `dates` object if you find them).",
      "3. Fill any MISSING field you can source. Flag anything you could not verify.",
      "4. Re-score per the model: Total = 0.35·Field + 0.30·Location + 0.20·Funding +",
      "   0.10·Duration + 0.05·Accreditation (scales in docs/qualifications.md). Update `score`.",
      "",
      "RETURN, in this order:",
      "A. A short bullet list of CHANGES (field: old → new) and anything you could not confirm,",
      "   each with the source URL you used.",
      "B. The corrected FULL record as a single JSON object in a ```json fenced block — same keys",
      "   as above (KEEP the same `id`), so it can be pasted back into the app or used to update",
      "   app/data.js. Use null/empty only when truly unknown.",
      "",
      "If you have repo access, also update the matching record (same `id`) in app/data.js in place",
      "(do NOT append a duplicate), then re-derive its fields via scripts/add_program.py rules.",
    ].join("\n");
  }

  function openVerify(id) {
    const p = PROGRAMS.find((x) => x.id === id);
    if (!p) return;
    state.verifyId = id;
    const prompt = buildVerifyPrompt(p);
    const q = `${p.program} ${p.institution}`.trim();
    const links = [
      { label: "🔎 Program (Google)", url: searchUrl(`${q} ${p.city || ""}`.trim()) },
      { label: "💰 Funding / tuition", url: searchUrl(`${q} tuition funding scholarship stipend cost`) },
      { label: "⏰ Deadline / intake", url: searchUrl(`${q} application deadline intake`) },
      { label: "🌐 Language of instruction", url: searchUrl(`${q} language of instruction English taught`) },
    ];
    if (p.link) links.unshift({ label: "↗ Official page", url: p.link, primary: true });

    $("#verifyBody").innerHTML = `
      <div class="verify-wrap">
        <div class="verify-prog">
          <div class="verify-prog-name">${esc(p.program)}</div>
          <div class="verify-prog-inst">${esc(p.institution)}${p.city ? " · " + esc(p.city) : ""}${p.country && p.city !== p.country ? ", " + esc(p.country) : ""}</div>
          ${hasVerifiedEdits(p) ? `<div class="verify-applied-flag">✓ Verified edits applied locally <button class="link-btn" id="verifyRevert">Revert</button></div>` : ""}
        </div>

        <div class="verify-step">
          <h4><span class="vstep-n">1</span> Look it up on the web</h4>
          <p class="score-hint">Open these in new tabs to webnav the official source yourself.</p>
          <div class="verify-links">
            ${links.map((l) => `<a class="btn ${l.primary ? "primary" : "ghost"}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}
          </div>
        </div>

        <div class="verify-step">
          <h4><span class="vstep-n">2</span> Hand it to an AI agent with web access</h4>
          <p class="score-hint">Copy this task into Cursor (or any agent that can search + browse). It returns a corrected JSON record you can paste below.</p>
          <textarea id="verifyPrompt" class="verify-ta mono" rows="10" readonly>${esc(prompt)}</textarea>
          <div class="verify-actions">
            <button class="btn" id="copyVerifyPrompt">⧉ Copy task prompt</button>
            <button class="btn ghost" id="copyVerifyRecord">⧉ Copy current record JSON</button>
          </div>
        </div>

        <div class="verify-step">
          <h4><span class="vstep-n">3</span> Paste the agent's JSON findings</h4>
          <p class="score-hint">Paste the corrected JSON object the agent returned. You'll see exactly what changed or was filled in.</p>
          <textarea id="verifyInput" class="verify-ta mono" rows="7" placeholder='{ "id": ${p.id}, "funding": "…", "score": 88, … }'></textarea>
          <div class="verify-actions">
            <button class="btn primary" id="checkVerify">Check differences</button>
            <span class="verify-parse-msg" id="verifyParseMsg"></span>
          </div>
        </div>

        <div id="verifyDiff" class="verify-diff hidden"></div>
      </div>`;

    $("#verifyModal").classList.remove("hidden");

    const revert = $("#verifyRevert");
    if (revert) revert.onclick = () => {
      delete state.dataEdits[keyOf(p)];
      saveDataEdits();
      // Re-apply remaining edits from a clean reload of base values would require the
      // original record; since data.js is untouched we just drop the override object
      // and reload the page-state by re-deriving from what's left. Simplest correct
      // behavior: reload so the canonical (unedited) values come back.
      if (hooks.onReload) hooks.onReload(); else location.reload();
    };

    $("#copyVerifyPrompt").onclick = () => copyText(prompt, $("#copyVerifyPrompt"), "⧉ Copy task prompt");
    $("#copyVerifyRecord").onclick = () => {
      const rec = {}; ["id", ...VERIFY_FIELDS.map((f) => f[0])].forEach((k) => { if (p[k] !== undefined) rec[k] = p[k]; });
      if (p.dates) rec.dates = p.dates;
      copyText(JSON.stringify(rec, null, 2), $("#copyVerifyRecord"), "⧉ Copy current record JSON");
    };
    $("#checkVerify").onclick = () => runVerifyDiff(p);
  }

  function parseIncoming(raw) {
    const txt = (raw || "").trim();
    if (!txt) return { error: "Paste the agent's JSON first." };
    // tolerate a ```json fenced block or surrounding prose: grab the outermost {...}
    let jsonStr = txt;
    const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) jsonStr = fence[1].trim();
    if (jsonStr[0] !== "{" && jsonStr[0] !== "[") {
      const s = jsonStr.indexOf("{"), e = jsonStr.lastIndexOf("}");
      if (s !== -1 && e > s) jsonStr = jsonStr.slice(s, e + 1);
    }
    let data;
    try { data = JSON.parse(jsonStr); }
    catch (err) { return { error: "Couldn't parse JSON: " + err.message }; }
    if (Array.isArray(data)) data = data[0];
    if (!data || typeof data !== "object") return { error: "Expected a JSON object." };
    return { data };
  }

  function runVerifyDiff(p) {
    const msg = $("#verifyParseMsg");
    const { data, error } = parseIncoming($("#verifyInput").value);
    if (error) { msg.textContent = error; msg.className = "verify-parse-msg err"; $("#verifyDiff").classList.add("hidden"); return; }
    msg.textContent = ""; msg.className = "verify-parse-msg";

    const rows = [];
    let nChanged = 0, nAdded = 0;
    VERIFY_FIELDS.forEach(([k, label]) => {
      if (!(k in data)) { rows.push({ k, label, status: "missing-from-reply", cur: p[k] }); return; }
      const nv = data[k], cv = p[k];
      if (normCmp(cv) === normCmp(nv)) { rows.push({ k, label, status: "same", cur: cv, nv }); return; }
      if (isEmptyVal(cv)) { rows.push({ k, label, status: "added", cur: cv, nv }); nAdded++; }
      else { rows.push({ k, label, status: "changed", cur: cv, nv }); nChanged++; }
    });
    // extra recognized keys the agent may have enriched
    const extras = VERIFY_EXTRA.filter((k) => k in data && JSON.stringify(data[k]) !== JSON.stringify(p[k]));

    const cell = (v) => v == null || v === "" ? '<span class="vd-empty">— empty —</span>' : esc(typeof v === "object" ? JSON.stringify(v) : String(v));
    const rowHTML = rows.map((r) => {
      const tag = r.status === "changed" ? '<span class="vd-badge vd-changed">changed</span>'
        : r.status === "added" ? '<span class="vd-badge vd-added">filled in</span>'
        : r.status === "missing-from-reply" ? '<span class="vd-badge vd-skip">not in reply</span>'
        : '<span class="vd-badge vd-same">unchanged</span>';
      const showNew = r.status === "changed" || r.status === "added";
      return `<tr class="vd-${r.status}">
        <td class="vd-k">${r.label}${tag}</td>
        <td class="vd-cur">${cell(r.cur)}</td>
        <td class="vd-new">${showNew ? cell(r.nv) : '<span class="vd-empty">·</span>'}</td>
      </tr>`;
    }).join("");

    const extrasHTML = extras.length
      ? `<p class="verify-extra-note">Agent also enriched derived field(s): <b>${extras.map(esc).join(", ")}</b> — these will be applied too.</p>`
      : "";

    const summary = (nChanged || nAdded || extras.length)
      ? `<b>${nChanged}</b> changed · <b>${nAdded}</b> filled in${extras.length ? ` · <b>${extras.length}</b> derived` : ""}`
      : "No differences — the record already matches the agent's findings.";

    $("#verifyDiff").innerHTML = `
      <h4>Suggested changes</h4>
      <p class="verify-summary">${summary}</p>
      <div class="verify-diff-scroll">
        <table class="vd-table">
          <thead><tr><th>Field</th><th>Current (in app)</th><th>Suggested</th></tr></thead>
          <tbody>${rowHTML}</tbody>
        </table>
      </div>
      ${extrasHTML}
      ${(nChanged || nAdded || extras.length) ? `
      <div class="verify-actions verify-apply-row">
        <button class="btn primary" id="applyVerify">✓ Apply verified data (this device)</button>
        <button class="btn" id="copyMerged">⧉ Copy corrected record JSON</button>
      </div>
      <p class="score-hint">Apply updates the entry in your browser only (saved locally, never edits <code>data.js</code>). To make it permanent, paste the corrected JSON into the matching record in <code>app/data.js</code> (keep the same <code>id</code>) or have your agent update it directly.</p>` : ""}`;
    $("#verifyDiff").classList.remove("hidden");

    // build the patch: changed/added canonical fields + any recognized extras
    const patch = {};
    rows.forEach((r) => { if (r.status === "changed" || r.status === "added") patch[r.k] = r.nv; });
    extras.forEach((k) => { patch[k] = data[k]; });

    const applyBtn = $("#applyVerify");
    if (applyBtn) applyBtn.onclick = () => {
      const k = keyOf(p);
      state.dataEdits[k] = Object.assign({}, state.dataEdits[k], patch);
      saveDataEdits();
      Object.assign(p, patch);              // reflect immediately everywhere (cards/table/drawer)
      renderStats();
      render();
      openDrawer(p.id);                     // refresh the open drawer with new values
      applyBtn.textContent = "✓ Applied";
      applyBtn.disabled = true;
    };
    const copyBtn = $("#copyMerged");
    if (copyBtn) copyBtn.onclick = () => {
      const merged = {}; ["id", ...VERIFY_FIELDS.map((f) => f[0])].forEach((kk) => { if (p[kk] !== undefined) merged[kk] = p[kk]; });
      Object.assign(merged, patch);
      copyText(JSON.stringify(merged, null, 2), copyBtn, "⧉ Copy corrected record JSON");
    };
  }

  function closeVerify() { state.verifyId = null; $("#verifyModal").classList.add("hidden"); }

  // clipboard helper with graceful fallback for file:// where navigator.clipboard may be blocked
  function copyText(text, btn, restoreLabel) {
    const done = () => { if (btn) { const t = btn.textContent; btn.textContent = "✓ Copied"; setTimeout(() => { btn.textContent = restoreLabel || t; }, 1300); } };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); return; }
    } catch (_) {}
    fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta); done();
    } catch (_) {}
  }

  // ============================================================
  //  EVENTS
  // ============================================================
  function bindEvents() {
    // search
    let st;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(st);
      const v = e.target.value;
      st = setTimeout(() => { state.search = v.trim(); render(); }, 130);
    });
    const onKey = (e) => {
      if (!root.isConnected) return;
      const scope = root.getRootNode();
      const host = scope && scope.host;
      const focused = (scope && scope.activeElement) || document.activeElement;
      const focusInApp = !!(focused && (focused === root || root.contains(focused)));
      const ae = document.activeElement;
      const focusIdle = !ae || ae === document.body || ae === document.documentElement || ae === host;
      if (!focusInApp && !focusIdle) return;
      const tag = focused && focused.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
        e.preventDefault();
        const search = $("#search");
        if (search) search.focus();
      }
      if (e.key === "Escape") {
        const drawerOpen = $("#drawer") && !$("#drawer").classList.contains("hidden");
        const verifyOpen = $("#verifyModal") && !$("#verifyModal").classList.contains("hidden");
        const compareOpen = $("#compareModal") && !$("#compareModal").classList.contains("hidden");
        if (drawerOpen || verifyOpen || compareOpen) {
          e.preventDefault();
          e.stopPropagation();
          closeDrawer();
          closeVerify();
          $("#compareModal").classList.add("hidden");
        }
      }
    };
    document.addEventListener("keydown", onKey);
    detachKey = () => document.removeEventListener("keydown", onKey);

    // chip filters (delegation)
    $("#sidebar").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const key = chip.dataset.key, val = chip.dataset.val;
      const set = key === "tier" ? state.tier
        : key === "fieldCategory" ? state.field
        : key === "degreeLevel" ? state.degree
        : key === "fundingType" ? state.funding : null;
      if (!set) return;
      set.has(val) ? set.delete(val) : set.add(val);
      render();
    });

    $("#filter-country").addEventListener("change", (e) => { state.country = e.target.value; render(); });
    $("#filter-score").addEventListener("input", (e) => {
      state.minScore = +e.target.value; $("#scoreVal").textContent = state.minScore; render();
    });
    $("#filter-duration").addEventListener("input", (e) => {
      state.maxDur = +e.target.value;
      $("#durVal").textContent = state.maxDur >= 6 ? "Any" : state.maxDur + "y"; render();
    });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });

    // ---- scoring panel ----
    $("#weights").addEventListener("input", (e) => {
      const inp = e.target.closest("[data-weight]");
      if (!inp) return;
      state.weights[inp.dataset.weight] = +inp.value;
      save("gs-weights", state.weights);
      refreshWeightPcts();
      render();
    });
    $$(".mode-btn").forEach((b) => {
      b.onclick = () => {
        state.scoreMode = b.dataset.mode;
        save("gs-scoremode", state.scoreMode);
        updateScorePanelMeta();
        $("#scoreHint").textContent = state.scoreMode === "research"
          ? "Showing the original research scores from the dataset. Switch to My score to re-weight and override."
          : "Adjust attribute weights — every program re-ranks live. Defaults reproduce the original research scores.";
        render();
      };
    });
    $("#resetWeights").onclick = () => {
      state.weights = { ...DEFAULT_WEIGHTS };
      save("gs-weights", state.weights);
      buildScorePanel();
      render();
    };
    $("#resetOverrides").onclick = () => {
      state.overrides = {};
      state.vibes = {};
      save("gs-overrides", state.overrides);
      save("gs-vibes", state.vibes);
      updateScorePanelMeta();
      render();
    };
    $("#scorePanelToggle").onclick = () => {
      const body = $("#scorePanelBody");
      const hidden = body.classList.toggle("collapsed");
      $("#scorePanelToggle").textContent = hidden ? "Show" : "Hide";
      $("#scorePanelToggle").setAttribute("aria-expanded", String(!hidden));
    };

    // reset
    const reset = () => {
      state.search = ""; state.country = ""; state.minScore = 0; state.maxDur = 6;
      state.field.clear(); state.tier.clear(); state.degree.clear(); state.funding.clear();
      syncControlsFromState(); render();
    };
    $("#resetFilters").onclick = reset;
    $("#emptyReset").onclick = reset;

    // view toggle
    $$(".view-btn").forEach((b) => {
      b.onclick = () => {
        $$(".view-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        state.view = b.dataset.view;
        render();
      };
    });

    // results clicks (delegation: open drawer / compare / dismiss / restore / favorite)
    $("#results").addEventListener("click", (e) => {
      const favBtn = e.target.closest("[data-fav]");
      if (favBtn) { e.stopPropagation(); toggleFavorite(+favBtn.dataset.fav); return; }
      const dis = e.target.closest("[data-dismiss]");
      if (dis) { e.stopPropagation(); dismiss(+dis.dataset.dismiss); return; }
      const res = e.target.closest("[data-restore]");
      if (res) { e.stopPropagation(); restore(+res.dataset.restore); return; }
      const cmp = e.target.closest("[data-compare]");
      if (cmp) { e.stopPropagation(); toggleCompare(+cmp.dataset.compare); render(); return; }
      const card = e.target.closest("[data-id]");
      if (card) openDrawer(+card.dataset.id);
    });

    // toolbar dismissed controls
    $("#dismissedToggle").onclick = () => { state.viewDismissed = !state.viewDismissed; render(); };
    $("#restoreAll").onclick = restoreAll;
    $("#favToggle").onclick = () => { state.viewFavorites = !state.viewFavorites; render(); };

    // drawer + modal close
    $("#drawerOverlay").onclick = closeDrawer;
    $("#clearCompare").onclick = () => { state.compare.clear(); renderTray(); render(); };
    $("#openCompare").onclick = openCompareModal;
    $("#closeCompare").onclick = () => $("#compareModal").classList.add("hidden");
    $("#compareModal").addEventListener("click", (e) => {
      if (e.target.id === "compareModal") $("#compareModal").classList.add("hidden");
    });

    // verify modal close (backdrop click + ✕)
    $("#closeVerify").onclick = closeVerify;
    $("#verifyModal").addEventListener("click", (e) => { if (e.target.id === "verifyModal") closeVerify(); });

    // theme
    $("#themeToggle").onclick = () => {
      const cur = root.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("gs-theme", next); } catch (_) {}
    };

    // mobile sidebar
    $("#filterToggle").onclick = () => $("#sidebar").classList.toggle("open");
    $("#sidebar").addEventListener("click", (e) => {
      if (window.innerWidth <= 900 && e.target.closest(".chip")) {
        /* keep open while filtering */
      }
    });
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    try {
      const saved = localStorage.getItem("gs-theme");
      if (saved) root.setAttribute("data-theme", saved);
    } catch (_) {}
    if (!PROGRAMS.length) {
      $("#results").innerHTML = '<p style="padding:40px;color:var(--text-dim)">No data loaded. <code>app/data.js</code> is the canonical store — add programs with <code>python3 scripts/add_program.py</code> or by hand-editing it.</p>';
      return;
    }
    // Apply any locally-saved verified corrections on top of the canonical records
    // (must run before the first render so cards/table/search reflect them).
    applyDataEdits();
    // Re-persist the migrated (legacy-id -> stable-key) and orphan-pruned state so
    // the cleanup sticks and old numeric ids never resurface.
    saveFavorites();
    saveDismissed();
    saveNotes();
    saveDataEdits();
    save("gs-overrides", state.overrides);
    save("gs-vibes", state.vibes);
    renderStats();
    buildFilters();
    buildScorePanel();
    syncControlsFromState();
    bindEvents();
    render();
  }


  init();
  return () => {
    detachKey();
  };
}
