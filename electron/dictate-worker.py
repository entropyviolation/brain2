"""
electron/dictate-worker.py — Warm Whisper for desktop dictation

Spawned once by `electron/dictate.js`. Loads the model one time, then reads
one JSON request per stdin line: {"id": n, "path": "/tmp/.../in.webm"}.
Writes one JSON reply per stdout line: {"id": n, "text": "..."} or
{"id": n, "error": "..."}. The first line out is {"ready": true}.
A warm `base` pass on a short line takes about 0.3 s, which is what makes
live partial text possible.
"""
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")


def send(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main():
    import whisper  # noqa: E402  (slow import, after the warnings filter)

    model = whisper.load_model(os.environ.get("BRAIN2_DICTATE_WHISPER_MODEL", "base"))
    lang = os.environ.get("BRAIN2_DICTATE_LANGUAGE", "en")
    send({"ready": True})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            opts = {"fp16": False, "task": "transcribe"}
            if lang != "auto":
                opts["language"] = lang
            result = model.transcribe(req["path"], **opts)
            send({"id": req_id, "text": " ".join(str(result.get("text", "")).split())})
        except Exception as error:  # one bad clip must not end the worker
            send({"id": req_id, "error": str(error)})


if __name__ == "__main__":
    main()
