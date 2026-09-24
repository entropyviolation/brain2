#!/usr/bin/env python3
"""
scripts/process-gems.py — Knock out gem photo backgrounds (same pipeline as
lib/remove-background.ts) and split plural contact sheets into per-stone PNGs.

Source: gems/ (kept as input). Output: public/gems-removebackground/ +
lib/gems-manifest.ts.

Plural filenames (gems1.jpg, gems2.jpg, …) are contact sheets. After knockout,
4-connected components that look like individual stones are cropped. The whole
sheet cutout is written and stays in the catalog with every other PNG in the
output folder (including extra hashed stones). Extra files are not deleted.
After write, `crop-gems.py` tight-crops every PNG to its alpha box.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
import sys
from pathlib import Path

from collections import deque

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "gems"
OUT = ROOT / "public" / "gems-removebackground"
MANIFEST = ROOT / "lib" / "gems-manifest.ts"
SIZE = 256
THRESHOLD = 60
SOFT = 1.6
ALPHA_KEEP = 10


def color_distance(rgb, bg):
    d = rgb.astype(np.float32) - bg
    return np.sqrt(np.sum(d * d, axis=-1))


def background_luma(arr: np.ndarray) -> float:
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
    return float(0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2])


def choose_threshold(arr: np.ndarray) -> float:
    luma = background_luma(arr)
    # Pale stones on white need a tighter wand or the star tunnels in.
    if luma > 210:
        return 42
    if luma < 35:
        return 55
    return 60


def knock_out(arr: np.ndarray, threshold: float = THRESHOLD) -> np.ndarray:
    """Flood from the four corners so interior highlights stay. Mirrors TS."""
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


def content_bbox(arr: np.ndarray):
    mask = arr[:, :, 3] > ALPHA_KEEP
    if mask.sum() < arr.shape[0] * arr.shape[1] * 0.01:
        return 0, 0, arr.shape[1] - 1, arr.shape[0] - 1
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def square_png(arr: np.ndarray, bbox=None) -> Image.Image:
    if bbox is None:
        bbox = content_bbox(arr)
    minx, miny, maxx, maxy = bbox
    crop = arr[miny : maxy + 1, minx : maxx + 1]
    ch, cw = crop.shape[:2]
    side = max(ch, cw)
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    dy = (side - ch) // 2
    dx = (side - cw) // 2
    canvas[dy : dy + ch, dx : dx + cw] = crop
    im = Image.fromarray(canvas, "RGBA")
    return im.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def connected_components(arr: np.ndarray, min_area_frac=0.0018, min_area=80):
    h, w = arr.shape[:2]
    mask = arr[:, :, 3] > ALPHA_KEEP
    min_area = max(min_area, int(h * w * min_area_frac))
    seen = np.zeros((h, w), dtype=np.uint8)
    blobs = []
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if seen[y, x] or not row[x]:
                continue
            stack = [(x, y)]
            seen[y, x] = 1
            minx = maxx = x
            miny = maxy = y
            area = 0
            while stack:
                cx, cy = stack.pop()
                area += 1
                if cx < minx:
                    minx = cx
                if cy < miny:
                    miny = cy
                if cx > maxx:
                    maxx = cx
                if cy > maxy:
                    maxy = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    if seen[ny, nx] or not mask[ny, nx]:
                        continue
                    seen[ny, nx] = 1
                    stack.append((nx, ny))
            if area < min_area:
                continue
            bw = maxx - minx + 1
            bh = maxy - miny + 1
            aspect = bw / max(bh, 1)
            fill = area / max(bw * bh, 1)
            # Reject leftover fabric strips and slivers; stones are compact ovals.
            if aspect > 2.8 or aspect < 0.36 or fill < 0.38:
                continue
            blobs.append((minx, miny, maxx, maxy, area))
    blobs.sort(key=lambda b: (b[1], b[0]))
    return blobs


def is_plural_sheet(stem: str) -> bool:
    return bool(re.match(r"^gems\d*$", stem, re.I))


def write_png(im: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Keep extra cutouts (hashed stones, uploads). Overwrite source-derived names only.

    picker: list[str] = []
    sheets: list[str] = []
    notes: list[str] = []

    sources = sorted(p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    for src in sources:
        im = Image.open(src).convert("RGBA")
        arr = np.array(im)
        threshold = choose_threshold(arr)
        knocked = knock_out(arr, threshold)
        opaque = float((knocked[:, :, 3] > ALPHA_KEEP).mean())
        if opaque > 0.72:
            knocked = knock_out(arr, threshold + 30)
        stem = src.stem
        whole_name = f"{stem}.png"
        if not is_plural_sheet(stem):
            blobs = connected_components(knocked, min_area_frac=0.0008, min_area=40)
            if blobs:
                largest = max(blobs, key=lambda b: b[4])
                write_png(square_png(knocked, largest[:4]), OUT / whole_name)
            else:
                write_png(square_png(knocked), OUT / whole_name)
            picker.append(whole_name)
            notes.append(f"{src.name}: single-stone knockout → {whole_name}.")
            continue
        write_png(square_png(knocked), OUT / whole_name)
        sheets.append(whole_name)
        blobs = connected_components(knocked)
        sheet_area = arr.shape[0] * arr.shape[1]
        stones = [b for b in blobs if b[4] < sheet_area * 0.45]
        if len(stones) < 2:
            notes.append(
                f"{src.name}: split unreliable ({len(blobs)} blob(s)); sheet cutout kept, no per-stone files."
            )
            picker.append(whole_name)
            continue
        pad = 4
        h, w = knocked.shape[:2]
        written = 0
        for i, (minx, miny, maxx, maxy, _area) in enumerate(stones, 1):
            bx = max(0, minx - pad), max(0, miny - pad), min(w - 1, maxx + pad), min(h - 1, maxy + pad)
            name = f"{stem}-{i:02d}.png"
            write_png(square_png(knocked, bx), OUT / name)
            picker.append(name)
            written += 1
        notes.append(f"{src.name}: knocked out sheet + extracted {written} stones.")

    sheets = sorted(set(sheets))
    # Catalog is every PNG in the folder — source stones, sheets, and extras.
    picker = sorted(p.name for p in OUT.glob("*.png"))
    body = "\n".join(f'  "{name}",' for name in picker)
    sheet_body = "\n".join(f'  "{name}",' for name in sheets)
    note_js = json.dumps(notes, indent=2)
    MANIFEST.write_text(
        f"""/** Gem gallery: every PNG in `public/gems-removebackground/`.
 *
 * Source photos live in `gems/`. Run `python3 scripts/process-gems.py` to refresh
 * source-derived files. Extra cutouts already in the folder stay in the catalog.
 * Whole-sheet PNGs stay in the picker too.
 *
 * Process notes:
 * {note_js}
 */
export const GEM_IMAGES: string[] = [
{body}
]
export const GEM_SHEET_IMAGES: string[] = [
{sheet_body}
]
export const GEM_PATHS = GEM_IMAGES.map((f) => `/gems-removebackground/${{f}}`)
export const GEM_SHEET_PATHS = GEM_SHEET_IMAGES.map((f) => `/gems-removebackground/${{f}}`)
""",
        encoding="utf-8",
    )
    print(f"picker gems: {len(picker)}")
    print(f"sheet cutouts: {len(sheets)}")
    for n in notes:
        print(" -", n)
    print("wrote", MANIFEST.relative_to(ROOT))

    subprocess.check_call([sys.executable, str(Path(__file__).resolve().parent / "crop-gems.py")])


if __name__ == "__main__":
    main()
