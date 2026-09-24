#!/usr/bin/env python3
"""
scripts/process-friend-pack.py — Preapproved today's-friend pictures

Source: animalsrcs/ (user-picked, hashed filenames). Output: public/friend-pack/
+ lib/friend-pack-manifest.ts.

Knock out the backdrop only when it is a studio / product plate (uniform white,
black, or gray border). Keep sand, snow, towels, rooms, rocks, and other scenes.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "animalsrcs"
OUT = ROOT / "public" / "friend-pack"
MANIFEST = ROOT / "lib" / "friend-pack-manifest.ts"
MAX_EDGE = 480
SOFT = 1.55
ALPHA_KEEP = 10


def color_distance(rgb, bg):
    d = rgb.astype(np.float32) - bg
    return np.sqrt(np.sum(d * d, axis=-1))


def load_rgba(path: Path) -> Image.Image:
    try:
        im = Image.open(path)
        im.load()
        return im.convert("RGBA")
    except Exception:
        pass
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "frame.png"
        r = subprocess.run(
            ["sips", "-s", "format", "png", str(path), "--out", str(dest)],
            capture_output=True,
        )
        if r.returncode != 0 or not dest.exists():
            raise RuntimeError(f"could not open {path.name}: {r.stderr.decode()[:200]}")
        return Image.open(dest).convert("RGBA")


def fit_max_edge(im: Image.Image, max_edge: int = MAX_EDGE) -> Image.Image:
    w, h = im.size
    long = max(w, h)
    if long <= max_edge:
        return im
    scale = max_edge / long
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)


def border_stats(arr: np.ndarray):
    h, w = arr.shape[:2]
    band = max(2, int(round(min(h, w) * 0.045)))
    mask = np.zeros((h, w), dtype=bool)
    mask[:band, :] = True
    mask[-band:, :] = True
    mask[:, :band] = True
    mask[:, -band:] = True
    pix = arr[:, :, :3][mask].astype(np.float32)
    med = np.median(pix, axis=0)
    spread = float(np.mean(np.sqrt(np.sum((pix - med) ** 2, axis=1))))
    lum = float(0.2126 * med[0] + 0.7152 * med[1] + 0.0722 * med[2])
    return med, spread, lum


def is_studio_plate(arr: np.ndarray) -> bool:
    """True when a cutout will look better than the original plate.

    Snow, towels, and rooms have high-luma borders with texture (spread).
    Product / cardboard plates are nearly flat white or black.
    """
    _med, spread, lum = border_stats(arr)
    if spread < 16:
        return True
    if spread < 22 and lum > 248:
        return True
    if spread < 18 and lum < 22:
        return True
    return False


def knock_out(arr: np.ndarray, threshold: float) -> np.ndarray:
    h, w = arr.shape[:2]
    corners = np.array(
        [
            arr[0, 0, :3],
            arr[0, w - 1, :3],
            arr[h - 1, 0, :3],
            arr[h - 1, w - 1, :3],
        ],
        dtype=np.float32,
    )
    bg = corners.mean(axis=0)
    dist = color_distance(arr[:, :, :3], bg)
    reach = threshold * SOFT
    out = arr.copy()
    seen = np.zeros((h, w), dtype=np.uint8)
    q = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    for x, y in list(q):
        seen[y, x] = 1
    while q:
        x, y = q.popleft()
        d = dist[y, x]
        if d >= reach:
            continue
        if d < threshold:
            out[y, x, 3] = 0
        else:
            t = (d - threshold) / (threshold * 0.6)
            out[y, x, 3] = int(round(max(0.0, min(1.0, t)) * out[y, x, 3]))
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or seen[ny, nx]:
                continue
            seen[ny, nx] = 1
            q.append((nx, ny))
    return out


def choose_threshold(lum: float) -> float:
    if lum > 210:
        return 44
    if lum < 35:
        return 52
    return 58


def content_fraction(arr: np.ndarray) -> float:
    return float((arr[:, :, 3] > ALPHA_KEEP).mean())


def pack_id(name: str) -> str:
    return "pack-" + hashlib.md5(name.encode("utf-8")).hexdigest()[:12]


def process_one(path: Path) -> dict:
    im = fit_max_edge(load_rgba(path))
    arr = np.array(im)
    med, spread, lum = border_stats(arr)
    studio = is_studio_plate(arr)
    knocked = False
    if studio:
        cut = knock_out(arr, choose_threshold(lum))
        frac = content_fraction(cut)
        if 0.08 <= frac <= 0.92:
            arr = cut
            knocked = True
    out_name = hashlib.md5(path.name.encode("utf-8")).hexdigest()[:16] + ".png"
    Image.fromarray(arr, "RGBA").save(OUT / out_name, "PNG", optimize=True)
    return {
        "id": pack_id(path.name),
        "file": out_name,
        "source": path.name,
        "knock": knocked,
        "spread": round(spread, 1),
        "lum": round(lum, 1),
    }


def main() -> int:
    if not SRC.is_dir():
        print("missing animalsrcs/", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    rows = []
    files = sorted(
        [p for p in SRC.iterdir() if p.is_file() and not p.name.startswith(".")],
        key=lambda p: p.name.lower(),
    )
    for path in files:
        try:
            row = process_one(path)
            rows.append(row)
            flag = "knock" if row["knock"] else "keep "
            print(f"{flag}  spread={row['spread']:5.1f} lum={row['lum']:5.1f}  {path.name}")
        except Exception as exc:
            print(f"skip {path.name}: {exc}", file=sys.stderr)
    slim = [{k: row[k] for k in ("id", "file", "source", "knock")} for row in rows]
    body = json.dumps(slim, indent=2)
    MANIFEST.write_text(
        "/** Preapproved today's-friend pictures from `animalsrcs/`.\n"
        " *  Processed by `python3 scripts/process-friend-pack.py` into `public/friend-pack/`.\n"
        " *  `knock` means a studio plate was removed; scenes keep their backdrop.\n"
        " */\n"
        "export type FriendPackEntry = {\n"
        "  id: string\n"
        "  file: string\n"
        "  source: string\n"
        "  knock: boolean\n"
        "}\n\n"
        f"export const FRIEND_PACK: FriendPackEntry[] = {body}\n",
        encoding="utf-8",
    )
    print(f"wrote {len(rows)} files → {OUT.relative_to(ROOT)}")
    print(f"knocked {sum(1 for r in rows if r['knock'])} / kept {sum(1 for r in rows if not r['knock'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
