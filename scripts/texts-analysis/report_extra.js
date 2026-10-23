// Second-pass sections for report.html. Reads DET (out/detail.json), loads threads lazily.
const E = DET.entities;
const people = Object.values(E).filter((e) => e.kind === "person");
const groups = Object.values(E).filter((e) => e.kind === "group");
const close20 = DET.closeness_people.map((id) => E[id]);

// ---------- modal ----------
const modal = $("modal"), mbody = $("mbody");
function openModal(title) {
  mbody.innerHTML = ""; mbody.parentElement.classList.remove("wide"); mbody.append(h("h3", { class: "mtitle" }, title));
  modal.hidden = false; document.body.style.overflow = "hidden";
  return mbody;
}
function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
$("mclose").onclick = closeModal;
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

function link(text, fn, cls = "link") { const a = h("button", { class: cls, type: "button" }, text); a.onclick = fn; return a; }
const threadLink = (e, label) => link(label || e.name, () => openThread(e.id));

// ---------- word cloud ----------
const measure = document.createElement("canvas").getContext("2d");
function wordcloud(parent, words, opts = {}) {
  const W = 900, H = opts.h || 380;
  const svg = svgBox(parent, W, H);
  if (!words.length) { svgText(svg, W / 2, H / 2, "Not enough words", { "text-anchor": "middle" }); return; }
  const val = (w) => w.z ?? w.count;
  const vs = words.map(val), mx = Math.max(...vs), mn = Math.min(...vs);
  const size = (v) => 12 + 40 * Math.sqrt((v - mn) / (mx - mn || 1));
  const placed = [];
  const colors = [css("ink"), css("me"), css("them"), css("ink2")];
  words.slice(0, opts.n || 70).forEach((w, i) => {
    const fs = size(val(w));
    measure.font = `600 ${fs}px system-ui, -apple-system, sans-serif`;
    const tw = measure.measureText(w.term).width + 4, th = fs * 0.95;
    for (let t = 0; t < 2400; t++) {
      const a = 0.35 * t, r = 2.2 * a;
      const cx = W / 2 + r * Math.cos(a) * 1.7, cy = H / 2 + r * Math.sin(a);
      const box = [cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2];
      if (box[0] < 0 || box[2] > W || box[1] < 0 || box[3] > H) continue;
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      const el = svgText(svg, cx, cy + fs * 0.33, w.term, { "text-anchor": "middle", style: `font-size:${fs}px;font-weight:600;fill:${colors[i % (i < 4 ? 1 : 4)]}` });
      hover(el, `<b>${w.term}</b><br>${w.count != null ? fmt(w.count) + " uses" : ""}${w.z != null ? `<br>distinctiveness z = ${w.z}` : ""}`);
      break;
    }
  });
}
function chipList(parent, list, n = 40) {
  parent.append(h("div", { class: "chips" }, list.slice(0, n).map((r) => h("span", { class: "chip", html: `${r.term}<b>${r.count != null ? fmt(r.count) : ""}</b>` }))));
}
function tabs(parent, defs) {
  const bar = h("div", { class: "tabs" }), body = h("div");
  parent.append(bar, body);
  const show = (i) => { [...bar.children].forEach((b, j) => b.classList.toggle("on", i === j)); body.innerHTML = ""; defs[i][1](body); };
  defs.forEach(([label], i) => { const b = link(label, () => show(i), "tab"); bar.append(b); });
  show(0);
}
function mergeCounts(a, b) {
  const m = new Map(); [...a, ...b].forEach((r) => m.set(r.term, (m.get(r.term) || 0) + r.count));
  return [...m].map(([term, count]) => ({ term, count })).sort((x, y) => y.count - x.count);
}
function openWords(e) { renderWords(openModal(`${e.name}: words`), e, true); }
function renderWords(b, e, withLink) {
  b.append(h("p", { class: "take" }, `${fmt(e.total)} messages, ${e.first} to ${e.last}. "Common" means the most used words, stopwords removed. "Distinctive" means words used in this chat far more than in the rest of your texts (log-odds z-score).`));
  const both = mergeCounts(e.words.common_me, e.words.common_them);
  tabs(b, [
    ["Common, both", (p) => { wordcloud(p, both); chipList(p, both); }],
    ["Distinctive, chat", (p) => { wordcloud(p, e.words.distinctive_chat); chipList(p, e.words.distinctive_chat); }],
    ["My common", (p) => { wordcloud(p, e.words.common_me); chipList(p, e.words.common_me); }],
    ["My distinctive", (p) => { wordcloud(p, e.words.distinctive_me); chipList(p, e.words.distinctive_me); }],
    [e.kind === "group" ? "Their common" : "Their common", (p) => { wordcloud(p, e.words.common_them); chipList(p, e.words.common_them); }],
    ["Their distinctive", (p) => { wordcloud(p, e.words.distinctive_them); chipList(p, e.words.distinctive_them); }],
  ]);
  if (withLink) b.append(h("div", { class: "row" }, [threadLink(e, "Open messages →")]));
}
function openYearWords(y) {
  const d = DET.years[y]; if (!d) return;
  const b = openModal(`${y}: my words`);
  b.append(h("p", { class: "take" }, `${fmt(d.words)} content words I sent in ${y}. "Distinctive" means words I used far more that year than in my other years (log-odds z-score).`));
  tabs(b, [
    ["Distinctive", (p) => { wordcloud(p, d.distinctive); chipList(p, d.distinctive); }],
    ["Common", (p) => { wordcloud(p, d.common); chipList(p, d.common); }],
  ]);
}

// ---------- message browser ----------
const threadCache = {}, threadWait = {};
window.__thread = (t) => { threadCache[t.id] = t; (threadWait[t.id] || []).forEach((f) => f(t)); delete threadWait[t.id]; };
function loadThread(id) {
  if (threadCache[id]) return Promise.resolve(threadCache[id]);
  return new Promise((res, rej) => {
    (threadWait[id] = threadWait[id] || []).push(res);
    const sc = document.createElement("script"); sc.src = `threads/${id}.js`;
    sc.onerror = () => rej(new Error("Could not load threads/" + id + ".js"));
    document.head.append(sc);
  });
}
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayStr = (d) => `${DOW[(d.getDay() + 6) % 7]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const timeStr = (d) => `${(d.getHours() % 12) || 12}:${pad(d.getMinutes())}${d.getHours() < 12 ? "am" : "pm"}`;
// ---------- calendar ----------
const day0 = new Date(DET.meta.first_day + "T12:00");
const dayAt = (i) => new Date(day0.getTime() + i * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);
function renderCalendar(b, e) {
  const S2 = e.streaks;
  b.append(h("p", { class: "take" }, `${fmt(S2.active_days)} active days out of ${fmt(S2.span_days)} (${pct(S2.active_share)}); both of you texted on ${fmt(S2.both_days)}. Longest streaks: ${S2.longest_any.slice(0, 3).map((r) => `${r.days}d (${r.start} → ${r.end})`).join(", ")}.`));
  const yrs = [...new Set(Array.from({ length: S2.calendar.length }, (_, i) => dayAt(i).getFullYear()))];
  const brk = new Set(S2.breaks);
  yrs.forEach((y) => {
    const wrap = h("div", { class: "cal" }, [h("div", { class: "caly" }, String(y))]); b.append(wrap);
    const cw = 12, W = 54 * cw, H = 7 * cw;
    const svg = svgBox(wrap, W, H);
    const jan1 = new Date(y, 0, 1, 12), off = (jan1.getDay() + 6) % 7;
    for (let d = new Date(jan1); d.getFullYear() === y; d = new Date(d.getTime() + 864e5)) {
      const k = Math.round((d - day0) / 864e5); if (k < 0 || k >= S2.calendar.length) continue;
      const doy = Math.round((d - jan1) / 864e5) + off, col = Math.floor(doy / 7), row = (d.getDay() + 6) % 7;
      const st = S2.calendar[k], isBreak = brk.has(iso(d));
      const r = s("rect", { x: col * cw, y: row * cw, width: cw - 2, height: cw - 2, rx: 2, fill: st === "2" ? css("me") : st === "1" ? `color-mix(in oklab, ${css("me")} 35%, ${css("surface")})` : css("grid"), stroke: isBreak ? css("neg") : "none", "stroke-width": isBreak ? 2 : 0 }, svg);
      const ds = iso(d); r.style.cursor = "pointer";
      hover(r, `<b>${ds}</b><br>${st === "2" ? "both texted" : st === "1" ? "one side" : "no texts"}${isBreak ? "<br>streak broke here" : ""}`);
      r.addEventListener("click", () => openThread(e.id, new Date(ds + "T00:00").getTime() / 1000));
    }
  });
  b.append(h("p", { class: "take" }, "Click a day to open the messages from that day."));
}
function openCalendar(e) { renderCalendar(openModal(`${e.name}: every day`), e); }

// ---------- texts per day ----------
{
  const root = $("perday"), PD = DET.per_day;
  const yrs = Object.keys(PD.yearly);
  const fullYrs = yrs.filter((y) => PD.yearly[y].days >= 300);
  const top = fullYrs.slice().sort((a, b) => PD.yearly[b].avg - PD.yearly[a].avg)[0], low = fullYrs.slice().sort((a, b) => PD.yearly[a].avg - PD.yearly[b].avg)[0];
  const t = h("div", { class: "tiles" }); root.append(t);
  [[PD.overall, "texts per day, overall"], [PD.yearly[top].avg, `per day in ${top}, the busiest full year`], [PD.yearly[low].avg, `per day in ${low}, the quietest full year`], [fmt(PD.zero_days), "days with no texts at all"]]
    .forEach(([v, l]) => t.append(h("div", { class: "tile" }, [h("div", { class: "v" }, String(v)), h("div", { class: "l" }, l)])));
  const g = h("div", { class: "grid2" }); root.append(g);
  const cy = card(g, "Average texts per day, by year", `Counted over calendar days, leaving out the ${PD.days_excluded} days in the no-data gap. ${top} averaged ${PD.yearly[top].avg} a day, ${low} ${PD.yearly[low].avg}.`);
  hbarsStacked(cy, yrs.map((y) => ({ name: y + (PD.yearly[y].days < 300 ? "*" : ""), n: PD.yearly[y].avg, days: PD.yearly[y].days })), [{ key: "n", name: "Texts/day", color: css("me") }], { labelW: 56, extra: (r) => `<br>${r.days} days counted` });
  const moy = PD.month_of_year; const mk = Object.keys(moy);
  const best = mk.slice().sort((a, b) => moy[b].avg - moy[a].avg)[0], worst = mk.slice().sort((a, b) => moy[a].avg - moy[b].avg)[0];
  const cm = card(g, "Average by calendar month, across all years", `${MON[best - 1]} is your busiest month of the year (${moy[best].avg}/day across ${moy[best].years} years) and ${MON[worst - 1]} the quietest (${moy[worst].avg}/day).`);
  hbarsStacked(cm, mk.map((m) => ({ name: MON[m - 1], n: moy[m].avg, years: moy[m].years })), [{ key: "n", name: "Texts/day", color: css("s3") }], { labelW: 40, extra: (r) => `<br>average of ${r.years} years` });
  const mo = PD.monthly;
  const peak = Object.keys(mo).sort((a, b) => mo[b].avg - mo[a].avg)[0];
  const cl = card(root, "Average texts per day, each month", `The highest month was ${mlabel(peak)} at ${mo[peak].avg} a day. Hover a month to compare it with that calendar month's average across years. Shaded months have no data.`);
  linesMonths(cl, months, [{ name: "Texts/day", values: months.map((m) => mo[m]?.avg ?? null), color: css("me") },
    { name: "Same month, all-years avg", values: months.map((m) => moy[+m.slice(5)]?.avg ?? null), color: css("muted"), width: 1, opacity: 0.6 }], { gaps: bigGaps, dec: 1, min: 0 });
  legend(cl, [["This month", css("me")], ["That calendar month, all-years average", css("muted")]]);
}

// ---------- directory ----------
{
  const root = $("dir");
  root.append(h("p", { class: "take" }, "Your top 30 people and top 10 group chats. Click Words for a word cloud with common and distinctive words, or Messages to scroll the full history."));
  const grid = h("div", { class: "dgrid" }); root.append(grid);
  [...people, ...groups].forEach((e) => {
    const both = mergeCounts(e.words.common_me, e.words.common_them).slice(0, 8);
    const dist = e.words.distinctive_chat.slice(0, 6);
    const c = h("div", { class: "dcard" }, [
      h("div", { class: "dhead" }, [h("b", {}, e.name), h("span", {}, e.kind === "group" ? `group · ${e.members} others` : "")]),
      h("div", { class: "dmeta" }, `${fmt(e.total)} messages · ${e.first.slice(0, 4)}–${e.last.slice(0, 4)}`),
      h("div", { class: "dline", html: `<span>Common</span> ${both.map((r) => r.term).join(", ")}` }),
      h("div", { class: "dline", html: `<span>Distinctive</span> ${dist.map((r) => r.term).join(", ") || "–"}` }),
      h("div", { class: "row" }, [...(e.kind === "person" ? [link("Relationship", () => openRelationship(e.id), "btn")] : []), link("Words ☁", () => openWords(e), "btn"), link("Messages", () => openThread(e.id), "btn")]),
    ]);
    grid.append(c);
  });
}

// make the year cards (Language section) open their word cloud
document.querySelectorAll("[data-year]").forEach((el) => { el.classList.add("clickable"); el.title = "Open word cloud"; el.onclick = () => openYearWords(el.dataset.year); });

// ---------- pronouns, length ----------
{
  const root = $("style2");
  const PY = DET.pronouns_by_year, yrs = Object.keys(PY);
  const o = DET.pronouns_overall;
  const c = card(root, "I vs you vs we, per 100 words", `Overall I use ${o.me.i_rate} first-person words and ${o.me.you_rate} you-words per 100 (I:you ${o.me.i_to_you}); the people I text use ${o.them.i_rate} and ${o.them.you_rate} (${o.them.i_to_you}). "u" counts as "you" only when it stands alone.`);
  table(c, ["Year", "My I", "My you", "My we", "My I:you", "Their I", "Their you", "Their we", "Their I:you"],
    yrs.map((y) => { const a = PY[y].me || {}, b = PY[y].them || {}; return [y, a.i_rate, a.you_rate, a.we_rate, a.i_to_you, b.i_rate, b.you_rate, b.we_rate, b.i_to_you].map((v) => v ?? "–"); }), [1, 2, 3, 4, 5, 6, 7, 8]);
  const rows = people.map((e) => ({ e, a: e.pronouns.me || {}, b: e.pronouns.them || {} }));
  const meMore = rows.filter((r) => r.a.i_rate > r.b.i_rate).length;
  const cp = card(root, "Pronouns by person, plus Pennebaker's power cue", `Pennebaker found the person using more "I" is usually the lower-status or more self-focused one in an exchange. I use more "I" than the other person in ${meMore} of ${rows.length} chats. This is a population tendency, not a verdict.`);
  table(cp, ["Person", "My I", "My you", "My we", "My I:you", "Their I", "Their you", "Their we", "Their I:you", "More “I”"],
    rows.map(({ e, a, b }) => [threadLink(e), a.i_rate ?? "–", a.you_rate ?? "–", a.we_rate ?? "–", a.i_to_you ?? "–", b.i_rate ?? "–", b.you_rate ?? "–", b.we_rate ?? "–", b.i_to_you ?? "–", e.power?.lower_status_by_pennebaker === "me" ? "me" : "them"]), [1, 2, 3, 4, 5, 6, 7, 8]);
  const lr = people.map((e) => ({ name: e.name, a: e.length.me?.chars_mean, b: e.length.them?.chars_mean, aw: e.length.me?.words_mean, bw: e.length.them?.words_mean, am: e.length.me?.chars_median, bm: e.length.them?.chars_median }));
  const longer = lr.filter((r) => r.a > r.b).length;
  const big = lr.filter((r) => r.a && r.b).sort((x, y) => Math.abs(y.a - y.b) / Math.max(y.a, y.b) - Math.abs(x.a - x.b) / Math.max(x.a, x.b))[0];
  const cl = card(root, "Average message length by person (characters)", `My messages are longer than theirs in ${longer} of ${lr.length} chats. Biggest mismatch: ${big.name} (me ${big.a.toFixed(0)} vs them ${big.b.toFixed(0)} chars). Hover for words and medians.`);
  legend(cl, [["Mine", css("me")], ["Theirs", css("them")]]);
  const mx = niceMax(Math.max(...lr.flatMap((r) => [r.a || 0, r.b || 0])));
  dumbbell(cl, lr, { min: 0, max: mx, ticks: ticks(mx), tickFmt: (t) => t.toFixed(0), colorA: css("me"), colorB: css("them"),
    tip: (r) => `<b>${r.name}</b><br>mine: ${r.a?.toFixed(1)} chars, ${r.aw?.toFixed(1)} words (median ${r.am} chars)<br>theirs: ${r.b?.toFixed(1)} chars, ${r.bw?.toFixed(1)} words (median ${r.bm} chars)` });
  const LY = DET.length_by_year;
  const cy = card(root, "Average message length by year", "Characters and words per message, me vs everyone I text.");
  table(cy, ["Year", "My chars", "My words", "Their chars", "Their words"], Object.keys(LY).map((y) => [y, LY[y].me?.chars_mean?.toFixed(1) ?? "–", LY[y].me?.words_mean?.toFixed(1) ?? "–", LY[y].them?.chars_mean?.toFixed(1) ?? "–", LY[y].them?.words_mean?.toFixed(1) ?? "–"]), [1, 2, 3, 4]);
}

// ---------- streaks ----------
{
  const root = $("streaks");
  const best = people.slice().sort((a, b) => b.streaks.longest_any[0].days - a.streaks.longest_any[0].days)[0];
  const cur = people.filter((e) => e.streaks.current).sort((a, b) => b.streaks.current.days - a.streaks.current.days);
  const c = card(root, "Texting streaks, top 30", `Your longest run is with ${best.name}: ${best.streaks.longest_any[0].days} straight days (${best.streaks.longest_any[0].start} → ${best.streaks.longest_any[0].end}).` + (cur.length ? ` Longest streak still going: ${cur[0].name}, ${cur[0].streaks.current.days} days.` : " No streak is still going.") + " Strip: one pixel column per day, solid when both of you texted, faint when only one did. Red ticks mark where a streak of 7+ days broke. Click a name for the full calendar.");
  legend(c, [["Both texted", css("me")], ["One side only", `color-mix(in oklab, ${css("me")} 35%, ${css("surface")})`], ["Streak (7+ days) broken", css("neg")]]);
  const t = h("table", { class: "stable" });
  t.append(h("tr", {}, ["Person", "Active days", "Both texted", "Longest", "Current", "Timeline"].map((x, i) => h("th", i && i < 5 ? { class: "n" } : {}, x))));
  people.forEach((e) => {
    const S2 = e.streaks, L = S2.longest_any[0];
    const td = h("td", { class: "strip" });
    const W = 600, H = 16, cal = S2.calendar, n = cal.length;
    const svg = svgBox(td, W, H);
    const bw = W / n;
    // merge runs of the same state for fewer nodes
    let i = 0;
    while (i < n) { let j = i; while (j < n && cal[j] === cal[i]) j++; if (cal[i] !== "0") s("rect", { x: i * bw, y: 2, width: Math.max((j - i) * bw, 0.6), height: H - 6, fill: cal[i] === "2" ? css("me") : `color-mix(in oklab, ${css("me")} 35%, ${css("surface")})` }, svg); i = j; }
    S2.breaks.forEach((d) => { const k = Math.round((new Date(d + "T12:00") - day0) / 864e5); s("rect", { x: k * bw - 0.5, y: 0, width: 1.5, height: H, fill: css("neg") }, svg); });
    hover(svg, (ev) => { const r = svg.getBoundingClientRect(); const k = Math.floor((ev.clientX - r.left) / r.width * n); const st = cal[k]; return `<b>${iso(dayAt(k))}</b><br>${st === "2" ? "both texted" : st === "1" ? "one side texted" : "no texts"}`; });
    t.append(h("tr", {}, [h("td", {}, link(e.name, () => openCalendar(e))), h("td", { class: "n" }, fmt(S2.active_days)), h("td", { class: "n" }, fmt(S2.both_days)),
      h("td", { class: "n", title: `${L.start} → ${L.end}` }, `${L.days}d`), h("td", { class: "n" }, S2.current ? `${S2.current.days}d` : "–"), td]));
  });
  c.append(h("div", { class: "scroll" }, t));
}

function relFacts(e) {
  const R = e.closeness_raw, I = e.initiation;
  const iy = Object.entries(I.by_year || {}); const drift = iy.length > 1 ? iy[iy.length - 1][1] - iy[0][1] : null;
  return [
      `I start ${pct(I.me_share)} of ${fmt(I.conversations)} conversations` + (drift != null ? ` (${drift >= 0 ? "up" : "down"} ${Math.abs(drift * 100).toFixed(0)} pts from ${iy[0][0]} to ${iy[iy.length - 1][0]})` : ""),
      `Depth vs logistics: ${pct(R.depth_ratio ?? 0)} depth (me ${pct(R.depth_me)}, them ${pct(R.depth_them)})`,
      `Style match (LSM) ${R.lsm} · length match ${R.length_match}`,
      `Positive : negative = ${R.pos_neg_ratio ?? "–"} : 1 (Gottman's stable-couple benchmark is about 5:1)`,
      `Median reply ${minutes(R.reply_median_min)} · consistency CV ${R.reply_cv ?? "–"}`,
      `Emoji overlap ${R.emoji_cosine ?? "–"} ${R.emoji_shared_top.join(" ")}`,
      `Questions: I ask ${pct(R.question_me ?? 0)} vs ${pct(R.question_them ?? 0)} of messages · morning texts me ${pct(R.morning_me ?? 0)} / them ${pct(R.morning_them ?? 0)}`,
      `We-language ${R.we_rate}/100 words`,
    ];
}
function relSparks(e) {
  const sp = h("div", { class: "sm sm4" }), ser = e.series;
  [["Messages / month", ser.volume, css("me"), {}], ["Sentiment", ser.sentiment, css("s3"), { zero: true, min: -0.2, max: 0.5, dec: 3 }], ["Median reply (min)", ser.reply_median, css("them"), { dec: 1 }], ["My share of messages", ser.me_share, css("me"), { min: 0, max: 1, dec: 2 }]]
    .forEach(([lab, vals, col, o]) => { const cell = h("div", { class: "cell" }, [h("b", {}, lab)]); sp.append(cell); spark(cell, ser.months, [{ name: lab, values: vals, color: col }], { h: 44, ...o }); });
  return sp;
}

// ---------- relationships ----------
{
  const root = $("rel");
  const comps = DET.closeness_components;
  root.append(h("p", { class: "take" }, `Closeness score for your top 20 people by volume. Each of ${comps.length} signals is ranked among these 20 people (0 = lowest, 1 = highest), and the score is the average × 100. It's relative to these 20, not an absolute measure of love. Signals are drawn from the MosaicChats relationship-insights framework and Gottman, Pennebaker and Ireland's research. AI-written reads will appear on each card once the AI step has run.`));
  const sumCard = card(root, "Closeness ranking", `${close20[0].name} ranks closest (${close20[0].closeness.score}), then ${close20[1].name} (${close20[1].closeness.score}) and ${close20[2].name} (${close20[2].closeness.score}).`);
  hbarsStacked(sumCard, close20.map((e) => ({ name: e.name, n: e.closeness.score })), [{ key: "n", name: "Closeness", color: css("me") }], {});
  const grid = h("div", { class: "rgrid" }); root.append(grid);
  close20.forEach((e) => {
    const R = e.closeness_raw, C = e.closeness.components, I = e.initiation;
    const c = h("div", { class: "card rcard" });
    c.append(h("div", { class: "rhead" }, [h("b", {}, `#${e.closeness.rank} ${e.name}`), h("span", { class: "score" }, String(e.closeness.score))]));
    const bars = h("div", { class: "cbars" });
    comps.forEach((k) => { const v = C[k.key]; bars.append(h("div", { class: "cbar", title: `${k.label}: ${v == null ? "n/a" : v.toFixed(2)}` }, [h("span", {}, k.label), h("i", { style: `width:${v == null ? 0 : v * 100}%` })])); });
    c.append(bars);
    const facts = relFacts(e);
    c.append(h("ul", { class: "facts" }, facts.map((f) => h("li", {}, f))));
    c.append(relSparks(e));
    if (e.inflections.length) c.append(h("div", { class: "dline", html: `<span>Turning points</span> ` + e.inflections.map((x) => `${mlabel(x.month)}: ${x.metric} ${x.direction === "up" ? "↑" : "↓"}`).join(" · ") }));
    c.append(h("div", { class: "row" }, [link("Relationship →", () => openRelationship(e.id), "btn"), link("Words ☁", () => openWords(e), "btn"), link("Messages", () => openThread(e.id), "btn")]));
    grid.append(c);
  });
}

// ---------- text markers (pop psych) ----------
{
  const root = $("markers");
  const M0 = DET.markers_me_overall;
  root.append(h("p", { class: "take" }, "Markers from the Fast Company psychiatrist piece and the research it draws on (Pennebaker and others). The article itself couldn't be fetched, so the Big Five word lists are standard examples from that research. Treat this as playful pop psychology, not a diagnosis."));
  const c = card(root, "How I end messages", `${pct(M0.endings.none)} of my texts end with no punctuation, ${pct(M0.endings.exclamation)} with "!", ${pct(M0.endings.period)} with a period and ${pct(M0.endings.emoji)} with an emoji. ${pct(M0.question_rate)} contain a question.`);
  const endKeys = [["period", "Period", css("ink2")], ["exclamation", "!", css("them")], ["question", "?", css("s3")], ["emoji", "Emoji", css("me")], ["none", "Nothing", `color-mix(in oklab, ${css("muted")} 35%, ${css("surface")})`]];
  legend(c, endKeys.map(([, l, col]) => [l, col]));
  const rows = [{ name: "Me (all texts)", ...Object.fromEntries(endKeys.map(([k]) => [k, M0.endings[k]])) }];
  close20.forEach((e) => { rows.push({ name: `me → ${e.name}`, ...Object.fromEntries(endKeys.map(([k]) => [k, e.markers.me?.endings[k] || 0])) }); rows.push({ name: `${e.name}`, ...Object.fromEntries(endKeys.map(([k]) => [k, e.markers.them?.endings[k] || 0])) }); });
  hbarsStacked(c, rows, endKeys.map(([k, l, col]) => ({ key: k, name: l, color: col })), { labelW: 190, extra: () => "" });
  const ct = card(root, "Questions, negations, future talk, counterfactuals", `Per person, me vs them. Negations (no/never/not/nothing) and future words (will/gonna/'ll) are per 100 words; counterfactuals (shoulda/coulda/woulda, "should have"…) per 1,000. Overall I use ${M0.negations_per100} negations and ${M0.future_per100} future words per 100, and ${M0.counterfactual_per1000} counterfactuals per 1,000.`);
  table(ct, ["Person", "Q% me", "Q% them", "Neg me", "Neg them", "Future me", "Future them", "CF me", "CF them", "I:you me", "I:you them"],
    close20.map((e) => { const a = e.markers.me || {}, b = e.markers.them || {}; const r = (x, y) => y ? (x / y).toFixed(2) : "–";
      return [threadLink(e), pct(a.question_rate || 0), pct(b.question_rate || 0), a.negations_per100, b.negations_per100, a.future_per100, b.future_per100, a.counterfactual_per1000, b.counterfactual_per1000, r(a.i_rate, a.you_rate), r(b.i_rate, b.you_rate)].map((v) => v ?? "–"); }), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const b5 = Object.keys(M0.big5_per1000);
  const cb = card(root, "Big Five marker words (pop psych)", `Marker-word rates per 1,000 words. My strongest is ${b5.slice().sort((a, b) => M0.big5_per1000[b] - M0.big5_per1000[a])[0]}. The table compares me and each person on the same lists.`);
  table(cb, ["Person", ...b5.flatMap((k) => [k.slice(0, 5) + " me", "them"])],
    [["Me (all)", ...b5.flatMap((k) => [M0.big5_per1000[k], ""])], ...close20.map((e) => [e.name, ...b5.flatMap((k) => [e.markers.me?.big5_per1000[k] ?? "–", e.markers.them?.big5_per1000[k] ?? "–"])])], b5.flatMap((_, i) => [1 + 2 * i, 2 + 2 * i]));
}

// ---------- topics ----------
{
  const root = $("topics");
  const th = Object.keys(DET.theme_baseline);
  const ents = [...people, ...groups];
  const c = card(root, "Topics discussed vs avoided", "Each cell shows how much more (blue) or less (red) often a topic comes up in that chat than in your texts overall (1.0× = your normal). It's keyword-based, so treat it as a sketch. AI topic labels will replace this once the AI step has run.");
  const t = h("table", { class: "heat" });
  t.append(h("tr", {}, [h("th", {}, "Chat"), ...th.map((k) => h("th", { class: "n" }, k))]));
  const col = (lift) => lift == null ? "transparent" : lift >= 1 ? mix(css("mid"), css("pos"), Math.min((lift - 1) / 1.5, 1)) : mix(css("mid"), css("neg"), Math.min((1 - lift) / 0.7, 1));
  ents.forEach((e) => t.append(h("tr", {}, [h("td", {}, threadLink(e)), ...th.map((k) => {
    const v = e.themes[k]; const td = h("td", { class: "n", style: `background:${col(v.lift)}` }, v.lift == null ? "–" : v.lift.toFixed(1) + "×");
    hover(td, `<b>${e.name} · ${k}</b><br>${pct(v.share, 1)} of messages (your normal ${pct(DET.theme_baseline[k], 1)})<br>me ${pct(v.me ?? 0, 1)} · them ${pct(v.them ?? 0, 1)}`); return td;
  })])));
  c.append(h("div", { class: "scroll" }, t));
  const deep = people.map((e) => ({ name: e.name, value: e.closeness_raw.depth_ratio ?? 0 })).sort((a, b) => b.value - a.value);
  const cd = card(root, "Deep sharing vs logistics", `Among messages that hit either word list, the share that are about feelings rather than logistics. Most depth: ${deep[0].name} (${pct(deep[0].value)}); most logistics: ${deep[deep.length - 1].name} (${pct(deep[deep.length - 1].value)}).`);
  legend(cd, [["More depth", css("me")], ["More logistics", css("them")]]);
  hbarsCentered(cd, deep, { min: 0, max: 1, center: 0.5, ticks: [0, 0.25, 0.5, 0.75, 1], tickFmt: (t) => pct(t), valFmt: (v) => pct(v), colorHi: css("me"), colorLo: css("them"), tip: (r) => `<b>${r.name}</b><br>${pct(r.value)} depth` });
}

// ---------- conflicts ----------
{
  const root = $("conflicts");
  const CC = DET.conflicts.candidates;
  const llm = DET.conflicts_llm;
  root.append(h("p", { class: "take" }, llm ? "Conflicts confirmed and described by the AI step. Each card shows both sides; click to open that moment in the message browser." :
    `These are ${fmt(CC.length)} candidate moments where a fight may have happened, found by rules rather than by reading: within an hour, at least two clearly negative messages from each side, and/or conflict and apology words from both of you. Many are just venting together, so they aren't confirmed. The AI step will confirm and describe them.`));
  const rows = people.filter((e) => e.arguing?.candidates).map((e) => ({ name: e.name, n: e.arguing.per_100_conversations, raw: e.arguing.candidates })).sort((a, b) => b.n - a.n);
  const c = card(root, "Arguing over text, by person", rows.length ? `Candidates per 100 conversations. Highest: ${rows[0].name} at ${rows[0].n}.` : "No candidates.");
  hbarsStacked(c, rows, [{ key: "n", name: "Candidates per 100 conversations", color: css("neg") }], { extra: (r) => `<br>${r.raw} candidates` });
  const bm = {}; CC.forEach((x) => { const m = x.start.slice(0, 7); bm[m] = (bm[m] || 0) + 1; });
  const pk = Object.keys(bm).sort((a, b) => bm[b] - bm[a])[0];
  const ct = card(root, "Candidate timeline", pk ? `Most candidates in one month: ${mlabel(pk)} (${bm[pk]}).` : "");
  stackedMonths(ct, months, [{ name: "Candidates", values: months.map((m) => bm[m] || 0), color: css("neg") }], { height: 160, gaps: bigGaps });
  const cl = card(root, "Strongest candidates", "Ranked by negative messages plus conflict words on both sides. Open one to read it in context.");
  const top = CC.slice().sort((a, b) => (b.strength - a.strength) || ((b.neg_me + b.neg_them + b.conflict_words_me + b.conflict_words_them) - (a.neg_me + a.neg_them + a.conflict_words_me + a.conflict_words_them))).slice(0, 60);
  table(cl, ["Date", "Person", "Msgs", "Neg me/them", "Conflict words me/them", "Tone me/them", "Went negative first", ""],
    top.map((x) => [x.start.slice(0, 16), x.name, x.messages, `${x.neg_me}/${x.neg_them}`, `${x.conflict_words_me}/${x.conflict_words_them}`, `${x.mean_sent_me}/${x.mean_sent_them}`, x.first_negative || "–", link("Open →", () => openThread(x.ent, x.hot_start_epoch || x.start_epoch), "btn")]), [2]);
}

// ---------- AI-written parts (local model) ----------
const LLM = DET.llm || null;
const AI_LABEL = () => h("span", { class: "ailab" }, `AI-written by a local model (${LLM?.meta?.model || "?"}), may be wrong`);
function aiBlock(parent, fields) {
  const box = h("div", { class: "ai" }, [AI_LABEL()]);
  fields.forEach(([title, v]) => {
    if (v == null || (Array.isArray(v) && !v.length) || v === "") return;
    box.append(h("h4", {}, title));
    if (Array.isArray(v)) box.append(h("ul", {}, v.map((x) => h("li", {}, typeof x === "string" ? x : [x.date || x.name || x.value || x.chapter, x.point || x.why || x.evidence || x.text].filter(Boolean).join(": ")))));
    else box.append(h("p", {}, String(v)));
  });
  parent.append(box);
  return box;
}
// relationship reads onto the cards
if (LLM?.relationships?.reads) {
  const cards = document.querySelectorAll(".rcard");
  close20.forEach((e, i) => {
    const r = LLM.relationships.reads[e.id]; const c = cards[i]; if (!r || !c || r.error) return;
    const box = aiBlock(h("div"), [["In one line", r.headline], ["Closeness and trajectory", r.closeness_and_trajectory], ["Dynamics and emotional work", r.dynamics_and_emotional_work],
      ["Depth vs logistics", r.depth_vs_logistics], ["Topics discussed", r.topics_discussed], ["Topics avoided", r.topics_avoided], ["Conflict style", r.conflict_style],
      ["Bids and responsiveness", r.bids_and_responsiveness], ["How you show up", r.how_you_show_up], ["Evidence", r.evidence]]);
    c.insertBefore(box, c.lastChild);
  });
}
// confirmed conflicts
if (LLM?.conflicts?.conflicts) {
  const root = $("conflicts"), C = LLM.conflicts;
  const list = C.conflicts.slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const top = card(root, "Conflicts the AI confirmed", `The local model read the ${C.windows_checked} strongest of ${C.windows_total} candidate windows and confirmed ${C.confirmed_windows} as real conflicts, which merge into ${list.length} distinct conflicts. ${list.filter((c) => c.hashed_out_over_text).length} were hashed out over text.`);
  top.append(AI_LABEL());
  const bm = {}; list.forEach((c) => { const m = String(c.start).slice(0, 7); bm[m] = (bm[m] || 0) + (+c.severity || 1); });
  stackedMonths(top, months, [{ name: "Severity-weighted conflicts", values: months.map((m) => bm[m] || 0), color: css("neg") }], { height: 150, gaps: bigGaps });
  const byP = {}; list.forEach((c) => (byP[c.name] = byP[c.name] || []).push(c));
  Object.entries(byP).sort((a, b) => b[1].length - a[1].length).forEach(([name, cs]) => {
    const pc = card(root, `${name}: ${cs.length} conflict${cs.length > 1 ? "s" : ""}`, `Endings: ${["resolved", "unresolved", "moved offline", "unclear"].map((k) => `${k} ${cs.filter((c) => c.ending === k).length}`).join(" · ")}`);
    cs.forEach((c) => {
      const cc = h("div", { class: "card ccard" }, [h("h3", {}, `${c.start}${c.end && c.end !== c.start ? " → " + c.end : ""} · ${c.title || "Untitled"} · severity ${c.severity ?? "?"}/5`)]);
      cc.append(h("p", { class: "take" }, `Source: ${c.trigger || "unclear"} · Ending: ${c.ending || "unclear"} · ${c.hashed_out_over_text ? "hashed out over text" : "not fully hashed out over text"}`));
      cc.append(h("div", { class: "sides" }, [h("div", {}, [h("b", {}, "Your side"), c.allie_side || "–"]), h("div", {}, [h("b", {}, `${name}'s side`), c.their_side || "–"])]));
      cc.append(h("div", { class: "row" }, [link("Open in messages →", () => openThread(c.ent, c.start_epoch), "btn"), ...((c.episodes || []).length > 1 ? [h("span", { class: "take" }, `${c.episodes.length} linked episodes`)] : [])]));
      pc.append(cc);
    });
  });
}
// You
{
  const root = $("you");
  const Y = LLM?.you;
  if (!Y?.portrait || Y.portrait.error) {
    root.append(h("p", { class: "take" }, "Not generated yet. Run llm_pass.py (local model), then build_report.py."));
  } else {
    const P2 = Y.portrait;
    root.append(h("p", { class: "take" }, "A portrait written by a local AI model from monthly samples of your sent messages, yearly chapters and your relationship reads. It can be wrong, and it only sees what you texted. Claims come with dates so you can check them in the message browser."));
    const ls = card(root, "Your story, 2018–2026", ""); ls.append(AI_LABEL());
    (P2.life_story || []).forEach((c) => { ls.append(h("h4", {}, `${c.chapter} (${c.years})`)); ls.append(h("p", {}, c.text)); });
    const ch = card(root, "Year by year", "Click a year to expand it."); ch.append(AI_LABEL());
    Object.entries(Y.chapters || {}).forEach(([y, c]) => {
      const d = h("details"); d.append(h("summary", {}, `${y}: ${c.title || ""}`));
      d.append(h("p", {}, c.chapter || ""));
      if (c.turning_points?.length) d.append(h("ul", {}, c.turning_points.map((t) => h("li", {}, `${t.date}: ${t.point}`))));
      if (c.mood_arc) d.append(h("p", { class: "take" }, `Mood: ${c.mood_arc}`));
      ch.append(d);
    });
    const g = h("div", { class: "grid2" }); root.append(g);
    aiBlock(card(g, "Values", ""), [["", P2.values]]);
    const fp = P2.as_a_friend_and_partner || {};
    aiBlock(card(g, "As a friend and partner", ""), [["Verdict", fp.verdict], ["Strengths", fp.strengths], ["Watch-outs", fp.watch_outs]]);
    aiBlock(card(g, "What you could do better", ""), [["", P2.could_do_better]]);
    aiBlock(card(g, "Who you're like", ""), [["", (P2.who_youre_like || []).map((x) => `${x.name}${x.kind ? " (" + x.kind + ")" : ""}: ${x.why}`)]]);
    aiBlock(card(g, "Greatest strengths and weaknesses", ""), [["Strengths", P2.greatest_strengths], ["Weaknesses", P2.greatest_weaknesses]]);
    aiBlock(card(g, "Likes and dislikes", ""), [["Likes", P2.likes], ["Dislikes", P2.dislikes]]);
    if (P2.caveats) root.append(h("p", { class: "take" }, "Caveats: " + P2.caveats));
  }
}

// ---------- reply time by week ----------
// Median minutes to answer, per week, last 52 weeks (analyze2.py reply_weekly). Thin lines are single weeks; thick ones a 4-week median.
const wkLabel = (w) => { const d = new Date(w + "T00:00"); return `Week of ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const wkTick = (w, i) => (i % 13 === 0 ? `${MON[+w.slice(5, 7) - 1]} ${w.slice(0, 4)}` : null);
const medOf = (v) => { const xs = v.filter((x) => x != null).sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : null; };
const roll4 = (v) => v.map((_, i) => (v.slice(Math.max(0, i - 3), i + 1).filter((x) => x != null).length >= 2 ? medOf(v.slice(Math.max(0, i - 3), i + 1)) : null));
function replyWeeks(parent, rw, them, height) {
  const all = [...rw.me, ...rw.them].filter((x) => x != null).sort((a, b) => a - b);
  const cap = all.length ? all[Math.floor(all.length * 0.95)] * 1.15 : 10;
  linesMonths(parent, rw.weeks, [
    { name: "You, that week", values: rw.me, color: css("me"), width: 1, opacity: 0.35 },
    { name: `${them}, that week`, values: rw.them, color: css("them"), width: 1, opacity: 0.35 },
    { name: "You, 4-week median", values: roll4(rw.me), color: css("me"), width: 2.5 },
    { name: `${them}, 4-week median`, values: roll4(rw.them), color: css("them"), width: 2.5 }],
  { floor: 0, max: cap, height: height || 220, label: wkLabel, tick: wkTick, fmtv: minutes, dec: 0 });
  legend(parent, [["You", css("me")], [them, css("them")]]);
}
function replyTrend(v) {
  const a = medOf(v.slice(-4)), b = medOf(v.slice(-12, -4));
  if (a == null || b == null) return "–";
  const r = a / b; return r < 0.8 ? `faster (${minutes(b)} → ${minutes(a)})` : r > 1.25 ? `slower (${minutes(b)} → ${minutes(a)})` : "about the same";
}
if (DET.comparisons?.reply_weekly) {
  const root = $("rt"), rw = DET.comparisons.reply_weekly, n = rw.weeks.length;
  const c = card(root, "Reply time by week", `Median time to answer in 1:1 chats, last 52 weeks. This week you took ${minutes(rw.me[n - 1])} (last week ${minutes(rw.me[n - 2])}); people took ${minutes(rw.them[n - 1])} to answer you (last week ${minutes(rw.them[n - 2])}). Weeks with fewer than 3 replies are blank.`);
  replyWeeks(c, rw, "Them");
  const ppl = people.filter((e) => e.reply_weekly).map((e) => ({ e, n8: [...e.reply_weekly.n_me.slice(-8), ...e.reply_weekly.n_them.slice(-8)].reduce((a, b) => a + b, 0) }))
    .filter((x) => x.n8 >= 6).sort((a, b) => b.n8 - a.n8).slice(0, 20);
  if (ppl.length) {
    const pc = card(root, "Reply time by person, week over week", "Your median reply time and theirs this week, last week and over the last 8 weeks. The trend compares the last 4 weeks with the 8 before. Click a name for the weekly chart.");
    table(pc, ["Person", "You this week", "last week", "8 weeks", "Your trend", "Them this week", "last week", "8 weeks", "Their trend"], ppl.map(({ e }) => {
      const r = e.reply_weekly, k = r.weeks.length;
      return [link(e.name, () => openRelationship(e.id)), minutes(r.me[k - 1]), minutes(r.me[k - 2]), minutes(medOf(r.me.slice(-8))), replyTrend(r.me),
        minutes(r.them[k - 1]), minutes(r.them[k - 2]), minutes(medOf(r.them.slice(-8))), replyTrend(r.them)];
    }), [1, 2, 3, 5, 6, 7]);
  }
}

// ---------- who's drifting ----------
{
  const root = $("driftdiv"), DR = DET.drifting;
  if (!DR) root.append(h("p", { class: "take" }, "Press Update now to compute this."));
  else if (!DR.people.length) root.append(h("p", { class: "take" }, `Nobody you texted at least 5 times a week has gone quiet in the last ${DR.recent_days} days.`));
  else {
    const top = DR.people[0];
    const c = card(root, "People who've gone quiet", `People you texted at least 5 times a week in the ${DR.base_days} days before the last ${DR.recent_days}, who are now under a third of that. ${top.name} dropped the most, from ${top.before_per_week} a week to ${top.now_per_week}, starting around ${top.since}. "Changed around" is the day that best splits a busy stretch from a quiet one.`);
    table(c, ["Person", "Before / week", "Now / week", "Changed around", "Last text", ""], DR.people.map((x) => [
      x.name, String(x.before_per_week), String(x.now_per_week), x.since || "–", x.last,
      h("span", { class: "row", style: "margin:0" }, [...(E[x.ent]?.kind === "person" ? [link("Relationship", () => openRelationship(x.ent), "btn xs")] : []), link("Messages", () => openThread(x.ent, x.since ? Date.parse(x.since + "T00:00") / 1000 : undefined), "btn xs")])]), [1, 2]);
  }
}
