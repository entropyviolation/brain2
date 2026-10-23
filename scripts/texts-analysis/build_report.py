#!/usr/bin/env python3
"""Build out/report.html from out/summary.json.

One self-contained file: inline CSS + JS, hand-rolled SVG, no network requests.
Usage: .venv/bin/python build_report.py && open out/report.html
"""
import json
from pathlib import Path

from texts_home import CODE, HOME as ROOT
JUNK = {"https", "http", "com", "www"}


def clean(summary):
    lang = summary["language"]
    has_junk = lambda t: any(w in JUNK for w in t.split())
    for k in ("my_top100_words", "my_top50_bigrams", "my_top50_trigrams"):
        lang[k] = [r for r in lang[k] if not has_junk(r["term"])]
    for y, rows in lang["distinctive_words_per_year"].items():
        lang["distinctive_words_per_year"][y] = [r for r in rows if r["term"] not in JUNK]
    per_day = summary["volume"].pop("per_day", None) or {}
    summary["volume"]["recent_days"] = dict(sorted(per_day.items())[-120:])  # week-by-week comparison
    return summary


def main():
    s = clean(json.loads((ROOT / "out/summary.json").read_text()))
    data = json.dumps(s, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    det_path = ROOT / "out/detail.json"
    det = det_path.read_text().replace("</", "<\\/") if det_path.exists() else "null"
    extra = ((CODE / "report_extra.js").read_text() + "\n" + (CODE / "report_app.js").read_text()) if det_path.exists() else ""
    llm_path = ROOT / "out/llm.json"
    if det_path.exists() and llm_path.exists():
        d = json.loads(det)
        d["llm"] = json.loads(llm_path.read_text())
        det = json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = TEMPLATE.replace("/*DATA*/", data).replace("/*DETAIL*/", det).replace("/*EXTRA*/", extra)
    out = ROOT / "out/report.html"
    out.write_text(html)
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'self' file:; connect-src 'self'; img-src data:">
<title>Texts, 2018–2026</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,0.10);
  --me: #2a78d6; --them: #eb6834; --s3: #1baf7a;
  --pos: #2a78d6; --neg: #e34948; --mid: #f0efec;
  --seq0: #cde2fb; --seq1: #104281;
  --gap: rgba(137,135,129,0.14);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
    --me: #3987e5; --them: #d95926; --s3: #199e70;
    --pos: #3987e5; --neg: #e66767; --mid: #383835;
    --seq0: #1f2a38; --seq1: #86b6ef;
    --gap: rgba(137,135,129,0.18);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
  --me: #3987e5; --them: #d95926; --s3: #199e70;
  --pos: #3987e5; --neg: #e66767; --mid: #383835;
  --seq0: #1f2a38; --seq1: #86b6ef;
  --gap: rgba(137,135,129,0.18);
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--page); color: var(--ink); }
body { font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1080px; margin: 0 auto; padding: 32px 16px 80px; }
header h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.01em; }
header p { color: var(--ink2); margin: 0; }
nav { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 18px 0 8px; font-size: 13px; }
nav a { color: var(--ink2); text-decoration: none; border-bottom: 1px solid var(--axis); }
nav a:hover { color: var(--ink); }
h2 { font-size: 20px; margin: 48px 0 12px; padding-top: 8px; border-top: 1px solid var(--grid); }
.card { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; padding: 16px 18px 12px; margin: 14px 0; }
.card h3 { font-size: 15px; margin: 0 0 2px; }
.take { color: var(--ink2); font-size: 13.5px; margin: 0 0 10px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
.grid2 > .card { margin: 0; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-top: 18px; }
.tile { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; padding: 12px 14px; }
.tile .v { font-size: 26px; font-weight: 600; letter-spacing: -0.01em; }
.tile .l { color: var(--ink2); font-size: 12.5px; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--ink2); margin: 0 0 6px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
svg { display: block; width: 100%; height: auto; overflow: visible; }
svg text { fill: var(--muted); font: 11px system-ui, -apple-system, sans-serif; }
svg .lab { fill: var(--ink2); }
svg .ink { fill: var(--ink); }
.gridl { stroke: var(--grid); stroke-width: 1; }
.axisl { stroke: var(--axis); stroke-width: 1; }
table { border-collapse: collapse; width: 100%; font-size: 13px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--grid); }
th { color: var(--ink2); font-weight: 600; }
td.n, th.n { text-align: right; }
.scroll { overflow-x: auto; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--page); border: 1px solid var(--ring); border-radius: 999px; padding: 2px 10px; font-size: 12.5px; }
.chip b { font-weight: 500; color: var(--muted); margin-left: 4px; font-variant-numeric: tabular-nums; }
.emoji { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; }
.emoji div { text-align: center; background: var(--page); border: 1px solid var(--ring); border-radius: 8px; padding: 6px 2px; }
.emoji span { display: block; font-size: 24px; line-height: 1.2; }
.emoji small { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.years { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
.years h4 { margin: 0 0 4px; font-size: 13px; }
.sm { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.sm .cell { background: var(--page); border: 1px solid var(--ring); border-radius: 8px; padding: 6px 8px 4px; }
.sm .cell b { font-size: 12.5px; font-weight: 600; }
.sm .cell em { font-style: normal; color: var(--muted); font-size: 11.5px; float: right; }
#tip { position: fixed; pointer-events: none; background: var(--surface); color: var(--ink); border: 1px solid var(--ring);
  box-shadow: 0 4px 14px rgba(0,0,0,0.14); border-radius: 8px; padding: 6px 9px; font-size: 12.5px; line-height: 1.4;
  opacity: 0; transition: opacity .08s; z-index: 10; max-width: 260px; font-variant-numeric: tabular-nums; }
#tip.on { opacity: 1; }
.method li { margin: 4px 0; color: var(--ink2); }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 20; display: flex; align-items: flex-start; justify-content: center; padding: 4vh 12px; }
.modal[hidden] { display: none; }
.mbox { position: relative; background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; width: min(980px, 100%); max-height: 92vh; overflow: auto; padding: 18px 20px; }
.mclose { position: sticky; top: 0; float: right; border: 0; background: var(--page); color: var(--ink); border-radius: 999px; width: 30px; height: 30px; font-size: 18px; cursor: pointer; z-index: 2; }
.mtitle { margin: 0 0 6px; font-size: 18px; }
.link { background: none; border: 0; padding: 0; color: var(--ink); text-decoration: underline; text-decoration-color: var(--axis); cursor: pointer; font: inherit; text-align: left; }
.btn { background: var(--page); border: 1px solid var(--ring); color: var(--ink); border-radius: 7px; padding: 3px 10px; font: inherit; font-size: 13px; cursor: pointer; }
.btn:hover, .tab:hover { border-color: var(--axis); }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
.tab { background: none; border: 1px solid var(--ring); color: var(--ink2); border-radius: 999px; padding: 3px 11px; font: inherit; font-size: 13px; cursor: pointer; }
.tab.on { background: var(--ink); color: var(--surface); border-color: var(--ink); }
.row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.clickable { cursor: pointer; border-radius: 8px; padding: 4px; margin: -4px; }
.clickable:hover { background: var(--page); }
.dgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.dcard { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; padding: 10px 12px; font-size: 13px; }
.dhead { display: flex; justify-content: space-between; gap: 8px; } .dhead span { color: var(--muted); font-size: 12px; }
.dmeta { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
.dline { color: var(--ink2); font-size: 12.5px; margin: 2px 0; } .dline span { color: var(--muted); margin-right: 4px; }
.tctrl { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; position: sticky; top: -18px; background: var(--surface); padding: 6px 0; z-index: 1; }
.tctrl select, .tctrl input { font: inherit; font-size: 13px; background: var(--page); color: var(--ink); border: 1px solid var(--ring); border-radius: 7px; padding: 3px 8px; }
.tctrl input[type=search] { flex: 1; min-width: 160px; }
.tlog { display: flex; flex-direction: column; gap: 3px; padding: 6px 0 20px; }
.tday { align-self: center; color: var(--muted); font-size: 12px; margin: 12px 0 4px; }
.bub { max-width: 72%; padding: 6px 10px; border-radius: 14px; font-size: 14px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
.bub.me { align-self: flex-end; background: var(--me); color: #fff; border-bottom-right-radius: 4px; }
.bub.them { align-self: flex-start; background: var(--page); border: 1px solid var(--ring); border-bottom-left-radius: 4px; }
.bub .who { font-size: 11px; color: var(--muted); margin-bottom: 1px; }
.bub .ts { font-size: 10.5px; opacity: 0.7; margin-top: 2px; text-align: right; }
.bub.hl { outline: 3px solid var(--them); outline-offset: 2px; }
.tres { max-height: 260px; overflow: auto; border: 1px solid var(--ring); border-radius: 8px; padding: 6px; margin: 6px 0; }
.hit { display: block; width: 100%; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--grid); padding: 4px 2px; font: inherit; font-size: 12.5px; color: var(--ink2); cursor: pointer; }
.hit b { color: var(--ink); font-weight: 600; }
.stable td.strip { width: 50%; min-width: 260px; }
.cal { display: flex; gap: 8px; align-items: center; margin: 4px 0; } .cal svg { max-width: 660px; } .caly { width: 40px; color: var(--ink2); font-size: 12px; }
.rgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 14px; }
.rgrid .card { margin: 0; }
.rhead { display: flex; justify-content: space-between; align-items: baseline; } .rhead b { font-size: 15px; } .score { font-size: 22px; font-weight: 600; }
.cbars { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; margin: 8px 0; }
.cbar { font-size: 11.5px; color: var(--ink2); } .cbar span { display: block; } .cbar i { display: block; height: 5px; border-radius: 3px; background: var(--me); min-width: 2px; }
.facts { margin: 6px 0; padding-left: 18px; font-size: 12.5px; color: var(--ink2); } .facts li { margin: 1px 0; }
.sm4 { grid-template-columns: repeat(2, 1fr); }
.ai h4 { margin: 8px 0 2px; font-size: 13px; color: var(--ink); } .ai p { margin: 2px 0 6px; } .ai ul { margin: 2px 0 6px; padding-left: 18px; }
.ccard { border-left: 3px solid var(--neg); }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; } .sides b { display: block; font-size: 12px; color: var(--muted); }
.ai { border-left: 3px solid var(--s3); padding: 6px 10px; margin: 8px 0; font-size: 13px; color: var(--ink2); }
.ailab { display: inline-block; font-size: 11px; color: var(--muted); border: 1px solid var(--ring); border-radius: 999px; padding: 0 7px; margin-bottom: 4px; }
table.heat td { font-size: 12px; }
.mbox.wide { width: min(1320px, 100%); }
.tgrid { display: grid; grid-template-columns: minmax(0, 1fr) 260px 56px; gap: 12px; align-items: start; }
.tchat { position: relative; padding-left: 30px; }
.tgut { position: absolute; left: 0; top: 0; width: 28px; cursor: crosshair; border-right: 1px solid var(--grid); min-height: 100%; }
.tgut:hover { background: color-mix(in oklab, var(--page) 70%, transparent); }
.gbar { position: absolute; width: 4px; border-radius: 2px; cursor: pointer; opacity: 0.85; }
.gbar:hover { opacity: 1; width: 6px; }
.tlog { position: relative; }
.mrow { display: flex; flex-direction: column; border-radius: 10px; padding: 1px 4px; cursor: default; }
.mrow.me { align-items: flex-end; } .mrow.them { align-items: flex-start; }
.mrow.sel { background: color-mix(in oklab, var(--me) 12%, transparent); }
.mrow.focus .bub { box-shadow: 0 0 0 2px var(--axis); }
.tlog .bub { max-width: 78%; }
.tmargin { position: relative; }
.mcard { position: absolute; left: 0; right: 0; background: var(--surface); border: 1px solid var(--ring); border-left: 3px solid var(--ink2); border-radius: 8px; padding: 6px 8px; font-size: 12.5px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.mchips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 2px; } .mchips .chip { font-size: 11px; padding: 0 7px; } .mchips .chip.c { color: var(--neg); border-color: var(--neg); }
.mnote { white-space: pre-wrap; color: var(--ink); margin: 2px 0; }
.mmeta { color: var(--muted); font-size: 11px; }
.mreply { border-top: 1px solid var(--grid); margin-top: 4px; padding-top: 3px; } .mreply small { color: var(--muted); font-size: 10.5px; }
.mact { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; font-size: 12px; } .mact .link { font-size: 12px; color: var(--ink2); }
.mreplyin { display: flex; gap: 6px; margin-top: 4px; } .mreplyin textarea { flex: 1; }
.tmini { position: sticky; top: 50px; } .minileg { display: flex; flex-direction: column; font-size: 10px; color: var(--muted); margin-top: 4px; }
.tbar { position: sticky; bottom: -18px; background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; box-shadow: 0 -4px 16px rgba(0,0,0,0.08); padding: 8px 10px; margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; z-index: 3; font-size: 13px; }
.tbar[hidden] { display: none; }
.tbar select, .editor select, .editor input[type=text], .erow input[type=month] { font: inherit; font-size: 13px; background: var(--page); color: var(--ink); border: 1px solid var(--ring); border-radius: 7px; padding: 3px 8px; }
.editor { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.editor textarea, textarea.notes, .mreplyin textarea, .card textarea { font: inherit; font-size: 13px; background: var(--page); color: var(--ink); border: 1px solid var(--ring); border-radius: 8px; padding: 6px 8px; width: 100%; resize: vertical; }
.erow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .erow label { display: flex; gap: 4px; align-items: center; }
.seg { display: inline-flex; gap: 2px; }
.btn.xs { padding: 1px 7px; font-size: 12px; } .btn.on { background: var(--ink); color: var(--surface); border-color: var(--ink); }
.btn.primary { background: var(--me); color: #fff; border-color: var(--me); } .btn.ghost { background: none; }
.fchips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.detstat { color: var(--muted); font-size: 12px; margin-left: auto; }
.cbanner { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; align-items: center; border: 1px dashed color-mix(in oklab, var(--neg) 60%, var(--ring)); background: color-mix(in oklab, var(--neg) 7%, var(--surface)); border-radius: 8px; padding: 5px 9px; margin: 8px 30px 4px; font-size: 12.5px; }
.cbanner small { color: var(--muted); } .cbanner .row { margin: 0; gap: 4px; }
.cbanner.confirmed { border-style: solid; } .cbanner.rejected { opacity: 0.55; border-color: var(--ring); background: var(--page); }
.cres { width: 100%; font-size: 12.5px; color: var(--ink2); }
.spin { font-size: 12px; color: var(--ink2); } .spin::before { content: "◌ "; display: inline-block; animation: spin 1.2s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.abtn { display: inline-flex; }
.jobs { position: fixed; right: 16px; bottom: 16px; width: 300px; background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.14); padding: 6px; z-index: 30; font-size: 12.5px; }
.jobs[hidden] { display: none; }
.jhead { display: block; width: 100%; text-align: left; background: none; border: 0; font: inherit; font-weight: 600; color: var(--ink); padding: 4px 6px; cursor: pointer; }
.jrow { display: grid; grid-template-columns: 12px 1fr auto; gap: 8px; align-items: center; padding: 4px 6px; border-top: 1px solid var(--grid); }
.jrow small { display: block; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--axis); } .dot.running { background: var(--s3); animation: pulse 1.2s ease-in-out infinite; } .dot.done { background: var(--me); } .dot.error { background: var(--neg); } .dot.queued { background: var(--muted); }
@keyframes pulse { 50% { opacity: 0.3; } }
.nwrap small { display: block; margin-top: 2px; }
.pnote { border-top: 1px solid var(--grid); padding: 4px 0; font-size: 13px; } .pnote b { font-size: 12px; color: var(--ink2); }
details summary { cursor: pointer; color: var(--ink); margin: 4px 0; }
@media (max-width: 900px) { .tgrid { grid-template-columns: minmax(0, 1fr) 46px; } .tmargin { grid-column: 1; grid-row: 2; } .mcard { position: static; margin: 6px 0; } }
footer { color: var(--muted); font-size: 12.5px; margin-top: 40px; }
</style>
</head>
<body>
<div id="tip"></div>
<div id="modal" class="modal" hidden><div class="mbox"><button id="mclose" class="mclose" type="button" aria-label="Close">×</button><div id="mbody"></div></div></div>
<main>
<header>
  <h1>Texts, 2018–2026</h1>
  <p id="sub"></p>
  <nav>
    <a href="#overview">Overview</a><a href="#volume">Volume</a><a href="#people">People</a>
    <a href="#perdayh">Per day</a><a href="#compare">Weeks and months</a><a href="#directory">Directory</a><a href="#response">Response times</a><a href="#language">Language</a><a href="#style">Style</a><a href="#sentiment">Sentiment</a>
    <a href="#streaksec">Streaks</a><a href="#relationships">Relationships</a><a href="#markersec">Text markers</a><a href="#topicsec">Topics</a><a href="#conflictsec">Conflicts</a><a href="#yousec">You</a><a href="#method">Method</a>
  </nav>
</header>
<section id="overview"><div class="tiles" id="tiles"></div></section>
<section id="volume"><h2>Volume</h2><div id="vol"></div></section>
<section id="perdaysec"><h2 id="perdayh">Texts per day</h2><div id="perday"></div></section>
<section id="compare"><h2>Week by week, month by month</h2><div id="cmp"></div></section>
<section id="people"><h2>People</h2><div id="ppl"></div></section>
<section><h2 id="directory">Directory: people and chats</h2><div id="dir"></div></section>
<section id="response"><h2>Response times</h2><div id="rt"></div></section>
<section id="language"><h2>Language</h2><div id="lang"></div></section>
<section><h2 id="style">Pronouns and message length</h2><div id="style2"></div></section>
<section id="sentiment"><h2>Sentiment</h2><div id="sent"></div></section>
<section><h2 id="streaksec">Streaks</h2><div id="streaks"></div></section>
<section><h2 id="relationships">Relationships: top 20</h2><div id="rel"></div></section>
<section><h2 id="markersec">Text markers (pop psych)</h2><div id="markers"></div></section>
<section><h2 id="topicsec">Topics</h2><div id="topics"></div></section>
<section><h2 id="conflictsec">Conflicts</h2><div id="conflicts"></div></section>
<section><h2 id="yousec">You</h2><div id="you"></div></section>
<section id="method"><h2>Method and caveats</h2><div class="card method" id="meth"></div></section>
<footer>Built locally from out/summary.json. Aggregates only, no message text. This file makes no network requests.</footer>
</main>
<script>
const D = /*DATA*/;
const DET = /*DETAIL*/;
const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString("en-US");
const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
const sgn = (x, d = 3) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const mlabel = (m) => MON[+m.slice(5) - 1] + " " + m.slice(0, 4);
const minutes = (m) => m == null ? "–" : m < 1 ? Math.round(m * 60) + " s" : m < 90 ? m.toFixed(1) + " min" : (m / 60).toFixed(1) + " h";

// ---------- tooltip ----------
const tip = $("tip");
function hover(el, html) {
  el.addEventListener("mousemove", (e) => {
    tip.innerHTML = typeof html === "function" ? html(e) : html;
    tip.classList.add("on");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });
  el.addEventListener("mouseleave", () => tip.classList.remove("on"));
}

// ---------- dom helpers ----------
function h(tag, attrs = {}, kids = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === "html" ? (el.innerHTML = v) : el.setAttribute(k, v);
  for (const k of [].concat(kids)) el.append(k);
  return el;
}
function s(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.append(el);
  return el;
}
function svgText(parent, x, y, str, attrs = {}) { const t = s("text", { x, y, ...attrs }, parent); t.textContent = str; return t; }
function card(parent, title, take, wide = true) {
  const c = h("div", { class: "card" }, [h("h3", {}, title), h("p", { class: "take" }, take)]);
  parent.append(c);
  return c;
}
function legend(parent, items) {
  parent.append(h("div", { class: "legend" }, items.map(([name, color]) => h("span", { html: `<i style="background:${color}"></i>${name}` }))));
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
function ticks(max, n = 4) { const st = max / n; return Array.from({ length: n + 1 }, (_, i) => i * st); }
function short(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0).replace(".0", "") + "k" : String(Math.round(n * 100) / 100); }
function svgBox(parent, W, H) { const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }); parent.append(svg); return svg; }
function css(v) { return `var(--${v})`; }

// Continuous month axis (fills the gaps so they show).
function monthRange(a, b) {
  const out = []; let [y, m] = a.split("-").map(Number); const [by, bm] = b.split("-").map(Number);
  while (y < by || (y === by && m <= bm)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// ---------- chart: vertical stacked bars over months ----------
function stackedMonths(parent, months, series, opts = {}) {
  const W = 1000, H = opts.height || 260, L = 44, R = 8, T = 10, B = 28;
  const svg = svgBox(parent, W, H);
  const totals = months.map((m, i) => series.reduce((a, sr) => a + (sr.values[i] || 0), 0));
  const max = niceMax(Math.max(...totals));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const bw = (W - L - R) / months.length;
  for (const t of ticks(max)) { s("line", { x1: L, x2: W - R, y1: y(t), y2: y(t), class: "gridl" }, svg); svgText(svg, L - 6, y(t) + 4, short(t), { "text-anchor": "end" }); }
  // gaps
  (opts.gaps || []).forEach(([a, b, label]) => {
    const i0 = months.indexOf(a), i1 = months.indexOf(b);
    if (i0 < 0 || i1 < 0) return;
    s("rect", { x: L + i0 * bw, y: T, width: (i1 - i0 + 1) * bw, height: H - T - B, fill: css("gap") }, svg);
    svgText(svg, L + (i0 + (i1 - i0 + 1) / 2) * bw, T + 14, label, { "text-anchor": "middle", class: "lab" });
  });
  months.forEach((m, i) => {
    let acc = 0;
    const g = s("g", {}, svg);
    series.forEach((sr, k) => {
      const v = sr.values[i] || 0; if (!v) return;
      const y0 = y(acc), y1 = y(acc + v); acc += v;
      const top = k === series.length - 1 || series.slice(k + 1).every((o) => !(o.values[i] || 0));
      s("rect", { x: L + i * bw + 0.5, y: y1 + (top ? 0 : 1), width: Math.max(bw - 1.5, 1), height: Math.max(y0 - y1 - (top ? 0 : 1), 0.5), fill: sr.color, rx: top ? 1.5 : 0 }, g);
    });
    const hit = s("rect", { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: "transparent" }, svg);
    hover(hit, () => `<b>${mlabel(m)}</b><br>` + series.map((sr) => `${sr.name}: ${fmt(sr.values[i] || 0)}`).join("<br>") + `<br>Total: ${fmt(totals[i])}`);
    if (m.endsWith("-01")) { svgText(svg, L + i * bw, H - 10, m.slice(0, 4), { class: "lab" }); s("line", { x1: L + i * bw, x2: L + i * bw, y1: H - B, y2: H - B + 4, class: "axisl" }, svg); }
  });
  s("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, class: "axisl" }, svg);
}

// ---------- chart: line(s) over months with crosshair ----------
function linesMonths(parent, months, series, opts = {}) {
  const W = 1000, H = opts.height || 240, L = 48, R = 10, T = 12, B = 28;
  const svg = svgBox(parent, W, H);
  const vals = series.flatMap((sr) => sr.values.filter((v) => v != null));
  let lo = opts.min ?? Math.min(...vals), hi = opts.max ?? Math.max(...vals);
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const x = (i) => L + (W - L - R) * (i / Math.max(months.length - 1, 1));
  const tk = 4;
  for (let i = 0; i <= tk; i++) { const v = lo + (hi - lo) * i / tk; s("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "gridl" }, svg); svgText(svg, L - 6, y(v) + 4, v.toFixed(opts.dec ?? 2), { "text-anchor": "end" }); }
  if (opts.zero && lo < 0 && hi > 0) s("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), class: "axisl" }, svg);
  months.forEach((m, i) => { if (m.endsWith("-01")) svgText(svg, x(i), H - 10, m.slice(0, 4), { class: "lab", "text-anchor": "middle" }); });
  (opts.gaps || []).forEach(([a, b, label]) => {
    const i0 = months.indexOf(a), i1 = months.indexOf(b); if (i0 < 0) return;
    s("rect", { x: x(i0 - 0.5), y: T, width: x(i1 + 0.5) - x(i0 - 0.5), height: H - T - B, fill: css("gap") }, svg);
    if (label) svgText(svg, (x(i0) + x(i1)) / 2, T + 14, label, { "text-anchor": "middle", class: "lab" });
  });
  for (const sr of series) {
    let d = "", pen = false;
    sr.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); pen = true; });
    s("path", { d, fill: "none", stroke: sr.color, "stroke-width": sr.width || 2, "stroke-opacity": sr.opacity || 1, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
  }
  const cross = s("line", { y1: T, y2: H - B, class: "axisl", opacity: 0 }, svg);
  const hit = s("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" }, svg);
  hover(hit, (e) => {
    const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (W / r.width);
    const i = Math.max(0, Math.min(months.length - 1, Math.round((px - L) / (W - L - R) * (months.length - 1))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 1);
    return `<b>${mlabel(months[i])}</b><br>` + series.filter((sr) => !sr.hideTip).map((sr) => `${sr.name}: ${sr.values[i] == null ? "–" : sr.values[i].toFixed(opts.dec ?? 3)}`).join("<br>");
  });
  hit.addEventListener("mouseleave", () => cross.setAttribute("opacity", 0));
}

// ---------- chart: horizontal bars, two series side by side (stacked) ----------
function hbarsStacked(parent, rows, series, opts = {}) {
  const rowH = 22, W = 1000, L = opts.labelW || 150, R = 60, T = 4;
  const H = T + rows.length * rowH + 22;
  const svg = svgBox(parent, W, H);
  const max = niceMax(Math.max(...rows.map((r) => series.reduce((a, sr) => a + r[sr.key], 0))));
  const x = (v) => L + (W - L - R) * v / max;
  for (const t of ticks(max)) { s("line", { x1: x(t), x2: x(t), y1: T, y2: H - 20, class: "gridl" }, svg); svgText(svg, x(t), H - 6, short(t), { "text-anchor": "middle" }); }
  rows.forEach((r, i) => {
    const yy = T + i * rowH;
    svgText(svg, L - 8, yy + rowH / 2 + 4, r.name, { "text-anchor": "end", class: "lab" });
    let acc = 0;
    series.forEach((sr, k) => {
      const v = r[sr.key]; const last = k === series.length - 1;
      s("rect", { x: x(acc) + (k ? 1 : 0), y: yy + 4, width: Math.max(x(acc + v) - x(acc) - (k ? 1 : 0), 0.5), height: rowH - 8, fill: sr.color, rx: last ? 2 : 0 }, svg);
      acc += v;
    });
    svgText(svg, x(acc) + 6, yy + rowH / 2 + 4, short(acc), { class: "lab" });
    const hit = s("rect", { x: 0, y: yy, width: W, height: rowH, fill: "transparent" }, svg);
    hover(hit, `<b>${r.name}</b><br>` + series.map((sr) => `${sr.name}: ${fmt(r[sr.key])}`).join("<br>") + (opts.extra ? opts.extra(r) : ""));
  });
}

// ---------- chart: diverging bars around a center ----------
function hbarsCentered(parent, rows, opts) {
  const rowH = 22, W = 1000, L = opts.labelW || 150, R = 70, T = 4;
  const H = T + rows.length * rowH + 22;
  const svg = svgBox(parent, W, H);
  const { min, max, center } = opts;
  const x = (v) => L + (W - L - R) * (v - min) / (max - min);
  for (const t of opts.ticks) { s("line", { x1: x(t), x2: x(t), y1: T, y2: H - 20, class: t === center ? "axisl" : "gridl" }, svg); svgText(svg, x(t), H - 6, opts.tickFmt(t), { "text-anchor": "middle" }); }
  rows.forEach((r, i) => {
    const yy = T + i * rowH, v = r.value;
    svgText(svg, L - 8, yy + rowH / 2 + 4, r.name, { "text-anchor": "end", class: "lab" });
    const a = Math.min(x(v), x(center)), b = Math.max(x(v), x(center));
    s("rect", { x: a, y: yy + 4, width: Math.max(b - a, 1), height: rowH - 8, fill: v >= center ? opts.colorHi : opts.colorLo, rx: 2 }, svg);
    svgText(svg, (v >= center ? b + 6 : a - 6), yy + rowH / 2 + 4, opts.valFmt(v), { "text-anchor": v >= center ? "start" : "end", class: "lab" });
    const hit = s("rect", { x: 0, y: yy, width: W, height: rowH, fill: "transparent" }, svg);
    hover(hit, opts.tip(r));
  });
}

// ---------- chart: dumbbell (two values per row) ----------
function dumbbell(parent, rows, opts) {
  const rowH = 22, W = 1000, L = opts.labelW || 150, R = 20, T = 4;
  const H = T + rows.length * rowH + 22;
  const svg = svgBox(parent, W, H);
  const { min, max } = opts;
  const x = (v) => L + (W - L - R) * (Math.max(min, Math.min(max, opts.scale ? opts.scale(v) : v)) - min) / (max - min);
  for (const t of opts.ticks) { const tv = opts.scale ? opts.scale(t) : t; const px = L + (W - L - R) * (tv - min) / (max - min); s("line", { x1: px, x2: px, y1: T, y2: H - 20, class: t === 0 ? "axisl" : "gridl" }, svg); svgText(svg, px, H - 6, opts.tickFmt(t), { "text-anchor": "middle" }); }
  rows.forEach((r, i) => {
    const yy = T + i * rowH + rowH / 2;
    svgText(svg, L - 8, yy + 4, r.name, { "text-anchor": "end", class: "lab" });
    if (r.a != null && r.b != null) s("line", { x1: x(r.a), x2: x(r.b), y1: yy, y2: yy, stroke: css("axis"), "stroke-width": 2 }, svg);
    for (const [k, color] of [["a", opts.colorA], ["b", opts.colorB]]) if (r[k] != null) s("circle", { cx: x(r[k]), cy: yy, r: 5, fill: color, stroke: css("surface"), "stroke-width": 2 }, svg);
    const hit = s("rect", { x: 0, y: yy - rowH / 2, width: W, height: rowH, fill: "transparent" }, svg);
    hover(hit, opts.tip(r));
  });
}

// ---------- chart: heatmap ----------
function mix(a, b, t) { // hex mix via CSS color-mix for theme tokens
  return `color-mix(in oklab, ${b} ${Math.round(t * 100)}%, ${a})`;
}
function heatmap(parent, matrix, rows, cols, opts = {}) {
  const W = 1000, L = 40, T = 4, cw = (W - L - 4) / cols.length, ch = opts.cellH || 26;
  const H = T + rows.length * ch + 20;
  const svg = svgBox(parent, W, H);
  const max = Math.max(...matrix.flat());
  matrix.forEach((row, r) => {
    svgText(svg, L - 6, T + r * ch + ch / 2 + 4, rows[r], { "text-anchor": "end", class: "lab" });
    row.forEach((v, c) => {
      const cell = s("rect", { x: L + c * cw + 1, y: T + r * ch + 1, width: cw - 2, height: ch - 2, rx: 3, fill: mix(css("seq0"), css("seq1"), v / max) }, svg);
      hover(cell, `<b>${DOW[r] || rows[r]} · ${opts.colFmt ? opts.colFmt(cols[c]) : cols[c]}</b><br>${fmt(v)} messages`);
    });
  });
  cols.forEach((c, i) => { if (i % 3 === 0) svgText(svg, L + i * cw + cw / 2, H - 4, opts.colFmt ? opts.colFmt(c) : c, { "text-anchor": "middle" }); });
}

// ---------- chart: sparkline small multiple ----------
function spark(parent, months, series, opts = {}) {
  const W = 200, H = opts.h || 54, P = 2;
  const svg = svgBox(parent, W, H);
  const vals = series.flatMap((sr) => sr.values.filter((v) => v != null));
  const lo = opts.min ?? 0, hi = opts.max ?? Math.max(...vals, 1);
  const x = (i) => P + (W - 2 * P) * i / Math.max(months.length - 1, 1);
  const y = (v) => P + (H - 2 * P) * (1 - (v - lo) / (hi - lo || 1));
  if (opts.zero) s("line", { x1: 0, x2: W, y1: y(0), y2: y(0), class: "axisl" }, svg);
  for (const sr of series) {
    let d = "", pen = false;
    sr.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); pen = true; });
    if (sr.area) s("path", { d: d + `L${x(months.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`, fill: sr.color, "fill-opacity": 0.12, stroke: "none" }, svg);
    s("path", { d, fill: "none", stroke: sr.color, "stroke-width": 1.5, "stroke-linejoin": "round" }, svg);
  }
  const hit = s("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }, svg);
  hover(hit, (e) => {
    const r = svg.getBoundingClientRect(); const i = Math.max(0, Math.min(months.length - 1, Math.round((e.clientX - r.left) / r.width * (months.length - 1))));
    return `<b>${mlabel(months[i])}</b><br>` + series.map((sr) => `${sr.name}: ${sr.values[i] == null ? "–" : (opts.dec != null ? sr.values[i].toFixed(opts.dec) : fmt(sr.values[i]))}`).join("<br>");
  });
}

function table(parent, head, rows, numCols = []) {
  const t = h("table");
  t.append(h("tr", {}, head.map((c, i) => h("th", numCols.includes(i) ? { class: "n" } : {}, c))));
  rows.forEach((r) => t.append(h("tr", {}, r.map((c, i) => {
    const td = h("td", numCols.includes(i) ? { class: "n" } : {}); if (c instanceof Node) td.append(c); else td.innerHTML = c; return td;
  }))));
  parent.append(h("div", { class: "scroll" }, t));
  return t;
}

// =================== data prep ===================
const M = D.meta, V = D.volume, P = D.people, RT = D.response_times, LG = D.language, S = D.sentiment;
const pmKeys = Object.keys(V.per_month).sort();
const months = monthRange(pmKeys[0], pmKeys[pmKeys.length - 1]);
const missing = months.filter((m) => !V.per_month[m]);
// group consecutive missing months into gap ranges
const gaps = [];
missing.forEach((m) => { const g = gaps[gaps.length - 1]; if (g && months.indexOf(m) === months.indexOf(g[1]) + 1) g[1] = m; else gaps.push([m, m]); });
const bigGaps = gaps.filter(([a, b]) => months.indexOf(b) - months.indexOf(a) >= 1).map(([a, b]) => [a, b, `no data ${MON[+a.slice(5) - 1]}–${MON[+b.slice(5) - 1]} ${b.slice(0, 4)}`]);
const pm = (m, k) => (V.per_month[m] || {})[k] || 0;
const years = [...new Set(months.map((m) => m.slice(0, 4)))];
const top25 = P.top25_overall;

// =================== 1. overview ===================
const busiest = V.top10_busiest_days[0];
const svc = V.by_service;
$("sub").textContent = `${fmt(M.non_tapback_messages)} messages from ${M.first.slice(0, 10)} to ${M.last.slice(0, 10)}. Aggregates only, computed on this Mac.`;
[
  [fmt(M.non_tapback_messages), "messages (plus " + fmt(M.tapbacks) + " tapbacks)"],
  [M.first.slice(0, 7) + " → " + M.last.slice(0, 7), "date range"],
  [pct(M.sent / M.non_tapback_messages) + " / " + pct(M.received / M.non_tapback_messages), `sent ${fmt(M.sent)} / received ${fmt(M.received)}`],
  [pct(svc.iMessage / (svc.iMessage + (svc.SMS || 0))), `iMessage (${fmt(svc.SMS || 0)} SMS)`],
  [fmt(P.distinct_1to1_contacts), "distinct 1:1 contacts"],
  [fmt(busiest.count), "busiest day, " + busiest.date],
].forEach(([v, l]) => $("tiles").append(h("div", { class: "tile" }, [h("div", { class: "v" }, v), h("div", { class: "l" }, l)])));

// =================== 2. volume ===================
{
  const root = $("vol");
  const ser = [
    { name: "Sent · 1:1", key: "sent_1:1", color: css("me") },
    { name: "Sent · group", key: "sent_group", color: `color-mix(in oklab, ${css("me")} 45%, ${css("surface")})` },
    { name: "Received · 1:1", key: "received_1:1", color: css("them") },
    { name: "Received · group", key: "received_group", color: `color-mix(in oklab, ${css("them")} 45%, ${css("surface")})` },
  ].map((sr) => ({ ...sr, values: months.map((m) => pm(m, sr.key)) }));
  const tot = months.map((m, i) => ser.reduce((a, sr) => a + sr.values[i], 0));
  const peakI = tot.indexOf(Math.max(...tot));
  const byYear = {}; months.forEach((m, i) => byYear[m.slice(0, 4)] = (byYear[m.slice(0, 4)] || 0) + tot[i]);
  const fullYears = Object.entries(byYear).filter(([y]) => y !== years[0] && y !== years[years.length - 1]);
  const topYear = fullYears.sort((a, b) => b[1] - a[1])[0];
  const groupShare = M.group_messages / M.non_tapback_messages;
  const c = card(root, "Messages per month", `Peak month was ${mlabel(months[peakI])} with ${fmt(tot[peakI])} messages; ${topYear[0]} was the busiest full year (${fmt(topYear[1])}). Group chats are ${pct(groupShare)} of all messages.` + (bigGaps.length ? ` The shaded band is a stretch with no messages in the database.` : ""));
  legend(c, ser.map((sr) => [sr.name, sr.color]));
  stackedMonths(c, months, ser, { gaps: bigGaps });

  const g = h("div", { class: "grid2" }); root.append(g);
  const hm = V.heatmap_weekday_hour;
  const peakCell = (mx) => { let b = [0, 0, -1]; mx.forEach((r, i) => r.forEach((v, j) => { if (v > b[2]) b = [i, j, v]; })); return b; };
  const hr = (x) => (x % 12 || 12) + (x < 12 ? "a" : "p");
  const quiet = (mx) => { const col = Array.from({ length: 24 }, (_, j) => mx.reduce((a, r) => a + r[j], 0)); return col.indexOf(Math.min(...col)); };
  for (const [k, label] of [["sent", "Sent"], ["received", "Received"]]) {
    const pc = peakCell(hm[k]);
    const late = hm[k].reduce((a, r) => a + r.slice(0, 4).reduce((x, y) => x + y, 0), 0) / hm[k].flat().reduce((a, b) => a + b, 0);
    const cc = card(g, `${label} by weekday × hour`, `Busiest slot is ${DOW[pc[0]]} ${hr(pc[1])} (${fmt(pc[2])}); quietest hour is ${hr(quiet(hm[k]))}. ${pct(late)} land between midnight and 4am.`);
    heatmap(cc, hm[k], DOW, Array.from({ length: 24 }, (_, i) => i), { colFmt: hr, cellH: 24 });
  }

  const g2 = h("div", { class: "grid2" }); root.append(g2);
  const d10 = V.top10_busiest_days;
  const cd = card(g2, "Top 10 busiest days", `${busiest.date} stands out at ${fmt(busiest.count)} messages, ${(busiest.count / d10[1].count).toFixed(1)}× the next busiest day.`);
  table(cd, ["Date", "Weekday", "Messages"], d10.map((d) => [d.date, DOW[(new Date(d.date + "T12:00").getDay() + 6) % 7], fmt(d.count)]), [2]);
  const tb = V.tapbacks_per_year; const tby = Object.keys(tb);
  const ct = card(g2, "Tapbacks per year", `Reactions went from ${fmt(tb[tby[0]])} in ${tby[0]} to ${fmt(tb[tby[tby.length - 1]])} in ${tby[tby.length - 1]}, with a jump once iOS made them easy in 2020.`);
  hbarsStacked(ct, tby.map((y) => ({ name: y, n: tb[y] })), [{ key: "n", name: "Tapbacks", color: css("s3") }], { labelW: 50 });
}

// =================== 2b. week by week, month by month ===================
{
  const root = $("cmp");
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const lastDay = new Date(M.last.slice(0, 10) + "T12:00");
  const delta = (a, b) => a && b ? (a - b) / b : null;  // a zero month is a gap in the data, not a change
  const tpct = (x) => { if (x == null) return "n/a"; const r = Math.round(x * 100); return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r) + "%"; };
  const dpct = (x) => x == null || Math.round(x * 100) === 0 ? tpct(x).replace("n/a", "–") : `<span style="color:${css(x > 0 ? "pos" : "neg")}">${tpct(x)}</span>`;
  const bar = (v, max, color) => h("div", { style: "width:140px" }, h("div", { style: `height:8px;min-width:2px;border-radius:2px;background:${color};width:${(100 * v / (max || 1)).toFixed(1)}%` }));

  // Weeks start Monday. The last one is the week so far.
  const monday = new Date(lastDay); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const weeks = [];
  for (let w = 12; w >= 0; w--) {
    const start = new Date(monday); start.setDate(start.getDate() - 7 * w);
    let n = 0, days = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      if (d > lastDay) break;
      n += V.recent_days[iso(d)] || 0; days++;
    }
    weeks.push({ start, n, days });
  }
  const full = weeks.slice(0, -1), cur = weeks[weeks.length - 1], prev = full[full.length - 1];
  const avg12 = full.reduce((a, w) => a + w.n, 0) / full.length;
  const pace = cur.days ? cur.n / cur.days * 7 : 0;
  const wmax = Math.max(...weeks.map((w) => w.n));
  const wl = (d) => `${MON[d.getMonth()]} ${d.getDate()}`;
  const cw = card(root, "Week by week", `Last full week (from ${wl(prev.start)}) had ${fmt(prev.n)} messages, ${tpct(delta(prev.n, full[full.length - 2].n))} on the week before and ${tpct(delta(prev.n, avg12))} against the 12-week average of ${fmt(Math.round(avg12))}. This week is on pace for about ${fmt(Math.round(pace))}.`);
  table(cw, ["Week of", "Messages", "", "vs week before", "vs 12-week avg"], weeks.slice().reverse().map((w, i, a) => {
    const before = a[i + 1];
    const partial = w.days < 7;
    return [wl(w.start) + (partial ? ` <span style="color:${css("muted")}">(${w.days} days so far)</span>` : ""), fmt(w.n), bar(w.n, wmax, css("me")),
      partial || !before ? "–" : dpct(delta(w.n, before.n)), partial ? "–" : dpct(delta(w.n, avg12))];
  }), [1, 3, 4]);

  // Months: last 13, with the same month a year earlier.
  const mk = months.slice(-13);
  const tot = (m) => pm(m, "sent_1:1") + pm(m, "received_1:1") + pm(m, "sent_group") + pm(m, "received_group");
  const sent = (m) => pm(m, "sent_1:1") + pm(m, "sent_group");
  const yearAgo = (m) => `${+m.slice(0, 4) - 1}${m.slice(4)}`;
  const curM = mk[mk.length - 1], lastM = mk[mk.length - 2];
  const curPartial = lastDay.getDate() < new Date(lastDay.getFullYear(), lastDay.getMonth() + 1, 0).getDate();
  const mmax = Math.max(...mk.map(tot));
  const sm = (m, k) => (S.monthly_mean[m] || {})[k];
  const cm = card(root, "Month by month", `${mlabel(lastM)} had ${fmt(tot(lastM))} messages, ${tpct(delta(tot(lastM), tot(mk[mk.length - 3])))} on the month before` + (tot(yearAgo(lastM)) ? ` and ${tpct(delta(tot(lastM), tot(yearAgo(lastM))))} on ${mlabel(yearAgo(lastM))}` : ` (no data for ${mlabel(yearAgo(lastM))})`) + `. I sent ${pct(sent(lastM) / (tot(lastM) || 1))} of them.`);
  table(cm, ["Month", "Messages", "", "Sent by me", "vs month before", "vs year before", "My sentiment", "Their sentiment"], mk.slice().reverse().map((m, i, a) => {
    const partial = m === curM && curPartial;
    const before = a[i + 1];
    const ms = sm(m, "sent"), mr = sm(m, "received");
    return [mlabel(m) + (partial ? ` <span style="color:${css("muted")}">(so far)</span>` : ""), fmt(tot(m)), bar(tot(m), mmax, css("me")), tot(m) ? pct(sent(m) / tot(m)) : "–",
      partial || !before ? "–" : dpct(delta(tot(m), tot(before))), partial ? "–" : dpct(delta(tot(m), tot(yearAgo(m)))),
      ms == null ? "–" : sgn(ms), mr == null ? "–" : sgn(mr)];
  }), [1, 3, 4, 5, 6, 7]);

  // Who moved: last full month against the one before, top 15 people.
  const ser = P.monthly_series_top15, prevM = mk[mk.length - 3];
  const moves = Object.entries(ser).map(([name, s]) => ({ name, a: s[prevM] || 0, b: s[lastM] || 0 })).filter((r) => r.a || r.b)
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
  if (moves.length) {
    const up = moves.find((r) => r.b > r.a), down = moves.find((r) => r.b < r.a);
    const cp = card(root, `Who moved: ${mlabel(prevM)} → ${mlabel(lastM)}`, [up && `${up.name} rose the most (${fmt(up.a)} → ${fmt(up.b)}).`, down && `${down.name} fell the most (${fmt(down.a)} → ${fmt(down.b)}).`].filter(Boolean).join(" ") + " 1:1 messages, top 15 people overall.");
    table(cp, ["Person", mlabel(prevM), mlabel(lastM), "Change"], moves.map((r) => [r.name, fmt(r.a), fmt(r.b), r.a ? dpct((r.b - r.a) / r.a) : "new"]), [1, 2, 3]);
  }
}

// =================== 3. people ===================
{
  const root = $("ppl");
  const top = top25[0], sumTop = top25.reduce((a, r) => a + r.total, 0);
  const oneToOne = M.non_tapback_messages - M.group_messages;
  const c = card(root, "Top 25 people (1:1 messages)", `${top.name} alone is ${pct(top.total / oneToOne)} of all 1:1 messages, ${(top.total / top25[1].total).toFixed(1)}× the next person. The top 25 cover ${pct(sumTop / oneToOne)}.`);
  legend(c, [["Sent by me", css("me")], ["Received", css("them")]]);
  hbarsStacked(c, top25, [{ key: "sent", name: "Sent", color: css("me") }, { key: "received", name: "Received", color: css("them") }],
    { extra: (r) => `<br>I send ${pct(r.sent / r.total)}` });

  // who mattered when: rank table
  const yrs = Object.keys(P.top10_per_year);
  const leaders = yrs.map((y) => P.top10_per_year[y][0].name);
  const changes = leaders.filter((n, i) => i && n !== leaders[i - 1]).length;
  const cw = card(root, "Who mattered when", `The #1 contact changed ${changes} times in ${yrs.length} years: ${[...new Set(leaders)].join(" → ")}.`);
  const maxRank = 10;
  const t = h("table");
  t.append(h("tr", {}, [h("th", {}, "Rank"), ...yrs.map((y) => h("th", {}, y))]));
  for (let r = 0; r < maxRank; r++) {
    t.append(h("tr", {}, [h("td", {}, String(r + 1)), ...yrs.map((y) => {
      const e = P.top10_per_year[y][r]; if (!e) return h("td", {}, "");
      const td = h("td", { html: `${e.name}<br><small style="color:var(--muted)">${fmt(e.total)}</small>` });
      hover(td, `<b>${e.name}, ${y}</b><br>#${r + 1} · ${fmt(e.total)} messages<br>sent ${fmt(e.sent)} · received ${fmt(e.received)}`);
      return td;
    })]));
  }
  cw.append(h("div", { class: "scroll" }, t));

  // small multiples
  const ms = P.monthly_series_top15;
  const names15 = Object.keys(ms);
  const peakOf = (n) => { const e = Object.entries(ms[n]).sort((a, b) => b[1] - a[1])[0]; return e; };
  const longest = names15.map((n) => [n, Object.keys(ms[n]).length]).sort((a, b) => b[1] - a[1])[0];
  const cs = card(root, "Monthly messages, top 15", `Most of these relationships run in bursts. ${longest[0]} is the steadiest, active in ${longest[1]} of ${months.length} months. Each panel has its own scale.`);
  const grid = h("div", { class: "sm" }); cs.append(grid);
  names15.forEach((n) => {
    const pk = peakOf(n);
    const cell = h("div", { class: "cell" }, [h("b", {}, n), h("em", {}, `peak ${mlabel(pk[0])}`)]);
    grid.append(cell);
    spark(cell, months, [{ name: "Messages", color: css("me"), values: months.map((m) => ms[n][m] ?? 0), area: true }]);
  });

  // initiation
  const ini = P.initiation_top25;
  const rows = top25.filter((r) => ini[r.name]).map((r) => ({ name: r.name, value: ini[r.name].me_share, ...ini[r.name] })).sort((a, b) => b.value - a.value);
  const meMore = rows.filter((r) => r.value > 0.5).length;
  const allConv = rows.reduce((a, r) => a + r.conversations, 0), allMe = rows.reduce((a, r) => a + r.me, 0);
  const ci = card(root, "Who starts the conversation", `Across the top 25 I start ${pct(allMe / allConv)} of conversations, and I start most of them with ${meMore} of ${rows.length} people. Most lopsided: ${rows[0].name} (I start ${pct(rows[0].value)}) and ${rows[rows.length - 1].name} (${pct(1 - rows[rows.length - 1].value)} start with them).`);
  legend(ci, [["I start more", css("me")], ["They start more", css("them")]]);
  hbarsCentered(ci, rows, { min: 0, max: 1, center: 0.5, ticks: [0, 0.25, 0.5, 0.75, 1], tickFmt: (t) => pct(t), valFmt: (v) => pct(v), colorHi: css("me"), colorLo: css("them"),
    tip: (r) => `<b>${r.name}</b><br>${fmt(r.conversations)} conversations<br>I started ${fmt(r.me)} · they started ${fmt(r.them)}` });

  const gc = P.top10_group_chats;
  const cg = card(root, "Top group chats", `${gc[0].name} leads with ${fmt(gc[0].messages)} messages. Unnamed chats show as "Group N".`);
  hbarsStacked(cg, gc.map((g) => ({ name: g.name, n: g.messages, members: g.members })), [{ key: "n", name: "Messages", color: css("s3") }], { labelW: 230, extra: (r) => `<br>${r.members} other members` });
}

// =================== 4. response times ===================
{
  const root = $("rt");
  const o = RT.overall;
  const py = RT.per_year; const yrs = Object.keys(py);
  const c = card(root, "Reply time per year", `Overall median reply is ${minutes(o.me_to_them.median_min)} for me and ${minutes(o.them_to_me.median_min)} for them; the slower quarter of my replies take ${minutes(o.me_to_them.p75_min)} or more (theirs ${minutes(o.them_to_me.p75_min)}).`);
  legend(c, [["Me → them", css("me")], ["Them → me", css("them")]]);
  const t = table(c, ["Year", "My median", "My p75", "Their median", "Their p75", "Replies counted"], yrs.map((y) => {
    const a = py[y].me_to_them || {}, b = py[y].them_to_me || {};
    return [y, minutes(a.median_min), minutes(a.p75_min), minutes(b.median_min), minutes(b.p75_min), fmt((a.n || 0) + (b.n || 0))];
  }), [1, 2, 3, 4, 5]);
  const mp = card(root, "p75 reply time by year", "Medians sit under a minute every year, so the 75th percentile shows the change better.");
  legend(mp, [["My p75", css("me")], ["Their p75", css("them")]]);
  dumbbell(mp, yrs.map((y) => ({ name: y, a: (py[y].me_to_them || {}).p75_min, b: (py[y].them_to_me || {}).p75_min })), {
    labelW: 50, min: 0, max: niceMax(Math.max(...yrs.flatMap((y) => [(py[y].me_to_them || {}).p75_min || 0, (py[y].them_to_me || {}).p75_min || 0]))),
    ticks: (() => { const mx = niceMax(Math.max(...yrs.flatMap((y) => [(py[y].me_to_them || {}).p75_min || 0, (py[y].them_to_me || {}).p75_min || 0]))); return ticks(mx); })(),
    tickFmt: (t) => t.toFixed(0) + "m", colorA: css("me"), colorB: css("them"),
    tip: (r) => `<b>${r.name}</b><br>my p75 ${minutes(r.a)}<br>their p75 ${minutes(r.b)}` });

  const pc = RT.per_contact_top25;
  const rows = top25.filter((r) => pc[r.name] && pc[r.name].me_to_them && pc[r.name].them_to_me)
    .map((r) => ({ name: r.name, a: pc[r.name].me_to_them.median_min, b: pc[r.name].them_to_me.median_min, ap: pc[r.name].me_to_them.p75_min, bp: pc[r.name].them_to_me.p75_min, na: pc[r.name].me_to_them.n, nb: pc[r.name].them_to_me.n }))
    .sort((x, y) => x.a - y.a);
  const slowerMe = rows.filter((r) => r.a > r.b).length;
  const fastest = rows[0], slowest = rows[rows.length - 1];
  const cc = card(root, "Median reply time by person", `I reply fastest to ${fastest.name} (${minutes(fastest.a)}) and slowest to ${slowest.name} (${minutes(slowest.a)}). I'm the slower one with ${slowerMe} of ${rows.length} people. Log scale.`);
  legend(cc, [["My median", css("me")], ["Their median", css("them")]]);
  const lg = (v) => Math.log10(Math.max(v, 0.1));
  dumbbell(cc, rows, { min: lg(0.1), max: lg(Math.max(60, ...rows.flatMap((r) => [r.a, r.b])) * 1.2), scale: lg, ticks: [0.1, 0.5, 1, 5, 15, 60].filter((t) => lg(t) <= lg(Math.max(60, ...rows.flatMap((r) => [r.a, r.b])) * 1.2)),
    tickFmt: (t) => t < 1 ? Math.round(t * 60) + "s" : t + "m", colorA: css("me"), colorB: css("them"),
    tip: (r) => `<b>${r.name}</b><br>me: median ${minutes(r.a)}, p75 ${minutes(r.ap)} (${fmt(r.na)})<br>them: median ${minutes(r.b)}, p75 ${minutes(r.bp)} (${fmt(r.nb)})` });
}

// =================== 5. language ===================
{
  const root = $("lang");
  const chips = (parent, list, n) => { const w = h("div", { class: "chips" }); list.slice(0, n).forEach((r) => w.append(h("span", { class: "chip", html: `${r.term}<b>${fmt(r.count)}</b>` }))); parent.append(w); };
  const w = LG.my_top100_words;
  const cw = card(root, "My most-used words", `Stopwords and link fragments removed. "${w[0].term}" leads with ${fmt(w[0].count)} uses, then "${w[1].term}" and "${w[2].term}".`);
  chips(cw, w, 100);

  const e = LG.my_top50_emoji;
  const eTot = e.reduce((a, r) => a + r.count, 0);
  const ce = card(root, "Top 50 emoji", `${e[0].emoji} is my most-used emoji (${fmt(e[0].count)}); the top 5 make up ${pct(e.slice(0, 5).reduce((a, r) => a + r.count, 0) / eTot)} of the top-50 total.`);
  const eg = h("div", { class: "emoji" }); ce.append(eg);
  e.forEach((r) => eg.append(h("div", {}, [h("span", {}, r.emoji), h("small", {}, fmt(r.count))])));

  const g = h("div", { class: "grid2" }); root.append(g);
  const bi = LG.my_top50_bigrams, tri = LG.my_top50_trigrams;
  const cb = card(g, "Top two-word phrases", `"${bi[0].term}" is my most common pair (${fmt(bi[0].count)}).`); chips(cb, bi, 50);
  const ct = card(g, "Top three-word phrases", tri.length ? `"${tri[0].term}" is my most common three-word phrase (${fmt(tri[0].count)}).` : "No trigram reached the count floor."); chips(ct, tri, 50);

  const ml = LG.message_length_by_year; const yrs = Object.keys(ml);
  const first = ml[yrs[0]].sent, last = ml[yrs[yrs.length - 1]].sent;
  const longer = yrs.filter((y) => ml[y].sent && ml[y].received && ml[y].sent.mean > ml[y].received.mean).length;
  const cm = card(root, "Message length by year (characters)", `My mean message went from ${first.mean.toFixed(0)} to ${last.mean.toFixed(0)} characters; my messages are longer than theirs in ${longer} of ${yrs.length} years. Dots are means; the table has medians.`);
  legend(cm, [["Mine (mean)", css("me")], ["Theirs (mean)", css("them")]]);
  const mx = niceMax(Math.max(...yrs.flatMap((y) => [ml[y].sent?.mean || 0, ml[y].received?.mean || 0])));
  dumbbell(cm, yrs.map((y) => ({ name: y, a: ml[y].sent?.mean, b: ml[y].received?.mean, am: ml[y].sent?.median, bm: ml[y].received?.median })), {
    labelW: 50, min: 0, max: mx, ticks: ticks(mx), tickFmt: (t) => t.toFixed(0), colorA: css("me"), colorB: css("them"),
    tip: (r) => `<b>${r.name}</b><br>mine: mean ${r.a?.toFixed(1)}, median ${r.am}<br>theirs: mean ${r.b?.toFixed(1)}, median ${r.bm}` });

  const dw = LG.distinctive_words_per_year;
  const cd = card(root, "Distinctive words per year", "TF-IDF across years: words I used unusually often that year compared with the other years, a rough proxy for what each year was about. Click a year for its word cloud.");
  const yg = h("div", { class: "years" }); cd.append(yg);
  Object.keys(dw).forEach((y) => yg.append(h("div", { "data-year": y }, [h("h4", {}, y + " ☁"), h("div", { class: "chips" }, dw[y].slice(0, 15).map((r) => h("span", { class: "chip" }, r.term)))])));
}

// =================== 6. sentiment ===================
{
  const root = $("sent");
  const mm = S.monthly_mean;
  const mine = months.map((m) => mm[m]?.sent ?? null), theirs = months.map((m) => mm[m]?.received ?? null);
  const roll = (arr, k = 3) => arr.map((_, i) => { const w = arr.slice(Math.max(0, i - k + 1), i + 1).filter((v) => v != null); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; });
  const ym = S.yearly_mean; const yrs = Object.keys(ym);
  const warmer = yrs.filter((y) => ym[y].received > ym[y].sent).length;
  const best = yrs.slice().sort((a, b) => ym[b].sent - ym[a].sent)[0], worst = yrs.slice().sort((a, b) => ym[a].sent - ym[b].sent)[0];
  const c = card(root, "Monthly sentiment, mine vs theirs", `My messages averaged ${ym[yrs[0]].sent.toFixed(3)} in ${yrs[0]} and ${ym[yrs[yrs.length - 1]].sent.toFixed(3)} in ${yrs[yrs.length - 1]} (VADER, −1 to +1); my most positive year was ${best} and least was ${worst}. Messages to me were warmer than mine in ${warmer} of ${yrs.length} years. Thick lines are 3-month rolling means.`);
  legend(c, [["Mine (3-mo avg)", css("me")], ["Theirs (3-mo avg)", css("them")]]);
  linesMonths(c, months, [
    { name: "Mine", values: mine, color: css("me"), width: 1, opacity: 0.35 },
    { name: "Theirs", values: theirs, color: css("them"), width: 1, opacity: 0.35 },
    { name: "Mine, 3-mo", values: roll(mine), color: css("me"), width: 2.5 },
    { name: "Theirs, 3-mo", values: roll(theirs), color: css("them"), width: 2.5 },
  ], { gaps: bigGaps.map(([a, b]) => [a, b, ""]), zero: true });

  const cs = S.class_share_per_year; const cy = Object.keys(cs);
  const negMax = cy.slice().sort((a, b) => cs[b].negative - cs[a].negative)[0];
  const cc = card(root, "Positive / neutral / negative share per year", `Most messages score neutral. Negative share peaked in ${negMax} at ${pct(cs[negMax].negative, 1)}; positive share went from ${pct(cs[cy[0]].positive)} to ${pct(cs[cy[cy.length - 1]].positive)}.`);
  legend(cc, [["Negative", css("neg")], ["Neutral", css("mid")], ["Positive", css("pos")]]);
  hbarsStacked(cc, cy.map((y) => ({ name: y, neg: cs[y].negative || 0, neu: cs[y].neutral || 0, pos: cs[y].positive || 0 })),
    [{ key: "neg", name: "Negative", color: css("neg") }, { key: "neu", name: "Neutral", color: `color-mix(in oklab, ${css("muted")} 35%, ${css("surface")})` }, { key: "pos", name: "Positive", color: css("pos") }],
    { labelW: 50 });

  const pc = S.per_contact_top25;
  const rows = top25.filter((r) => pc[r.name]).map((r) => ({ name: r.name, a: pc[r.name].sent, b: pc[r.name].received })).sort((x, y) => (y.a ?? 0) - (x.a ?? 0));
  const gapRows = rows.filter((r) => r.a != null && r.b != null).map((r) => ({ ...r, d: r.b - r.a })).sort((x, y) => y.d - x.d);
  const cp = card(root, "Sentiment by person, mine vs theirs", `I'm most positive with ${rows[0].name} (${rows[0].a.toFixed(3)}). The biggest gap is ${gapRows[0].name}: their messages to me score ${gapRows[0].b.toFixed(3)}, mine to them ${gapRows[0].a.toFixed(3)}.`);
  legend(cp, [["My messages to them", css("me")], ["Their messages to me", css("them")]]);
  const lo = Math.min(0, ...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0])), hi = Math.max(...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]));
  const tk = ticks(niceMax(hi)).filter((t) => t <= niceMax(hi));
  dumbbell(cp, rows, { min: Math.min(lo, -0.05), max: niceMax(hi), ticks: lo < -0.05 ? [-0.1, ...tk] : tk, tickFmt: (t) => t.toFixed(2), colorA: css("me"), colorB: css("them"),
    tip: (r) => `<b>${r.name}</b><br>mine: ${r.a?.toFixed(3)}<br>theirs: ${r.b?.toFixed(3)}<br>gap: ${r.a != null && r.b != null ? sgn(r.b - r.a) : "–"}` });

  // yearly heat table: my sentiment per person per year
  const py = S.per_contact_yearly_top25;
  const allYears = [...new Set(Object.values(py).flatMap((o) => Object.keys(o)))].sort();
  const vals = Object.values(py).flatMap((o) => Object.values(o).flatMap((v) => [v.sent, v.received])).filter((v) => v != null);
  const ext = Math.max(...vals.map(Math.abs), 0.01);
  const color = (v) => v == null ? "transparent" : v >= 0 ? mix(css("mid"), css("pos"), Math.min(v / ext, 1)) : mix(css("mid"), css("neg"), Math.min(-v / ext, 1));
  const ink = (v) => v != null && Math.abs(v) / ext > 0.6 ? "#fff" : "var(--ink)";
  let rising = null;
  for (const n of Object.keys(py)) { const ys = Object.keys(py[n]).filter((y) => py[n][y].sent != null); if (ys.length >= 3) { const d = py[n][ys[ys.length - 1]].sent - py[n][ys[0]].sent; if (!rising || d > rising[1]) rising = [n, d, ys[0], ys[ys.length - 1]]; } }
  const cy2 = card(root, "My sentiment per person, by year", `Each cell shows my average toward that person that year; hover for theirs. Biggest rise: ${rising ? `${rising[0]}, ${sgn(rising[1])} from ${rising[2]} to ${rising[3]}` : "n/a"}. Blue is more positive, red more negative, gray neutral.`);
  const t = h("table");
  t.append(h("tr", {}, [h("th", {}, "Person"), ...allYears.map((y) => h("th", { class: "n" }, y))]));
  top25.filter((r) => py[r.name]).forEach((r) => {
    t.append(h("tr", {}, [h("td", {}, r.name), ...allYears.map((y) => {
      const v = py[r.name][y]; const m = v?.sent;
      const td = h("td", { class: "n", style: `background:${color(m)};color:${ink(m)}` }, m == null ? "" : m.toFixed(2));
      if (v) hover(td, `<b>${r.name}, ${y}</b><br>mine: ${v.sent?.toFixed(3) ?? "–"}<br>theirs: ${v.received?.toFixed(3) ?? "–"}`);
      return td;
    })]));
  });
  cy2.append(h("div", { class: "scroll" }, t));

  // small multiples top 10 monthly
  const ms = S.monthly_series_top10;
  const names = Object.keys(ms).filter((n) => Object.keys(ms[n]).length);
  const cm = card(root, "Monthly sentiment, top 10 people", "One panel per person, all on the same −0.2 to +0.5 scale (values outside are clipped). Gaps are months with no messages. Single months with few messages are noisy.");
  legend(cm, [["Mine", css("me")], ["Theirs", css("them")]]);
  const grid = h("div", { class: "sm" }); cm.append(grid);
  names.forEach((n) => {
    const ks = Object.keys(ms[n]).sort();
    const sub = monthRange(ks[0], ks[ks.length - 1]);
    const clip = (v) => v == null ? null : Math.max(-0.2, Math.min(0.5, v));
    const cell = h("div", { class: "cell" }, [h("b", {}, n), h("em", {}, `${ks[0].slice(0, 4)}–${ks[ks.length - 1].slice(0, 4)}`)]);
    grid.append(cell);
    spark(cell, sub, [
      { name: "Mine", color: css("me"), values: sub.map((m) => clip(ms[n][m]?.sent ?? null)) },
      { name: "Theirs", color: css("them"), values: sub.map((m) => clip(ms[n][m]?.received ?? null)) },
    ], { min: -0.2, max: 0.5, zero: true, dec: 3, h: 60 });
  });
}

// =================== 7. method ===================
$("meth").innerHTML = `<ul>
<li><b>Source.</b> A read-only copy of the Messages database (chat.db) and Contacts on this Mac. ${fmt(M.total_rows)} rows in total; ${fmt(M.non_tapback_messages)} are messages and ${fmt(M.tapbacks)} are tapbacks/reactions. Reactions are counted separately and left out of every other stat.</li>
<li><b>Text recovery.</b> Newer messages keep their text in a binary "attributedBody" field. ${fmt(M.attributedBody_decoded)} of ${fmt(M.attributedBody_needed)} were decoded (${pct(M.attributedBody_decode_rate, 1)}).</li>
<li><b>People.</b> Phone numbers are matched to Contacts on their last 10 digits, and emails exactly. Names are shown as first name + last initial. Unmatched numbers show as "Unknown" + last 4 digits. ${pct(M.unresolved_handle_share_of_messages, 1)} of messages and ${pct(M.unresolved_share_of_1to1_contacts)} of distinct 1:1 numbers are unmatched; most are one-off numbers such as verification codes, shops and carriers. People rankings count 1:1 threads only.</li>
<li><b>Conversations.</b> A new conversation starts after a gap of 6 hours or more. Whoever sends first after the gap "started" it.</li>
<li><b>Reply times.</b> In 1:1 threads, the time from one person's message to the other person's next message. Only replies within 24 hours count. Medians and 75th percentiles are shown.</li>
<li><b>Sentiment.</b> VADER compound score (−1 to +1) on each text message: ≥ 0.05 is positive, ≤ −0.05 negative, the rest neutral. VADER is tuned for English social text; sarcasm, inside jokes, other languages and emoji-only messages score poorly. Treat it as a trend, not a verdict on any one message.</li>
<li><b>Language.</b> Only my sent messages. Words and phrases appear only if used at least 20 times. Stopwords and link fragments (https, com, www) are removed. Distinctive words come from TF-IDF across years.</li>
<li><b>Gaps.</b> ${bigGaps.length ? bigGaps.map((g) => g[2]).join("; ") + ". " : ""}The shaded band means the database has no messages for those months (for example a phone change or messages not synced). It doesn't mean nobody texted.</li>
<li><b>Other.</b> ${fmt(M.messages_without_chat)} messages have no chat attached. A message that belongs to two chats can be counted twice.</li>
</ul>`;
if (DET) {
/*EXTRA*/
$("meth").insertAdjacentHTML("beforeend", `<ul>
<li><b>Texts per day.</b> Total messages divided by calendar days. The ${DET.per_day.days_excluded} days in months with no data (${DET.meta.gap_months.join(", ")}) are left out of every average. Month-of-year averages are the mean of each year's per-day average for that month.</li>
<li><b>Words by person.</b> Stopwords removed. "Distinctive" uses log-odds with an informative Dirichlet prior (Monroe et al. 2008): this chat (or year) against all my other texts. Only words with z &gt; 1.96 and at least 5 uses are shown.</li>
<li><b>Pronouns.</b> First person: i, me, my, mine, myself, im/i'm, ive/i've, ill/i'll, id/i'd. Second person: you, your, yours, yourself, youre/you're, ya, ur, and "u" only as a standalone word. We: we, us, our, ours, we're. Rates are per 100 words.</li>
<li><b>Streaks.</b> Consecutive calendar days with at least one message either way ("active") or from both sides ("both texted"). A streak counts as current if it reaches the last day in the data or the day before.</li>
<li><b>Closeness.</b> Each of the ${DET.closeness_components.length} signals (${DET.closeness_components.map((c) => c.label.toLowerCase()).join(", ")}) is percentile-ranked among the top 20 people, then averaged × 100. Reply speed and reply consistency are inverted so that faster and steadier rank higher. LSM is Ireland &amp; Pennebaker's language style matching over 9 function-word groups. Depth vs logistics uses keyword lists. The positive:negative ratio counts messages with VADER above 0.3 against those below −0.3 (Gottman's ~5:1 benchmark). Turning points are months where volume, sentiment or reply time moved more than 2.5 standard deviations from the previous 3 months.</li>
<li><b>Conflict candidates.</b> A conversation (6-hour gap rule) is flagged if some 60-minute window has at least 2 messages from each side scoring below −0.3 with a negative mean tone, or if both sides use at least 2 conflict/apology words and the overall tone is below +0.05. These are rule-based candidates, not confirmed fights.</li>
<li><b>Message browser.</b> Full text loads from out/threads/*.js on this Mac. Nothing is uploaded, but this folder now holds your raw messages, so treat it as private.</li>
</ul>`);
}
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
