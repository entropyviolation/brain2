"""On-demand AI jobs for serve.py: one conflict, or one relationship, at a time.

Uses the local Ollama model via llm_pass.ask. The user's own notes and labels go
into the prompt as context, clearly marked as Allie's notes.
"""
import json
from datetime import datetime
from pathlib import Path

import llm_pass as L

from texts_home import HOME

OUT = HOME / "out"
CONTEXT = 30


class Cancelled(Exception):
    pass


def _thread(eid):
    return L.load_thread(eid)


def _notes_block(ctx, lo_epoch=None, hi_epoch=None):
    out = []
    for n in ctx["notes"]:
        if n["body"]:
            span = f" ({n['period_start']} to {n['period_end']})" if n.get("period_start") else ""
            out.append(f"- [{n['scope']}{span}] {n['body']}")
    for a in ctx["annotations"]:
        if lo_epoch is not None and not (a["end_epoch"] and a["start_epoch"] and a["end_epoch"] >= lo_epoch and a["start_epoch"] <= hi_epoch):
            continue
        bits = []
        if a["is_conflict"]:
            bits.append("marked as conflict")
        if a["sentiment"] is not None:
            bits.append(f"sentiment {a['sentiment']:+d}")
        if a["ctype"]:
            bits.append(a["ctype"])
        tags = json.loads(a["tags"] or "[]") if isinstance(a["tags"], str) else a["tags"]
        if tags:
            bits.append("tags: " + ", ".join(tags))
        d = datetime.fromtimestamp(a["start_epoch"]).strftime("%Y-%m-%d") if a["start_epoch"] else "?"
        if bits or a["note"]:
            out.append(f"- [{d}] {'; '.join(bits)}{': ' if a['note'] and bits else ''}{a['note'] or ''}")
    return "\n".join(out) if out else "(none)"


CONFLICT_SCHEMA = L.CONFLICT_SCHEMA.replace('"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}',
    '"start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "what_helped": "...", "what_hurt": "...", '
    '"evidence": [{"date": "YYYY-MM-DD", "point": "paraphrase"}]}')


def analyze_conflict(eid, params, ctx, progress, fresh=False):
    t = _thread(eid)
    msgs = t["msgs"]
    idx = {m[4]: i for i, m in enumerate(msgs)}
    a, b = idx.get(params.get("start_mid")), idx.get(params.get("end_mid"))
    if a is None or b is None:
        raise ValueError("window not found in thread")
    a, b = min(a, b), max(a, b)
    lo, hi = max(0, a - CONTEXT), min(len(msgs) - 1, b + CONTEXT)
    lines = [L.fmt_line(m, t["name"]) for m in msgs[lo:hi + 1]]
    if len(lines) > 320:
        lines = lines[:120] + ["[… skipped …]"] + lines[-200:]
    notes = _notes_block(ctx, msgs[lo][0], msgs[hi][0])
    progress("reading the conversation")
    user = (f"Other person: {t['name']}\nReturn JSON: {CONFLICT_SCHEMA}\n\n"
            f"Allie's own notes and labels about this stretch (trust these as her perspective, but still judge from the messages):\n{notes}\n\n"
            f"The flagged window runs from {datetime.fromtimestamp(msgs[a][0]):%Y-%m-%d %H:%M} to {datetime.fromtimestamp(msgs[b][0]):%Y-%m-%d %H:%M}; "
            f"{CONTEXT} messages of context are included on each side.\n\nExcerpt:\n" + "\n".join(lines))
    r = L.ask(L.CONFLICT_SYS, user, 900, fresh=fresh)
    if r.get("error"):
        raise RuntimeError("model call failed")
    r.update({"ent": eid, "name": t["name"], "start_mid": msgs[a][4], "end_mid": msgs[b][4], "start_epoch": msgs[a][0], "end_epoch": msgs[b][0],
              "cid": params.get("cid"), "model": L.MODEL})
    return r


def analyze_relationship(eid, params, ctx, progress, fresh=False):
    det = json.loads((OUT / "detail.json").read_text())
    e = det["entities"][eid]
    t = _thread(eid)
    years = sorted({datetime.fromtimestamp(m[0]).year for m in t["msgs"]})
    yearly = {}
    for k, y in enumerate(years, 1):
        progress(f"year {y} ({k}/{len(years)})")
        idx = L.sample_year(t["msgs"], y)
        if len(idx) < 25:
            continue
        lines, prev = [], None
        for i in idx:
            if prev is not None and i != prev + 1:
                lines.append("…")
            lines.append(L.fmt_line(t["msgs"][i], t["name"])); prev = i
        yearly[y] = L.ask(L.YEAR_SYS, f"Other person: {t['name']}. Year: {y}.\nReturn JSON: {L.YEAR_SCHEMA}\n\nExcerpts:\n" + "\n".join(lines), 900, fresh=fresh)
    progress("writing the read")
    m = {k: e.get(k) for k in ("total", "first", "last", "initiation", "replies", "closeness", "arguing", "inflections", "streaks")}
    m["streaks"] = {k: v for k, v in (m["streaks"] or {}).items() if k != "calendar"}
    m["closeness_raw"] = {k: v for k, v in e.get("closeness_raw", {}).items() if not isinstance(v, (dict, list))}
    confirmed = [l for l in ctx["labels"] if l["label"] == "conflict"]
    analyzed = []
    for r in ctx["conflict_results"]:
        try:
            x = json.loads(r["result"])
            analyzed.append({k: x.get(k) for k in ("start", "title", "trigger", "ending", "severity", "hashed_out_over_text")})
        except Exception:
            pass
    user = (f"Person: {e['name']}\nReturn JSON: {L.FINAL_SCHEMA}\n\n"
            f"Allie's own notes about this relationship (her perspective; weigh them, don't just repeat them):\n{_notes_block(ctx)}\n\n"
            f"Conflicts Allie confirmed or marked: {len(confirmed)} (dates: {', '.join(sorted({datetime.fromtimestamp(l['start_epoch']).strftime('%Y-%m') for l in confirmed if l['start_epoch']}))})\n"
            f"Analyzed conflicts:\n{json.dumps(analyzed, ensure_ascii=False)}\n\n"
            f"Metrics (closeness = 0-100 rank among Allie's top 20):\n{json.dumps(m, ensure_ascii=False, default=str)}\n\n"
            f"Yearly summaries:\n{json.dumps(yearly, ensure_ascii=False)}")
    r = L.ask(L.FINAL_SYS, user, 1600, fresh=fresh)
    if r.get("error"):
        raise RuntimeError("model call failed")
    r.update({"ent": eid, "name": e["name"], "yearly": yearly, "model": L.MODEL})
    return r


MOOD_SYS = (f"You read a sample of one month of text messages between {L.ME} and another person and judge the emotional tone "
            "between them that month. " + L.GROUND)
MOOD_SCHEMA = '{"tone": "one to three words", "score": -2 to 2 (-2 hard, 0 neutral, 2 warm), "summary": "one sentence, paraphrased"}'


def sample_month(msgs, idxs, target=80, seed=11):
    """A few runs of consecutive messages spread across the month, so the model sees real exchanges."""
    if len(idxs) <= target:
        return idxs
    import random
    rnd, picked, n = random.Random(seed + idxs[0]), set(), target
    while n > 0:
        snip = min(12, n)
        st = rnd.randrange(0, len(idxs) - snip + 1)
        picked.update(idxs[st:st + snip]); n -= snip
    return sorted(picked)


def analyze_mood(eid, params, ctx, progress, fresh=False):
    t = _thread(eid)
    by_m = {}
    for i, m in enumerate(t["msgs"]):
        by_m.setdefault(datetime.fromtimestamp(m[0]).strftime("%Y-%m"), []).append(i)
    months = [k for k in sorted(by_m) if len(by_m[k]) >= 20][-int(params.get("months") or 24):]
    notes = _notes_block(ctx)
    out = []
    for k, mo in enumerate(months, 1):
        progress(f"month {mo} ({k}/{len(months)})")
        idx = sample_month(t["msgs"], by_m[mo])
        lines, prev = [], None
        for i in idx:
            if prev is not None and i != prev + 1:
                lines.append("…")
            lines.append(L.fmt_line(t["msgs"][i], t["name"])); prev = i
        r = L.ask(MOOD_SYS, f"Other person: {t['name']}. Month: {mo}. {len(by_m[mo])} messages that month.\n"
                  f"Allie's own notes (her perspective):\n{notes}\n\nReturn JSON: {MOOD_SCHEMA}\n\nExcerpts:\n" + "\n".join(lines), 300, fresh=fresh)
        if r.get("error"):
            raise RuntimeError("model call failed")
        try:
            score = max(-2.0, min(2.0, float(r.get("score"))))
        except (TypeError, ValueError):
            score = None
        out.append({"month": mo, "messages": len(by_m[mo]), "tone": str(r.get("tone") or "")[:40], "score": score, "summary": str(r.get("summary") or "")[:300]})
    return {"ent": eid, "name": t["name"], "months": out, "model": L.MODEL}

