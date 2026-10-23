#!/usr/bin/env python3
"""Local app for the texts report: notes, labels and on-demand AI analysis.

  ~/texts-analysis/.venv/bin/python serve.py --home ~/texts-analysis [--port 8765] [--open]

Binds to 127.0.0.1 only. Serves out/ (report.html, threads/*.js) and a JSON API
backed by out/annotations.sqlite. "Analyze" jobs run one at a time against the
local Ollama model (see llm_pass.py). Nothing is sent off this Mac.
"""
import json
import sqlite3
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from texts_home import CODE, HOME as ROOT, _take
OUT = ROOT / "out"
DB = OUT / "annotations.sqlite"
HOST, PORT = "127.0.0.1", int(_take("--port") or 8765)
ENV = {**__import__("os").environ, "TEXTS_HOME": str(ROOT)}


def run_script(name, *args):
    return subprocess.run([sys.executable, str(CODE / name), *args], cwd=CODE, env=ENV, capture_output=True, text=True)


def slog(msg):
    with open(OUT / "serve.log", "a") as f:
        f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")

SCHEMA = """
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY, ent TEXT NOT NULL, start_mid INTEGER, end_mid INTEGER,
  start_epoch INTEGER, end_epoch INTEGER, note TEXT DEFAULT '', is_conflict INTEGER DEFAULT 0,
  sentiment INTEGER, ctype TEXT, tags TEXT DEFAULT '[]', parent_id INTEGER,
  created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY, cid TEXT, ent TEXT NOT NULL, start_mid INTEGER, end_mid INTEGER,
  start_epoch INTEGER, end_epoch INTEGER, label TEXT NOT NULL, source TEXT NOT NULL,
  annotation_id INTEGER, created TEXT);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY, scope TEXT NOT NULL, ent TEXT, ref TEXT, period_start TEXT, period_end TEXT,
  body TEXT DEFAULT '', created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, ent TEXT, ref TEXT, params TEXT, status TEXT NOT NULL,
  progress TEXT DEFAULT '', result TEXT, error TEXT, created TEXT, started TEXT, finished TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS topic_feedback (
  id INTEGER PRIMARY KEY, ent TEXT NOT NULL, topic TEXT NOT NULL, start_mid INTEGER, end_mid INTEGER,
  start_epoch INTEGER, end_epoch INTEGER, auto INTEGER, auto_hits INTEGER, n_msgs INTEGER, matched TEXT DEFAULT '[]',
  verdict TEXT, new_topic TEXT, note TEXT, theme_version TEXT, created TEXT);
"""
now = lambda: datetime.now().isoformat(timespec="seconds")
_db_lock = threading.Lock()


def db():
    con = sqlite3.connect(DB, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


CON = None


def q(sql, args=(), one=False):
    with _db_lock:
        cur = CON.execute(sql, args)
        CON.commit()
        rows = [dict(r) for r in cur.fetchall()]
        return (rows[0] if rows else None) if one else rows


def ins(table, d):
    if table in ENT_TABLES and d.get("ent"):
        d = {**d, "ent_ids": json.dumps(ent_ids_map().get(d["ent"]) or [])}
    keys = list(d)
    with _db_lock:
        cur = CON.execute(f"INSERT INTO {table} ({','.join(keys)}) VALUES ({','.join('?' * len(keys))})", [d[k] for k in keys])
        CON.commit()
        return cur.lastrowid


def upd(table, id_, d):
    with _db_lock:
        CON.execute(f"UPDATE {table} SET {','.join(k + '=?' for k in d)} WHERE id=?", [*d.values(), id_])
        CON.commit()


def state():
    if _ents["mtime"] != ((OUT / "detail.json").stat().st_mtime if (OUT / "detail.json").exists() else None):
        rehome()
    jobs = q("SELECT * FROM jobs ORDER BY id DESC LIMIT 200")
    for j in jobs:
        j["result"] = json.loads(j["result"]) if j["result"] else None
    for a in (anns := q("SELECT * FROM annotations ORDER BY start_epoch, id")):
        a["tags"] = json.loads(a["tags"] or "[]")
    for t in (topics := q("SELECT * FROM topic_feedback ORDER BY id")):
        t["matched"] = json.loads(t["matched"] or "[]")
    det = OUT / "detector.json"
    types = q("SELECT value FROM settings WHERE key='ctypes'", one=True)
    return {"annotations": anns, "labels": q("SELECT * FROM labels ORDER BY id"), "notes": q("SELECT * FROM notes ORDER BY id"),
            "jobs": jobs, "detector": json.loads(det.read_text()) if det.exists() else None,
            "ctypes": json.loads(types["value"]) if types else None, "topic_feedback": topics}


# ---------- stable keys ----------
# Entity ids (p01, g03) follow rank and shift when Brain2 links, merges or new texts reorder cards.
# Every saved row also keeps ent_ids: the person's numbers and emails, or a group's chat ids.
# rehome() points each row's ent at whichever current card holds those ids.
ENT_TABLES = ("annotations", "labels", "notes", "jobs", "topic_feedback")
_ents = {"mtime": None, "ids": {}}


def ent_ids_map():
    f = OUT / "detail.json"
    mt = f.stat().st_mtime if f.exists() else None
    if mt != _ents["mtime"]:
        ents = json.loads(f.read_text()).get("entities", {}) if f.exists() else {}
        _ents.update(mtime=mt, ids={eid: (e.get("handles") or [f"chat:{c}" for c in e.get("chat_ids") or []]) for eid, e in ents.items()})
    return _ents["ids"]


def rehome():
    ids = ent_ids_map()
    if not ids:
        return
    owner = {i: eid for eid, xs in ids.items() for i in xs}
    with _db_lock:
        for t in ENT_TABLES:
            for r in CON.execute(f"SELECT id, ent, ent_ids FROM {t} WHERE ent IS NOT NULL").fetchall():
                if not r["ent_ids"]:  # saved before stable keys: trust the card it was saved on
                    if ids.get(r["ent"]):
                        CON.execute(f"UPDATE {t} SET ent_ids=? WHERE id=?", (json.dumps(ids[r["ent"]]), r["id"]))
                    continue
                now_ent = next((owner[i] for i in json.loads(r["ent_ids"]) if i in owner), None)
                if now_ent and now_ent != r["ent"]:
                    CON.execute(f"UPDATE {t} SET ent=? WHERE id=?", (now_ent, r["id"]))
        CON.commit()


# ---------- detector refresh (debounced, in background) ----------
_det_timer = None


def refresh_detector():
    global _det_timer
    if _det_timer:
        _det_timer.cancel()
    _det_timer = threading.Timer(2.0, lambda: run_script("detector_eval.py"))
    _det_timer.daemon = True
    _det_timer.start()


# ---------- jobs ----------
_cancel = set()


def worker():
    import llm_jobs  # imported lazily so the server starts even if Ollama is down
    while True:
        j = q("SELECT * FROM jobs WHERE status='queued' ORDER BY id LIMIT 1", one=True)
        if not j:
            time.sleep(1.5)
            continue
        upd("jobs", j["id"], {"status": "running", "started": now(), "progress": "starting"})

        def progress(msg, jid=j["id"]):
            if jid in _cancel:
                raise llm_jobs.Cancelled()
            upd("jobs", jid, {"progress": msg})
        try:
            params = json.loads(j["params"] or "{}")
            ctx = {"annotations": q("SELECT * FROM annotations WHERE ent=?", (j["ent"],)),
                   "labels": q("SELECT * FROM labels WHERE ent=?", (j["ent"],)),
                   "notes": q("SELECT * FROM notes WHERE ent=?", (j["ent"],)),
                   "conflict_results": [r for r in q("SELECT ref, result FROM jobs WHERE kind='conflict' AND ent=? AND status='done' ORDER BY id", (j["ent"],))]}
            if j["kind"] == "conflict":
                res = llm_jobs.analyze_conflict(j["ent"], params, ctx, progress, fresh=params.get("regenerate", False))
            else:
                res = llm_jobs.analyze_relationship(j["ent"], params, ctx, progress, fresh=params.get("regenerate", False))
            res["generated"] = now()
            upd("jobs", j["id"], {"status": "done", "result": json.dumps(res, ensure_ascii=False), "finished": now(), "progress": "done"})
        except llm_jobs.Cancelled:
            upd("jobs", j["id"], {"status": "cancelled", "finished": now()})
        except Exception as e:  # keep the worker alive
            upd("jobs", j["id"], {"status": "error", "error": f"{type(e).__name__}: {e}", "finished": now()})
        _cancel.discard(j["id"])


# ---------- refresh pipeline (weekly, or POST /api/refresh) ----------
_refresh = {"running": False, "error": None, "step": None}
RUNS = OUT / "runs.json"


def runs():
    return json.loads(RUNS.read_text()) if RUNS.exists() else {"lastRun": None, "history": []}


def refresh_pipeline():
    _refresh.update(running=True, error=None)
    t0 = time.time()
    try:
        cache = ROOT / "data/cache_msgs.pkl"
        steps = [("copy + aggregates", "analyze.py", ("--fresh",)), ("calls", "calls.py", ("--fresh",)), ("per-person detail", "analyze2.py", ()), ("detector", "detector_eval.py", ()), ("report", "build_report.py", ())]
        for label, script, args in steps:
            _refresh["step"] = label
            slog(f"refresh: {label}")
            if script == "analyze2.py" and cache.exists():
                cache.unlink()  # rebuild from the fresh copy
            r = run_script(script, *args)
            if r.returncode and script == "calls.py":  # calls are extra; texts still update
                slog(f"refresh: calls skipped: {(r.stderr or r.stdout).strip()[-300:]}")
                continue
            if r.returncode:
                raise RuntimeError(f"{script} failed: {(r.stderr or r.stdout).strip().splitlines()[-1] if (r.stderr or r.stdout).strip() else r.returncode}")
        meta = json.loads((OUT / "summary.json").read_text())["meta"]
        rr = runs()
        rr["lastRun"] = now()
        rr["messages"] = meta["non_tapback_messages"]
        rr["range"] = {"from": meta["first"][:10], "to": meta["last"][:10]}
        rr["history"] = ([{"at": rr["lastRun"], "seconds": round(time.time() - t0), "messages": rr["messages"]}] + rr.get("history", []))[:52]
        RUNS.write_text(json.dumps(rr, indent=1))
        rehome()  # cards may have new ids now
        slog(f"refresh: done in {time.time() - t0:.0f}s")
    except Exception as e:
        _refresh["error"] = str(e)
        slog(f"refresh: error {e}")
    finally:
        _refresh.update(running=False, step=None)


def status():
    rr = runs()
    if not rr.get("range") and (OUT / "summary.json").exists():
        meta = json.loads((OUT / "summary.json").read_text())["meta"]
        rr.update(messages=meta["non_tapback_messages"], range={"from": meta["first"][:10], "to": meta["last"][:10]})
    return {"lastRun": rr.get("lastRun"), "running": _refresh["running"], "step": _refresh["step"], "messages": rr.get("messages"),
            "range": rr.get("range"), "error": _refresh["error"]}


# ---------- HTTP ----------
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(OUT), **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def _local_only(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        origin = self.headers.get("Origin")
        if host not in ("127.0.0.1", "localhost") or (origin and not origin.startswith(f"http://{host}:")):
            self._json({"error": "forbidden"}, 403)
            return False
        return True

    def do_GET(self):
        if not self._local_only():
            return
        if self.path in ("/", "/index.html"):
            self.path = "/report.html"
        if self.path == "/api/status":
            return self._json(status())
        if self.path == "/api/state":
            return self._json(state())
        if self.path == "/api/jobs":
            jobs = q("SELECT id, kind, ent, ref, status, progress, error, created, started, finished FROM jobs ORDER BY id DESC LIMIT 50")
            return self._json(jobs)
        return super().do_GET()

    def do_POST(self):
        if not self._local_only():
            return
        p, b = self.path, self._body()
        if p == "/api/refresh":
            if _refresh["running"]:
                return self._json({"started": False, **status()})
            _refresh["running"] = True  # claim it now so a second call is ignored
            threading.Thread(target=refresh_pipeline, daemon=True).start()
            time.sleep(0.05)
            return self._json({"started": True, **status()})
        if p == "/api/annotations":
            d = {k: b.get(k) for k in ("ent", "start_mid", "end_mid", "start_epoch", "end_epoch", "note", "is_conflict", "sentiment", "ctype", "parent_id")}
            d["tags"] = json.dumps(b.get("tags") or [])
            d["is_conflict"] = 1 if d["is_conflict"] else 0
            d["note"] = d["note"] or ""
            if b.get("id"):
                d.pop("ent"); d["updated"] = now()
                upd("annotations", b["id"], {k: v for k, v in d.items() if v is not None or k in ("sentiment", "ctype")})
                aid = b["id"]
            else:
                d["created"] = d["updated"] = now()
                aid = ins("annotations", d)
            # A conflict annotation is also a user label for the detector.
            existing = q("SELECT id FROM labels WHERE annotation_id=?", (aid,), one=True)
            if d.get("is_conflict") and not existing and not b.get("parent_id"):
                ins("labels", {"ent": b["ent"], "start_mid": b.get("start_mid"), "end_mid": b.get("end_mid"), "start_epoch": b.get("start_epoch"),
                               "end_epoch": b.get("end_epoch"), "label": "conflict", "source": "user", "annotation_id": aid, "created": now()})
                refresh_detector()
            elif not d.get("is_conflict") and existing:
                q("DELETE FROM labels WHERE id=?", (existing["id"],))
                refresh_detector()
            return self._json({"id": aid})
        if p == "/api/labels":
            q("DELETE FROM labels WHERE cid=? AND source='detector'", (b.get("cid"),)) if b.get("cid") else None
            if b.get("label") in ("conflict", "not_conflict"):
                lid = ins("labels", {"cid": b.get("cid"), "ent": b["ent"], "start_mid": b.get("start_mid"), "end_mid": b.get("end_mid"),
                                     "start_epoch": b.get("start_epoch"), "end_epoch": b.get("end_epoch"), "label": b["label"],
                                     "source": b.get("source", "detector"), "created": now()})
            else:
                lid = None  # "clear"
            refresh_detector()
            return self._json({"id": lid})
        if p == "/api/topics":
            # Append-only: every confirm, reject, change or comment is kept, so later training sees changes of mind too.
            if b.get("verdict") not in (None, "confirmed", "rejected", "changed", "added", "clear") or not b.get("ent") or not b.get("topic"):
                return self._json({"error": "bad topic feedback"}, 400)
            d = {k: b.get(k) for k in ("ent", "topic", "start_mid", "end_mid", "start_epoch", "end_epoch", "auto_hits", "n_msgs", "verdict", "new_topic", "note", "theme_version")}
            d.update(auto=1 if b.get("auto") else 0, matched=json.dumps(b.get("matched") or []), created=now())
            return self._json({"id": ins("topic_feedback", d)})
        if p == "/api/notes":
            d = {k: b.get(k) for k in ("scope", "ent", "ref", "period_start", "period_end", "body")}
            if b.get("id"):
                upd("notes", b["id"], {"body": d["body"] or "", "period_start": d["period_start"], "period_end": d["period_end"], "updated": now()})
                return self._json({"id": b["id"]})
            d["created"] = d["updated"] = now()
            return self._json({"id": ins("notes", d)})
        if p == "/api/jobs":
            jid = ins("jobs", {"kind": b["kind"], "ent": b["ent"], "ref": b.get("ref"), "params": json.dumps(b.get("params") or {}),
                               "status": "queued", "created": now()})
            return self._json({"id": jid})
        if p.startswith("/api/jobs/") and p.endswith("/cancel"):
            jid = int(p.split("/")[3])
            j = q("SELECT status FROM jobs WHERE id=?", (jid,), one=True)
            if j and j["status"] == "queued":
                upd("jobs", jid, {"status": "cancelled", "finished": now()})
            elif j and j["status"] == "running":
                _cancel.add(jid)
            return self._json({"ok": True})
        if p == "/api/settings":
            for k, v in b.items():
                q("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, json.dumps(v)))
            return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        if not self._local_only():
            return
        parts = self.path.strip("/").split("/")
        if len(parts) == 3 and parts[0] == "api" and parts[1] in ("annotations", "notes", "labels"):
            tid = int(parts[2])
            if parts[1] == "annotations":
                q("DELETE FROM labels WHERE annotation_id=?", (tid,))
                q("DELETE FROM annotations WHERE id=? OR parent_id=?", (tid, tid))
                refresh_detector()
            else:
                q(f"DELETE FROM {parts[1]} WHERE id=?", (tid,))
            return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)


def main():
    global CON
    OUT.mkdir(exist_ok=True)
    CON = db()
    CON.executescript(SCHEMA)
    for t in ENT_TABLES:
        if "ent_ids" not in {r[1] for r in CON.execute(f"PRAGMA table_info({t})")}:
            CON.execute(f"ALTER TABLE {t} ADD COLUMN ent_ids TEXT")
    CON.commit()
    rehome()

    # Rebuild so the page knows it's being served (it detects http: and enables the app layer).
    # Runs after the port is bound, so Brain2 sees /api/status straight away.
    def warm():
        run_script("build_report.py")
        if not (OUT / "detector.json").exists():
            refresh_detector()
    q("UPDATE jobs SET status='queued', progress='' WHERE status='running'")  # resume after a restart
    threading.Thread(target=worker, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), H)
    threading.Thread(target=warm, daemon=True).start()
    url = f"http://{HOST}:{PORT}/"
    print(f"Texts app on {url} (Ctrl+C to stop)")
    slog(f"serving {url} home={ROOT}")
    if "--open" in sys.argv:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
