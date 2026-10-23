#!/usr/bin/env python3
"""Aggregate-only analysis of the iMessage/SMS history.

Reads a COPY of ~/Library/Messages/chat.db (read-only) and writes
out/summary.json. No individual message text is written anywhere.
Words and n-grams appear only when their count is >= 20.

Usage:
  python3 -m venv .venv && .venv/bin/pip install pandas vaderSentiment scikit-learn emoji
  .venv/bin/python analyze.py            # copies chat.db into data/, then analyzes
  .venv/bin/python analyze.py --no-copy  # reuse the existing copy in data/
"""
import glob
import json
import os
import re
import shutil
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

import emoji
import pandas as pd
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, CountVectorizer, TfidfTransformer
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

HOME = Path.home()
from texts_home import HOME as ROOT
DATA = ROOT / "data"
OUT = ROOT / "out"
SRC_DB = HOME / "Library/Messages/chat.db"
AB_GLOB = str(HOME / "Library/Application Support/AddressBook/Sources/*/AddressBook-v22.abcddb")
APPLE_EPOCH = 978307200  # 2001-01-01 in unix seconds
MIN_COUNT = 20
GAP_NEW_CONVO = pd.Timedelta(hours=6)
MAX_REPLY = pd.Timedelta(hours=24)
STOP = set(ENGLISH_STOP_WORDS) | {"im", "dont", "thats", "its", "ill", "ive", "youre", "u", "ur", "yeah", "ok", "okay", "lol"}


# ---------- copy + open ----------

def copy_db():
    DATA.mkdir(exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        src = Path(str(SRC_DB) + suffix)
        if src.exists():
            shutil.copy2(src, DATA / src.name)
    for ab in glob.glob(AB_GLOB):
        dest = DATA / "addressbook" / Path(ab).parent.name
        dest.mkdir(parents=True, exist_ok=True)
        for suffix in ("", "-wal", "-shm"):
            if os.path.exists(ab + suffix):
                shutil.copy2(ab + suffix, dest / (Path(ab).name + suffix))


def open_ro(path):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


# ---------- attributedBody (typedstream) ----------

def decode_attributed_body(blob):
    """Pull the NSString payload out of a typedstream blob. Returns None on failure."""
    if not blob:
        return None
    try:
        i = blob.find(b"NSString")
        if i < 0:
            return None
        j = blob.find(b"\x01\x2b", i)  # type marker '+' after the class chain
        if j < 0:
            return None
        k = j + 2
        n = blob[k]
        if n == 0x81:
            length = int.from_bytes(blob[k + 1:k + 3], "little"); k += 3
        elif n == 0x82:
            length = int.from_bytes(blob[k + 1:k + 4], "little"); k += 4
        elif n == 0x83:
            length = int.from_bytes(blob[k + 1:k + 5], "little"); k += 5
        else:
            length = n; k += 1
        return blob[k:k + length].decode("utf-8", errors="replace")
    except Exception:
        return None


# ---------- your merges, names and Brain2 links ----------
# Saved from the report into out/annotations.sqlite (settings table, via serve.py
# POST /api/settings), so they survive every refresh:
#   people_links  [{id, name, handles}]  a Brain2 Person and every number saved on them
#   merges        {from_key: {to, name}}  a chat folded into another
#   names         {key: name}             a name you gave a card
ALIAS, NAMES = {}, {}


def load_overrides():
    db = OUT / "annotations.sqlite"
    if not db.exists():
        return {}
    try:
        con = open_ro(db)
        rows = con.execute("SELECT key, value FROM settings WHERE key IN ('people_links', 'merges', 'names')").fetchall()
        con.close()
    except sqlite3.Error:
        return {}
    out = {}
    for k, v in rows:
        try:
            out[k] = json.loads(v)
        except ValueError:
            pass
    return out


def alias(key):
    seen = set()
    while key in ALIAS and key not in seen:
        seen.add(key)
        key = ALIAS[key]
    return key


# ---------- contacts ----------

def norm_phone(s):
    d = re.sub(r"\D", "", s or "")
    return d[-10:] if len(d) >= 7 else None


def load_contacts():
    """Map normalized phone / lowercased email -> (person_key, display label)."""
    lookup, labels = {}, {}
    dbs = sorted(glob.glob(str(DATA / "addressbook/*/AddressBook-v22.abcddb")))
    for n, path in enumerate(dbs):
        try:
            con = open_ro(path)
            recs = {r[0]: r[1:] for r in con.execute(
                "SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION FROM ZABCDRECORD")}
            def label(pk):
                first, last, org = recs.get(pk, (None, None, None))
                # First name + last initial only; letters only, so emoji and nicknames in brackets drop out.
                words = re.findall(r"[^\W\d_][^\W\d_'-]*", f"{first or ''} {last or ''}")
                if not words:
                    words = re.findall(r"[^\W\d_]+", org or "")[:1]
                if not words:
                    return None
                lab = words[0][:1].upper() + words[0][1:]
                return lab + (f" {words[-1][0].upper()}." if len(words) > 1 else "")
            for owner, num in con.execute("SELECT ZOWNER, ZFULLNUMBER FROM ZABCDPHONENUMBER"):
                p, lab = norm_phone(num), label(owner)
                if p and lab:
                    key = f"ab{n}:{owner}"
                    lookup.setdefault(p, key); labels[key] = lab
            for owner, addr in con.execute("SELECT ZOWNER, ZADDRESS FROM ZABCDEMAILADDRESS"):
                lab = label(owner)
                if addr and lab:
                    key = f"ab{n}:{owner}"
                    lookup.setdefault(addr.strip().lower(), key); labels[key] = lab
            con.close()
        except sqlite3.Error as e:
            print(f"warn: address book {path}: {e}", file=sys.stderr)
    # Brain2 links win over Contacts: every number on one Person is one person here.
    ov = load_overrides()
    for p in ov.get("people_links") or []:
        if not isinstance(p, dict) or not p.get("id"):
            continue
        key = f"b2:{p['id']}"
        for h in p.get("handles") or []:
            k = h.strip().lower() if "@" in h else norm_phone(h)
            if k:
                lookup[k] = key
        labels[key] = p.get("name") or labels.get(key)
    ALIAS.clear()
    ALIAS.update({k: v.get("to") if isinstance(v, dict) else v for k, v in (ov.get("merges") or {}).items() if v})
    NAMES.clear()
    NAMES.update(ov.get("names") or {})
    return lookup, labels


def resolve_handle(hid, lookup):
    if not hid:
        return None
    key = hid.strip().lower() if "@" in hid else norm_phone(hid)
    if key and key in lookup:
        return alias(lookup[key])
    return alias("unk:" + hid)


# ---------- extraction ----------

def extract():
    con = open_ro(DATA / "chat.db")
    q = """
    SELECT m.ROWID AS mid, m.date, m.is_from_me, m.text, m.attributedBody,
           m.associated_message_type AS amt, m.service, h.id AS sender,
           cmj.chat_id
    FROM message m
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    """
    df = pd.read_sql_query(q, con)
    chats = pd.read_sql_query("SELECT ROWID AS chat_id, display_name, service_name FROM chat", con)
    chj = pd.read_sql_query(
        "SELECT chj.chat_id, h.id AS hid FROM chat_handle_join chj JOIN handle h ON h.ROWID = chj.handle_id", con)
    con.close()

    # Apple date: ns since 2001 on modern macOS, seconds on old rows.
    d = df["date"].astype("float64")
    secs = d.where(d < 1e11, d / 1e9)
    df["ts"] = pd.to_datetime(secs + APPLE_EPOCH, unit="s", utc=True).dt.tz_convert(_local_tz()).dt.tz_localize(None)

    # Text recovery.
    null_text = df["text"].isna() | (df["text"] == "")
    df["decoded"] = False
    rec = df.loc[null_text & df["attributedBody"].notna(), "attributedBody"].map(decode_attributed_body)
    df.loc[rec.index, "text"] = rec
    df.loc[rec.index, "decoded"] = rec.notna()
    df["body_needed"] = null_text & df["attributedBody"].notna()
    df["text"] = df["text"].fillna("").str.replace("￼", "", regex=False).str.strip()
    df = df.drop(columns=["attributedBody"])

    # Chat shape.
    members = chj.groupby("chat_id")["hid"].apply(list).to_dict()
    df["n_members"] = df["chat_id"].map(lambda c: len(members.get(c, [])) if pd.notna(c) else 0)
    df["is_group"] = df["n_members"] > 1
    df["is_tapback"] = df["amt"].fillna(0).astype(int) != 0
    df["service"] = df["service"].fillna("unknown")
    return df, chats, members


def _local_tz():
    import time
    from datetime import timezone, timedelta
    try:
        from zoneinfo import ZoneInfo
        tzname = os.path.realpath("/etc/localtime").split("zoneinfo/")[-1]
        return ZoneInfo(tzname)
    except Exception:
        return timezone(timedelta(seconds=-time.timezone))


# ---------- helpers ----------

def unknown_label(hid):
    digits = re.sub(r"\D", "", hid)
    tail = digits[-4:] if len(digits) >= 4 else re.sub(r"[^a-z0-9]", "", hid.split("@")[0].lower())[-4:]
    return f"Unknown {tail}"


def label_people(keys, labels, raw_for_key):
    out, seen = {}, Counter()
    for k in keys:
        lab = NAMES.get(k) or (labels.get(k) if not k.startswith("unk:") else unknown_label(k[4:]))
        lab = lab or unknown_label(raw_for_key.get(k, k))
        seen[lab] += 1
        out[k] = lab if seen[lab] == 1 else f"{lab} ({seen[lab]})"
    return out


def q(series, p):
    s = series.dropna()
    return None if s.empty else round(float(s.quantile(p)), 1)


def ym(ts):
    return ts.dt.strftime("%Y-%m")


WORD_RE = re.compile(r"[a-z][a-z']*")


def tokens(text):
    return [w.replace("'", "") for w in WORD_RE.findall(text.lower())]


# ---------- main ----------

def main():
    # --fresh (used by serve.py's refresh) always takes a new copy of chat.db and Contacts.
    if "--no-copy" not in sys.argv and ("--fresh" in sys.argv or not (DATA / "chat.db").exists()):
        copy_db()
    OUT.mkdir(exist_ok=True)
    df, chats, members = extract()
    lookup, labels = load_contacts()

    # Person for each message: 1:1 -> the chat's single handle; group -> sender.
    one_handle = {c: hs[0] for c, hs in members.items() if len(hs) == 1}
    df["peer_raw"] = df.apply(
        lambda r: one_handle.get(r["chat_id"]) if not r["is_group"] else r["sender"], axis=1)
    df.loc[df["peer_raw"].isna() & ~df["is_group"], "peer_raw"] = df["sender"]
    df["peer"] = df["peer_raw"].map(lambda h: resolve_handle(h, lookup) if isinstance(h, str) else None)
    raw_for_key = df.dropna(subset=["peer"]).groupby("peer")["peer_raw"].first().to_dict()

    total = len(df)
    tb = df[df["is_tapback"]]
    msgs = df[~df["is_tapback"]].copy()
    msgs["dir"] = msgs["is_from_me"].map({1: "sent", 0: "received"})
    has_text = msgs["text"].str.len() > 0
    texts = msgs[has_text]

    summary = {"meta": {}}

    # --- volume ---
    msgs["month"] = ym(msgs["ts"])
    msgs["kind"] = msgs["is_group"].map({True: "group", False: "1:1"})
    per_month = msgs.groupby(["month", "dir", "kind"]).size().unstack(["dir", "kind"], fill_value=0)
    per_month.columns = [f"{a}_{b}" for a, b in per_month.columns]
    daily = msgs.groupby(msgs["ts"].dt.date).size()
    hm = msgs.groupby(["dir", msgs["ts"].dt.day_of_week, msgs["ts"].dt.hour]).size()
    heat = {d: [[int(hm.get((d, wd, h), 0)) for h in range(24)] for wd in range(7)] for d in ("sent", "received")}
    summary["volume"] = {
        "per_month": {m: {k: int(v) for k, v in row.items()} for m, row in per_month.iterrows()},
        "per_day": {str(k): int(v) for k, v in daily.items()},
        "top10_busiest_days": [{"date": str(k), "count": int(v)} for k, v in daily.nlargest(10).items()],
        "heatmap_weekday_hour": {"rows": "Mon..Sun", "cols": "hour 0..23", **heat},
        "tapbacks_per_year": {int(k): int(v) for k, v in tb.groupby(tb["ts"].dt.year).size().items()},
        "by_service": {k: int(v) for k, v in msgs["service"].value_counts().items()},
    }

    # --- people (1:1 threads by person, so phone + email merge) ---
    oo = msgs[~msgs["is_group"] & msgs["peer"].notna()].sort_values("ts")
    counts = oo.groupby(["peer", "dir"]).size().unstack(fill_value=0)
    for c in ("sent", "received"):
        if c not in counts:
            counts[c] = 0
    counts["total"] = counts["sent"] + counts["received"]
    counts = counts.sort_values("total", ascending=False)
    top25 = list(counts.index[:25])
    names = label_people(list(counts.index), labels, raw_for_key)

    def row(k, r):
        return {"name": names[k], "total": int(r["total"]), "sent": int(r["sent"]), "received": int(r["received"])}

    per_year = {}
    for y, g in oo.groupby(oo["ts"].dt.year):
        c = g.groupby(["peer", "dir"]).size().unstack(fill_value=0)
        for col in ("sent", "received"):
            if col not in c:
                c[col] = 0
        c["total"] = c["sent"] + c["received"]
        per_year[int(y)] = [row(k, r) for k, r in c.sort_values("total", ascending=False).head(10).iterrows()]

    top15 = top25[:15]
    monthly = oo[oo["peer"].isin(top15)].groupby(["peer", "month"]).size()
    monthly_series = {names[k]: {m: int(v) for m, v in monthly[k].items()} for k in top15 if k in monthly.index.get_level_values(0)}

    # Initiation: a new conversation starts after a gap >= 6h.
    initiation = {}
    resp_rows = []
    for k, g in oo.groupby("peer"):
        gap = g["ts"].diff()
        starts = g[gap.isna() | (gap >= GAP_NEW_CONVO)]
        if k in top25:
            me = int(starts["is_from_me"].sum())
            initiation[names[k]] = {"conversations": int(len(starts)), "me": me, "them": int(len(starts) - me),
                                    "me_share": round(me / max(len(starts), 1), 3)}
        flip = g["is_from_me"].ne(g["is_from_me"].shift()) & gap.notna() & (gap < MAX_REPLY)
        r = g[flip]
        resp_rows.append(pd.DataFrame({"peer": k, "year": r["ts"].dt.year,
                                       "who": r["is_from_me"].map({1: "me_to_them", 0: "them_to_me"}),
                                       "minutes": gap[flip].dt.total_seconds() / 60}))
    resp = pd.concat(resp_rows) if resp_rows else pd.DataFrame(columns=["peer", "year", "who", "minutes"])

    groups = msgs[msgs["is_group"]].groupby("chat_id").size().sort_values(ascending=False).head(10)
    disp = chats.set_index("chat_id")["display_name"].to_dict()
    top_groups = []
    for i, (cid, n) in enumerate(groups.items(), 1):
        dn = disp.get(int(cid)); name = dn.strip() if isinstance(dn, str) and dn.strip() else f"Group {i}"
        top_groups.append({"name": name, "messages": int(n), "members": int(len(members.get(cid, [])))})

    summary["people"] = {
        "top25_overall": [row(k, counts.loc[k]) for k in top25],
        "top10_per_year": per_year,
        "monthly_series_top15": monthly_series,
        "initiation_top25": initiation,
        "top10_group_chats": top_groups,
        "distinct_1to1_contacts": int(len(counts)),
    }

    # --- response times (minutes, replies within 24h, 1:1 only) ---
    def rt(g):
        return {w: {"median_min": q(s["minutes"], .5), "p75_min": q(s["minutes"], .75), "n": int(len(s))}
                for w, s in g.groupby("who")}
    summary["response_times"] = {
        "overall": rt(resp),
        "per_year": {int(y): rt(g) for y, g in resp.groupby("year")},
        "per_contact_top25": {names[k]: rt(resp[resp["peer"] == k]) for k in top25},
    }

    # --- language (my messages) ---
    mine = texts[texts["is_from_me"] == 1]
    word_c, emo_c, bi_c, tri_c = Counter(), Counter(), Counter(), Counter()
    year_docs = defaultdict(list)
    for t, y in zip(mine["text"], mine["ts"].dt.year):
        toks = tokens(t)
        content = [w for w in toks if w not in STOP and len(w) > 1]
        word_c.update(content)
        year_docs[int(y)].append(" ".join(content))
        bi_c.update(" ".join(p) for p in zip(toks, toks[1:]) if not all(w in STOP for w in p))
        tri_c.update(" ".join(p) for p in zip(toks, toks[1:], toks[2:]) if not all(w in STOP for w in p))
        emo_c.update(e["emoji"] for e in emoji.emoji_list(t))
    keep = lambda c, n: [{"term": w, "count": v} for w, v in c.most_common() if v >= MIN_COUNT][:n]

    lens = texts.assign(len=texts["text"].str.len(), year=texts["ts"].dt.year)
    length_by_year = {int(y): {d: {"mean": round(float(s.mean()), 1), "median": float(s.median())}
                               for d, s in g.groupby("dir")["len"]}
                      for y, g in lens.groupby("year")}

    # Distinctive words per year: TF-IDF over one doc per year, vocab limited to count >= 20.
    vocab = [w for w, v in word_c.items() if v >= MIN_COUNT]
    distinct = {}
    if vocab and len(year_docs) > 1:
        years = sorted(year_docs)
        cv = CountVectorizer(vocabulary=vocab, token_pattern=r"(?u)\b\w+\b")
        X = cv.transform([" ".join(year_docs[y]) for y in years])
        T = TfidfTransformer(sublinear_tf=True).fit_transform(X).toarray()
        for i, y in enumerate(years):
            idx = T[i].argsort()[::-1][:25]
            distinct[y] = [{"term": vocab[j], "score": round(float(T[i][j]), 4)} for j in idx if T[i][j] > 0]

    summary["language"] = {
        "my_top100_words": keep(word_c, 100),
        "my_top50_emoji": [{"emoji": e, "count": v} for e, v in emo_c.most_common(50)],
        "my_top50_bigrams": keep(bi_c, 50),
        "my_top50_trigrams": keep(tri_c, 50),
        "message_length_by_year": length_by_year,
        "distinctive_words_per_year": distinct,
    }

    # --- sentiment ---
    sia = SentimentIntensityAnalyzer()
    s = texts.copy()
    s["compound"] = [sia.polarity_scores(t)["compound"] for t in s["text"]]
    s["year"] = s["ts"].dt.year
    s["month"] = ym(s["ts"])
    s["cls"] = pd.cut(s["compound"], [-1.01, -0.05, 0.05, 1.01], labels=["negative", "neutral", "positive"])
    r3 = lambda x: round(float(x), 4)
    oo_s = s[~s["is_group"] & s["peer"].notna()]
    top10 = top25[:10]
    cm = oo_s[oo_s["peer"].isin(top10)].groupby(["peer", "month", "dir"])["compound"].mean()
    summary["sentiment"] = {
        "monthly_mean": {m: {d: r3(v) for d, v in g.droplevel(0).items()}
                         for m, g in s.groupby(["month", "dir"])["compound"].mean().groupby(level=0)},
        "yearly_mean": {int(y): {d: r3(v) for d, v in g.droplevel(0).items()}
                        for y, g in s.groupby(["year", "dir"])["compound"].mean().groupby(level=0)},
        "per_contact_top25": {names[k]: {d: r3(v) for d, v in oo_s[oo_s["peer"] == k].groupby("dir")["compound"].mean().items()}
                              for k in top25},
        "per_contact_yearly_top25": {names[k]: {int(y): {d: r3(v) for d, v in g.droplevel(0).items()}
                                                for y, g in oo_s[oo_s["peer"] == k].groupby(["year", "dir"])["compound"].mean().groupby(level=0)}
                                     for k in top25},
        "monthly_series_top10":{names[k]: {m: {d: r3(v) for d, v in g.droplevel(0).items()}
                                            for m, g in cm[k].groupby(level=0)} if k in cm.index.get_level_values(0) else {}
                                 for k in top10},
        "class_share_per_year": {int(y): {c: r3(v) for c, v in g["cls"].value_counts(normalize=True).items()}
                                 for y, g in s.groupby("year")},
    }

    # --- meta / caveats ---
    needed = int(df["body_needed"].sum())
    unresolved = msgs["peer"].fillna("").str.startswith("unk:") | msgs["peer"].isna()
    summary["meta"] = {
        "total_rows": total,
        "non_tapback_messages": int(len(msgs)),
        "tapbacks": int(len(tb)),
        "messages_with_text": int(len(texts)),
        "sent": int((msgs["is_from_me"] == 1).sum()),
        "received": int((msgs["is_from_me"] == 0).sum()),
        "group_messages": int(msgs["is_group"].sum()),
        "first": str(df["ts"].min()), "last": str(df["ts"].max()),
        "attributedBody_needed": needed,
        "attributedBody_decoded": int(df["decoded"].sum()),
        "attributedBody_decode_rate": round(int(df["decoded"].sum()) / needed, 4) if needed else None,
        "unresolved_handle_share_of_messages": round(float(unresolved.mean()), 4),
        "unresolved_share_of_1to1_contacts": round(sum(k.startswith("unk:") for k in counts.index) / max(len(counts), 1), 4),
        "messages_without_chat": int(df["chat_id"].isna().sum()),
        "notes": "Rows may be counted twice if a message joins two chats. Words/ngrams floor = 20.",
    }

    path = OUT / "summary.json"
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=str))
    m = summary["meta"]
    print(f"rows {m['total_rows']:,} (expect ~302k) | messages {m['non_tapback_messages']:,} | tapbacks {m['tapbacks']:,}")
    print(f"sent {m['sent']:,} / received {m['received']:,} | group {m['group_messages']:,}")
    print(f"range {m['first']} -> {m['last']}")
    print(f"attributedBody decode {m['attributedBody_decoded']:,}/{needed:,} | unresolved msg share {m['unresolved_handle_share_of_messages']:.1%}")
    print(f"top contacts: {', '.join(p['name'] for p in summary['people']['top25_overall'][:5])}")
    print(f"wrote {path} ({path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
