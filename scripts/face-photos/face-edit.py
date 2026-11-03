#!/usr/bin/env python3
"""FaceApp-style batch edit through ComfyUI + Qwen-Image-Edit 2509.

Runs qwen-face-edit.api.json once per photo per edit, against a running ComfyUI.

    python3 scripts/face-photos/face-edit.py IN_DIR OUT_DIR --edit smile --edit older
    python3 scripts/face-photos/face-edit.py IN_DIR OUT_DIR --prompt "give them a short black bob haircut"

COMFY_URL defaults to Comfy Desktop's http://127.0.0.1:8188.
"""
import argparse
import copy
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMFY = os.environ.get("COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
KEEP = " Keep the same person, identity, face shape, hair, clothes, lighting, framing and background."

# One-word presets. Each is a plain Qwen edit instruction.
PRESETS = {
    "smile": "Make the person smile naturally with teeth showing.",
    "neutral": "Give the person a relaxed, neutral expression with closed lips.",
    "older": "Age the person by about 25 years: grey hair, natural wrinkles, slightly thinner skin.",
    "younger": "Make the person look about 15 years younger, with smoother skin and fuller cheeks.",
    "no-glasses": "Remove the glasses from the person's face.",
    "glasses": "Give the person thin silver wire-frame glasses.",
    "beard": "Give the person a short, neat full beard.",
    "clean-shaven": "Remove all facial hair; make the person clean-shaven.",
    "short-hair": "Give the person a short, tidy haircut.",
    "long-hair": "Give the person long, straight shoulder-length hair.",
    "makeup": "Add soft natural makeup: even skin, light blush, defined brows, subtle lip color.",
    "retouch": "Lightly retouch the skin: remove blemishes and shine, keep natural texture and pores.",
    "studio": "Relight the photo as a soft studio portrait with a plain light grey backdrop.",
}

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def http(path, data=None, headers=None):
    req = urllib.request.Request(COMFY + path, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def upload(photo: Path) -> str:
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{photo.name}\"\r\n"
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + photo.read_bytes() + (
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n"
    ).encode()
    res = json.loads(http("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}))
    return f"{res['subfolder']}/{res['name']}" if res.get("subfolder") else res["name"]


def run(graph, client_id):
    body = json.dumps({"prompt": graph, "client_id": client_id}).encode()
    res = json.loads(http("/prompt", body, {"Content-Type": "application/json"}))
    if res.get("node_errors"):
        sys.exit(f"ComfyUI rejected the graph: {json.dumps(res['node_errors'], indent=1)}")
    pid = res["prompt_id"]
    while True:
        hist = json.loads(http(f"/history/{pid}"))
        if pid in hist:
            entry = hist[pid]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                msgs = [m for m in status.get("messages", []) if m[0] == "execution_error"]
                sys.exit(f"ComfyUI error: {msgs[-1][1].get('exception_message') if msgs else status}")
            return [img for out in entry["outputs"].values() for img in out.get("images", [])]
        time.sleep(1.5)


def fetch(img) -> bytes:
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
    return http(f"/view?{q}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path, help="photo or folder of photos")
    ap.add_argument("dst", type=Path)
    ap.add_argument("--edit", action="append", default=[], choices=sorted(PRESETS), help="preset; repeatable")
    ap.add_argument("--prompt", action="append", default=[], help="free-text instruction; repeatable")
    ap.add_argument("--steps", type=int, default=20, help="20 for the base model, 4 or 8 with a Lightning LoRA")
    ap.add_argument("--cfg", type=float, default=2.5)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--megapixels", type=float, default=1.0)
    args = ap.parse_args()

    edits = [(name, PRESETS[name]) for name in args.edit]
    edits += [(f"prompt{i + 1}", p) for i, p in enumerate(args.prompt)]
    if not edits:
        ap.error("give at least one --edit or --prompt")

    photos = [args.src] if args.src.is_file() else sorted(p for p in args.src.iterdir() if p.suffix.lower() in IMAGE_EXT)
    if not photos:
        sys.exit(f"no photos in {args.src}")
    try:
        http("/system_stats")
    except OSError as e:
        sys.exit(f"ComfyUI is not reachable at {COMFY} ({e}). Start Comfy Desktop or set COMFY_URL.")

    base = json.loads((HERE / "qwen-face-edit.api.json").read_text())
    args.dst.mkdir(parents=True, exist_ok=True)
    client_id = uuid.uuid4().hex

    for n, photo in enumerate(photos, 1):
        name = upload(photo)
        for label, instruction in edits:
            g = copy.deepcopy(base)
            g["1"]["inputs"]["image"] = name
            g["2"]["inputs"]["megapixels"] = args.megapixels
            g["8"]["inputs"]["prompt"] = instruction + KEEP
            g["11"]["inputs"].update(steps=args.steps, cfg=args.cfg, seed=args.seed)
            t = time.time()
            imgs = run(g, client_id)
            out = args.dst / f"{photo.stem}__{label}.png"
            out.write_bytes(fetch(imgs[0]))
            print(f"[{n}/{len(photos)}] {photo.name} {label} -> {out} ({time.time() - t:.0f}s)")


if __name__ == "__main__":
    main()
