// App layer: annotations, conflict review, relationship pages and on-demand AI jobs.
// Works read-only from file://. When served by serve.py (http://127.0.0.1:8765) it can write.
const SERVER = location.protocol.startsWith("http");
let STATE = { annotations: [], labels: [], notes: [], jobs: [], detector: null, ctypes: null };
const CTYPES_DEFAULT = ["logistics", "deep talk", "banter", "plans", "support", "flirting", "venting", "news"];
const ctypes = () => STATE.ctypes || CTYPES_DEFAULT;
const CANDS = DET.conflicts.candidates;
const candByEnt = {}; CANDS.forEach((c) => (candByEnt[c.ent] = candByEnt[c.ent] || []).push(c));
const listeners = new Set();
const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  return r.json();
}
async function refreshState() {
  if (!SERVER) return STATE;
  STATE = await api("GET", "/api/state");
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  renderJobs();
  return STATE;
}
const candLabel = (cid) => STATE.labels.find((l) => l.cid === cid && l.source === "detector");
const jobsFor = (kind, ref) => STATE.jobs.filter((j) => j.kind === kind && j.ref === ref);
const latestDone = (kind, ref) => jobsFor(kind, ref).find((j) => j.status === "done");
const activeJob = (kind, ref) => jobsFor(kind, ref).find((j) => j.status === "queued" || j.status === "running");
const conf = (cid) => STATE.detector?.scores?.[cid];
const fmtDate = (ep) => new Date(ep * 1000).toISOString().slice(0, 10);
const sentLabel = (v) => (v > 0 ? "+" : "") + v;
function candRange(c) { return { start_mid: c.message_ids[0], end_mid: c.message_ids[c.message_ids.length - 1] }; }

async function queueJob(kind, ent, ref, params) {
  if (!SERVER) return;
  await api("POST", "/api/jobs", { kind, ent, ref, params });
  await refreshState();
  pollJobs();
}
async function setLabel(c, label) {
  await api("POST", "/api/labels", { cid: c.cid, ent: c.ent, ...candRange(c), start_epoch: c.start_epoch, end_epoch: c.end_epoch || null, label, source: "detector" });
  await refreshState();
}

// ---------- jobs tray ----------
const tray = h("div", { class: "jobs", hidden: "" }); document.body.append(tray);
let polling = null;
function pollJobs() {
  if (polling) return;
  polling = setInterval(async () => {
    const before = STATE.jobs.filter((j) => j.status === "queued" || j.status === "running").map((j) => j.id + j.status + j.progress).join();
    const js = await api("GET", "/api/jobs");
    const now = js.filter((j) => j.status === "queued" || j.status === "running").map((j) => j.id + j.status + j.progress).join();
    if (now !== before) await refreshState();
    if (!js.some((j) => j.status === "queued" || j.status === "running")) { clearInterval(polling); polling = null; await refreshState(); }
  }, 2500);
}
let trayOpen = true;
function renderJobs() {
  if (!SERVER) return;
  const recent = STATE.jobs.slice(0, 8);
  tray.hidden = !recent.length;
  tray.innerHTML = "";
  const active = recent.filter((j) => j.status === "queued" || j.status === "running").length;
  const head = link(`AI jobs${active ? ` · ${active} active` : ""} ${trayOpen ? "▾" : "▸"}`, () => { trayOpen = !trayOpen; renderJobs(); }, "jhead");
  tray.append(head);
  if (!trayOpen) return;
  recent.forEach((j) => {
    const name = E[j.ent]?.name || j.ent;
    const row = h("div", { class: "jrow " + j.status }, [
      h("i", { class: "dot " + j.status }),
      h("div", {}, [h("b", {}, `${j.kind === "conflict" ? "Conflict" : "Relationship"} · ${name}`), h("small", {}, j.status === "running" ? j.progress || "running" : j.status === "error" ? (j.error || "error").slice(0, 80) : j.status)]),
    ]);
    if (j.status === "queued" || j.status === "running") row.append(link("Cancel", async () => { await api("POST", `/api/jobs/${j.id}/cancel`); refreshState(); }, "btn xs"));
    else if (j.status === "done") row.append(link("Open", () => j.kind === "conflict" ? openConflict(j.ent, j.ref) : openRelationship(j.ent), "btn xs"));
    tray.append(row);
  });
}

// ---------- AI result rendering ----------
function conflictResult(parent, r, meta) {
  const box = h("div", { class: "ai" }, [h("span", { class: "ailab" }, `AI-written by ${r.model || "local model"}, may be wrong${meta ? " · " + meta : ""}`)]);
  if (r.is_conflict === false) box.append(h("p", {}, "The model doesn't read this as a real conflict" + (r.confidence != null ? ` (confidence ${r.confidence})` : "") + "."));
  box.append(h("h4", {}, `${r.title || "Untitled"}${r.severity ? ` · severity ${r.severity}/5` : ""}`));
  box.append(h("p", { class: "take" }, `${r.start || ""}${r.end && r.end !== r.start ? " → " + r.end : ""} · Ending: ${r.ending || "unclear"} · ${r.hashed_out_over_text ? "hashed out over text" : "not hashed out over text"}`));
  if (r.trigger) box.append(h("p", {}, [h("b", {}, "Source: "), r.trigger]));
  box.append(h("div", { class: "sides" }, [h("div", {}, [h("b", {}, "Your side"), r.allie_side || "–"]), h("div", {}, [h("b", {}, `${r.name || "Their"} side`), r.their_side || "–"])]));
  if (r.what_helped) box.append(h("p", {}, [h("b", {}, "What helped: "), r.what_helped]));
  if (r.what_hurt) box.append(h("p", {}, [h("b", {}, "What hurt: "), r.what_hurt]));
  if (r.evidence?.length) box.append(h("ul", {}, r.evidence.map((x) => h("li", {}, `${x.date}: ${x.point}`))));
  parent.append(box);
  return box;
}
function analyzeButton(kind, ent, ref, params, label) {
  const wrap = h("span", { class: "abtn" });
  const paint = () => {
    wrap.innerHTML = "";
    if (!SERVER) { wrap.append(h("span", { class: "take" }, "Run serve.py to analyze")); return; }
    const act = activeJob(kind, ref), done = latestDone(kind, ref);
    if (act) wrap.append(h("span", { class: "spin" }, act.status === "running" ? act.progress || "running…" : "queued…"));
    else wrap.append(link(done ? "Regenerate" : label, () => queueJob(kind, ent, ref, { ...params, regenerate: !!done }), "btn " + (done ? "" : "primary")));
  };
  paint(); const off = onState(paint); wrap._off = off;
  return wrap;
}

// ---------- conflict detail ----------
function conflictRefs(ent) {
  const out = (candByEnt[ent] || []).map((c) => ({ ref: c.cid, kind: "detected", c, start_epoch: c.start_epoch, ...candRange(c) }));
  STATE.labels.filter((l) => l.ent === ent && l.source === "user" && l.label === "conflict").forEach((l) =>
    out.push({ ref: "u" + l.id, kind: "marked", label: l, start_epoch: l.start_epoch, start_mid: l.start_mid, end_mid: l.end_mid }));
  return out.sort((a, b) => a.start_epoch - b.start_epoch);
}
function openConflict(ent, ref) {
  const item = conflictRefs(ent).find((x) => x.ref === ref);
  const e = E[ent];
  const b = openModal(`${e.name}: ${item?.kind === "marked" ? "conflict you marked" : "possible conflict"} · ${item ? fmtDate(item.start_epoch) : ""}`);
  const body = h("div"); b.append(body);
  const paint = () => {
    body.innerHTML = "";
    if (!item) { body.append(h("p", {}, "Not found.")); return; }
    const c = item.c;
    if (c) body.append(h("p", { class: "take" }, `${c.messages} messages · negative: you ${c.neg_me}, them ${c.neg_them} · conflict words: you ${c.conflict_words_me}, them ${c.conflict_words_them} · rule: ${c.rule}${conf(c.cid) != null ? ` · model confidence ${conf(c.cid)}` : ""}`));
    const row = h("div", { class: "row" }, [link("Open in messages →", () => openThread(ent, c ? c.hot_start_epoch || c.start_epoch : item.start_epoch, item.start_mid), "btn")]);
    if (c && SERVER) {
      const lab = candLabel(c.cid)?.label;
      row.append(link(lab === "conflict" ? "✓ Confirmed" : "Confirm", () => setLabel(c, lab === "conflict" ? "clear" : "conflict"), "btn" + (lab === "conflict" ? " on" : "")),
        link(lab === "not_conflict" ? "✕ Not a conflict" : "Not a conflict", () => setLabel(c, lab === "not_conflict" ? "clear" : "not_conflict"), "btn" + (lab === "not_conflict" ? " on" : "")));
    }
    row.append(analyzeButton("conflict", ent, ref, { start_mid: item.start_mid, end_mid: item.end_mid, cid: c?.cid }, "Analyze conflict"));
    body.append(row);
    if (SERVER) body.append(notesEditor("conflict", ent, ref, "Your notes on this conflict"));
    const done = latestDone("conflict", ref);
    if (done?.result) conflictResult(body, done.result, `generated ${done.result.generated || done.finished}`);
  };
  paint(); onState(() => { if (!modal.hidden && body.isConnected) paint(); });
}

// ---------- notes (relationship / conflict / period) ----------
function notesEditor(scope, ent, ref, placeholder) {
  const existing = STATE.notes.find((n) => n.scope === scope && n.ent === ent && (n.ref || null) === (ref || null) && !n.period_start);
  const ta = h("textarea", { class: "notes", placeholder, rows: 4 }); ta.value = existing?.body || "";
  const st = h("small", { class: "take" }, existing ? `Saved ${existing.updated?.replace("T", " ")}` : "");
  let id = existing?.id, timer;
  ta.oninput = () => { clearTimeout(timer); st.textContent = "…"; timer = setTimeout(async () => {
    const r = await api("POST", "/api/notes", { id, scope, ent, ref, body: ta.value }); id = r.id; st.textContent = "Saved"; STATE.notes = (await api("GET", "/api/state")).notes; }, 700); };
  return h("div", { class: "nwrap" }, [ta, st]);
}

// ---------- message browser with annotations ----------
async function openThread(id, atEpoch, highlightMid) {
  const e = E[id];
  const b = openModal(`${e.name}: messages`);
  mbody.parentElement.classList.add("wide");
  b.append(h("p", { class: "take" }, "Loading…"));
  let t;
  try { t = await loadThread(id); } catch (err) { b.lastChild.textContent = err.message + ". Run analyze2.py to create the thread files."; return; }
  b.lastChild.remove();
  const msgs = t.msgs, byMonth = new Map(), midIdx = new Map();
  msgs.forEach((m, i) => { midIdx.set(m[4], i); const k = dkey(new Date(m[0] * 1000)); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(i); });
  const keys = [...byMonth.keys()];
  const monthOf = (i) => dkey(new Date(msgs[i][0] * 1000));
  const cands = (candByEnt[id] || []).map((c) => ({ c, a: midIdx.get(c.message_ids[0]), b: midIdx.get(c.message_ids[c.message_ids.length - 1]) })).filter((x) => x.a != null);
  let cur = null, sel = null, focus = null, filter = "all", editing = null;
  const anns = () => STATE.annotations.filter((a) => a.ent === id && !a.parent_id);
  const replies = (aid) => STATE.annotations.filter((a) => a.parent_id === aid);
  const annRange = (a) => [midIdx.get(a.start_mid), midIdx.get(a.end_mid)].map((x, k, arr) => x ?? arr[1 - k]).sort((p, q) => p - q);

  // controls
  const ctrl = h("div", { class: "tctrl" });
  const sel_ = h("select", {}, keys.map((k) => h("option", { value: k }, `${mlabel(k)} (${fmt(byMonth.get(k).length)})`)));
  const prev = link("‹", () => go(keys.indexOf(cur) - 1), "btn"), next = link("›", () => go(keys.indexOf(cur) + 1), "btn");
  const dateIn = h("input", { type: "date", min: e.first, max: e.last, title: "Jump to date" });
  const search = h("input", { type: "search", placeholder: "Search this chat…  ( / )" });
  const det = h("span", { class: "detstat" });
  ctrl.append(prev, sel_, next, dateIn, search, det);
  const chips = h("div", { class: "fchips" });
  const res = h("div", { class: "tres", hidden: "" });
  const grid = h("div", { class: "tgrid" });
  const chat = h("div", { class: "tchat" }), gutter = h("div", { class: "tgut" }), log = h("div", { class: "tlog" });
  chat.append(gutter, log);
  const margin = h("div", { class: "tmargin" });
  const mini = h("div", { class: "tmini" });
  grid.append(chat, margin, mini);
  const bar = h("div", { class: "tbar", hidden: "" });
  b.append(h("p", { class: "take" }, `${fmt(msgs.length)} messages. Mine are on the right.` + (SERVER ? " Click a message, then shift-click (or drag down the left gutter) to select a range and annotate it. Keys: n note · c conflict · t tag · 1–5 sentiment · j/k move · [ ] annotations · / search." : " Run serve.py to add notes and labels.")), ctrl, chips, res, grid, bar);

  function paintDet() {
    const d = STATE.detector;
    det.textContent = SERVER && d ? `Detector: ${d.n_labels} labels${d.precision != null ? `, precision ${d.precision}` : ""}${d.model_trained ? " · learning on" : ""}` : "";
  }
  function paintChips() {
    chips.innerHTML = "";
    const tags = new Set(), types = new Set();
    anns().forEach((a) => { (a.tags || []).forEach((x) => tags.add(x)); if (a.ctype) types.add(a.ctype); });
    const opts = [["all", "All"], ["conflict", "Conflicts"], ["note", "Notes"], ...[...types].map((x) => ["type:" + x, x]), ...[...tags].map((x) => ["tag:" + x, "#" + x])];
    if (opts.length <= 3 && !anns().length) return;
    opts.forEach(([k, l]) => chips.append(link(l, () => { filter = k; paintChips(); paintOverlay(); }, "tab" + (filter === k ? " on" : ""))));
  }
  const pass = (a) => filter === "all" || (filter === "conflict" && a.is_conflict) || (filter === "note" && a.note) ||
    (filter.startsWith("type:") && a.ctype === filter.slice(5)) || (filter.startsWith("tag:") && (a.tags || []).includes(filter.slice(4)));

  function rowEl(i) { return log.querySelector(`.mrow[data-i="${i}"]`); }
  function render(k) {
    cur = k; sel_.value = k; log.innerHTML = ""; let lastDay = "";
    const idxs = byMonth.get(k) || [];
    const bannerAt = new Map();
    cands.forEach((x) => { if (monthOf(x.a) === k) bannerAt.set(x.a, [...(bannerAt.get(x.a) || []), x]); });
    STATE.labels.filter((l) => l.ent === id && l.source === "user" && l.label === "conflict").forEach((l) => {
      const a = midIdx.get(l.start_mid); if (a != null && monthOf(a) === k) bannerAt.set(a, [...(bannerAt.get(a) || []), { user: l, a, b: midIdx.get(l.end_mid) ?? a }]);
    });
    for (const i of idxs) {
      const [ts, me, who, text, mid] = msgs[i]; const d = new Date(ts * 1000);
      const ds = d.toDateString(); if (ds !== lastDay) { log.append(h("div", { class: "tday" }, dayStr(d))); lastDay = ds; }
      (bannerAt.get(i) || []).forEach((x) => log.append(banner(x)));
      const row = h("div", { class: "mrow " + (me ? "me" : "them"), "data-i": i });
      const bub = h("div", { class: "bub " + (me ? "me" : "them") + (mid === highlightMid ? " hl" : "") });
      if (who) bub.append(h("div", { class: "who" }, who));
      bub.append(h("div", { class: "txt" }, text || "[attachment]"), h("div", { class: "ts" }, timeStr(d)));
      row.append(bub);
      row.addEventListener("click", (ev) => { if (ev.target.closest("a,button")) return; pick(i, ev.shiftKey); });
      log.append(row);
    }
    paintSel(); requestAnimationFrame(() => { paintOverlay(); paintMini(); });
  }
  function banner(x) {
    const el = h("div", { class: "cbanner" });
    if (x.user) {
      const ref = "u" + x.user.id;
      el.append(h("span", {}, [h("b", {}, "You marked a conflict here"), h("small", {}, ` · ${x.b - x.a + 1} messages`)]),
        h("span", { class: "row" }, [link("Notes", () => openConflict(id, ref), "btn xs"), analyzeButton("conflict", id, ref, { start_mid: x.user.start_mid, end_mid: x.user.end_mid }, "Analyze conflict")]));
      const done = latestDone("conflict", ref); if (done?.result) el.append(miniResult(done.result, () => openConflict(id, ref)));
      return el;
    }
    const c = x.c, lab = candLabel(c.cid)?.label, p = conf(c.cid);
    el.classList.add(lab === "not_conflict" ? "rejected" : lab === "conflict" ? "confirmed" : "open");
    el.append(h("span", {}, [h("b", {}, lab === "conflict" ? "Conflict (confirmed)" : lab === "not_conflict" ? "Not a conflict" : "Possible conflict"),
      h("small", {}, ` · ${c.messages} messages${p != null ? ` · model confidence ${p}` : ""} · ${c.rule}`)]));
    if (SERVER) el.append(h("span", { class: "row" }, [
      link(lab === "conflict" ? "✓ Confirmed" : "Confirm", () => setLabel(c, lab === "conflict" ? "clear" : "conflict"), "btn xs" + (lab === "conflict" ? " on" : "")),
      link(lab === "not_conflict" ? "✕ Not a conflict" : "Not a conflict", () => setLabel(c, lab === "not_conflict" ? "clear" : "not_conflict"), "btn xs" + (lab === "not_conflict" ? " on" : "")),
      link("Add note", () => openConflict(id, c.cid), "btn xs"),
      analyzeButton("conflict", id, c.cid, { ...candRange(c), cid: c.cid }, "Analyze conflict")]));
    const done = latestDone("conflict", c.cid); if (done?.result) el.append(miniResult(done.result, () => openConflict(id, c.cid)));
    return el;
  }
  function miniResult(r, open) {
    return h("div", { class: "cres" }, [h("span", { class: "ailab" }, "AI"), ` ${r.title || ""} · ${r.ending || ""}${r.severity ? ` · severity ${r.severity}/5` : ""} `, link("details", open)]);
  }
  function go(i, focusIdx) {
    if (i < 0 || i >= keys.length) return;
    render(keys[i]);
    if (focusIdx != null) { focus = focusIdx; paintSel(); rowEl(focusIdx)?.scrollIntoView({ block: "center" }); }
    else log.querySelector(".hl")?.scrollIntoView({ block: "center" }) || grid.scrollIntoView({ block: "start" });
  }
  const goIdx = (i) => { if (monthOf(i) !== cur) go(keys.indexOf(monthOf(i)), i); else { focus = i; paintSel(); rowEl(i)?.scrollIntoView({ block: "nearest" }); } };

  // selection
  function pick(i, extend) {
    if (!SERVER) return;
    if (extend && sel) sel = { a: sel.a, b: i };
    else if (sel && sel.a === i && sel.b === i) sel = null;
    else sel = { a: i, b: i };
    focus = i; paintSel();
  }
  const selRange = () => sel ? [Math.min(sel.a, sel.b), Math.max(sel.a, sel.b)] : null;
  function paintSel() {
    const r = selRange();
    log.querySelectorAll(".mrow").forEach((row) => { const i = +row.dataset.i; row.classList.toggle("sel", !!r && i >= r[0] && i <= r[1]); row.classList.toggle("focus", i === focus); });
    paintBar();
  }
  // gutter drag
  let dragging = null;
  gutter.addEventListener("mousedown", (ev) => {
    if (!SERVER) return;
    const row = rowAtY(ev.clientY); if (row == null) return;
    dragging = row; sel = { a: row, b: row }; focus = row; paintSel(); ev.preventDefault();
  });
  addEventListener("mousemove", (ev) => { if (dragging == null) return; const row = rowAtY(ev.clientY); if (row != null) { sel = { a: dragging, b: row }; focus = row; paintSel(); } });
  addEventListener("mouseup", () => { dragging = null; });
  function rowAtY(y) { for (const row of log.querySelectorAll(".mrow")) { const r = row.getBoundingClientRect(); if (y >= r.top && y <= r.bottom) return +row.dataset.i; } return null; }

  // overlay: gutter bars + margin cards
  const kindColor = (a) => a.is_conflict ? css("neg") : a.sentiment != null ? (a.sentiment >= 0 ? css("pos") : css("them")) : a.ctype ? css("s3") : css("ink2");
  function paintOverlay() {
    gutter.innerHTML = ""; margin.innerHTML = "";
    const idxs = byMonth.get(cur) || []; if (!idxs.length) return;
    const lo = idxs[0], hi = idxs[idxs.length - 1];
    const vis = anns().filter(pass).map((a) => ({ a, r: annRange(a) })).filter(({ r }) => r[0] != null && r[1] >= lo && r[0] <= hi).sort((p, q) => p.r[0] - q.r[0]);
    const lanes = [];
    let lastBottom = 0;
    vis.forEach(({ a, r }) => {
      const f = rowEl(Math.max(r[0], lo)), l = rowEl(Math.min(r[1], hi)); if (!f || !l) return;
      const top = f.offsetTop, bot = l.offsetTop + l.offsetHeight;
      let lane = lanes.findIndex((end) => end < top); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = bot;
      const gb = h("div", { class: "gbar", style: `top:${top}px;height:${bot - top}px;left:${2 + lane * 6}px;background:${kindColor(a)}` });
      gb.onclick = () => { sel = { a: r[0], b: r[1] }; paintSel(); };
      hover(gb, `<b>${annTitle(a)}</b>${a.note ? "<br>" + escapeHtml(a.note).slice(0, 160) : ""}`);
      gutter.append(gb);
      const cardEl = annCard(a, r);
      cardEl.style.top = Math.max(top, lastBottom + 6) + "px";
      margin.append(cardEl);
      lastBottom = Math.max(top, lastBottom + 6) + cardEl.offsetHeight;
    });
    margin.style.minHeight = Math.max(log.offsetHeight, lastBottom) + "px";
    gutter.style.height = log.offsetHeight + "px";
  }
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const annTitle = (a) => [a.is_conflict ? "Conflict" : null, a.sentiment != null ? `Sentiment ${sentLabel(a.sentiment)}` : null, a.ctype, ...(a.tags || []).map((x) => "#" + x)].filter(Boolean).join(" · ") || "Note";
  function annCard(a, r) {
    const c = h("div", { class: "mcard", style: `border-left-color:${kindColor(a)}` });
    const chipsRow = h("div", { class: "mchips" });
    if (a.is_conflict) chipsRow.append(h("span", { class: "chip c" }, "conflict"));
    if (a.sentiment != null) chipsRow.append(h("span", { class: "chip" }, "sentiment " + sentLabel(a.sentiment)));
    if (a.ctype) chipsRow.append(h("span", { class: "chip" }, a.ctype));
    (a.tags || []).forEach((x) => chipsRow.append(h("span", { class: "chip" }, "#" + x)));
    c.append(chipsRow);
    if (a.note) c.append(h("div", { class: "mnote" }, a.note));
    c.append(h("div", { class: "mmeta" }, `${fmtDate(msgs[r[0]][0])}${r[1] !== r[0] ? ` · ${r[1] - r[0] + 1} msgs` : ""} · ${(a.updated || a.created || "").replace("T", " ").slice(0, 16)}`));
    replies(a.id).forEach((rp) => c.append(h("div", { class: "mreply" }, [h("div", {}, rp.note), h("small", {}, (rp.created || "").replace("T", " ").slice(0, 16))])));
    if (SERVER) {
      const acts = h("div", { class: "mact" }, [
        link("Edit", () => { sel = { a: r[0], b: r[1] }; paintSel(); openEditor({ ann: a }); }),
        link("Reply", () => { const ta = h("textarea", { rows: 2, placeholder: "Reply…" }); const sv = link("Save", async () => { if (!ta.value.trim()) return; await api("POST", "/api/annotations", { ent: id, parent_id: a.id, note: ta.value, start_mid: a.start_mid, end_mid: a.end_mid, start_epoch: a.start_epoch, end_epoch: a.end_epoch }); await refreshState(); }, "btn xs"); acts.after(h("div", { class: "mreplyin" }, [ta, sv])); ta.focus(); }),
        link("Delete", async () => { if (confirm("Delete this annotation?")) { await api("DELETE", `/api/annotations/${a.id}`); await refreshState(); } }),
      ]);
      if (a.is_conflict) {
        const lab = STATE.labels.find((l) => l.annotation_id === a.id);
        if (lab) acts.append(analyzeButton("conflict", id, "u" + lab.id, { start_mid: a.start_mid, end_mid: a.end_mid }, "Analyze conflict"));
      }
      c.append(acts);
    }
    return c;
  }

  // toolbar + editor
  function paintBar() {
    const r = selRange();
    if (!SERVER || !r) { if (!editing) bar.hidden = true; return; }
    if (editing) return;
    bar.hidden = false; bar.innerHTML = "";
    const n = r[1] - r[0] + 1;
    const ty = h("select", { title: "Conversation type" }, [h("option", { value: "" }, "Type…"), ...ctypes().map((x) => h("option", { value: x }, x)), h("option", { value: "__edit" }, "Edit list…")]);
    ty.onchange = async () => {
      if (ty.value === "__edit") { const v = prompt("Conversation types, comma-separated", ctypes().join(", ")); if (v != null) { await api("POST", "/api/settings", { ctypes: v.split(",").map((x) => x.trim()).filter(Boolean) }); await refreshState(); } ty.value = ""; return; }
      if (ty.value) openEditor({ ctype: ty.value });
    };
    bar.append(h("b", {}, `${n} message${n > 1 ? "s" : ""} · ${fmtDate(msgs[r[0]][0])}`),
      link("Note  n", () => openEditor({ focus: "note" }), "btn"), link("Conflict  c", () => openEditor({ is_conflict: true }), "btn"),
      h("span", { class: "seg" }, [-2, -1, 0, 1, 2].map((v, k) => link(sentLabel(v), () => openEditor({ sentiment: v }), "btn xs", ))),
      ty, link("Tag  t", () => openEditor({ focus: "tags" }), "btn"), link("Clear", () => { sel = null; paintSel(); }, "btn ghost"));
  }
  function openEditor(preset = {}) {
    const r = selRange(); if (!r) return;
    const a = preset.ann || {};
    editing = true; bar.hidden = false; bar.innerHTML = "";
    const note = h("textarea", { rows: 3, placeholder: "Note (your words)…" }); note.value = a.note || "";
    const isC = h("input", { type: "checkbox" }); isC.checked = !!(preset.is_conflict ?? a.is_conflict);
    let sv = preset.sentiment ?? a.sentiment ?? null;
    const seg = h("span", { class: "seg" });
    const paintSeg = () => { seg.innerHTML = ""; [null, -2, -1, 0, 1, 2].forEach((v) => seg.append(link(v == null ? "–" : sentLabel(v), () => { sv = v; paintSeg(); }, "btn xs" + (sv === v ? " on" : "")))); };
    paintSeg();
    const ty = h("select", {}, [h("option", { value: "" }, "No type"), ...ctypes().map((x) => h("option", { value: x }, x))]); ty.value = preset.ctype ?? a.ctype ?? "";
    const tags = h("input", { type: "text", placeholder: "tags, comma-separated" }); tags.value = (a.tags || []).join(", ");
    const save = async () => {
      const r2 = selRange();
      await api("POST", "/api/annotations", { id: a.id, ent: id, start_mid: msgs[r2[0]][4], end_mid: msgs[r2[1]][4], start_epoch: msgs[r2[0]][0], end_epoch: msgs[r2[1]][0],
        note: note.value.trim(), is_conflict: isC.checked, sentiment: sv, ctype: ty.value || null, tags: tags.value.split(",").map((x) => x.trim().replace(/^#/, "")).filter(Boolean) });
      editing = null; sel = null; await refreshState();
    };
    const cancel = () => { editing = null; paintSel(); };
    bar.append(h("div", { class: "editor" }, [
      h("div", { class: "erow" }, [h("b", {}, `${a.id ? "Edit" : "New"} annotation · ${r[1] - r[0] + 1} messages from ${fmtDate(msgs[r[0]][0])}`)]),
      note,
      h("div", { class: "erow" }, [h("label", {}, [isC, " Conflict"]), h("span", {}, "Sentiment "), seg, ty, tags]),
      h("div", { class: "erow" }, [link("Save  ⌘↵", save, "btn primary"), link("Cancel  esc", cancel, "btn ghost")]),
    ]));
    [note, tags].forEach((el) => el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); save(); } if (ev.key === "Escape") { ev.stopPropagation(); cancel(); } }));
    (preset.focus === "tags" ? tags : note).focus();
  }

  // minimap
  function paintMini() {
    mini.innerHTML = "";
    const H = Math.min(innerHeight * 0.7, Math.max(240, keys.length * 4)), W = 46;
    const svg = svgBox(mini, W, H); svg.style.height = H + "px"; svg.style.width = W + "px";
    const rowH = H / keys.length, maxN = Math.max(...keys.map((k) => byMonth.get(k).length));
    const annMonths = new Map(); anns().filter(pass).forEach((a) => { const r = annRange(a); if (r[0] != null) { const k = monthOf(r[0]); annMonths.set(k, (annMonths.get(k) || 0) + 1); } });
    const candMonths = new Map(); cands.forEach((x) => { const k = monthOf(x.a); const lab = candLabel(x.c.cid)?.label; if (lab !== "not_conflict") candMonths.set(k, Math.max(candMonths.get(k) || 0, lab === "conflict" ? 2 : 1)); });
    STATE.labels.filter((l) => l.ent === id && l.source === "user").forEach((l) => { const i = midIdx.get(l.start_mid); if (i != null) candMonths.set(monthOf(i), 2); });
    keys.forEach((k, i) => {
      const y = i * rowH, n = byMonth.get(k).length;
      s("rect", { x: 0, y, width: Math.max(1, 26 * n / maxN), height: Math.max(rowH - 0.5, 0.8), fill: k === cur ? css("ink") : css("axis") }, svg);
      if (candMonths.has(k)) s("circle", { cx: 33, cy: y + rowH / 2, r: candMonths.get(k) === 2 ? 2.6 : 1.8, fill: css("neg"), opacity: candMonths.get(k) === 2 ? 1 : 0.55 }, svg);
      if (annMonths.has(k)) s("rect", { x: 39, y: y + rowH / 2 - 1.5, width: 6, height: 3, rx: 1, fill: css("me") }, svg);
    });
    s("rect", { x: 0, y: keys.indexOf(cur) * rowH - 1, width: W, height: rowH + 2, fill: "none", stroke: css("them"), "stroke-width": 1 }, svg);
    const hit = s("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }, svg);
    const at = (ev) => { const r = svg.getBoundingClientRect(); return Math.max(0, Math.min(keys.length - 1, Math.floor((ev.clientY - r.top) / r.height * keys.length))); };
    hover(hit, (ev) => { const k = keys[at(ev)]; return `<b>${mlabel(k)}</b><br>${fmt(byMonth.get(k).length)} messages${candMonths.has(k) ? "<br>conflict flagged" : ""}${annMonths.has(k) ? `<br>${annMonths.get(k)} annotation(s)` : ""}`; });
    hit.addEventListener("click", (ev) => go(at(ev)));
    mini.append(h("div", { class: "minileg" }, [h("span", {}, "density"), h("span", { style: "color:var(--neg)" }, "● conflict"), h("span", { style: "color:var(--me)" }, "▬ note")]));
  }

  // navigation, search
  sel_.onchange = () => go(keys.indexOf(sel_.value));
  dateIn.onchange = () => {
    if (!dateIn.value) return; const target = new Date(dateIn.value + "T00:00").getTime() / 1000;
    let idx = msgs.findIndex((m) => m[0] >= target); if (idx < 0) idx = msgs.length - 1; goIdx(idx);
  };
  let timer;
  search.oninput = () => {
    clearTimeout(timer); timer = setTimeout(() => {
      const qq = search.value.trim().toLowerCase(); res.innerHTML = "";
      if (qq.length < 2) { res.hidden = true; return; }
      const hits = []; for (let i = 0; i < msgs.length && hits.length < 300; i++) if (msgs[i][3] && msgs[i][3].toLowerCase().includes(qq)) hits.push(i);
      res.hidden = false;
      res.append(h("div", { class: "take" }, `${hits.length === 300 ? "300+" : hits.length} matches${hits.length ? ", click one to jump to it" : ""}`));
      hits.forEach((i) => {
        const [ts, me, who, text] = msgs[i];
        const r = link("", () => { res.hidden = true; goIdx(i); }, "hit");
        r.append(h("b", {}, `${fmtDate(ts)} · ${me ? "me" : who || e.name}: `), document.createTextNode(text.length > 140 ? text.slice(0, 140) + "…" : text));
        res.append(r);
      });
    }, 200);
  };
  const keyHandler = (ev) => {
    if (modal.hidden || !grid.isConnected) { removeEventListener("keydown", keyHandler); return; }
    if (ev.target.matches("input, textarea, select")) return;
    const k = ev.key;
    if (k === "/") { ev.preventDefault(); search.focus(); return; }
    if (k === "j" || k === "k") { const i = Math.max(0, Math.min(msgs.length - 1, (focus ?? (byMonth.get(cur) || [0])[0]) + (k === "j" ? 1 : -1))); if (ev.shiftKey && sel) sel = { a: sel.a, b: i }; else if (sel) sel = { a: i, b: i }; goIdx(i); paintSel(); return; }
    if (k === "[" || k === "]") {
      const list = anns().map((a) => annRange(a)[0]).filter((x) => x != null).sort((p, q) => p - q);
      const from = focus ?? -1; const tgt = k === "]" ? list.find((x) => x > from) : [...list].reverse().find((x) => x < from);
      if (tgt != null) { const a = anns().find((x) => annRange(x)[0] === tgt); const r = annRange(a); sel = { a: r[0], b: r[1] }; goIdx(tgt); paintSel(); }
      return;
    }
    if (!SERVER) return;
    if (!sel && focus != null && "nct12345".includes(k)) sel = { a: focus, b: focus };
    if (!sel) return;
    if (k === "n") { ev.preventDefault(); openEditor({ focus: "note" }); }
    else if (k === "c") { ev.preventDefault(); openEditor({ is_conflict: true }); }
    else if (k === "t") { ev.preventDefault(); openEditor({ focus: "tags" }); }
    else if ("12345".includes(k)) { ev.preventDefault(); openEditor({ sentiment: +k - 3 }); }
  };
  addEventListener("keydown", keyHandler);
  const off = onState(() => { if (!grid.isConnected) { off(); return; } paintDet(); paintChips(); if (!editing) render(cur); });
  paintDet(); paintChips();
  let start = keys.length - 1, focusIdx;
  if (atEpoch) { const idx = msgs.findIndex((m) => m[0] >= atEpoch); if (idx >= 0) { start = keys.indexOf(monthOf(idx)); focusIdx = idx; } }
  if (highlightMid != null && midIdx.has(highlightMid)) { focusIdx = midIdx.get(highlightMid); start = keys.indexOf(monthOf(focusIdx)); }
  go(start, focusIdx);
}

// ---------- Brain2: link a relationship to a Person ----------
// Only inside Brain2 (Analytics → Texts frames this page). Brain2 posts People I Know
// here (names and the numbers saved on each). Linking saves this chat's numbers on that
// Person in Brain2, so its texts and calls pens show their name. The links are also
// saved here (settings → people_links), so every number on one Person becomes one
// card at the next update (analyze.py). Nothing leaves this Mac.
const IN_BRAIN2 = window.parent !== window;
let B2 = { people: null, origin: null, applyOnNext: false };
let OV = DET.overrides || {};
function b2Norm(x) {
  const raw = String(x || "").trim();
  if (!raw) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return raw.toLowerCase();
  if (!/^[+\d\s().\-]+$/.test(raw)) return raw.toLowerCase();
  const d = raw.replace(/\D/g, "");
  if (!d) return raw.toLowerCase();
  if (raw.startsWith("+")) return "+" + d;
  if (d.startsWith("00") && d.length > 6) return "+" + d.slice(2);
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return d;
}
function b2Send(msg) { if (IN_BRAIN2 && B2.origin) window.parent.postMessage({ source: "texts-report", ...msg }, B2.origin); }
function b2Linked(e) {
  const mine = new Set((e.handles || []).map(b2Norm).filter(Boolean));
  return (B2.people || []).find((p) => (p.handles || []).some((x) => mine.has(b2Norm(x))));
}
const personEnts = () => Object.values(E).filter((x) => x.kind === "person");
function entForHandles(handles) {
  const want = new Set((handles || []).map(b2Norm).filter(Boolean));
  return personEnts().find((x) => (x.handles || []).some((hd) => want.has(b2Norm(hd))));
}
let applyNote = "";
// Save one override, then re-run the pipeline so cards merge or rename. Brain2 reloads the frame when it ends.
async function saveOverride(key, value) {
  OV = { ...OV, [key]: value };
  await api("POST", "/api/settings", { [key]: value });
  await applyOverrides();
}
async function applyOverrides() {
  await api("POST", "/api/refresh");
  applyNote = IN_BRAIN2 ? "Updating the report to apply this. It reloads when done." : "Updating the report. Reload this page when Update finishes.";
  b2Send({ type: "refreshing" });
  listeners.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } });
}
async function syncPeopleLinks() {
  if (!SERVER) return;
  const links = B2.people.filter((p) => p.handles?.length).map((p) => ({ id: p.id, name: p.name, handles: p.handles.map(b2Norm).filter(Boolean).sort() }));
  if (JSON.stringify(links) === JSON.stringify(OV.people_links || [])) return;
  OV = { ...OV, people_links: links };
  await api("POST", "/api/settings", { people_links: links });
  if (B2.applyOnNext) { B2.applyOnNext = false; await applyOverrides(); }
}
if (IN_BRAIN2) {
  window.addEventListener("message", (ev) => {
    if (ev.source !== window.parent || ev.data?.source !== "brain2") return;
    if (ev.data.type === "people") {
      B2 = { ...B2, people: ev.data.people || [], origin: ev.origin };
      b2Send({ type: "index", people: personEnts().map((x) => ({ ent: x.id, name: x.name, handles: x.handles || [] })) });
      syncPeopleLinks().catch((err) => console.error(err));
      listeners.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } });
    } else if (ev.data.type === "open" && ev.origin === B2.origin) {
      const hit = entForHandles(ev.data.handles);
      if (hit) openRelationship(hit.id);
    }
  });
  window.parent.postMessage({ source: "texts-report", type: "ready" }, "*");
}
function brain2Card(parent, e) {
  if (!IN_BRAIN2 || e.kind !== "person") return;
  const c = card(parent, "Person in Brain2", "Link this chat to someone in People I Know, or make them a new person. Their texts and calls in Tracking then show their name, and every number saved on them becomes one card here.");
  if (!B2.people) { c.append(h("p", { class: "take" }, "Waiting for Brain2…")); return; }
  if (!e.handles?.length) { c.append(h("p", { class: "take" }, "Press Update now above, then link. This report was built before it kept numbers.")); return; }
  c.append(h("p", { class: "take" }, `Numbers in this chat: ${e.handles.join(", ")}`));
  const act = (msg) => { B2.applyOnNext = SERVER; b2Send(msg); };
  const linked = b2Linked(e);
  if (linked) {
    c.append(h("div", { class: "row" }, [h("span", {}, ["Linked to ", h("b", {}, linked.name), "."]),
      link("Open in Brain2", () => b2Send({ type: "open-person", personId: linked.id }), "btn xs"),
      link("Unlink", () => act({ type: "unlink", personId: linked.id, handles: e.handles }), "btn xs")]));
  }
  const q = h("input", { type: "search", placeholder: linked ? "Link to someone else…" : "Search People I Know…", "aria-label": "Search People I Know" });
  const res = h("div", { class: "row" });
  q.oninput = () => {
    res.innerHTML = "";
    const t = q.value.trim().toLowerCase();
    if (!t) return;
    const hits = B2.people.filter((p) => [p.name, ...(p.nicknames || [])].some((n) => n && n.toLowerCase().includes(t))).slice(0, 8);
    if (!hits.length) res.append(h("span", { class: "take" }, "No one by that name in People I Know."));
    hits.forEach((p) => res.append(link(p.name, () => act({ type: "link", personId: p.id, handles: e.handles }), "btn xs" + (linked?.id === p.id ? " on" : ""))));
  };
  c.append(h("div", { class: "tctrl", style: "position:static" }, [q]), res);
  if (!linked) {
    const nm = h("input", { type: "text", value: e.name, "aria-label": "New person's name" });
    c.append(h("div", { class: "tctrl", style: "position:static" }, [h("span", { class: "take" }, "Or make a new person:"), nm,
      link("Create in People I Know", () => { const name = nm.value.trim(); if (name) act({ type: "create-person", name, handles: e.handles }); }, "btn xs")]));
  }
}
// Rename a card and fold other chats into it. Saved in settings (names / merges), so they hold through every update.
function mergeCard(parent, e) {
  if (!SERVER || e.kind !== "person") return;
  const c = card(parent, "Name and merge", "Give this card a name, or fold another chat into it (an old number, a second email). It holds through every update.");
  if (applyNote) c.append(h("p", { class: "take" }, applyNote));
  if (!e.key) { c.append(h("p", { class: "take" }, "Press Update now first. This report was built before cards could merge.")); return; }
  const nm = h("input", { type: "text", value: e.name, "aria-label": "Card name" });
  c.append(h("div", { class: "tctrl", style: "position:static" }, [nm, link("Rename", () => { const v = nm.value.trim(); if (v && v !== e.name) saveOverride("names", { ...(OV.names || {}), [e.key]: v }); }, "btn xs")]));
  const merges = OV.merges || {};
  const here = Object.entries(merges).filter(([, v]) => (v?.to ?? v) === e.key);
  if (here.length) {
    c.append(h("h4", {}, "Merged into this card"));
    c.append(h("div", { class: "row" }, here.map(([from, v]) => h("span", { class: "chip" }, [v?.name || from, " ",
      link("Undo", () => { const next = { ...merges }; delete next[from]; saveOverride("merges", next); }, "btn xs")]))));
  }
  const q = h("input", { type: "search", placeholder: "Merge another chat into this one…", "aria-label": "Search chats to merge" });
  const res = h("div", { class: "row" });
  q.oninput = () => {
    res.innerHTML = "";
    const t = q.value.trim().toLowerCase();
    if (!t) return;
    const hits = personEnts().filter((x) => x.id !== e.id && x.key && (x.name.toLowerCase().includes(t) || (x.handles || []).some((hd) => hd.includes(t)))).slice(0, 8);
    if (!hits.length) res.append(h("span", { class: "take" }, "No other chat matches."));
    hits.forEach((x) => res.append(link(`${x.name} (${fmt(x.total)})`, () => saveOverride("merges", { ...merges, [x.key]: { to: e.key, name: x.name } }), "btn xs")));
  };
  c.append(h("div", { class: "tctrl", style: "position:static" }, [q]), res);
}

// ---------- relationship page ----------
function openRelationship(eid) {
  const e = E[eid];
  const b = openModal(`${e.name}: relationship`);
  mbody.parentElement.classList.add("wide");
  const body = h("div"); b.append(body);
  const paint = () => {
    body.innerHTML = "";
    const cl = e.closeness;
    body.append(h("p", { class: "take" }, `${fmt(e.total)} messages from ${e.first} to ${e.last}` + (cl ? ` · closeness ${cl.score} (#${cl.rank} of 20)` : "") + "."));
    body.append(h("div", { class: "row" }, [link("Messages", () => openThread(eid), "btn"), link("Words ☁", () => openWords(e), "btn"), link("Calendar", () => openCalendar(e), "btn")]));
    brain2Card(body, e);
    mergeCard(body, e);
    const top = h("div", { class: "grid2" }); body.append(top);
    // AI read
    const ai = card(top, "AI relationship report", SERVER ? "Generated by the local model from yearly samples, your metrics, your notes and your confirmed conflicts." : "Run serve.py to generate it.");
    ai.append(h("div", { class: "row" }, [analyzeButton("relationship", eid, eid, {}, "Analyze relationship")]));
    const done = latestDone("relationship", eid);
    const act = activeJob("relationship", eid);
    if (act) ai.append(h("p", { class: "take" }, `Working: ${act.progress || act.status}. Usually a few minutes per year of history.`));
    if (done?.result && !done.result.error) {
      const r = done.result;
      aiBlock(ai, [["In one line", r.headline], ["Closeness and trajectory", r.closeness_and_trajectory], ["Dynamics and emotional work", r.dynamics_and_emotional_work],
        ["Depth vs logistics", r.depth_vs_logistics], ["Topics discussed", r.topics_discussed], ["Topics avoided", r.topics_avoided], ["Conflict style", r.conflict_style],
        ["Bids and responsiveness", r.bids_and_responsiveness], ["How you show up", r.how_you_show_up], ["Evidence", r.evidence]]);
      ai.append(h("p", { class: "take" }, `Generated ${(r.generated || done.finished || "").replace("T", " ")} · ${r.model || ""}`));
      if (r.yearly) { const d = h("details"); d.append(h("summary", {}, "Year by year")); Object.entries(r.yearly).forEach(([y, v]) => d.append(h("p", {}, [h("b", {}, y + ": "), v.summary || ""]))); ai.append(d); }
    }
    // notes
    const nc = card(top, "Your notes", "Only on this Mac. They're included as context when you analyze.");
    if (SERVER) {
      nc.append(notesEditor("relationship", eid, null, "What you know about this relationship that the texts don't show…"));
      nc.append(h("h4", {}, "Notes on periods"));
      STATE.notes.filter((n) => n.scope === "period" && n.ent === eid).forEach((n) => nc.append(h("div", { class: "pnote" }, [h("b", {}, `${n.period_start} → ${n.period_end}`), h("div", {}, n.body),
        link("Delete", async () => { await api("DELETE", `/api/notes/${n.id}`); await refreshState(); })])));
      const f = h("input", { type: "month", min: e.first.slice(0, 7), max: e.last.slice(0, 7) }), t2 = h("input", { type: "month", min: e.first.slice(0, 7), max: e.last.slice(0, 7) });
      const ta = h("textarea", { rows: 2, placeholder: "What was going on in this period…" });
      nc.append(h("div", { class: "erow" }, [f, h("span", {}, "→"), t2]), ta, link("Add period note", async () => { if (!f.value || !ta.value.trim()) return; await api("POST", "/api/notes", { scope: "period", ent: eid, period_start: f.value, period_end: t2.value || f.value, body: ta.value.trim() }); await refreshState(); }, "btn"));
    } else nc.append(h("p", { class: "take" }, "Run serve.py to write notes."));
    // metrics
    if (e.closeness_raw) {
      const mc = card(body, "Signals", "");
      const comps = DET.closeness_components, C = cl.components;
      const bars = h("div", { class: "cbars" }); comps.forEach((k) => { const v = C[k.key]; bars.append(h("div", { class: "cbar", title: `${k.label}: ${v == null ? "n/a" : v.toFixed(2)}` }, [h("span", {}, k.label), h("i", { style: `width:${v == null ? 0 : v * 100}%` })])); });
      mc.append(bars, h("ul", { class: "facts" }, relFacts(e).map((x) => h("li", {}, x))), relSparks(e));
      if (e.inflections?.length) mc.append(h("div", { class: "dline", html: `<span>Turning points</span> ` + e.inflections.map((x) => `${mlabel(x.month)}: ${x.metric} ${x.direction === "up" ? "↑" : "↓"}`).join(" · ") }));
    }
    const g2 = h("div", { class: "grid2" }); body.append(g2);
    const pc = card(g2, "Pronouns and length", "");
    const pa = e.pronouns.me || {}, pb = e.pronouns.them || {}, la = e.length.me || {}, lb = e.length.them || {};
    table(pc, ["", "I /100", "you /100", "we /100", "I:you", "chars", "words"], [["Me", pa.i_rate, pa.you_rate, pa.we_rate, pa.i_to_you, la.chars_mean?.toFixed(1), la.words_mean?.toFixed(1)], [e.name, pb.i_rate, pb.you_rate, pb.we_rate, pb.i_to_you, lb.chars_mean?.toFixed(1), lb.words_mean?.toFixed(1)]].map((r) => r.map((v) => v ?? "–")), [1, 2, 3, 4, 5, 6]);
    const tc = card(g2, "Topics vs your normal", "Keyword-based. Above 1× means this topic comes up more than in your texts overall.");
    tc.append(h("div", { class: "chips" }, Object.entries(e.themes).sort((x, y) => (y[1].lift || 0) - (x[1].lift || 0)).map(([k, v]) => h("span", { class: "chip", html: `${k}<b>${v.lift == null ? "–" : v.lift.toFixed(1) + "×"}</b>` }))));
    // conflicts
    const cc = card(body, "Conflicts", "Detected candidates and the ones you marked. Confirm or reject to teach the detector.");
    const refs = conflictRefs(eid);
    if (!refs.length) cc.append(h("p", { class: "take" }, "None detected or marked."));
    else table(cc, ["Date", "Source", "Status", "AI", ""], refs.map((x) => {
      const lab = x.c ? candLabel(x.c.cid)?.label : "conflict"; const d = latestDone("conflict", x.ref);
      return [fmtDate(x.start_epoch), x.kind === "marked" ? "you" : `detector${conf(x.ref) != null ? " · " + conf(x.ref) : ""}`, lab === "conflict" ? "confirmed" : lab === "not_conflict" ? "not a conflict" : "unreviewed",
        d?.result ? (d.result.title || "done") : "–", h("span", { class: "row" }, [link("Open", () => openConflict(eid, x.ref), "btn xs"), link("Messages", () => openThread(eid, x.start_epoch, x.start_mid), "btn xs")])];
    }));
    // annotations
    const an = STATE.annotations.filter((a) => a.ent === eid && !a.parent_id);
    if (an.length) {
      const ac = card(body, "Your annotations", `${an.length} in this chat.`);
      table(ac, ["Date", "What", "Note", ""], an.map((a) => [fmtDate(a.start_epoch), [a.is_conflict ? "conflict" : "", a.sentiment != null ? "sentiment " + sentLabel(a.sentiment) : "", a.ctype || "", ...(a.tags || []).map((x) => "#" + x)].filter(Boolean).join(" · ") || "note",
        (a.note || "").slice(0, 120), link("Open", () => openThread(eid, a.start_epoch, a.start_mid), "btn xs")]));
    }
    const wc = card(body, "Words", ""); renderWords(wc, e, false);
    const cal = card(body, "Every day", ""); renderCalendar(cal, e);
  };
  paint();
  const off = onState(() => { if (!body.isConnected) { off(); return; } const y = mbody.parentElement.scrollTop; paint(); mbody.parentElement.scrollTop = y; });
}

// ---------- conflicts review on the main page ----------
{
  const root = $("conflicts");
  const box = h("div"); root.prepend(box);
  const paint = () => {
    box.innerHTML = "";
    if (!SERVER) { box.append(h("p", { class: "take" }, "To review conflicts, add notes and run \"Analyze conflict\", start the local app: cd ~/texts-analysis && .venv/bin/python serve.py")); return; }
    const d = STATE.detector;
    const reviewed = CANDS.filter((c) => candLabel(c.cid)).length;
    const c = card(box, "Review queue", `Detector: ${d?.n_labels ?? 0} labels${d?.precision != null ? `, precision ${d.precision}` : ""}${d?.recall_user != null ? `, caught ${pct(d.recall_user)} of the conflicts you marked` : ""}. ${d?.model_trained ? "It's learning from your labels and now ranks candidates by model confidence." : `After 30 labels it starts learning from them (${reviewed} reviewed so far).`}`);
    const order = CANDS.slice().sort((a, b) => (conf(b.cid) ?? b.strength / 3) - (conf(a.cid) ?? a.strength / 3) || b.neg_me + b.neg_them - a.neg_me - a.neg_them);
    const fsel = h("select", {}, [["open", "Unreviewed"], ["conflict", "Confirmed"], ["not_conflict", "Not a conflict"], ["all", "All"]].map(([v, l]) => h("option", { value: v }, l)));
    fsel.value = box.dataset.f || "open"; fsel.onchange = () => { box.dataset.f = fsel.value; paint(); };
    c.append(h("div", { class: "row" }, [h("span", { class: "take" }, "Show"), fsel]));
    const shown = order.filter((x) => { const l = candLabel(x.cid)?.label; return fsel.value === "all" || (fsel.value === "open" ? !l : l === fsel.value); }).slice(0, 80);
    table(c, ["Date", "Person", "Msgs", "Confidence", "Status", ""], shown.map((x) => {
      const l = candLabel(x.cid)?.label;
      return [x.start.slice(0, 16), x.name, x.messages, conf(x.cid) ?? "–", l === "conflict" ? "confirmed" : l === "not_conflict" ? "not a conflict" : "–",
        h("span", { class: "row" }, [link("Confirm", () => setLabel(x, l === "conflict" ? "clear" : "conflict"), "btn xs" + (l === "conflict" ? " on" : "")), link("Not", () => setLabel(x, l === "not_conflict" ? "clear" : "not_conflict"), "btn xs" + (l === "not_conflict" ? " on" : "")),
          link("Open", () => openThread(x.ent, x.hot_start_epoch || x.start_epoch), "btn xs"), analyzeButton("conflict", x.ent, x.cid, { ...candRange(x), cid: x.cid }, "Analyze")])];
    }), [2, 3]);
    const done = STATE.jobs.filter((j) => j.kind === "conflict" && j.status === "done" && j.result && j.result.is_conflict !== false);
    const seen = new Set(), uniq = done.filter((j) => !seen.has(j.ref) && seen.add(j.ref));
    if (uniq.length) {
      const ac = card(box, "Analyzed conflicts", `${uniq.length} analyzed so far.`);
      uniq.sort((a, b) => String(a.result.start).localeCompare(String(b.result.start))).forEach((j) => {
        const cc = h("div", { class: "card ccard" }); conflictResult(cc, j.result, `${E[j.ent]?.name} · generated ${(j.result.generated || "").replace("T", " ")}`);
        cc.append(h("div", { class: "row" }, [link("Open in messages →", () => openThread(j.ent, j.result.start_epoch, j.result.start_mid), "btn"), link("Notes", () => openConflict(j.ent, j.ref), "btn")]));
        ac.append(cc);
      });
    }
  };
  paint(); onState(paint);
}

if (SERVER) refreshState().then(() => { if (STATE.jobs.some((j) => j.status === "queued" || j.status === "running")) pollJobs(); });
