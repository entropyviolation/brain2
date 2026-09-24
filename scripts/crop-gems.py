#!/usr/bin/env python3
"""
scripts/crop-gems.py — Tight-crop every PNG in public/gems-removebackground/.

Trims to the alpha bounding box of the stone, then adds ~3% padding so
specular edges are not clipped. Overwrites in place. No stretch / no resize.
Repeatable: already-tight files are left alone.

Run: python3 scripts/crop-gems.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "gems-removebackground"
PAD_FRAC = 0.03
ALPHA_MIN = 8


def alpha_bbox(arr: np.ndarray, alpha_min: int = ALPHA_MIN) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(arr[:, :, 3] > alpha_min)
    if xs.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def padded_box(
    bbox: tuple[int, int, int, int],
    width: int,
    height: int,
    pad_frac: float = PAD_FRAC,
) -> tuple[int, int, int, int]:
    minx, miny, maxx, maxy = bbox
    bw = maxx - minx + 1
    bh = maxy - miny + 1
    pad_x = max(1, int(round(bw * pad_frac)))
    pad_y = max(1, int(round(bh * pad_frac)))
    return (
        max(0, minx - pad_x),
        max(0, miny - pad_y),
        min(width - 1, maxx + pad_x),
        min(height - 1, maxy + pad_y),
    )


def fill_ratio(arr: np.ndarray, alpha_min: int = ALPHA_MIN) -> float:
    h, w = arr.shape[:2]
    if h == 0 or w == 0:
        return 0.0
    return float((arr[:, :, 3] > alpha_min).mean())


def crop_png(path: Path, pad_frac: float = PAD_FRAC, alpha_min: int = ALPHA_MIN) -> dict:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    before_w, before_h = im.size
    before_fill = fill_ratio(arr, alpha_min)
    bbox = alpha_bbox(arr, alpha_min)
    if bbox is None:
        return {
            "name": path.name,
            "changed": False,
            "before": (before_w, before_h),
            "after": (before_w, before_h),
            "before_fill": before_fill,
            "after_fill": before_fill,
        }
    left, top, right, bottom = padded_box(bbox, before_w, before_h, pad_frac)
    if left == 0 and top == 0 and right == before_w - 1 and bottom == before_h - 1:
        return {
            "name": path.name,
            "changed": False,
            "before": (before_w, before_h),
            "after": (before_w, before_h),
            "before_fill": before_fill,
            "after_fill": before_fill,
        }
    cropped = arr[top : bottom + 1, left : right + 1]
    Image.fromarray(cropped, "RGBA").save(path, "PNG", optimize=True)
    after_h, after_w = cropped.shape[:2]
    return {
        "name": path.name,
        "changed": True,
        "before": (before_w, before_h),
        "after": (after_w, after_h),
        "before_fill": before_fill,
        "after_fill": fill_ratio(cropped, alpha_min),
    }


def crop_folder(folder: Path = OUT) -> list[dict]:
    rows: list[dict] = []
    for path in sorted(folder.glob("*.png")):
        rows.append(crop_png(path))
    return rows


def main() -> None:
    rows = crop_folder(OUT)
    changed = [row for row in rows if row["changed"]]
    print(f"gems: {len(rows)}  cropped: {len(changed)}  already tight: {len(rows) - len(changed)}")
    sample = sorted(rows, key=lambda row: row["before_fill"])[:8]
    print("loosest before → after (px, fill):")
    for row in sample:
        bw, bh = row["before"]
        aw, ah = row["after"]
        print(
            f"  {row['name']}: {bw}×{bh} ({row['before_fill']:.1%}) → {aw}×{ah} ({row['after_fill']:.1%})"
        )


if __name__ == "__main__":
    main()
