#!/usr/bin/env python3
"""Score a folder of portrait photos and copy them into ranked folders.

    python3 scripts/face-photos/score-sort.py IN_DIR OUT_DIR
    python3 scripts/face-photos/score-sort.py IN_DIR OUT_DIR --buckets 3 --face-model my_scorer.onnx

Per photo, on the largest face:
  aesthetic  LAION improved aesthetic predictor (CLIP ViT-L/14 + MLP), whole photo
  sharp      Laplacian variance of the face crop (focus / motion blur)
  eyes       eye aspect ratio from 68 landmarks (closed eyes score low)
  frontal    how close yaw/pitch are to facing the camera
  size       face area as a share of the frame
  face_model optional: your own ONNX scorer on the face crop (e.g. trained on your likes)

Each signal becomes a percentile within this batch, then a weighted mean, 0-100.
Originals are never moved or changed; they are copied. scores.csv lists every number.
First run downloads InsightFace buffalo_l (~300MB) and CLIP ViT-L/14 (~1.7GB).
"""
import argparse
import csv
import shutil
import sys
import warnings
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

warnings.filterwarnings("ignore")
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic"}
WEIGHTS = {"aesthetic": 0.35, "sharp": 0.2, "eyes": 0.15, "frontal": 0.1, "size": 0.2, "face_model": 0.5}


def load_rgb(path: Path):
    if path.suffix.lower() == ".heic":
        try:
            import pillow_heif
            pillow_heif.register_heif_opener()
        except ImportError:
            return None
    try:
        return np.asarray(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))
    except Exception:
        return None


class Aesthetic:
    """LAION 'improved aesthetic predictor': normalized CLIP L/14 embedding -> MLP -> ~1..10."""

    def __init__(self, device):
        import torch
        from huggingface_hub import hf_hub_download
        from transformers import CLIPModel, CLIPProcessor

        self.torch, self.device = torch, device
        self.clip = CLIPModel.from_pretrained("openai/clip-vit-large-patch14").to(device).eval()
        self.proc = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
        nn = torch.nn
        self.mlp = nn.Sequential(
            nn.Linear(768, 1024), nn.Dropout(0.2), nn.Linear(1024, 128), nn.Dropout(0.2),
            nn.Linear(128, 64), nn.Dropout(0.1), nn.Linear(64, 16), nn.Linear(16, 1),
        )
        sd = torch.load(
            hf_hub_download("camenduru/improved-aesthetic-predictor", "sac+logos+ava1-l14-linearMSE.pth"),
            map_location="cpu",
            weights_only=True,
        )
        self.mlp.load_state_dict({k.removeprefix("layers."): v for k, v in sd.items()})
        self.mlp.to(device).eval()

    def __call__(self, rgb) -> float:
        with self.torch.no_grad():
            px = self.proc(images=Image.fromarray(rgb), return_tensors="pt")["pixel_values"].to(self.device)
            emb = self.clip.get_image_features(pixel_values=px)
            emb = emb / emb.norm(dim=-1, keepdim=True)
            return float(self.mlp(emb.float()))


class FaceModel:
    """Your own ONNX scorer: input 1x3x224x224 RGB, ImageNet-normalized; output one number."""

    def __init__(self, path):
        import onnxruntime as ort
        self.sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        self.name = self.sess.get_inputs()[0].name

    def __call__(self, face_rgb) -> float:
        x = cv2.resize(face_rgb, (224, 224)).astype(np.float32) / 255
        x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        return float(np.ravel(self.sess.run(None, {self.name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0])[0])


def eye_ratio(lm68) -> float:
    def ear(p):
        return (np.linalg.norm(p[1] - p[5]) + np.linalg.norm(p[2] - p[4])) / (2 * np.linalg.norm(p[0] - p[3]) + 1e-6)
    return (ear(lm68[36:42, :2]) + ear(lm68[42:48, :2])) / 2


def crop(rgb, bbox, pad=0.25):
    h, w = rgb.shape[:2]
    x1, y1, x2, y2 = bbox
    px, py = (x2 - x1) * pad, (y2 - y1) * pad
    x1, y1 = max(0, int(x1 - px)), max(0, int(y1 - py))
    x2, y2 = min(w, int(x2 + px)), min(h, int(y2 + py))
    return rgb[y1:y2, x1:x2]


def percentile(values):
    """Rank each value within the batch, 0..1. None stays None."""
    known = sorted(v for v in values if v is not None)
    if len(known) < 2:
        return [None if v is None else 0.5 for v in values]
    return [None if v is None else np.searchsorted(known, v, side="right") / len(known) for v in values]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path)
    ap.add_argument("dst", type=Path)
    ap.add_argument("--buckets", type=int, default=5, help="ranked folders, best first")
    ap.add_argument("--face-model", type=Path, help="optional ONNX face scorer")
    ap.add_argument("--no-aesthetic", action="store_true", help="skip the CLIP download and aesthetic score")
    ap.add_argument("--min-face", type=float, default=0.005, help="ignore faces smaller than this share of the frame")
    args = ap.parse_args()

    photos = sorted(p for p in args.src.rglob("*") if p.suffix.lower() in IMAGE_EXT)
    if not photos:
        sys.exit(f"no photos in {args.src}")

    from insightface.app import FaceAnalysis
    faces = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"],
                         allowed_modules=["detection", "landmark_3d_68"])
    faces.prepare(ctx_id=-1, det_size=(640, 640))

    aesthetic = None
    if not args.no_aesthetic:
        import torch
        aesthetic = Aesthetic("mps" if torch.backends.mps.is_available() else "cpu")
    face_model = FaceModel(args.face_model) if args.face_model else None

    rows = []
    for i, path in enumerate(photos, 1):
        rgb = load_rgb(path)
        row = {"file": str(path.relative_to(args.src)), "faces": 0}
        if rgb is None:
            row["note"] = "unreadable" + (" (pip install pillow-heif)" if path.suffix.lower() == ".heic" else "")
            rows.append(row)
            continue
        h, w = rgb.shape[:2]
        found = [f for f in faces.get(rgb[:, :, ::-1].copy())
                 if (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) / (w * h) >= args.min_face]
        row["faces"] = len(found)
        if found:
            f = max(found, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            face = crop(rgb, f.bbox)
            gray = cv2.cvtColor(cv2.resize(face, (256, 256)), cv2.COLOR_RGB2GRAY)
            pitch, yaw, _ = f.pose
            row.update(
                size=(f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) / (w * h),
                sharp=float(np.log1p(cv2.Laplacian(gray, cv2.CV_64F).var())),
                eyes=eye_ratio(f.landmark_3d_68),
                frontal=-float(np.hypot(yaw, pitch)),
                det=float(f.det_score),
            )
            if face_model:
                row["face_model"] = face_model(face)
        if aesthetic:
            row["aesthetic"] = aesthetic(rgb)
        rows.append(row)
        print(f"[{i}/{len(photos)}] {row['file']}  faces={row['faces']}", flush=True)

    # Percentile per signal, weighted mean over the signals each photo has.
    used = [k for k in WEIGHTS if any(k in r for r in rows)]
    pct = {k: percentile([r.get(k) for r in rows]) for k in used}
    for j, r in enumerate(rows):
        parts = [(WEIGHTS[k], pct[k][j]) for k in used if pct[k][j] is not None]
        r["score"] = round(100 * sum(w * p for w, p in parts) / sum(w for w, _ in parts), 1) if r["faces"] and parts else None

    ranked = sorted((r for r in rows if r["score"] is not None), key=lambda r: -r["score"])
    args.dst.mkdir(parents=True, exist_ok=True)
    width = len(str(len(ranked)))
    for n, r in enumerate(ranked):
        b = n * args.buckets // len(ranked)
        folder = args.dst / f"{b + 1}_{'best' if b == 0 else 'worst' if b == args.buckets - 1 else 'mid'}"
        folder.mkdir(exist_ok=True)
        r["rank"] = n + 1
        r["out"] = str(folder / f"{n + 1:0{width}d}_{r['score']:.0f}_{Path(r['file']).name}")
        shutil.copy2(args.src / r["file"], r["out"])
    for r in rows:
        if r["score"] is None:
            (args.dst / "no_face").mkdir(exist_ok=True)
            r["out"] = str(args.dst / "no_face" / Path(r["file"]).name)
            if not r.get("note", "").startswith("unreadable"):
                shutil.copy2(args.src / r["file"], r["out"])

    cols = ["rank", "score", "file", "faces", *used, "det", "note", "out"]
    with open(args.dst / "scores.csv", "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        wr.writeheader()
        wr.writerows(sorted(rows, key=lambda r: r.get("rank") or 1e9))
    print(f"\n{len(ranked)} ranked into {args.buckets} folders, {len(rows) - len(ranked)} without a usable face."
          f"\nScores: {args.dst / 'scores.csv'}")


if __name__ == "__main__":
    main()
