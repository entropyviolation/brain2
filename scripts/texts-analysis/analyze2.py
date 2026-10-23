#!/usr/bin/env python3
"""Second pass: per-person detail for the local report.

Reads the copies in data/ (via analyze.extract). Writes, all local to this Mac:
  out/detail.json             per-person / per-year aggregates for report.html
  out/threads/<id>.js         full message logs for the message browser (RAW TEXT)
  out/conflict_candidates.json  candidate conflict windows (ids, dates, counts; no text)
Nothing here is meant to be shared. out/threads/ contains message text.

Usage: .venv/bin/python analyze2.py && .venv/bin/python build_report.py
"""
import hashlib
import json
import math
import pickle
import re
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

import emoji
import numpy as np
import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

import analyze as A

from texts_home import HOME as ROOT
OUT = ROOT / "out"
THREADS = OUT / "threads"
CACHE = ROOT / "data/cache_msgs.pkl"
N_PEOPLE, N_GROUPS, N_CLOSE = 30, 10, 20
GAP_6H = pd.Timedelta(hours=6)
DAY_24H = pd.Timedelta(hours=24)
STOP = A.STOP

# ---------- lexicons ----------
FPS = {"i", "me", "my", "mine", "myself", "im", "i'm", "ive", "i've", "ill", "i'll", "id", "i'd"}
SP = {"you", "your", "yours", "yourself", "youre", "you're", "ya", "ur", "u"}
WE = {"we", "us", "our", "ours", "we're"}
NEG = {"no", "never", "not", "nothing"}
FUTURE = {"will", "gonna"}
CF_TOK = {"shoulda", "coulda", "woulda", "should've", "could've", "would've"}
CF_BI = {("should", "have"), ("could", "have"), ("would", "have")}
LOGISTICS = {"omw", "where", "when", "pickup", "pick", "meet", "tonight", "tomorrow", "address", "leaving", "leave",
             "arrive", "arriving", "eta", "min", "mins", "minutes", "pm", "am", "oclock", "schedule", "parking", "uber",
             "lyft", "flight", "store", "grocery", "outside", "door", "venmo", "here", "otw", "coming", "ready", "time"}
DEPTH = {"feel", "feeling", "feelings", "felt", "sad", "scared", "afraid", "anxious", "anxiety", "depressed", "lonely",
         "hurt", "miss", "cry", "crying", "cried", "grateful", "proud", "worried", "worry", "stressed", "honestly",
         "vulnerable", "trust", "heart", "therapy", "therapist", "ashamed", "fear", "hope", "wish", "emotional",
         "struggling", "overwhelmed", "insecure", "love", "happy", "afraid", "upset"}
CONFLICT = {"sorry", "upset", "mad", "angry", "hurt", "ignore", "ignoring", "ignored", "fight", "fighting", "argue",
            "arguing", "whatever", "annoyed", "frustrated", "disrespect", "disrespectful", "apologize", "apology",
            "wtf", "unfair", "rude", "blame", "pissed", "hate"}
CONFLICT_BI = {("why", "would"), ("you", "always"), ("you", "never")}
THEMES = {
    "logistics": LOGISTICS,
    "feelings": DEPTH,
    "conflict": CONFLICT,
    "money": {"money", "pay", "paid", "rent", "venmo", "bill", "bills", "cash", "cost", "price", "expensive", "afford", "bank", "dollars", "owe"},
    "family": {"mom", "dad", "mother", "father", "sister", "brother", "family", "grandma", "grandpa", "aunt", "uncle", "cousin", "parents"},
    "work & school": {"work", "job", "boss", "shift", "class", "classes", "school", "exam", "test", "homework", "professor", "meeting", "interview", "office", "project", "paper", "essay", "grade"},
    "health": {"sick", "doctor", "hospital", "pain", "meds", "medicine", "tired", "sleep", "headache", "appointment", "covid", "nurse", "therapy"},
    "plans & future": {"will", "gonna", "plan", "plans", "future", "someday", "trip", "move", "moving", "weekend", "next"},
    "romance": {"babe", "baby", "cute", "kiss", "date", "boyfriend", "girlfriend", "crush", "beautiful", "handsome", "love"},
    "humor": {"lol", "lmao", "haha", "hahaha", "lmfao", "funny", "joke", "hilarious"},
    "substances": {"weed", "high", "drunk", "drinks", "drink", "beer", "wine", "smoke", "shrooms", "mushrooms", "dmt", "acid", "edible"},
}
BIG5 = {  # pop-psych marker words, per 1,000 words
    "extraversion": {"we", "us", "party", "fun", "friends", "excited", "tonight", "together", "love", "yay"},
    "neuroticism": {"worried", "anxious", "scared", "stressed", "sad", "hate", "afraid", "upset", "nervous", "depressed"},
    "agreeableness": {"thanks", "thank", "please", "sorry", "appreciate", "sweet", "kind", "happy", "wonderful", "glad"},
    "conscientiousness": {"done", "finished", "completed", "plan", "schedule", "ready", "organized", "deadline", "prepared", "work"},
    "openness": {"art", "music", "idea", "wonder", "book", "books", "universe", "curious", "dream", "poetry"},
}
LSM_CATS = {
    "personal pronouns": {"i", "me", "my", "mine", "myself", "we", "us", "our", "ours", "you", "your", "yours", "yourself",
                          "he", "him", "his", "she", "her", "hers", "they", "them", "their", "theirs", "u", "ur"},
    "impersonal pronouns": {"it", "its", "this", "that", "these", "those", "something", "anything", "everything", "nothing",
                            "someone", "anyone", "everyone", "thing", "stuff"},
    "articles": {"a", "an", "the"},
    "prepositions": {"to", "of", "in", "for", "on", "with", "at", "by", "from", "up", "about", "into", "over", "after",
                     "under", "between", "through", "during", "without", "before"},
    "auxiliary verbs": {"am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
                        "will", "would", "shall", "should", "can", "could", "may", "might", "must"},
    "adverbs": {"very", "really", "so", "just", "too", "quite", "pretty", "also", "even", "still", "always", "often", "ever"},
    "conjunctions": {"and", "but", "or", "because", "if", "though", "although", "while", "whereas"},
    "negations": {"no", "not", "never", "none", "nobody", "neither", "nor", "cant", "dont", "wont", "isnt", "arent",
                  "wasnt", "didnt", "doesnt", "shouldnt", "couldnt", "wouldnt"},
    "quantifiers": {"all", "some", "many", "much", "few", "lot", "lots", "more", "most", "less", "every", "each", "any", "several"},
}
TOK = re.compile(r"[a-z]+(?:'[a-z]+)?")
URL_RX = re.compile(r"https?://\S+|www\.\S+|\b\S+\.(?:com|net|org|io|co|ly|me|app|gl|be)/\S*", re.I)


def tokenize(text):
    return TOK.findall(URL_RX.sub(" ", text).lower().replace("’", "'"))


# ---------- load ----------

def load():
    if CACHE.exists():
        return pickle.loads(CACHE.read_bytes())
    df, chats, members = A.extract()
    lookup, labels = A.load_contacts()
    one_handle = {c: hs[0] for c, hs in members.items() if len(hs) == 1}
    df["peer_raw"] = [one_handle.get(c) if not g else s for c, g, s in zip(df["chat_id"], df["is_group"], df["sender"])]
    df.loc[df["peer_raw"].isna() & ~df["is_group"], "peer_raw"] = df["sender"]
    df["peer"] = df["peer_raw"].map(lambda h: A.resolve_handle(h, lookup) if isinstance(h, str) else None)
    df["sender_key"] = df["sender"].map(lambda h: A.resolve_handle(h, lookup) if isinstance(h, str) else None)
    raw_for_key = df.dropna(subset=["peer"]).groupby("peer")["peer_raw"].first().to_dict()
    msgs = df[~df["is_tapback"]].copy()
    sia = SentimentIntensityAnalyzer()
    msgs["compound"] = [sia.polarity_scores(t)["compound"] if t else np.nan for t in msgs["text"]]
    blob = (msgs, chats, members, labels, raw_for_key)
    CACHE.write_bytes(pickle.dumps(blob))
    return blob


def log_odds(fg, bg_minus, prior, a0=500.0, min_count=5, n=40):
    """Monroe et al. log-odds with informative Dirichlet prior. fg vs (everything else)."""
    nf, nb, np_ = sum(fg.values()), sum(bg_minus.values()), sum(prior.values())
    if not nf or not nb:
        return []
    out = []
    for w, y in fg.items():
        if y < min_count or w in STOP or len(w) < 2:
            continue
        a = prior.get(w, 0) / np_ * a0 + 0.01
        yb = bg_minus.get(w, 0)
        d = math.log((y + a) / (nf + a0 - y - a)) - math.log((yb + a) / (nb + a0 - yb - a))
        z = d / math.sqrt(1 / (y + a) + 1 / (yb + a))
        out.append((z, w, y))
    out.sort(reverse=True)
    return [{"term": w, "z": round(z, 2), "count": y} for z, w, y in out[:n] if z > 1.96]


def runs(days):
    """Consecutive-day runs from a sorted list of dates -> [(start, end, length)]."""
    out, start, prev = [], None, None
    for d in days:
        if prev is not None and (d - prev).days == 1:
            prev = d
            continue
        if start is not None:
            out.append((start, prev, (prev - start).days + 1))
        start = prev = d
    if start is not None:
        out.append((start, prev, (prev - start).days + 1))
    return out


def rate(n, d, per=100):
    return round(per * n / d, 3) if d else None


def r3(x):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), 3)


def main():
    OUT.mkdir(exist_ok=True)
    THREADS.mkdir(exist_ok=True)
    msgs, chats, members, labels, raw_for_key = load()
    msgs = msgs.sort_values("ts").reset_index(drop=True)

    # Names exactly as analyze.py labels them.
    oo_all = msgs[~msgs["is_group"] & msgs["peer"].notna()]
    counts = oo_all.groupby("peer").size().sort_values(ascending=False)
    names = A.label_people(list(counts.index), labels, raw_for_key)
    sender_name = lambda k: "Unknown" if not isinstance(k, str) else (names.get(k) or (labels.get(k) if not k.startswith("unk:") else None) or (A.unknown_label(k[4:]) if k.startswith("unk:") else "Unknown"))

    # Entities: top people (1:1, merged across handles) and top group chats.
    ents = {}
    for i, k in enumerate(counts.index[:N_PEOPLE], 1):
        ents[f"p{i:02d}"] = {"kind": "person", "key": k, "name": names[k]}
    gsize = msgs[msgs["is_group"]].groupby("chat_id").size().sort_values(ascending=False)
    disp = chats.set_index("chat_id")["display_name"].to_dict()
    for i, cid in enumerate(gsize.index[:N_GROUPS], 1):
        dn = disp.get(int(cid))
        ents[f"g{i:02d}"] = {"kind": "group", "chat_id": int(cid), "name": dn.strip() if isinstance(dn, str) and dn.strip() else f"Group {i}"}
    key2ent = {e["key"]: eid for eid, e in ents.items() if e["kind"] == "person"}
    chat2ent = {e["chat_id"]: eid for eid, e in ents.items() if e["kind"] == "group"}
    msgs["ent"] = [key2ent.get(p) if not g else chat2ent.get(int(c)) if c == c else None
                   for p, g, c in zip(msgs["peer"], msgs["is_group"], msgs["chat_id"])]
    msgs["side"] = np.where(msgs["is_from_me"] == 1, "me", "them")
    msgs["peer_name"] = msgs["peer"].map(lambda k: names.get(k) if isinstance(k, str) else None)
    msgs["year"] = msgs["ts"].dt.year
    msgs["month"] = msgs["ts"].dt.strftime("%Y-%m")
    msgs["hour"] = msgs["ts"].dt.hour
    msgs["day"] = msgs["ts"].dt.date

    # ---------- per-message features ----------
    feats = defaultdict(list)
    tok_store = []
    for t in msgs["text"]:
        ta = tokenize(t) if t else []
        tk = [w.replace("'", "") for w in ta]
        tok_store.append(tk)
        st = set(ta) | set(tk)
        bis = set(zip(tk, tk[1:]))
        feats["n_words"].append(len(tk))
        feats["n_chars"].append(len(t))
        feats["fps"].append(sum(w in FPS for w in ta))
        feats["sp"].append(sum(w in SP for w in ta))
        feats["we"].append(sum(w in WE for w in ta))
        feats["neg"].append(sum(w in NEG for w in tk))
        feats["fut"].append(sum(w in FUTURE or w.endswith("'ll") for w in ta))
        feats["cf"].append(sum(w in CF_TOK for w in ta) + sum(b in CF_BI for b in bis))
        feats["q"].append("?" in t)
        s_ = t.rstrip()
        if not s_:
            end = "none"
        else:
            em = emoji.emoji_list(s_)
            if em and em[-1]["match_end"] >= len(s_):
                end = "emoji"
            else:
                end = {".": "period", "!": "exclamation", "?": "question"}.get(s_[-1], "none")
        feats["end"].append(end)
        for th, lex in THEMES.items():
            feats["th_" + th].append(bool(st & lex) or (th == "conflict" and bool(bis & CONFLICT_BI)))
        feats["conflict_hits"].append(sum(w in CONFLICT for w in tk) + len(bis & CONFLICT_BI))
        for b, lex in BIG5.items():
            feats["b5_" + b].append(sum(w in lex for w in tk))
        for c, lex in LSM_CATS.items():
            feats["lsm_" + c].append(sum(w in lex for w in tk))
        feats["emojis"].append([e["emoji"] for e in emoji.emoji_list(t)] if t else [])
    for k, v in feats.items():
        msgs[k] = v
    msgs["has_text"] = msgs["n_chars"] > 0

    # Calendar range and gap months (months with no messages at all).
    first_day, last_day = msgs["day"].min(), msgs["day"].max()
    all_months = pd.period_range(first_day, last_day, freq="M").strftime("%Y-%m").tolist()
    present = set(msgs["month"])
    gap_months = [m for m in all_months if m not in present]

    detail = {"meta": {"gap_months": gap_months, "first_day": str(first_day), "last_day": str(last_day)}, "entities": {},
              "overrides": A.load_overrides()}

    # ---------- texts per day ----------
    daily = msgs.groupby("day").size()
    days = pd.date_range(first_day, last_day, freq="D")
    dser = pd.Series(0, index=days.date)
    dser.loc[daily.index] = daily.values
    dmonth = pd.Series([d.strftime("%Y-%m") for d in dser.index], index=dser.index)
    keep = ~dmonth.isin(gap_months)
    dk = dser[keep.values]
    by_year = dk.groupby([d.year for d in dk.index]).agg(["sum", "count"])
    by_month = dk.groupby(dmonth[keep.values].values).agg(["sum", "count"])
    moy = defaultdict(list)
    for m, r in by_month.iterrows():
        moy[int(m[5:])].append(r["sum"] / r["count"])
    detail["per_day"] = {
        "overall": round(dk.sum() / len(dk), 1), "days_counted": int(len(dk)), "days_excluded": int((~keep).sum()),
        "yearly": {int(y): {"avg": round(r["sum"] / r["count"], 1), "days": int(r["count"])} for y, r in by_year.iterrows()},
        "monthly": {m: {"avg": round(r["sum"] / r["count"], 1), "days": int(r["count"])} for m, r in by_month.iterrows()},
        "month_of_year": {mo: {"avg": round(float(np.mean(v)), 1), "years": len(v)} for mo, v in sorted(moy.items())},
        "busiest_weekday": {int(k): round(float(v), 1) for k, v in dk.groupby([d.weekday() for d in dk.index]).mean().items()},
        "zero_days": int((dk == 0).sum()),
    }

    detail["comparisons"] = comparisons(msgs, tok_store, gap_months, last_day)

    # ---------- background word counts ----------
    bg_all, bg_me = Counter(), Counter()
    ent_c = defaultdict(lambda: {"me": Counter(), "them": Counter()})
    year_me = defaultdict(Counter)
    for tk, side, ent, y in zip(tok_store, msgs["side"], msgs["ent"], msgs["year"]):
        c = [w for w in tk if w not in STOP and len(w) > 1]
        bg_all.update(c)
        if side == "me":
            bg_me.update(c)
            year_me[int(y)].update(c)
        if ent:
            ent_c[ent][side].update(c)

    # Years: common + distinctive (log-odds vs my other years).
    detail["years"] = {}
    for y, c in sorted(year_me.items()):
        detail["years"][y] = {
            "common": [{"term": w, "count": n} for w, n in c.most_common(60) if n >= 5],
            "distinctive": log_odds(c, bg_me - c, bg_me, n=40),
            "words": int(sum(c.values())),
        }

    # Per-year pronouns + lengths, me vs everyone else.
    def pron_block(g):
        w = int(g["n_words"].sum())
        return {"words": w, "i_rate": rate(g["fps"].sum(), w), "you_rate": rate(g["sp"].sum(), w), "we_rate": rate(g["we"].sum(), w),
                "i_to_you": r3(g["fps"].sum() / g["sp"].sum()) if g["sp"].sum() else None}

    def len_block(g):
        g = g[g["has_text"]]
        return {"chars_mean": r3(g["n_chars"].mean()), "chars_median": r3(g["n_chars"].median()),
                "words_mean": r3(g["n_words"].mean()), "words_median": r3(g["n_words"].median()), "n": int(len(g))}

    detail["pronouns_by_year"] = {int(y): {s: pron_block(gg) for s, gg in g.groupby("side")} for y, g in msgs.groupby("year")}
    detail["length_by_year"] = {int(y): {s: len_block(gg) for s, gg in g.groupby("side")} for y, g in msgs.groupby("year")}
    detail["pronouns_overall"] = {s: pron_block(g) for s, g in msgs.groupby("side")}

    # Theme baseline (share of text messages touching each theme), for discussed-vs-avoided lifts.
    txt = msgs[msgs["has_text"]]
    base_theme = {th: float(txt["th_" + th].mean()) for th in THEMES}
    detail["theme_baseline"] = {k: r3(v) for k, v in base_theme.items()}
    # Keyword lists, in bit order. Thread rows carry a bitmask of the topics each message hit.
    lex = {th: sorted(THEMES[th]) + (sorted(" ".join(b) for b in CONFLICT_BI) if th == "conflict" else []) for th in THEMES}
    detail["theme_lexicon"] = lex
    detail["theme_version"] = hashlib.sha1(json.dumps(lex, sort_keys=True).encode()).hexdigest()[:10]

    # Fast Company markers: me overall.
    def markers(g):
        g = g[g["has_text"]]
        w = int(g["n_words"].sum()) or 1
        ends = g["end"].value_counts(normalize=True)
        return {
            "question_rate": r3(g["q"].mean()),
            "endings": {k: r3(ends.get(k, 0)) for k in ("period", "exclamation", "question", "emoji", "none")},
            "negations_per100": rate(g["neg"].sum(), w), "future_per100": rate(g["fut"].sum(), w),
            "counterfactual_per1000": rate(g["cf"].sum(), w, 1000),
            "i_rate": rate(g["fps"].sum(), w), "you_rate": rate(g["sp"].sum(), w),
            "big5_per1000": {b: rate(g["b5_" + b].sum(), w, 1000) for b in BIG5},
            "emoji_per_msg": r3(g["emojis"].map(len).mean()),
            "morning_share": r3(g["hour"].between(6, 9).mean()),
            "late_night_share": r3(g["hour"].between(0, 3).mean()),
        }
    detail["markers_me_overall"] = markers(msgs[msgs["side"] == "me"])

    # ---------- per entity ----------
    conflicts = []
    for eid, e in ents.items():
        g = msgs[msgs["ent"] == eid]
        if g.empty:
            continue
        cm, ct = ent_c[eid]["me"], ent_c[eid]["them"]
        rest_me = bg_me - cm
        rest_all = bg_all - cm - ct
        info = {
            "id": eid, "kind": e["kind"], "name": e["name"], "total": int(len(g)),
            "sent": int((g["side"] == "me").sum()), "received": int((g["side"] == "them").sum()),
            "first": str(g["day"].min()), "last": str(g["day"].max()),
            "members": int(len(members.get(e.get("chat_id"), []))) if e["kind"] == "group" else None,
            "words": {
                "common_me": [{"term": w, "count": n} for w, n in cm.most_common(60) if n >= 3],
                "common_them": [{"term": w, "count": n} for w, n in ct.most_common(60) if n >= 3],
                "distinctive_me": log_odds(cm, rest_me, bg_me),
                "distinctive_them": log_odds(ct, rest_all, bg_all),
                "distinctive_chat": log_odds(cm + ct, rest_all, bg_all),
            },
            "pronouns": {s: pron_block(gg) for s, gg in g.groupby("side")},
            "length": {s: len_block(gg) for s, gg in g.groupby("side")},
            "length_by_year": {int(y): {s: len_block(g3) for s, g3 in gg.groupby("side")} for y, gg in g.groupby("year")},
            "pronouns_by_year": {int(y): {s: pron_block(g3) for s, g3 in gg.groupby("side")} for y, gg in g.groupby("year")},
            "themes": {},
        }
        gt = g[g["has_text"]]
        for th in THEMES:
            sh = float(gt["th_" + th].mean()) if len(gt) else 0
            info["themes"][th] = {"share": r3(sh), "lift": r3(sh / base_theme[th]) if base_theme[th] else None,
                                  "me": r3(gt[gt["side"] == "me"]["th_" + th].mean()), "them": r3(gt[gt["side"] == "them"]["th_" + th].mean())}
        if e["kind"] == "person":
            # Numbers and emails this person texts from. Brain2 links them to a Person (local only).
            info["handles"] = sorted({h for h in g["peer_raw"].dropna().unique() if isinstance(h, str)})
            info["key"] = e["key"]
            person_metrics(info, g, conflicts, eid, all_months, first_day, last_day, markers)
        else:
            info["chat_ids"] = sorted({int(c) for c in g["chat_id"].dropna()})  # serve.py keys saved rows on these
        detail["entities"][eid] = info

        # Thread file (raw text, local only).
        rows = []
        tmask = sum(g["th_" + th].astype(int).to_numpy() << b for b, th in enumerate(THEMES))
        for ts, me, sk, t, comp, mid, tm in zip(g["ts"], g["is_from_me"], g["sender_key"], g["text"], g["compound"], g["mid"], tmask):
            who = "" if me else (sender_name(sk) if e["kind"] == "group" else "")
            rows.append([int(ts.timestamp()), int(me), who, t or "", int(mid), int(tm)])
        payload = json.dumps({"id": eid, "name": e["name"], "msgs": rows}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        (THREADS / f"{eid}.js").write_text(f"window.__thread&&window.__thread({payload});")

    # Closeness composite over the top 20 people.
    composite(detail)

    # Conflict candidates (no text).
    for i, c in enumerate(sorted(conflicts, key=lambda c: c["start"]), 1):
        c["cid"] = f"c{i:04d}"
    per_person = Counter(c["ent"] for c in conflicts)
    (OUT / "conflict_candidates.json").write_text(json.dumps({"candidates": conflicts, "per_person": per_person}, indent=1))
    detail["conflicts"] = {"candidates": conflicts, "per_person": dict(per_person)}

    (OUT / "detail.json").write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":"), default=str))
    pd_ = detail["per_day"]
    print(f"entities {len(detail['entities'])} | threads written to {THREADS}")
    print(f"texts/day overall {pd_['overall']} over {pd_['days_counted']} days (excluded {pd_['days_excluded']} gap days)")
    print(f"conflict candidates {len(conflicts)} across {len(per_person)} people")
    top = sorted(((v.get('closeness', {}).get('score', 0), v['name']) for v in detail['entities'].values() if v['kind'] == 'person'), reverse=True)[:5]
    print("closeness top 5:", ", ".join(f"{n} {s:.0f}" for s, n in top))


def person_metrics(info, g, conflicts, eid, all_months, first_day, last_day, markers):
    g = g.sort_values("ts")
    gap = g["ts"].diff()
    starts = gap.isna() | (gap >= GAP_6H)
    session = starts.cumsum()
    # Initiation per year.
    st = g[starts]
    info["initiation"] = {"me_share": r3(st["is_from_me"].mean()), "conversations": int(len(st)),
                          "by_year": {int(y): r3(v) for y, v in st.groupby("year")["is_from_me"].mean().items()}}
    # Replies.
    flip = g["is_from_me"].ne(g["is_from_me"].shift()) & gap.notna() & (gap < DAY_24H)
    rp = pd.DataFrame({"month": g["month"], "side": g["side"], "min": gap.dt.total_seconds() / 60})[flip]
    med = rp.groupby("side")["min"].median()
    mon_med = rp.groupby(["month"])["min"].agg(["median", "size"])
    mm = mon_med[mon_med["size"] >= 10]["median"]
    cv = {}
    for s, gg in rp.groupby("side"):
        m2 = gg.groupby("month")["min"].agg(["median", "size"])
        m2 = m2[m2["size"] >= 10]["median"]
        cv[s] = r3(m2.std() / m2.mean()) if len(m2) >= 3 and m2.mean() else None
    info["replies"] = {"median_me": r3(med.get("me")), "median_them": r3(med.get("them")), "cv_me": cv.get("me"), "cv_them": cv.get("them"),
                       "median_all": r3(rp["min"].median())}
    # Monthly series over the relationship span.
    span = [m for m in all_months if g["month"].min() <= m <= g["month"].max()]
    vol = g.groupby("month").size()
    sen = g[g["has_text"]].groupby("month")["compound"].agg(["mean", "size"])
    series = {
        "months": span,
        "volume": [int(vol.get(m, 0)) for m in span],
        "sentiment": [r3(sen.loc[m, "mean"]) if m in sen.index and sen.loc[m, "size"] >= 20 else None for m in span],
        "reply_median": [r3(mm.get(m)) if m in mm.index else None for m in span],
        "me_share": [r3(v) for v in (g.groupby("month")["is_from_me"].mean().reindex(span).tolist())],
    }
    info["series"] = series
    info["inflections"] = inflections(series)

    # Streaks.
    days_any = sorted(set(g["day"]))
    me_days, them_days = set(g[g["side"] == "me"]["day"]), set(g[g["side"] == "them"]["day"])
    days_both = sorted(me_days & them_days)
    ra, rb = runs(days_any), runs(days_both)
    cur = next((r for r in reversed(ra) if (last_day - r[1]).days <= 1), None)
    span_days = (pd.Timestamp(days_any[-1]) - pd.Timestamp(days_any[0])).days + 1
    cal = []
    d = first_day
    sa, sb = set(days_any), set(days_both)
    while d <= last_day:
        cal.append("2" if d in sb else "1" if d in sa else "0")
        d += timedelta(days=1)
    info["streaks"] = {
        "active_days": len(days_any), "both_days": len(days_both), "span_days": span_days,
        "active_share": r3(len(days_any) / span_days),
        "longest_any": [{"start": str(a), "end": str(b), "days": n} for a, b, n in sorted(ra, key=lambda r: -r[2])[:5]],
        "longest_both": [{"start": str(a), "end": str(b), "days": n} for a, b, n in sorted(rb, key=lambda r: -r[2])[:5]],
        "current": {"start": str(cur[0]), "end": str(cur[1]), "days": cur[2]} if cur else None,
        "breaks": [str(b + timedelta(days=1)) for a, b, n in ra if n >= 7 and (last_day - b).days > 1],
        "calendar": "".join(cal),
    }

    # Closeness raw components.
    lm, lt = info["length"].get("me", {}).get("chars_mean"), info["length"].get("them", {}).get("chars_mean")
    gt = g[g["has_text"]]
    em_me = Counter(e for l in gt[gt["side"] == "me"]["emojis"] for e in l)
    em_th = Counter(e for l in gt[gt["side"] == "them"]["emojis"] for e in l)
    keys = set(em_me) | set(em_th)
    dot = sum(em_me[k] * em_th[k] for k in keys)
    cos = dot / (math.sqrt(sum(v * v for v in em_me.values())) * math.sqrt(sum(v * v for v in em_th.values()))) if em_me and em_th else None
    top_me, top_th = {e for e, _ in em_me.most_common(10)}, {e for e, _ in em_th.most_common(10)}
    lsm = {}
    for c in LSM_CATS:
        a = gt[gt["side"] == "me"]["lsm_" + c].sum() / max(gt[gt["side"] == "me"]["n_words"].sum(), 1)
        b = gt[gt["side"] == "them"]["lsm_" + c].sum() / max(gt[gt["side"] == "them"]["n_words"].sum(), 1)
        lsm[c] = r3(1 - abs(a - b) / (a + b + 1e-4))
    lsm_by_year = {}
    for y, gy in gt.groupby("year"):
        vals = []
        for c in LSM_CATS:
            wm, wt = gy[gy["side"] == "me"]["n_words"].sum(), gy[gy["side"] == "them"]["n_words"].sum()
            if wm < 200 or wt < 200:
                break
            a, b = gy[gy["side"] == "me"]["lsm_" + c].sum() / wm, gy[gy["side"] == "them"]["lsm_" + c].sum() / wt
            vals.append(1 - abs(a - b) / (a + b + 1e-4))
        if len(vals) == len(LSM_CATS):
            lsm_by_year[int(y)] = r3(np.mean(vals))
    depth = {s: (int(gg["th_feelings"].sum()), int(gg["th_logistics"].sum())) for s, gg in gt.groupby("side")}
    dall = sum(v[0] for v in depth.values()), sum(v[1] for v in depth.values())
    pos, neg = int((gt["compound"] > 0.3).sum()), int((gt["compound"] < -0.3).sum())
    we_by_year = {int(y): rate(gg["we"].sum(), gg["n_words"].sum()) for y, gg in gt.groupby("year")}
    q_me, q_th = gt[gt["side"] == "me"]["q"].mean(), gt[gt["side"] == "them"]["q"].mean()
    recent = g[g["ts"] >= g["ts"].max() - pd.Timedelta(days=365)] if len(g) else g
    info["closeness_raw"] = {
        "volume": int(len(g)),
        "active_share": r3(len(days_any) / span_days),
        "reciprocity": r3(1 - abs((g["side"] == "me").mean() - 0.5) * 2),
        "initiation_balance": r3(1 - abs(st["is_from_me"].mean() - 0.5) * 2) if len(st) else None,
        "depth_ratio": r3(dall[0] / (dall[0] + dall[1])) if sum(dall) else None,
        "depth_me": r3(depth.get("me", (0, 0))[0] / max(sum(depth.get("me", (0, 0))), 1)),
        "depth_them": r3(depth.get("them", (0, 0))[0] / max(sum(depth.get("them", (0, 0))), 1)),
        "lsm": r3(np.mean([v for v in lsm.values() if v is not None])),
        "lsm_by_category": lsm, "lsm_by_year": lsm_by_year,
        "length_match": r3(1 - abs(lm - lt) / max(lm, lt)) if lm and lt else None,
        "emoji_cosine": r3(cos), "emoji_top10_overlap": r3(len(top_me & top_th) / len(top_me | top_th)) if top_me | top_th else None,
        "emoji_shared_top": sorted(top_me & top_th, key=lambda e: -(em_me[e] + em_th[e]))[:8],
        "positive_msgs": pos, "negative_msgs": neg, "pos_neg_ratio": r3(pos / neg) if neg else None,
        "reply_median_min": info["replies"]["median_all"],
        "reply_cv": r3(np.nanmean([v for v in (info["replies"]["cv_me"], info["replies"]["cv_them"]) if v is not None])) if (info["replies"]["cv_me"] or info["replies"]["cv_them"]) else None,
        "we_rate": rate(gt["we"].sum(), gt["n_words"].sum()), "we_by_year": we_by_year,
        "question_me": r3(q_me), "question_them": r3(q_th), "question_balance": r3(q_me / (q_me + q_th)) if (q_me + q_th) else None,
        "morning_me": r3(gt[gt["side"] == "me"]["hour"].between(6, 9).mean()), "morning_them": r3(gt[gt["side"] == "them"]["hour"].between(6, 9).mean()),
        "recent_365_msgs": int(len(recent)) if g["day"].max() >= last_day - timedelta(days=365) else 0,
    }
    info["markers"] = {s: markers(gg) for s, gg in g.groupby("side")}
    i_me, i_th = info["markers"].get("me", {}).get("i_rate"), info["markers"].get("them", {}).get("i_rate")
    info["power"] = {"i_rate_me": i_me, "i_rate_them": i_th,
                     "lower_status_by_pennebaker": None if i_me is None or i_th is None else ("me" if i_me > i_th else "them")}

    # Conflict candidates: sessions with both sides negative within an hour, or conflict words from both sides.
    sess_count = 0
    for sid, s in g.groupby(session):
        sess_count += 1
        s = s[s["has_text"]]
        if len(s) < 4:
            continue
        negs = s[s["compound"] < -0.3]
        # Hot window: some 60-minute stretch with 2+ clearly negative messages from EACH side
        # and a negative mean tone across everything said in it.
        both_neg, hot = False, None
        if not negs.empty and (negs["side"] == "me").sum() >= 2 and (negs["side"] == "them").sum() >= 2:
            tsv = s["ts"].values
            for t0 in negs["ts"].values:
                w = s[(tsv >= t0) & (tsv <= t0 + np.timedelta64(60, "m"))]
                wn = w[w["compound"] < -0.3]
                if (wn["side"] == "me").sum() >= 2 and (wn["side"] == "them").sum() >= 2 and w["compound"].mean() < -0.05:
                    both_neg, hot = True, w
                    break
        hits = s.groupby("side")["conflict_hits"].sum()
        word_rule = hits.get("me", 0) >= 2 and hits.get("them", 0) >= 2 and s["compound"].mean() < 0.05
        if not (both_neg or word_rule):
            continue
        first_neg = negs.iloc[0]["side"] if not negs.empty else None
        conflicts.append({
            "ent": eid, "name": info["name"], "start": str(s["ts"].min()), "end": str(s["ts"].max()),
            "start_epoch": int(s["ts"].min().timestamp()), "messages": int(len(s)),
            "rule": "both" if both_neg and word_rule else "both-negative<1h" if both_neg else "conflict-words",
            "strength": 2 if both_neg and word_rule else 1,
            "hot_start_epoch": int(pd.Timestamp(hot["ts"].min()).timestamp()) if hot is not None else None,
            "neg_me": int((negs["side"] == "me").sum()), "neg_them": int((negs["side"] == "them").sum()),
            "conflict_words_me": int(hits.get("me", 0)), "conflict_words_them": int(hits.get("them", 0)),
            "mean_sent_me": r3(s[s["side"] == "me"]["compound"].mean()), "mean_sent_them": r3(s[s["side"] == "them"]["compound"].mean()),
            "first_negative": first_neg, "opened_by": s.iloc[0]["side"],
            "message_ids": [int(m) for m in s["mid"]],
        })
    n_c = sum(1 for c in conflicts if c["ent"] == eid)
    info["arguing"] = {"candidates": n_c, "per_100_conversations": rate(n_c, sess_count), "per_1000_messages": rate(n_c, len(g), 1000)}


def comparisons(msgs, tok_store, gap_months, last_day):
    """This week vs last week vs the average week; this month vs last month vs the same month last year."""
    m = msgs.copy()
    m["tok"] = tok_store
    m["week"] = (m["ts"] - pd.to_timedelta(m["ts"].dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
    # Replies in 1:1 threads (sender flips within 24h), attributed to the replying message's period.
    oo = m[~m["is_group"] & m["peer"].notna()].sort_values(["peer", "ts"])
    gap = oo["ts"].diff()
    flip = (oo["peer"] == oo["peer"].shift()) & (oo["is_from_me"] != oo["is_from_me"].shift()) & (gap < DAY_24H)
    rep = pd.DataFrame({"week": oo["week"], "month": oo["month"], "side": oo["side"], "min": gap.dt.total_seconds() / 60})[flip]

    def stats(g, rg):
        gt = g[g["has_text"]]
        words = Counter(w for tk, sd in zip(gt["tok"], gt["side"]) if sd == "me" for w in tk if w not in STOP and len(w) > 1)
        return {
            "messages": int(len(g)), "sent": int((g["side"] == "me").sum()), "received": int((g["side"] == "them").sum()),
            "people": int(g[~g["is_group"]]["peer"].nunique()), "active_days": int(g["day"].nunique()),
            "reply_me_min": r3(rg[rg["side"] == "me"]["min"].median()) if len(rg) else None,
            "reply_them_min": r3(rg[rg["side"] == "them"]["min"].median()) if len(rg) else None,
            "sentiment_me": r3(gt[gt["side"] == "me"]["compound"].mean()), "sentiment_them": r3(gt[gt["side"] == "them"]["compound"].mean()),
            "top_words": [{"term": w, "count": n} for w, n in words.most_common(15)],
            "top_people": [{"name": n, "messages": int(c)} for n, c in g[~g["is_group"]]["peer_name"].value_counts().head(5).items()],
        }

    weeks = sorted(m["week"].unique())
    wk_counts = m.groupby("week").size()
    gap_weeks = {w for w in weeks if pd.Timestamp(w).strftime("%Y-%m") in gap_months}
    full = [w for w in weeks if w not in gap_weeks]
    this_w = weeks[-1]
    last_w = (pd.Timestamp(this_w) - pd.Timedelta(days=7)).strftime("%Y-%m-%d")
    days_in_this = (pd.Timestamp(last_day) - pd.Timestamp(this_w)).days + 1
    wstats = {}
    for w in full[-1:] + [last_w]:
        wstats[w] = stats(m[m["week"] == w], rep[rep["week"] == w])
    # Average week: per-week numbers averaged over all complete, non-gap weeks.
    per_week = m[m["week"].isin(full[:-1])].groupby("week")
    pw = pd.DataFrame({"messages": per_week.size(), "sent": per_week["is_from_me"].sum(), "people": per_week.apply(lambda g: g[~g["is_group"]]["peer"].nunique()),
                       "active_days": per_week["day"].nunique()})
    pw["received"] = pw["messages"] - pw["sent"]
    rw = rep[rep["week"].isin(full[:-1])].groupby(["week", "side"])["min"].median().unstack()
    sw = m[m["has_text"] & m["week"].isin(full[:-1])].groupby(["week", "side"])["compound"].mean().unstack()
    avg_week = {k: r3(pw[k].mean()) for k in ("messages", "sent", "received", "people", "active_days")}
    avg_week.update({"reply_me_min": r3(rw.get("me", pd.Series(dtype=float)).median()), "reply_them_min": r3(rw.get("them", pd.Series(dtype=float)).median()),
                     "sentiment_me": r3(sw.get("me", pd.Series(dtype=float)).mean()), "sentiment_them": r3(sw.get("them", pd.Series(dtype=float)).mean())})
    months = sorted(m["month"].unique())
    this_m = months[-1]
    pm = (pd.Period(this_m, "M") - 1).strftime("%Y-%m")
    ly = (pd.Period(this_m, "M") - 12).strftime("%Y-%m")
    mstats = {k: stats(m[m["month"] == k], rep[rep["month"] == k]) for k in (this_m, pm, ly) if k in set(months)}
    wk_series = [{"week": w, "messages": int(wk_counts.get(w, 0)), "gap": w in gap_weeks} for w in weeks]
    mo_series = [{"month": k, "messages": int(v)} for k, v in m.groupby("month").size().items()]
    return {
        "week": {"this": this_w, "this_days": days_in_this, "last": last_w, "stats": wstats, "avg": avg_week, "avg_weeks": len(full) - 1},
        "month": {"this": this_m, "this_days": int(pd.Timestamp(last_day).day), "last": pm, "last_year": ly, "stats": mstats},
        "weekly_series": wk_series, "monthly_series": mo_series,
    }


def inflections(series, top=4):
    out = []
    months = series["months"]
    for key, label in (("volume", "volume"), ("sentiment", "sentiment"), ("reply_median", "reply time")):
        v = pd.Series(series[key], dtype="float64")
        if key == "volume":
            v = np.log1p(v)
        base = v.shift(1).rolling(3, min_periods=2).mean()
        ch = v - base
        sd = ch.std()
        if not sd or np.isnan(sd):
            continue
        z = ch / sd
        for i in z.dropna().index:
            if abs(z[i]) >= 2.5:
                out.append({"month": months[i], "metric": label, "direction": "up" if z[i] > 0 else "down", "z": round(float(z[i]), 2)})
    return sorted(out, key=lambda r: -abs(r["z"]))[:top]


COMPONENTS = [  # (key, higher_is_closer, label)
    ("volume", True, "Volume"), ("active_share", True, "Days in touch"), ("reciprocity", True, "Sent/received balance"),
    ("initiation_balance", True, "Initiation balance"), ("depth_ratio", True, "Depth vs logistics"), ("lsm", True, "Style matching"),
    ("length_match", True, "Length matching"), ("emoji_cosine", True, "Emoji mirroring"), ("pos_neg_ratio", True, "Positive : negative"),
    ("reply_median_min", False, "Reply speed"), ("reply_cv", False, "Reply consistency"), ("we_rate", True, "We-language"),
]


def composite(detail):
    people = [e for e in detail["entities"].values() if e["kind"] == "person"][:N_CLOSE]
    for key, hi, _ in COMPONENTS:
        vals = [(p["closeness_raw"].get(key), p) for p in people]
        ok = sorted(v for v, _ in vals if v is not None)
        for v, p in vals:
            if v is None:
                pr = None
            else:
                pr = (sum(x < v for x in ok) + 0.5 * (sum(x == v for x in ok) - 1)) / max(len(ok) - 1, 1)
                if not hi:
                    pr = 1 - pr
            p.setdefault("closeness", {"components": {}})["components"][key] = r3(pr)
    for p in people:
        comps = [v for v in p["closeness"]["components"].values() if v is not None]
        p["closeness"]["score"] = round(100 * float(np.mean(comps)), 1) if comps else None
    ranked = sorted(people, key=lambda p: -(p["closeness"]["score"] or 0))
    for i, p in enumerate(ranked, 1):
        p["closeness"]["rank"] = i
    detail["closeness_components"] = [{"key": k, "label": l, "higher_is_closer": h} for k, h, l in COMPONENTS]
    detail["closeness_people"] = [p["id"] for p in ranked]


if __name__ == "__main__":
    main()
