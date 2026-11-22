#!/usr/bin/env python3
"""Add each person card's numbers to an existing report, without a full rebuild.

  ~/texts-analysis/.venv/bin/python backfill_handles.py --home ~/texts-analysis

Reports built before cards kept numbers can't link to Brain2 people. This reads
the copy already in data/ (no Full Disk Access needed), ranks people exactly as
analyze2.py does, writes `handles` and `key` onto the person cards in
out/detail.json, and rebuilds report.html. Takes seconds. Nothing else changes.
"""
import json
import subprocess
import sys

from texts_home import CODE, HOME as ROOT
import analyze2 as A2

OUT = ROOT / "out"


def main():
    det_path = OUT / "detail.json"
    if not det_path.exists():
        sys.exit("No out/detail.json yet. Run the full pipeline once first.")
    detail = json.loads(det_path.read_text())
    msgs, _chats, _members, labels, raw_for_key = A2.load()
    oo = msgs[~msgs["is_group"] & msgs["peer"].notna()]
    counts = oo.groupby("peer").size().sort_values(ascending=False)
    names = A2.A.label_people(list(counts.index), labels, raw_for_key)
    filled = skipped = 0
    for i, key in enumerate(counts.index[:A2.N_PEOPLE], 1):
        e = detail["entities"].get(f"p{i:02d}")
        if not e:
            continue
        # The same rank must still be the same person; otherwise leave the card alone.
        if e.get("name") != names[key]:
            skipped += 1
            continue
        g = oo[oo["peer"] == key]
        e["handles"] = sorted({h for h in g["peer_raw"].dropna().unique() if isinstance(h, str)})
        e["key"] = key
        filled += 1
    detail.setdefault("overrides", A2.A.load_overrides())
    det_path.write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":"), default=str))
    print(f"numbers added to {filled} cards ({skipped} skipped: rank changed since the last full run)")
    subprocess.run([sys.executable, str(CODE / "build_report.py")], check=True)


if __name__ == "__main__":
    main()
