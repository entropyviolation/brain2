#!/usr/bin/env python3
"""AI pass for the local texts report, run against a LOCAL model (Ollama on this Mac).

Nothing leaves the Mac: requests go to http://localhost:11434 only.
Results: out/llm.json (read by build_report.py). Resumable cache: out/llm_cache/.
Progress: out/llm_progress.log.

Run:
  .venv/bin/python llm_pass.py                 # you, conflicts, relationships (in that order)
  .venv/bin/python llm_pass.py you conflicts   # a subset
Then: .venv/bin/python build_report.py && open out/report.html
"""
import hashlib
import json
import random
import re
import sys
import threading
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from texts_home import HOME as ROOT
OUT = ROOT / "out"
CACHE = OUT / "llm_cache"
LOG = OUT / "llm_progress.log"
URL = "http://localhost:11434/api/chat"
MODEL = "qwen2.5:14b-instruct"
WORKERS = 2          # Ollama serves 2 parallel requests well on an M2 Max
NUM_CTX = 16384
ME = "Allie"
MAX_CONFLICT_WINDOWS = 100

# Redact contact details before they reach the model (it's local, but the outputs are saved).
RX = [
    (re.compile(r"https?://\S+|www\.\S+", re.I), "[link]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email]"),
    (re.compile(r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"), "[phone]"),
    (re.compile(r"\b\d{4,}\b"), "[number]"),
]


def redact(t):
    for rx, rep in RX:
        t = rx.sub(rep, t)
    return t


_lock = threading.Lock()
tally = {"calls": 0, "cached": 0, "in": 0, "out": 0, "seconds": 0.0, "failed": 0}


def log(msg):
    line = f"{datetime.now():%H:%M:%S} {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def ask(system, user, max_tokens=1200, fresh=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256(json.dumps([MODEL, system, user, max_tokens]).encode()).hexdigest()
    f = CACHE / f"{h}.json"
    if f.exists() and not fresh:
        with _lock:
            tally["cached"] += 1
        return json.loads(f.read_text())
    body = json.dumps({"model": MODEL, "stream": False, "format": "json",
                       "options": {"temperature": 0.6 if fresh else 0.3, "num_ctx": NUM_CTX, "num_predict": max_tokens},
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}).encode()
    for attempt in range(5):
        try:
            t0 = time.time()
            req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=900) as r:
                res = json.loads(r.read())
            out = json.loads(res["message"]["content"])
            with _lock:
                tally["calls"] += 1
                tally["in"] += res.get("prompt_eval_count", 0)
                tally["out"] += res.get("eval_count", 0)
                tally["seconds"] += time.time() - t0
            f.write_text(json.dumps(out, ensure_ascii=False))
            return out
        except json.JSONDecodeError:
            continue
        except Exception as e:
            time.sleep(2 ** attempt)
            log(f"  retry {attempt + 1}: {type(e).__name__}")
    with _lock:
        tally["failed"] += 1
    return {"error": "failed"}


def pmap(fn, items, label):
    done = [0]
    def wrap(x):
        r = fn(x)
        with _lock:
            done[0] += 1
            if done[0] % 5 == 0 or done[0] == len(items):
                log(f"{label}: {done[0]}/{len(items)} (calls {tally['calls']}, cached {tally['cached']}, failed {tally['failed']})")
        return r
    with ThreadPoolExecutor(WORKERS) as ex:
        return list(ex.map(wrap, items))


def load_thread(eid):
    raw = (OUT / "threads" / f"{eid}.js").read_text()
    return json.loads(raw[raw.index("(") + 1: raw.rindex(")")])


def fmt_line(m, other):
    ts, me, who, text, mid = m
    return f"[{datetime.fromtimestamp(ts):%Y-%m-%d %H:%M}] {ME if me else (who or other)}: {redact(text or '[attachment]')[:400]}"


GROUND = ("Be honest, warm and balanced. Use only what is in the material provided; never invent events, feelings or facts. "
          "Support claims with dates (YYYY-MM-DD or YYYY-MM). If something is a guess, say 'guess:' explicitly. "
          "Paraphrase; never quote more than a few words. Reply with a single JSON object only.")

# ---------- D) You ----------
MONTH_SYS = f"You read a sample of the text messages {ME} sent in one month (to many people) and summarize her life that month. " + GROUND
MONTH_SCHEMA = '{"summary": "3-5 sentences", "life_events": [{"date": "YYYY-MM-DD", "point": "..."}], "moods": "...", "people": ["name: why they matter this month"], "interests": ["..."], "worries": ["..."]}'
YEARC_SYS = f"You write one chapter of {ME}'s life from monthly summaries of her texts. Write to her in second person ('you'). " + GROUND
YEARC_SCHEMA = '{"title": "chapter title", "chapter": "2-3 paragraphs", "key_people": ["..."], "turning_points": [{"date": "YYYY-MM", "point": "..."}], "mood_arc": "..."}'
YOU_SYS = (f"You write a candid, kind, evidence-based portrait of {ME} from yearly chapters of her texts, relationship summaries and metrics. "
           "Write to her in second person. Balanced means real praise and real critique. " + GROUND)
YOU_SCHEMA = ('{"life_story": [{"chapter": "title", "years": "2018-2019", "text": "a paragraph"}], "values": [{"value": "...", "evidence": "dated"}], '
              '"as_a_friend_and_partner": {"verdict": "balanced assessment", "strengths": ["dated evidence"], "watch_outs": ["dated evidence"]}, '
              '"could_do_better": ["specific, kind, actionable"], "who_youre_like": [{"name": "fictional character or real person", "kind": "fictional|real", "why": "..."}], '
              '"greatest_strengths": ["..."], "greatest_weaknesses": ["..."], "likes": ["..."], "dislikes": ["..."], "caveats": "what this read cannot know"}')


def task_you(det, reads):
    names = {eid: e["name"] for eid, e in det["entities"].items()}
    mine = defaultdict(list)
    for eid in names:
        for m in load_thread(eid)["msgs"]:
            if m[1] and m[3]:
                mine[datetime.fromtimestamp(m[0]).strftime("%Y-%m")].append((m[0], names[eid], m[3]))
    jobs = []
    for mo, lst in sorted(mine.items()):
        lst.sort()
        rnd = random.Random(int(mo.replace("-", "")))
        pick = sorted(rnd.sample(lst, 200)) if len(lst) > 200 else lst
        jobs.append((mo, "\n".join(f"[{datetime.fromtimestamp(ts):%Y-%m-%d}] to {to}: {redact(tx)[:300]}" for ts, to, tx in pick)))
    log(f"you: {len(jobs)} months")
    months = dict(pmap(lambda j: (j[0], ask(MONTH_SYS, f"Month: {j[0]}\nReturn JSON: {MONTH_SCHEMA}\n\nMessages Allie sent:\n{j[1]}", 700)), jobs, "you/months"))
    by_year = defaultdict(dict)
    for mo, r in months.items():
        by_year[mo[:4]][mo] = r
    chapters = dict(pmap(lambda y: (y, ask(YEARC_SYS, f"Year: {y}\nReturn JSON: {YEARC_SCHEMA}\n\nMonthly summaries:\n{json.dumps(by_year[y], ensure_ascii=False)}", 1400)), sorted(by_year), "you/chapters"))
    rel = {names.get(eid, eid): {k: r.get(k) for k in ("headline", "how_you_show_up")} for eid, r in (reads or {}).items()}
    top = [{"name": det["entities"][i]["name"], "messages": det["entities"][i]["total"], "closeness": det["entities"][i]["closeness"]["score"]} for i in det["closeness_people"][:20]]
    metrics = {"texts_per_day": det["per_day"]["yearly"], "pronouns": det["pronouns_overall"], "markers": det["markers_me_overall"], "top_people": top}
    portrait = ask(YOU_SYS, f"Return JSON: {YOU_SCHEMA}\n\nYearly chapters:\n{json.dumps(chapters, ensure_ascii=False)}\n\nRelationship summaries:\n{json.dumps(rel, ensure_ascii=False)}\n\nMetrics:\n{json.dumps(metrics, ensure_ascii=False)}", 3500)
    log("you: portrait done")
    return {"months": months, "chapters": chapters, "portrait": portrait}


# ---------- A) conflicts ----------
CONFLICT_SYS = (f"You read a text-message excerpt between {ME} and another person and judge whether a real conflict happened "
                "(an argument, a hurt, a disagreement with tension), as opposed to venting together, banter or bad news about something else. " + GROUND)
CONFLICT_SCHEMA = ('{"is_conflict": true/false, "confidence": 0-1, "title": "short neutral title", "trigger": "what set it off", '
                   '"allie_side": "Allie\'s position and feelings, fairly stated", "their_side": "the other person\'s position and feelings, fairly stated", '
                   '"ending": "resolved|unresolved|moved offline|unclear", "hashed_out_over_text": true/false, "severity": 1-5, '
                   '"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}')


def task_conflicts():
    cand = json.loads((OUT / "conflict_candidates.json").read_text())["candidates"]
    score = lambda c: c["strength"] * 10 + c["neg_me"] + c["neg_them"] + c["conflict_words_me"] + c["conflict_words_them"]
    by_ent = defaultdict(list)
    for c in cand:
        by_ent[c["ent"]].append(c)
    jobs = []
    for eid, cs in by_ent.items():
        t = load_thread(eid)
        idx = {m[4]: i for i, m in enumerate(t["msgs"])}
        spans = sorted((min(idx[m] for m in c["message_ids"] if m in idx), max(idx[m] for m in c["message_ids"] if m in idx), c["cid"], score(c))
                       for c in cs if any(m in idx for m in c["message_ids"]))
        merged = []
        for a, b, cid, sc in spans:
            a, b = max(0, a - 15), min(len(t["msgs"]) - 1, b + 15)
            if merged and a <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], b); merged[-1][2].append(cid); merged[-1][3] += sc
            else:
                merged.append([a, b, [cid], sc])
        for a, b, cids, sc in merged:
            lines = [fmt_line(m, t["name"]) for m in t["msgs"][a:b + 1]]
            if len(lines) > 220:
                lines = lines[:80] + ["[… skipped …]"] + lines[-140:]
            jobs.append((sc, eid, t["name"], cids, t["msgs"][a][0], "\n".join(lines)))
    jobs.sort(key=lambda j: -j[0])
    total = len(jobs)
    jobs = jobs[:MAX_CONFLICT_WINDOWS]
    log(f"conflicts: {len(cand)} candidates -> {total} windows; checking the strongest {len(jobs)}")

    def run(j):
        sc, eid, name, cids, epoch, text = j
        r = ask(CONFLICT_SYS, f"Other person: {name}\nReturn JSON: {CONFLICT_SCHEMA}\n\nExcerpt:\n{text}", 600)
        return {**r, "ent": eid, "name": name, "candidate_ids": cids, "start_epoch": epoch}
    found = pmap(run, jobs, "conflicts")
    confirmed = [c for c in found if c.get("is_conflict") is True and float(c.get("confidence", 0) or 0) >= 0.5]
    final = []
    for eid in sorted({c["ent"] for c in confirmed}):
        cs = sorted([c for c in confirmed if c["ent"] == eid], key=lambda c: str(c.get("start", "")))
        groups = [[i] for i in range(len(cs))]
        if len(cs) > 1:
            brief = [{"i": i, "start": c.get("start"), "title": c.get("title"), "trigger": c.get("trigger")} for i, c in enumerate(cs)]
            g = ask("You group conflict summaries that are the same ongoing fight (same issue, close in time). " + GROUND,
                    'Return JSON {"groups": [[indices], ...]} using every index exactly once.\n' + json.dumps(brief, ensure_ascii=False), 600)
            gg = g.get("groups")
            if isinstance(gg, list) and sorted(i for grp in gg for i in grp if isinstance(i, int)) == list(range(len(cs))):
                groups = gg
        for grp in groups:
            parts = [cs[i] for i in grp]
            main = max(parts, key=lambda c: int(c.get("severity", 0) or 0))
            final.append({**main, "start": min(str(p.get("start", "")) for p in parts), "end": max(str(p.get("end", "")) for p in parts),
                          "start_epoch": min(p["start_epoch"] for p in parts),
                          "episodes": [{"start": p.get("start"), "title": p.get("title"), "start_epoch": p["start_epoch"]} for p in parts]})
    log(f"conflicts: {len(confirmed)} confirmed windows -> {len(final)} conflicts")
    return {"windows_total": total, "windows_checked": len(jobs), "confirmed_windows": len(confirmed), "conflicts": final}


# ---------- B + C) relationships ----------
YEAR_SYS = f"You summarize one year of a text-message relationship between {ME} and another person, from sampled excerpts. " + GROUND
YEAR_SCHEMA = ('{"summary": "3-5 sentences", "themes": ["recurring topics"], "discussed_a_lot": ["..."], "seemed_avoided": ["guess: ..."], '
               '"share_estimate": {"logistics": 0-1, "deep_sharing": 0-1, "banter_other": 0-1}, "emotional_work": "who supports, who asks, who carries it", '
               '"bids_and_responses": "...", "conflict_style": "...", "notable_moments": [{"date": "YYYY-MM-DD", "point": "..."}]}')
FINAL_SYS = f"You write a relationship read of {ME} and one person from yearly summaries of their texts plus computed metrics. Write to Allie in second person. " + GROUND
FINAL_SCHEMA = ('{"headline": "one sentence", "closeness_and_trajectory": "...", "dynamics_and_emotional_work": "...", "depth_vs_logistics": "...", '
                '"topics_discussed": ["..."], "topics_avoided": ["guess: ..."], "conflict_style": "...", "bids_and_responsiveness": "...", '
                '"how_you_show_up": "strengths and blind spots", "evidence": [{"date": "YYYY-MM", "point": "..."}]}')


def sample_year(msgs, year, target=150, seed=7):
    rnd = random.Random(seed + year)
    ys = [i for i, m in enumerate(msgs) if datetime.fromtimestamp(m[0]).year == year]
    if len(ys) <= target:
        return ys
    by_m, by_d = defaultdict(list), defaultdict(list)
    for i in ys:
        d = datetime.fromtimestamp(msgs[i][0])
        by_m[d.month].append(i); by_d[d.date()].append(i)
    picked = set(max(by_d.values(), key=len)[:30])
    per_m = max(10, (target - len(picked)) // len(by_m))
    for idxs in by_m.values():
        n = min(per_m, len(idxs))
        while n > 0:
            snip = min(15, n)
            st = rnd.randrange(0, max(1, len(idxs) - snip + 1))
            picked.update(idxs[st:st + snip]); n -= snip
    return sorted(picked)


def task_relationships(det, conflicts):
    ids = det["closeness_people"][:20]
    jobs = []
    for eid in ids:
        t = load_thread(eid)
        for y in sorted({datetime.fromtimestamp(m[0]).year for m in t["msgs"]}):
            idx = sample_year(t["msgs"], y)
            if len(idx) < 25:
                continue
            lines, prev = [], None
            for i in idx:
                if prev is not None and i != prev + 1:
                    lines.append("…")
                lines.append(fmt_line(t["msgs"][i], t["name"])); prev = i
            jobs.append((eid, t["name"], y, "\n".join(lines)))
    log(f"relationships: {len(ids)} people, {len(jobs)} person-years")
    yearly = pmap(lambda j: (j[0], j[2], ask(YEAR_SYS, f"Other person: {j[1]}. Year: {j[2]}.\nReturn JSON: {YEAR_SCHEMA}\n\nExcerpts:\n{j[3]}", 900)), jobs, "relationships/years")
    per = defaultdict(dict)
    for eid, y, r in yearly:
        per[eid][y] = r

    def final(eid):
        e = det["entities"][eid]
        m = {k: e.get(k) for k in ("total", "first", "last", "initiation", "replies", "closeness", "arguing", "inflections")}
        m["closeness_raw"] = {k: v for k, v in e["closeness_raw"].items() if not isinstance(v, (dict, list))}
        cf = [{k: c.get(k) for k in ("start", "title", "trigger", "ending", "severity")} for c in conflicts if c["ent"] == eid]
        return eid, ask(FINAL_SYS, f"Person: {e['name']}\nReturn JSON: {FINAL_SCHEMA}\n\nMetrics (closeness = 0-100 rank among Allie's top 20):\n{json.dumps(m, ensure_ascii=False)}\n\nConflicts:\n{json.dumps(cf, ensure_ascii=False)}\n\nYearly summaries:\n{json.dumps(per[eid], ensure_ascii=False)}", 1500)
    reads = dict(pmap(final, ids, "relationships/reads"))
    return {"reads": reads, "yearly": dict(per)}


def save(res):
    res["meta"] = {"model": MODEL, "run": datetime.now().isoformat(timespec="seconds"), "tally": tally}
    (OUT / "llm.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))


def main():
    tasks = sys.argv[1:] or ["you", "conflicts", "relationships"]
    det = json.loads((OUT / "detail.json").read_text())
    path = OUT / "llm.json"
    res = json.loads(path.read_text()) if path.exists() else {}
    log(f"start: {tasks} with {MODEL}")
    for t in tasks:
        if t == "you":
            res["you"] = task_you(det, res.get("relationships", {}).get("reads"))
        elif t == "conflicts":
            res["conflicts"] = task_conflicts()
        elif t == "relationships":
            res["relationships"] = task_relationships(det, res.get("conflicts", {}).get("conflicts", []))
        save(res)
        log(f"saved after {t}")
    # Re-run the portrait now that relationship reads exist (months/chapters come from cache).
    if "you" in tasks and "relationships" in tasks:
        res["you"] = task_you(det, res["relationships"]["reads"])
        save(res)
    log(f"done: {tally['calls']} calls, {tally['in']:,} in / {tally['out']:,} out tokens, {tally['seconds'] / 60:.0f} model-minutes, {tally['failed']} failed")


if __name__ == "__main__":
    main()
