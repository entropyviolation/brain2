#!/usr/bin/env python3
"""Call history -> out/calls.json for the report's Calls section.

Reads a COPY of ~/Library/Application Support/CallHistoryDB/CallHistory.storedata
(read-only). That file holds the iPhone's calls when the Mac syncs them through
Continuity: who, when, how long, in or out, missed. There are no recordings.

  .venv/bin/python calls.py --home ~/texts-analysis [--fresh]

--fresh always takes a new copy; otherwise it copies only when data/calls/ is
empty. Names come from the Contacts copy that analyze.py makes. Writes
{"available": false, ...} when the Mac has no call history, so the report can
say so instead of failing.
"""
import json
import shutil
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

import analyze as A
from texts_home import HOME as ROOT

SRC = Path.home() / "Library/Application Support/CallHistoryDB/CallHistory.storedata"
DATA = ROOT / "data" / "calls"
OUT = ROOT / "out"
SERVICES = {1: "Phone", 8: "FaceTime video", 16: "FaceTime audio"}


def copy_calls():
    DATA.mkdir(parents=True, exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        src = Path(str(SRC) + suffix)
        if src.exists():
            shutil.copy2(src, DATA / src.name)


def text(v):
    if v is None:
        return ""
    if isinstance(v, bytes):
        v = v.decode("utf-8", errors="replace").rstrip("\0")
    return str(v).strip()


def extract():
    con = A.open_ro(DATA / SRC.name)
    cols = {r[1] for r in con.execute("PRAGMA table_info(ZCALLRECORD)")}
    want = ["ZDATE", "ZDURATION", "ZORIGINATED", "ZANSWERED", "ZADDRESS", "ZNAME", "ZCALLTYPE"]
    rows = con.execute(f"SELECT {', '.join(c if c in cols else 'NULL' for c in want)} FROM ZCALLRECORD WHERE ZDATE IS NOT NULL").fetchall()
    con.close()
    df = pd.DataFrame(rows, columns=want)
    df["ts"] = pd.to_datetime(df["ZDATE"].astype(float) + A.APPLE_EPOCH, unit="s", utc=True).dt.tz_convert(A._local_tz()).dt.tz_localize(None)
    df["dur"] = df["ZDURATION"].fillna(0).astype(float).clip(lower=0)
    df["out"] = df["ZORIGINATED"] == 1
    # Outgoing calls often keep ZANSWERED at 0 even when they connected, so any duration counts.
    df["answered"] = (df["ZANSWERED"] == 1) | (df["dur"] > 0)
    df["missed"] = ~df["out"] & ~df["answered"]
    df["service"] = df["ZCALLTYPE"].map(lambda t: SERVICES.get(int(t), "Other app") if pd.notna(t) else "Phone")
    df["handle"] = df["ZADDRESS"].map(text)
    df["cname"] = df["ZNAME"].map(text)
    return df.sort_values("ts").reset_index(drop=True)


def main():
    OUT.mkdir(exist_ok=True)
    if "--fresh" in sys.argv or not (DATA / SRC.name).exists():
        try:
            copy_calls()
        except PermissionError as e:
            print(f"calls: no access to call history ({e}). Give Full Disk Access.", file=sys.stderr)
    if not (DATA / SRC.name).exists():
        (OUT / "calls.json").write_text(json.dumps({"available": False, "reason": "No call history on this Mac, or no Full Disk Access."}))
        print("calls: no call history found")
        return
    try:
        df = extract()
    except sqlite3.Error as e:
        (OUT / "calls.json").write_text(json.dumps({"available": False, "reason": f"Could not read call history: {e}"}))
        print(f"calls: {e}", file=sys.stderr)
        return
    if df.empty:
        (OUT / "calls.json").write_text(json.dumps({"available": False, "reason": "The call history is empty."}))
        return

    lookup, labels = A.load_contacts()
    df["peer"] = df["handle"].map(lambda h: A.resolve_handle(h, lookup) if h else None)
    df["peer"] = df["peer"].fillna("unk:?")
    raw = df.groupby("peer")["handle"].first().to_dict()
    names = A.label_people(df["peer"].unique().tolist(), labels, raw)
    # A contact name the call log saved beats "Unknown 1234".
    for k, n in df[df["cname"] != ""].groupby("peer")["cname"].first().items():
        if names[k].startswith("Unknown"):
            names[k] = n.split()[0] + (f" {n.split()[-1][0]}." if len(n.split()) > 1 else "")
    seen = Counter()
    for k in names:
        seen[names[k]] += 1
        if seen[names[k]] > 1:
            names[k] = f"{names[k]} ({seen[names[k]]})"
    df["name"] = df["peer"].map(names)
    df["ym"] = df["ts"].dt.strftime("%Y-%m")
    mins = lambda s: round(float(s.sum()) / 60, 1)

    per_month = {}
    for m, g in df.groupby("ym"):
        per_month[m] = {"out": int(g["out"].sum()), "in": int((~g["out"] & ~g["missed"]).sum()), "missed": int(g["missed"].sum()), "minutes": mins(g["dur"])}

    people = []
    for k, g in df.groupby("peer"):
        people.append({"name": names[k], "calls": len(g), "out": int(g["out"].sum()), "in": int((~g["out"]).sum()), "missed": int(g["missed"].sum()),
                       "minutes": mins(g["dur"]), "longest": round(float(g["dur"].max()) / 60, 1), "last": g["ts"].max().strftime("%Y-%m-%d")})
    people.sort(key=lambda r: (-r["minutes"], -r["calls"]))

    heat = [[0] * 24 for _ in range(7)]
    for d, h in zip(df["ts"].dt.day_of_week, df["ts"].dt.hour):
        heat[d][h] += 1

    longest = df.nlargest(10, "dur")
    recent_days = defaultdict(lambda: {"calls": 0, "minutes": 0.0})
    for _, r in df[df["ts"] >= df["ts"].max() - pd.Timedelta(days=120)].iterrows():
        d = recent_days[r["ts"].strftime("%Y-%m-%d")]
        d["calls"] += 1; d["minutes"] = round(d["minutes"] + r["dur"] / 60, 1)

    out = {
        "available": True,
        "meta": {"calls": len(df), "answered": int(df["answered"].sum()), "missed": int(df["missed"].sum()), "outgoing": int(df["out"].sum()),
                 "hours": round(float(df["dur"].sum()) / 3600, 1), "first": df["ts"].min().isoformat(), "last": df["ts"].max().isoformat(),
                 "people": int(df["peer"].nunique())},
        "per_month": per_month,
        "people_top25": people[:25],
        "heatmap_weekday_hour": heat,
        "by_service": dict(Counter(df["service"])),
        "longest10": [{"date": r["ts"].strftime("%Y-%m-%d"), "name": r["name"], "minutes": round(r["dur"] / 60, 1), "out": bool(r["out"])} for _, r in longest.iterrows()],
        "recent_days": dict(sorted(recent_days.items())),
        # Every call, for the per-person calls + texts timeline: [epoch, person key, outgoing, missed, minutes].
        # The key matches the person card's key in detail.json (same resolve_handle).
        "log": [[int(t.timestamp()), k, int(o), int(ms), round(float(d) / 60, 1)] for t, k, o, ms, d in zip(df["ts"], df["peer"], df["out"], df["missed"], df["dur"])],
    }
    (OUT / "calls.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"calls: {len(df)} calls, {out['meta']['hours']} h, {out['meta']['first'][:10]} to {out['meta']['last'][:10]}")


if __name__ == "__main__":
    main()
