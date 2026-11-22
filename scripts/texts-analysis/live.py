"""Live texts: counts for messages that arrived after the last full analysis.

serve.py calls poll() about once a minute. It reads ~/Library/Messages/chat.db
read-only, only rows past a ROWID cursor, and adds them to out/live.json:
totals, per month, per day and per person. The page merges that into the
report when it is served. Sentiment, topics, response times and the message
browser stay as of the last full run.

The base is summary.json's meta.max_mid. A full refresh writes a new base,
and the next poll starts over from it.
"""
import json
import os
import sqlite3
import time
from pathlib import Path

import analyze as A
from texts_home import HOME as ROOT

OUT = ROOT / "out"
LIVE = OUT / "live.json"
SRC = Path(os.environ.get("COGS_MESSAGES_DB") or Path.home() / "Library/Messages/chat.db")
CONTACTS_TTL = 3600


def empty(base):
    return {"base_mid": base, "cursor": base, "messages": 0, "sent": 0, "received": 0, "group": 0, "last": None,
            "updated": None, "per_month": {}, "per_day": {}, "people": {}, "people_monthly": {}}


def base_mid():
    try:
        mid = json.loads((OUT / "summary.json").read_text())["meta"].get("max_mid")
    except (OSError, ValueError, KeyError):
        return None
    if mid is None and (A.DATA / "chat.db").exists():  # summary from before max_mid existed
        con = A.open_ro(A.DATA / "chat.db")
        mid = con.execute("SELECT MAX(ROWID) FROM message").fetchone()[0]
        con.close()
    return mid


def load():
    base = base_mid()
    try:
        cur = json.loads(LIVE.read_text())
        if cur.get("base_mid") == base:
            return cur
    except (OSError, ValueError):
        pass
    return empty(base)


_contacts = {"at": 0, "lookup": {}, "labels": {}, "peers": {}}


def contacts():
    if time.time() - _contacts["at"] > CONTACTS_TTL:
        lookup, labels = A.load_contacts()
        try:
            peers = json.loads((OUT / "peers.json").read_text())
        except (OSError, ValueError):
            peers = {}
        _contacts.update(at=time.time(), lookup=lookup, labels=labels, peers=peers)
    return _contacts


def name_for(handle):
    c = contacts()
    key = A.resolve_handle(handle, c["lookup"])
    if key in c["peers"]:
        return c["peers"][key]
    if key and not key.startswith("unk:") and key in c["labels"]:
        return c["labels"][key]
    return A.unknown_label(handle or "")


def poll():
    """Add new texts to out/live.json. Returns the live state."""
    st = load()
    if st["base_mid"] is None:
        return st
    con = sqlite3.connect(f"file:{SRC}?mode=ro", uri=True)
    try:
        rows = con.execute("""
            SELECT m.ROWID, m.date, m.is_from_me, m.associated_message_type, h.id, cmj.chat_id
            FROM message m
            LEFT JOIN handle h ON h.ROWID = m.handle_id
            LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
            WHERE m.ROWID > ? ORDER BY m.ROWID""", (st["cursor"],)).fetchall()
        chats = {r[5] for r in rows if r[5] is not None}
        members = {}
        if chats:
            qs = ",".join("?" * len(chats))
            for cid, hid in con.execute(f"SELECT chj.chat_id, h.id FROM chat_handle_join chj JOIN handle h ON h.ROWID = chj.handle_id WHERE chj.chat_id IN ({qs})", tuple(chats)):
                members.setdefault(cid, []).append(hid)
    finally:
        con.close()
    if not rows:
        return st
    for mid, date, from_me, amt, sender, cid in rows:
        st["cursor"] = max(st["cursor"], mid)
        if amt:  # tapback
            continue
        secs = date / 1e9 if date and date > 1e11 else (date or 0)
        ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(secs + A.APPLE_EPOCH))
        day, month = ts[:10], ts[:7]
        group = len(members.get(cid, [])) > 1
        d = "sent" if from_me else "received"
        st["messages"] += 1; st[d] += 1; st["group"] += int(group)
        st["last"] = max(st["last"] or "", ts)
        pm = st["per_month"].setdefault(month, {})
        k = f"{d}_{'group' if group else '1:1'}"
        pm[k] = pm.get(k, 0) + 1
        st["per_day"][day] = st["per_day"].get(day, 0) + 1
        if not group:
            hs = members.get(cid) or [sender]
            name = name_for(hs[0] if len(hs) == 1 else sender)
            p = st["people"].setdefault(name, {"sent": 0, "received": 0})
            p[d] += 1
            pmn = st["people_monthly"].setdefault(name, {})
            pmn[month] = pmn.get(month, 0) + 1
    st["updated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    LIVE.write_text(json.dumps(st, ensure_ascii=False))
    return st
