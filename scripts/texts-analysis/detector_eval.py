#!/usr/bin/env python3
"""Score the rule-based conflict detector against your labels, and learn from them.

Labels come from out/annotations.sqlite (Confirm / Not a conflict on a detected
window, or a range you marked as Conflict yourself). Writes out/detector.json:
  precision  = confirmed / (confirmed + rejected) among reviewed detections
  recall     = share of your own marked conflicts that the detector also flagged
With 30+ labels of both kinds, fits a logistic-regression scorer on window features
and re-ranks every candidate by its probability ("model confidence").
"""
import json
import math
import sqlite3
from pathlib import Path

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from analyze2 import CONFLICT, tokenize
import llm_pass as L

from texts_home import HOME as ROOT
OUT = ROOT / "out"
FEAT_CACHE = OUT / "detector_features.json"
FEATURES = ["sentiment_drop", "both_negative", "neg_share", "keyword_rate", "reply_gap_ratio", "length_ratio", "late_night", "log_messages"]
sia = SentimentIntensityAnalyzer()


def window_features(msgs, a, b, base):
    w = [m for m in msgs[a:b + 1] if m[3]]
    if not w:
        return None
    comp = [sia.polarity_scores(m[3])["compound"] for m in w]
    me_neg = sum(1 for m, c in zip(w, comp) if m[1] and c < -0.3)
    th_neg = sum(1 for m, c in zip(w, comp) if not m[1] and c < -0.3)
    kw = sum(sum(t.replace("'", "") in CONFLICT for t in tokenize(m[3])) for m in w)
    gaps = [(w[i][0] - w[i - 1][0]) / 60 for i in range(1, len(w)) if w[i][1] != w[i - 1][1] and w[i][0] - w[i - 1][0] < 86400]
    from datetime import datetime
    h = datetime.fromtimestamp(w[0][0]).hour
    return {
        "sentiment_drop": base["sent"] - float(np.mean(comp)),
        "both_negative": float(min(me_neg, th_neg) >= 2),
        "neg_share": (me_neg + th_neg) / len(w),
        "keyword_rate": kw / len(w),
        "reply_gap_ratio": math.log((float(np.median(gaps)) + 0.1) / (base["gap"] + 0.1)) if gaps else 0.0,
        "length_ratio": math.log((np.mean([len(m[3]) for m in w]) + 1) / (base["len"] + 1)),
        "late_night": float(h < 5),
        "log_messages": math.log(len(w)),
    }


def baseline(msgs, ent_detail):
    rnd = np.random.default_rng(0)
    pick = [msgs[i] for i in rnd.choice(len(msgs), size=min(3000, len(msgs)), replace=False)] if msgs else []
    sent = float(np.mean([sia.polarity_scores(m[3])["compound"] for m in pick if m[3]])) if pick else 0.0
    gap = (ent_detail.get("replies") or {}).get("median_all") or 1.0
    ln = np.mean([len(m[3]) for m in pick if m[3]]) if pick else 30
    return {"sent": sent, "gap": gap, "len": float(ln)}


def main():
    cand = json.loads((OUT / "conflict_candidates.json").read_text())["candidates"]
    det = json.loads((OUT / "detail.json").read_text())
    con = sqlite3.connect(OUT / "annotations.sqlite")
    con.row_factory = sqlite3.Row
    labels = [dict(r) for r in con.execute("SELECT * FROM labels")]
    cache = json.loads(FEAT_CACHE.read_text()) if FEAT_CACHE.exists() else {}

    threads, bases = {}, {}
    def thread(eid):
        if eid not in threads:
            t = L.load_thread(eid)
            threads[eid] = (t["msgs"], {m[4]: i for i, m in enumerate(t["msgs"])})
            bases[eid] = cache.get("_base_" + eid) or baseline(t["msgs"], det["entities"].get(eid, {}))
            cache["_base_" + eid] = bases[eid]
        return threads[eid]

    def feats_for(key, eid, mids):
        if key in cache:
            return cache[key]
        msgs, idx = thread(eid)
        ii = [idx[m] for m in mids if m in idx]
        if not ii:
            return None
        f = window_features(msgs, min(ii), max(ii), bases[eid])
        cache[key] = f
        return f

    cfeat = {c["cid"]: feats_for(c["cid"], c["ent"], c["message_ids"]) for c in cand}
    by_cid = {l["cid"]: l for l in labels if l["cid"] and l["source"] == "detector"}
    confirmed = sum(1 for l in by_cid.values() if l["label"] == "conflict")
    rejected = sum(1 for l in by_cid.values() if l["label"] == "not_conflict")
    user = [l for l in labels if l["source"] == "user" and l["label"] == "conflict"]

    def overlaps(l):
        return any(c["ent"] == l["ent"] and c["start_epoch"] <= (l["end_epoch"] or 0) and
                   (c.get("end_epoch") or c["start_epoch"] + 6 * 3600) >= (l["start_epoch"] or 0) for c in cand)
    from datetime import datetime
    for c in cand:
        c["end_epoch"] = int(datetime.fromisoformat(c["end"]).timestamp())
    caught = sum(1 for l in user if overlaps(l))

    X, y = [], []
    for cid, l in by_cid.items():
        if cfeat.get(cid):
            X.append([cfeat[cid][k] for k in FEATURES]); y.append(1 if l["label"] == "conflict" else 0)
    for l in user:  # a user range covers every message between its first and last id
        if l["start_mid"] and l["end_mid"]:
            f = feats_for(f"user_{l['id']}_{l['start_mid']}_{l['end_mid']}", l["ent"], [l["start_mid"], l["end_mid"]])
            if f:
                X.append([f[k] for k in FEATURES]); y.append(1)

    out = {"n_labels": len(y), "confirmed": confirmed, "rejected": rejected, "user_marked": len(user),
           "precision": round(confirmed / (confirmed + rejected), 3) if confirmed + rejected else None,
           "recall_user": round(caught / len(user), 3) if user else None, "user_missed": len(user) - caught,
           "candidates": len(cand), "model_trained": False, "features": FEATURES, "scores": {}}
    if len(y) >= 30 and 0 < sum(y) < len(y):
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
        sc = StandardScaler().fit(X)
        lr = LogisticRegression(class_weight="balanced", max_iter=1000).fit(sc.transform(X), y)
        rows = [(cid, f) for cid, f in cfeat.items() if f]
        p = lr.predict_proba(sc.transform([[f[k] for k in FEATURES] for _, f in rows]))[:, 1]
        out.update({"model_trained": True, "coef": {k: round(float(w), 3) for k, w in zip(FEATURES, lr.coef_[0])},
                    "scores": {cid: round(float(v), 3) for (cid, _), v in zip(rows, p)}})
    FEAT_CACHE.write_text(json.dumps(cache))
    (OUT / "detector.json").write_text(json.dumps(out, indent=1))
    print(f"labels {out['n_labels']} | precision {out['precision']} | recall {out['recall_user']} | model {'on' if out['model_trained'] else 'off (needs 30 labels)'}")


if __name__ == "__main__":
    main()
