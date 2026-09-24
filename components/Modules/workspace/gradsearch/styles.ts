/** Scoped GradSearch stylesheet (shadow root). Port of gradsearch/app/styles.css. */
export const GRADSEARCH_CSS = `
/* ============================================================
   GradSearch — Program Explorer styles
   ============================================================ */
.gs-app {
  --radius: 14px;
  --radius-sm: 9px;
  --shadow: 0 10px 30px -12px rgba(0,0,0,.45);
  --shadow-sm: 0 2px 8px -2px rgba(0,0,0,.25);
  --ring: 0 0 0 3px var(--accent-ring);
  --maxw: 1500px;
  --sidebar-w: 270px;
  --transition: .18s cubic-bezier(.4,0,.2,1);
  font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

/* ---------- THEMES ---------- */
.gs-app[data-theme="dark"] {
  --bg: #0b0e14;
  --bg-elev: #121722;
  --bg-elev2: #19202e;
  --bg-hover: #202838;
  --border: #232c3d;
  --border-soft: #1a2230;
  --text: #e8edf6;
  --text-dim: #97a2b6;
  --text-faint: #687288;
  --accent: #6ea8fe;
  --accent-2: #8b7bff;
  --accent-ring: rgba(110,168,254,.28);
  --good: #4ade80;
  --warn: #fbbf24;
  --bad: #fb7185;
  --chip-bg: #19202e;
  color-scheme: dark;
}
.gs-app[data-theme="light"] {
  --bg: #f4f6fb;
  --bg-elev: #ffffff;
  --bg-elev2: #ffffff;
  --bg-hover: #eef2fb;
  --border: #e2e7f0;
  --border-soft: #eef1f7;
  --text: #1a2030;
  --text-dim: #5a6678;
  --text-faint: #8b97a9;
  --accent: #2f6bff;
  --accent-2: #7a5cff;
  --accent-ring: rgba(47,107,255,.22);
  --good: #16a34a;
  --warn: #d97706;
  --bad: #e11d48;
  --chip-bg: #f0f3fa;
  --shadow: 0 10px 30px -14px rgba(20,40,80,.28);
  --shadow-sm: 0 2px 8px -3px rgba(20,40,80,.18);
  color-scheme: light;
}

* { box-sizing: border-box; }
.gs-app {
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  padding-bottom: 90px;
}
h1,h2,h3 { margin: 0; font-weight: 700; letter-spacing: -.01em; }
button { font-family: inherit; cursor: pointer; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ============================================================
   TOP BAR
   ============================================================ */
.topbar {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 18px;
  padding: 12px 22px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
.brand-mark {
  width: 38px; height: 38px; display: grid; place-items: center;
  border-radius: 11px; font-size: 18px; color: white;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-sm);
}
.brand-text h1 { font-size: 17px; line-height: 1.1; }
.brand-text p { margin: 0; font-size: 11.5px; color: var(--text-dim); }

.search-wrap {
  flex: 1; max-width: 560px; margin: 0 auto; position: relative;
  display: flex; align-items: center;
}
.search-icon { position: absolute; left: 14px; width: 17px; height: 17px; color: var(--text-faint); }
#search {
  width: 100%; padding: 11px 40px 11px 40px;
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: 11px; color: var(--text); font-size: 14px;
  transition: var(--transition);
}
#search::placeholder { color: var(--text-faint); }
#search:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); }
.search-kbd {
  position: absolute; right: 12px; font-size: 11px; color: var(--text-faint);
  border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; background: var(--bg);
}
.topbar-actions { display: flex; gap: 8px; flex-shrink: 0; }
.icon-btn {
  width: 38px; height: 38px; border-radius: 10px; font-size: 16px;
  background: var(--bg-elev); border: 1px solid var(--border); color: var(--text);
  display: grid; place-items: center; transition: var(--transition);
}
.icon-btn:hover { background: var(--bg-hover); border-color: var(--accent); }
.gs-app[data-theme="dark"] .theme-light { display: none; }
.gs-app[data-theme="light"] .theme-dark { display: none; }

/* ============================================================
   STATS STRIP
   ============================================================ */
.stats {
  max-width: var(--maxw); margin: 0 auto; padding: 18px 22px 6px;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;
}
.stat-card {
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px; position: relative; overflow: hidden;
}
.stat-card .stat-num { font-size: 24px; font-weight: 800; font-family: 'Fraunces', serif; }
.stat-card .stat-label { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; }
.stat-card .stat-accent { position: absolute; right: -10px; top: -10px; font-size: 56px; opacity: .06; }

/* ============================================================
   LAYOUT
   ============================================================ */
.layout {
  max-width: var(--maxw); margin: 0 auto; padding: 12px 22px 40px;
  display: grid; grid-template-columns: var(--sidebar-w) 1fr; gap: 22px; align-items: start;
}

/* ---------- SIDEBAR ---------- */
.sidebar {
  position: sticky; top: 68px;
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px;
  max-height: calc(var(--gs-pane-h, 100dvh) - 84px);
  overflow-y: auto;
}
/* ---------- SCORING PANEL ---------- */
.score-panel {
  border: 1px solid var(--accent); border-radius: var(--radius);
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-elev));
  padding: 14px 14px 12px; margin-bottom: 18px;
}
.score-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.score-panel-head h2 { font-size: 14px; display: flex; align-items: center; gap: 7px; }
.score-panel-head h2::before { content: "⚖"; font-size: 15px; }
.score-panel-body.collapsed { display: none; }
.mode-toggle { display: flex; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; margin-bottom: 11px; }
.mode-btn { flex: 1; padding: 7px 8px; background: var(--bg); border: none; color: var(--text-dim); font-size: 12.5px; font-weight: 600; transition: var(--transition); }
.mode-btn.active { background: var(--accent); color: #fff; }
.score-hint { font-size: 11.5px; color: var(--text-dim); margin: 0 0 12px; line-height: 1.45; }
.weight-row { margin-bottom: 11px; }
.weight-row .wr-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
.weight-row .wr-name { font-size: 12.5px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.weight-row .wr-pct { font-size: 12px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.weight-row input[type=range] { display: block; }
.weight-sum { font-size: 11px; color: var(--text-faint); text-align: right; margin-bottom: 8px; }
.score-panel-actions { display: flex; justify-content: space-between; gap: 10px; }

.sidebar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.sidebar-head h2 { font-size: 15px; }
.link-btn { background: none; border: none; color: var(--accent); font-size: 12px; padding: 0; }
.link-btn:hover { text-decoration: underline; }
.filter-group { margin-bottom: 18px; }
.filter-group h3 {
  font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-dim); margin-bottom: 9px; display: flex; justify-content: space-between;
}
.range-val { color: var(--accent); font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px; padding: 5px 10px; border-radius: 20px;
  background: var(--chip-bg); border: 1px solid var(--border);
  color: var(--text-dim); transition: var(--transition); user-select: none;
  display: inline-flex; align-items: center; gap: 5px;
}
.chip:hover { border-color: var(--accent); color: var(--text); }
.chip.active {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: var(--accent); color: var(--text); font-weight: 600;
}
.chip .chip-count { font-size: 10.5px; color: var(--text-faint); }
.chip.active .chip-count { color: var(--accent); }
.select {
  width: 100%; padding: 9px 11px; border-radius: var(--radius-sm);
  background: var(--bg); border: 1px solid var(--border); color: var(--text); font-size: 13px;
}
.select:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); }
.select.compact { width: auto; padding: 7px 28px 7px 10px; }
input[type=range] { width: 100%; accent-color: var(--accent); }

/* ============================================================
   MAIN / TOOLBAR
   ============================================================ */
.toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; flex-wrap: wrap; }
.result-count { font-size: 13px; color: var(--text-dim); font-weight: 500; }
.result-count b { color: var(--text); }
.toolbar-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.sort-label { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 7px; }
.view-toggle { display: flex; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
.view-btn {
  width: 34px; height: 32px; background: var(--bg-elev); border: none; color: var(--text-dim); font-size: 15px;
}
.view-btn.active { background: var(--accent); color: white; }

.btn {
  padding: 9px 15px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg-elev); color: var(--text); font-size: 13px; font-weight: 600;
  transition: var(--transition);
}
.btn:hover { border-color: var(--accent); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
.btn.primary:hover { filter: brightness(1.08); }
.btn.ghost { background: transparent; }

.active-filters { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 14px; }
.active-filters:empty { display: none; }
.af-tag {
  font-size: 12px; padding: 4px 9px; border-radius: 16px; display: inline-flex; gap: 6px; align-items: center;
  background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid var(--accent); color: var(--text);
}
.af-tag button { background: none; border: none; color: var(--text-dim); font-size: 13px; padding: 0; line-height: 1; }
.af-tag button:hover { color: var(--bad); }

/* ============================================================
   RESULTS — GRID (cards)
   ============================================================ */
.results.grid-view {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px;
}
.card {
  background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; position: relative; transition: var(--transition); cursor: pointer;
  display: flex; flex-direction: column; gap: 10px;
}
.card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow); }
.card-top { display: flex; gap: 12px; align-items: flex-start; }
.score-badge {
  flex-shrink: 0; width: 50px; height: 50px; border-radius: 12px; display: grid; place-items: center;
  font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; color: #fff; line-height: 1;
}
.card-title { flex: 1; min-width: 0; }
.card-title h3 { font-size: 14.5px; line-height: 1.25; margin-bottom: 3px; padding-right: 118px; }
.card.is-dismissed .card-title h3 { padding-right: 78px; }
.card-title .inst { font-size: 12.5px; color: var(--text-dim); }
.card-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  font-size: 11px; padding: 3px 8px; border-radius: 7px; background: var(--chip-bg);
  border: 1px solid var(--border-soft); color: var(--text-dim); white-space: nowrap;
}
.tag.field { color: var(--text); border-color: transparent; }
.tag .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }
.loc { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 5px; min-width: 0; }
.loc svg { width: 13px; height: 13px; flex-shrink: 0; }
.loc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compare-check {
  display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-dim);
  padding: 4px 8px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg);
  transition: var(--transition); flex-shrink: 0;
}
.compare-check:hover { border-color: var(--accent); color: var(--text); }
.compare-check.checked { background: color-mix(in srgb, var(--accent) 16%, transparent); border-color: var(--accent); color: var(--text); }
.tier-rail { position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px; border-radius: 3px; }
.tag-edited { color: var(--accent); border-color: var(--accent); }

/* favorite / dismiss / restore */
.card-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; z-index: 2; }
.card-fav, .card-dismiss {
  height: 26px; border-radius: 8px;
  background: var(--bg); border: 1px solid var(--border); color: var(--text-dim);
  font-size: 12px; font-weight: 700; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
  opacity: 1; transition: var(--transition);
}
.card-fav { width: auto; padding: 0 8px; gap: 4px; }
.card-dismiss { width: 26px; }
.card-fav.active { color: #f5b301; border-color: #f5b301; background: color-mix(in srgb, #f5b301 16%, var(--bg)); }
.card-fav:hover { color: #f5b301; border-color: #f5b301; }
.card-dismiss:hover { color: #fff; background: var(--bad); border-color: var(--bad); }
.t-fav.fav-on { color: #f5b301; border-color: #f5b30166; }
.btn.fav-active, .mode-btn.fav-active { color: #f5b301; border-color: #f5b301; }
#favToggle.fav-active { background: color-mix(in srgb, #f5b301 18%, transparent); border-color: #f5b301; color: var(--text); }
.drawer-fav.fav-active { color: #f5b301; border-color: #f5b301; }
.card-restore {
  position: absolute; top: 10px; right: 10px; padding: 4px 9px; border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 16%, transparent); border: 1px solid var(--accent);
  color: var(--text); font-size: 11.5px; font-weight: 600; z-index: 2;
}
.card.is-dismissed { opacity: .72; }
.card.is-dismissed:hover { opacity: 1; }
.t-actions { white-space: nowrap; display: flex; gap: 6px; }
.t-dismiss:hover { color: #fff; background: var(--bad); border-color: var(--bad); }
.btn-dismiss { width: 100%; margin-top: 10px; color: var(--text-dim); }
.btn-dismiss:hover { color: #fff; background: var(--bad); border-color: var(--bad); }

/* ============================================================
   RESULTS — TABLE
   ============================================================ */
.results.table-view { display: block; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
.results.table-view .card { display: none; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-soft); }
.data-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); background: var(--bg-elev2); position: sticky; top: 0; }
.data-table tbody tr { cursor: pointer; transition: var(--transition); }
.data-table tbody tr:hover { background: var(--bg-hover); }
.data-table .t-score { font-family: 'Fraunces', serif; font-weight: 600; }
.results.grid-view .data-table { display: none; }

/* ============================================================
   COMPARE TRAY
   ============================================================ */
.compare-tray {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 45;
  width: min(900px, calc(100% - 32px));
}
.compare-tray-inner {
  background: var(--bg-elev2); border: 1px solid var(--accent); border-radius: 14px;
  box-shadow: var(--shadow); padding: 11px 14px; display: flex; align-items: center; gap: 14px;
}
.compare-items { display: flex; gap: 8px; flex: 1; overflow-x: auto; }
.compare-pill {
  display: flex; align-items: center; gap: 7px; font-size: 12px; white-space: nowrap;
  background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 5px 6px 5px 11px;
}
.compare-pill button { background: none; border: none; color: var(--text-dim); font-size: 13px; }
.compare-pill button:hover { color: var(--bad); }
.compare-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* ============================================================
   DRAWER (detail)
   ============================================================ */
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 50; backdrop-filter: blur(2px); }
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: min(480px, 100%); z-index: 55;
  background: var(--bg-elev); border-left: 1px solid var(--border); box-shadow: var(--shadow);
  overflow-y: auto; padding: 0; animation: slideIn .22s cubic-bezier(.4,0,.2,1);
}
@keyframes slideIn { from { transform: translateX(40px); opacity: .4; } to { transform: none; opacity: 1; } }
.drawer-hd { padding: 22px 24px 18px; border-bottom: 1px solid var(--border); position: relative; }
.drawer-hd .close { position: absolute; top: 16px; right: 16px; }
.drawer-score { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.drawer-score .score-badge { width: 62px; height: 62px; font-size: 21px; border-radius: 14px; }
.drawer-score .ds-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .05em; }
.drawer-score .ds-tier { font-size: 13px; font-weight: 600; }
.drawer-hd h2 { font-size: 19px; line-height: 1.25; font-family: 'Fraunces', serif; font-weight: 600; margin-bottom: 4px; }
.drawer-hd .d-inst { color: var(--text-dim); font-size: 13.5px; }
.drawer-body { padding: 20px 24px; }
.d-section { margin-bottom: 22px; }
.d-section h4 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); margin-bottom: 10px; }
.d-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
.d-fact .k { font-size: 11px; color: var(--text-faint); margin-bottom: 1px; }
.d-fact .v { font-size: 13.5px; font-weight: 500; }
.bar-row { display: grid; grid-template-columns: 96px 1fr 40px; align-items: center; gap: 10px; margin-bottom: 9px; font-size: 12.5px; }
.bar-track { height: 8px; background: var(--chip-bg); border-radius: 6px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
.bar-val { text-align: right; font-weight: 600; font-size: 12px; color: var(--text-dim); }

/* editable component scores in drawer */
.edit-row { margin-bottom: 13px; }
.edit-row .er-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
.edit-row .er-name { font-size: 12.5px; font-weight: 500; }
.edit-row .er-wt { font-size: 10.5px; color: var(--text-faint); margin-left: 6px; font-weight: 400; }
.edit-row .er-val { font-size: 13px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.edit-row .er-val.changed { color: var(--accent); }
.edit-row input[type=range] { display: block; margin-top: 2px; }
.edit-row .er-contrib { font-size: 10.5px; color: var(--text-faint); text-align: right; margin-top: 1px; }
.vibes-row { display: flex; align-items: center; gap: 10px; }
.vibes-row input[type=range] { flex: 1; }
.vibes-row .vibes-val { font-size: 14px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
.score-compare-line { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); margin-top: 8px; }
.score-compare-line .research-ref { padding: 2px 8px; border-radius: 7px; background: var(--chip-bg); border: 1px solid var(--border-soft); }
.score-compare-line .delta { font-weight: 700; }
.delta.up { color: var(--good); } .delta.down { color: var(--bad); }
.edited-flag { position: absolute; top: 10px; right: 12px; font-size: 10px; color: var(--accent); display: inline-flex; align-items: center; gap: 3px; }
.card .edited-flag { background: color-mix(in srgb, var(--accent) 16%, transparent); padding: 2px 6px; border-radius: 6px; }
.funding-note { font-size: 13px; color: var(--text); background: var(--bg); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 11px 13px; }
/* ---- dates & deadlines section ---- */
.d-breaks { margin-top: 10px; }
.d-breaks .k { font-size: 11px; color: var(--text-faint); margin-bottom: 4px; }
.d-breaks ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--text); }
.d-breaks li { margin-bottom: 2px; }
.dates-note { font-size: 12.5px; color: var(--text-dim); margin: 8px 0 0; }
.dates-verified { font-size: 11px; color: var(--text-faint); margin: 6px 0 0; }
.drawer-actions { display: flex; gap: 10px; margin-top: 8px; }
.drawer-actions .btn { flex: 1; text-align: center; }

/* ============================================================
   COMPARE MODAL
   ============================================================ */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 60; display: grid; place-items: center; padding: 24px; backdrop-filter: blur(3px); }
.modal { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 18px; width: min(1000px, 100%); max-height: 88vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border); }
.modal-head h2 { font-size: 17px; }
.modal-body { overflow: auto; padding: 0; }
.cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cmp-table th, .cmp-table td { padding: 12px 14px; border-bottom: 1px solid var(--border-soft); text-align: left; vertical-align: top; }
.cmp-table thead th { background: var(--bg-elev2); position: sticky; top: 0; z-index: 1; }
.cmp-table .row-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); white-space: nowrap; background: var(--bg-elev2); position: sticky; left: 0; }
.cmp-prog { font-weight: 600; font-size: 14px; }
.cmp-best { color: var(--good); font-weight: 700; }
.mini-bar { height: 6px; background: var(--chip-bg); border-radius: 4px; overflow: hidden; margin-top: 4px; }
.mini-bar > div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }

/* ============================================================
   VERIFY MODAL  (🔍 verify info with web search)
   ============================================================ */
.drawer-hd .verify-btn { position: absolute; top: 16px; right: 58px; width: 34px; height: 34px; font-size: 15px; }
.verify-modal { width: min(760px, 100%); }
.verify-wrap { padding: 20px 22px 24px; }
.verify-prog { margin-bottom: 18px; }
.verify-prog-name { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; }
.verify-prog-inst { color: var(--text-dim); font-size: 13px; margin-top: 2px; }
.verify-applied-flag { margin-top: 8px; font-size: 12px; color: var(--good); display: flex; align-items: center; gap: 8px; }

.verify-step { border-top: 1px solid var(--border-soft); padding-top: 16px; margin-top: 16px; }
.verify-step:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.verify-step h4 { font-size: 14px; display: flex; align-items: center; gap: 9px; margin-bottom: 6px; }
.vstep-n {
  display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.verify-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.verify-links .btn { flex: 0 1 auto; display: inline-flex; align-items: center; text-decoration: none; }
.verify-ta {
  width: 100%; margin-top: 10px; resize: vertical; color: var(--text);
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 11px 12px; line-height: 1.5; transition: var(--transition);
}
.verify-ta.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.verify-ta::placeholder { color: var(--text-faint); }
.verify-ta:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); background: var(--bg-elev); }
.verify-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; }
.verify-parse-msg { font-size: 12px; color: var(--text-dim); }
.verify-parse-msg.err { color: var(--bad); }

.verify-diff { border-top: 1px solid var(--border-soft); padding-top: 16px; margin-top: 18px; }
.verify-diff h4 { font-size: 14px; margin-bottom: 4px; }
.verify-summary { font-size: 12.5px; color: var(--text-dim); margin: 0 0 12px; }
.verify-diff-scroll { max-height: 320px; overflow: auto; border: 1px solid var(--border-soft); border-radius: var(--radius-sm); }
.vd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.vd-table th, .vd-table td { padding: 9px 11px; border-bottom: 1px solid var(--border-soft); text-align: left; vertical-align: top; }
.vd-table thead th { background: var(--bg-elev2); position: sticky; top: 0; z-index: 1; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-dim); }
.vd-table tr:last-child td { border-bottom: none; }
.vd-k { white-space: nowrap; font-weight: 500; }
.vd-cur { color: var(--text-dim); }
.vd-new { color: var(--text); }
.vd-empty { color: var(--text-faint); font-style: italic; }
.vd-changed .vd-new { color: var(--good); font-weight: 600; }
.vd-added .vd-new { color: var(--accent); font-weight: 600; }
.vd-changed { background: color-mix(in srgb, var(--good) 7%, transparent); }
.vd-added { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.vd-same { opacity: .62; }
.vd-badge { display: inline-block; margin-left: 8px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 1px 6px; border-radius: 6px; vertical-align: middle; }
.vd-badge.vd-changed { background: color-mix(in srgb, var(--good) 22%, transparent); color: var(--good); }
.vd-badge.vd-added { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
.vd-badge.vd-same { background: var(--chip-bg); color: var(--text-faint); }
.vd-badge.vd-skip { background: var(--chip-bg); color: var(--text-faint); }
.verify-extra-note { font-size: 12px; color: var(--text-dim); margin: 10px 0 0; }
.verify-apply-row { margin-top: 14px; }

/* ============================================================
   MISC
   ============================================================ */
.empty { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.empty .btn { margin-top: 14px; }
.hidden { display: none !important; }
.mobile-only { display: none; }

/* ============================================================
   RESPONSIVE
   ============================================================ */
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 65; width: 300px; max-height: none;
    border-radius: 0; transform: translateX(-105%); transition: transform .24s ease;
  }
  .sidebar.open { transform: none; box-shadow: var(--shadow); }
  .mobile-only { display: inline-flex; }
  .search-kbd { display: none; }
  .stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .brand-text { display: none; }
  .topbar { gap: 10px; padding: 10px 14px; }
  .layout { padding: 12px 14px 40px; }
  .stats { padding: 14px 14px 4px; }
  .d-facts { grid-template-columns: 1fr; }
}

/* ============================================================
   UI POLISH  (notes, favorites, accessibility, micro-interactions)
   ============================================================ */

/* ---- per-program notes (drawer) ---- */
.notes-area {
  width: 100%; min-height: 92px; resize: vertical; font-family: inherit; font-size: 13px;
  line-height: 1.55; color: var(--text); background: var(--bg);
  border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 11px 12px;
  transition: var(--transition);
}
.notes-area::placeholder { color: var(--text-faint); }
.notes-area:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); background: var(--bg-elev); }
.note-status {
  float: right; font-size: 10.5px; font-weight: 600; color: var(--good);
  text-transform: none; letter-spacing: 0; opacity: 0; transition: opacity .2s ease;
}
.note-status.show { opacity: 1; }

/* ---- note indicator chip on cards ---- */
.tag-note { color: var(--accent-2); border-color: color-mix(in srgb, var(--accent-2) 45%, transparent); }
.tag-deadline { color: #f0883e; border-color: color-mix(in srgb, #f0883e 45%, transparent); font-variant-numeric: tabular-nums; }

/* ---- favorited card gets a warm accent rail + faint glow ---- */
.card.is-fav { border-color: color-mix(in srgb, #f5b301 42%, var(--border)); }
.card.is-fav .tier-rail { background: #f5b301 !important; }
.card.is-fav::after {
  content: "★"; position: absolute; bottom: 10px; right: 12px;
  font-size: 11px; color: #f5b30155; pointer-events: none;
}

/* keep the save control readable; only the dismiss (✕) waits for hover */
.card-dismiss { opacity: 0; }
.card:hover .card-dismiss, .card:focus-within .card-dismiss { opacity: 1; }

/* ---- score badge depth ---- */
.score-badge { box-shadow: 0 4px 12px -4px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.18); text-shadow: 0 1px 1px rgba(0,0,0,.25); }

/* ---- card hover: subtle accent wash ---- */
.card { will-change: transform; }
.card:hover { box-shadow: 0 16px 34px -16px rgba(0,0,0,.55); }

/* ---- stat cards: gradient top hairline + hover lift ---- */
.stat-card { transition: var(--transition); }
.stat-card::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2)); opacity: .8;
}
.stat-card:hover { transform: translateY(-2px); border-color: var(--accent); }

/* ---- results fade-in ---- */
.results.grid-view .card { animation: cardIn .26s cubic-bezier(.4,0,.2,1) both; }
@keyframes cardIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ---- toolbar / sort polish ---- */
.toolbar { position: sticky; top: 63px; z-index: 4; padding: 8px 0; background: var(--bg); }
#favToggle, #dismissedToggle { padding: 7px 12px; font-size: 12.5px; }

/* ---- accessible focus rings everywhere ---- */
button:focus-visible, a:focus-visible, input:focus-visible,
select:focus-visible, textarea:focus-visible, .chip:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.chip { cursor: pointer; }

/* ---- nicer custom scrollbars ---- */
.sidebar, .drawer, .modal-body, .results.table-view { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.sidebar::-webkit-scrollbar, .drawer::-webkit-scrollbar, .modal-body::-webkit-scrollbar { width: 9px; height: 9px; }
.sidebar::-webkit-scrollbar-thumb, .drawer::-webkit-scrollbar-thumb, .modal-body::-webkit-scrollbar-thumb {
  background: var(--border); border-radius: 6px; border: 2px solid var(--bg-elev);
}
.sidebar::-webkit-scrollbar-thumb:hover, .drawer::-webkit-scrollbar-thumb:hover { background: var(--text-faint); }

/* ---- empty state glyph ---- */
.empty::before { content: "🔍"; display: block; font-size: 40px; opacity: .5; margin-bottom: 10px; }

/* ---- range sliders: larger, themed thumbs ---- */
input[type=range] {
  -webkit-appearance: none; appearance: none; height: 5px; border-radius: 4px;
  background: var(--chip-bg); cursor: pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--bg-elev); box-shadow: var(--shadow-sm); transition: transform .12s ease;
}
input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.18); }
input[type=range]::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%; background: var(--accent); border: 2px solid var(--bg-elev);
}

/* ---- drawer header tint ---- */
.drawer-hd { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--bg-elev)), var(--bg-elev)); }

/* ---- buttons: gentle press feedback ---- */
.btn:active, .icon-btn:active, .chip:active, .compare-check:active { transform: translateY(1px); }

.card-facts { display: flex; flex-direction: column; gap: 6px; }
.card-fact-k {
  font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  margin-right: 6px;
}
.card-deadline {
  display: flex; align-items: baseline; gap: 0;
  font-size: 12.5px; font-weight: 650; color: #f6c56b;
  background: color-mix(in srgb, #f0883e 14%, transparent);
  border: 1px solid color-mix(in srgb, #f0883e 42%, transparent);
  border-radius: 8px; padding: 6px 9px;
}
.card-apply {
  margin: 0; font-size: 12.5px; color: var(--text); line-height: 1.45;
  background: var(--bg); border: 1px solid var(--border-soft); border-radius: 8px; padding: 6px 9px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.card-apply .card-fact-k { color: var(--accent); }
.t-deadline { margin-top: 3px; font-size: 11.5px; font-weight: 700; color: #f6c56b; }
.t-apply {
  margin-top: 2px; font-size: 11.5px; color: var(--text-dim); line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.d-callouts { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.deadline-callout, .apply-callout {
  border-radius: 12px; padding: 12px 14px;
}
.deadline-callout {
  background: color-mix(in srgb, #f0883e 14%, var(--bg-elev));
  border: 1px solid color-mix(in srgb, #f0883e 45%, transparent);
}
.apply-callout {
  background: var(--bg);
  border: 1px solid var(--border);
}
.deadline-callout .k, .apply-callout .k {
  font-size: 10.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
  color: var(--text-faint); margin-bottom: 3px;
}
.deadline-callout .v { font-size: 16px; font-weight: 700; color: #f6c56b; font-family: 'Fraunces', serif; }
.apply-callout .v { font-size: 13.5px; line-height: 1.5; color: var(--text); }

.gs-app { min-height: 100%; }
.gs-app.gs-flow { height: auto; overflow: visible; }
.gs-app.gs-flow .topbar,
.gs-app.gs-flow .toolbar,
.gs-app.gs-flow .sidebar { position: relative; top: auto; max-height: none; }
`;
