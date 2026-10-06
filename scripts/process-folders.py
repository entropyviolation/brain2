#!/usr/bin/env python3
"""
scripts/process-folders.py — Knock out folder photographs for the Lists tab.

Source: folders/ (the photographed set). Output: public/folders-removebackground/
+ lib/folders-manifest.ts.

Near-white studio plates use the same corner flood as gems, with a tight
threshold so cream paper survives. Gray, black, and gradient plates go through
rembg. Each cut-out is tight-cropped onto a square PNG, the same way orbs sit
on the velvet desktop.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "folders"
OUT = ROOT / "public" / "folders-removebackground"
MANIFEST = ROOT / "lib" / "folders-manifest.ts"
SIZE = 320
SOFT = 1.6
ALPHA_KEEP = 12
SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


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
            raise RuntimeError(f"could not open {path.name}")
        return Image.open(dest).convert("RGBA")


def fit_max_edge(im: Image.Image, max_edge: int = 900) -> Image.Image:
    w, h = im.size
    long = max(w, h)
    if long <= max_edge:
        return im
    scale = max_edge / long
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)


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
        d = float(dist[y, x])
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


def content_fraction(arr: np.ndarray) -> float:
    return float((arr[:, :, 3] > ALPHA_KEEP).mean())


def content_bbox(arr: np.ndarray):
    mask = arr[:, :, 3] > ALPHA_KEEP
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def square_png(arr: np.ndarray) -> Image.Image:
    bbox = content_bbox(arr)
    if bbox is None:
        im = Image.fromarray(arr, "RGBA")
        return im.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    minx, miny, maxx, maxy = bbox
    pad = max(2, int(round(max(maxx - minx, maxy - miny) * 0.04)))
    h, w = arr.shape[:2]
    minx = max(0, minx - pad)
    miny = max(0, miny - pad)
    maxx = min(w - 1, maxx + pad)
    maxy = min(h - 1, maxy + pad)
    crop = arr[miny : maxy + 1, minx : maxx + 1]
    ch, cw = crop.shape[:2]
    side = max(ch, cw)
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    dy = (side - ch) // 2
    dx = (side - cw) // 2
    canvas[dy : dy + ch, dx : dx + cw] = crop
    im = Image.fromarray(canvas, "RGBA")
    return im.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def rembg_cut(im: Image.Image, session) -> np.ndarray:
    from rembg import remove

    cut = remove(im, session=session)
    return np.array(cut.convert("RGBA"))


def corner_luma(arr: np.ndarray) -> float:
    h, w = arr.shape[:2]
    corners = np.array(
        [arr[0, 0, :3], arr[0, w - 1, :3], arr[h - 1, 0, :3], arr[h - 1, w - 1, :3]],
        dtype=np.float32,
    )
    bg = corners.mean(axis=0)
    return float(0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2])


def process_one(path: Path, session) -> str:
    im = fit_max_edge(load_rgba(path))
    arr = np.array(im)
    lum = corner_luma(arr)
    # Cream paper sits ~25 ΔE off white. A tight flood keeps the folder and
    # still clears a white plate. rembg eats that paper and leaves a ghost.
    if lum > 220:
        threshold = 16
    elif lum < 45:
        threshold = 42
    else:
        threshold = 52
    flooded = knock_out(arr, threshold)
    frac = content_fraction(flooded)
    # Floor is low on purpose: a small folder centered on a white plate is
    # only a few percent of the frame, and that cut-out is the one we want.
    if 0.035 <= frac <= 0.90:
        cut = flooded
        method = "flood"
    else:
        cut = rembg_cut(im, session)
        method = "rembg"
        rb = content_fraction(cut)
        if rb < 0.08 or rb > 0.96:
            cut = flooded
            method = "flood-fallback"
    square_png(cut).save(OUT / f"{path.stem}.png", "PNG", optimize=True)
    return method


def main() -> int:
    if not SRC.is_dir():
        print("missing folders/", file=sys.stderr)
        return 1
    from rembg import new_session

    OUT.mkdir(parents=True, exist_ok=True)
    session = new_session("u2net")
    sources = sorted(p for p in SRC.iterdir() if p.suffix.lower() in SUFFIXES and not p.name.startswith("."))
    notes = []
    for src in sources:
        method = process_one(src, session)
        notes.append(f"{src.name}: {method}")
        print(f"{method:16} {src.name}")
    names = sorted(p.name for p in OUT.glob("*.png"))
    body = "\n".join(f'  "{name}",' for name in names)
    note_js = json.dumps(notes, indent=2)
    MANIFEST.write_text(
        f"""/** Folder photographs for the Lists tab.
 *
 * Every PNG in `public/folders-removebackground/`. Source photos live in
 * `folders/`. Run `python3 scripts/process-folders.py` to refresh.
 * Assigned like orbs: `folderFor(id)` hashes the folder id into this list.
 *
 * Process notes:
 * {note_js}
 */
export const FOLDER_IMAGES: string[] = [
{body}
]
export const FOLDER_PATHS = FOLDER_IMAGES.map((f) => `/folders-removebackground/${{f}}`)
""",
        encoding="utf-8",
    )
    print(f"wrote {len(names)} cut-outs → {OUT.relative_to(ROOT)}")
    print("wrote", MANIFEST.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
