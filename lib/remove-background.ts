/**
 * lib/remove-background.ts — Lightweight client-side background remover
 *
 * Orbs/gems: flood from the four corners on a near-uniform studio ground.
 * Photographs (today's friend): seed only the typical border colour, stop at
 * a colour step so fur is not eaten, keep the largest interior subject. Tight
 * crops with no backdrop are left alone. No network / model required.
 *
 * Batch gem processing (`scripts/process-gems.py`) mirrors this knockout, then
 * splits plural contact sheets with `extractConnectedComponents`.
 */

export type RemoveBackgroundSubject = "orb" | "photo"

export interface RemoveBackgroundOptions {
  /** Colour distance (0-441) under which a pixel is treated as background. */
  threshold?: number
  /** Output square size in px. */
  size?: number
  /**
   * `orb` (default) — studio cutouts, flood from corners.
   * `photo` — animal / snapshot: seed only the typical border colour, stop at
   * edges, keep the largest interior subject. Aborts to the original if the
   * frame is already a tight crop.
   */
  subject?: RemoveBackgroundSubject
}

export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

export interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  kept: number
}

export interface ConnectedComponent {
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
}

export function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** Knock out a near-uniform background in place. Returns the opaque bounding box.
 * Flood-fills from the four corners so interior highlights are not punched out.
 */
export function knockOutUniformBackground(buffer: PixelBuffer, threshold = 60): ContentBounds {
  const { width: w, height: h, data } = buffer
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]
  let br = 0
  let bg = 0
  let bb = 0
  for (const [cx, cy] of corners) {
    const idx = (cy * w + cx) * 4
    br += data[idx]
    bg += data[idx + 1]
    bb += data[idx + 2]
  }
  br /= corners.length
  bg /= corners.length
  bb /= corners.length

  const reach = threshold * 1.6
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  for (const [cx, cy] of corners) {
    const i = cy * w + cx
    seen[i] = 1
    stack.push(i)
  }

  while (stack.length) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i / w) | 0
    const idx = i * 4
    const dist = colorDistance(data[idx], data[idx + 1], data[idx + 2], br, bg, bb)
    if (dist >= reach) continue
    if (dist < threshold) {
      data[idx + 3] = 0
    } else {
      const t = (dist - threshold) / (threshold * 0.6)
      data[idx + 3] = Math.round(Math.max(0, Math.min(1, t)) * data[idx + 3])
    }
    const next = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ]
    for (const ni of next) {
      if (ni < 0 || seen[ni]) continue
      seen[ni] = 1
      stack.push(ni)
    }
  }

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let kept = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (data[idx + 3] > 10) {
        kept++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (kept < w * h * 0.01 || maxX <= minX || maxY <= minY) {
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, kept }
  }
  return { minX, minY, maxX, maxY, kept }
}

function medianChannel(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = (sorted.length / 2) | 0
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
}

function isBorder(x: number, y: number, w: number, h: number, band: number): boolean {
  return x < band || y < band || x >= w - band || y >= h - band
}

function contentBoundsFromAlpha(buffer: PixelBuffer, minAlpha = 10): ContentBounds {
  const { width: w, height: h, data } = buffer
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let kept = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > minAlpha) {
        kept++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (kept < w * h * 0.01 || maxX <= minX || maxY <= minY) {
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, kept }
  }
  const padX = Math.max(1, Math.round(w * 0.02))
  const padY = Math.max(1, Math.round(h * 0.02))
  return {
    minX: Math.max(0, minX - padX),
    minY: Math.max(0, minY - padY),
    maxX: Math.min(w - 1, maxX + padX),
    maxY: Math.min(h - 1, maxY + padY),
    kept,
  }
}

function inCenterEllipse(x: number, y: number, w: number, h: number): boolean {
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const rx = Math.max(2, w * 0.4)
  const ry = Math.max(2, h * 0.42)
  const nx = (x - cx) / rx
  const ny = (y - cy) / ry
  return nx * nx + ny * ny <= 1
}

/**
 * Knock out a photograph backdrop so a creature remains.
 * The middle ellipse is the subject and is never punched out. Background grows
 * from typical border colour and stops at a colour step. Uniform dark/light
 * studio grounds (the lamb case) flood more freely. Tight crops are left alone.
 */
export function knockOutPhotoBackground(buffer: PixelBuffer, threshold = 40): ContentBounds {
  const { width: w, height: h, data } = buffer
  const original = new Uint8ClampedArray(data)
  const restore = () => {
    data.set(original)
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, kept: w * h } satisfies ContentBounds
  }

  const band = Math.max(2, Math.round(Math.min(w, h) * 0.04))
  const borderR: number[] = []
  const borderG: number[] = []
  const borderB: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBorder(x, y, w, h, band)) continue
      const i = (y * w + x) * 4
      borderR.push(data[i]!)
      borderG.push(data[i + 1]!)
      borderB.push(data[i + 2]!)
    }
  }
  const br = medianChannel(borderR)
  const bg = medianChannel(borderG)
  const bb = medianChannel(borderB)
  let borderSpread = 0
  for (let i = 0; i < borderR.length; i++) {
    borderSpread += colorDistance(borderR[i]!, borderG[i]!, borderB[i]!, br, bg, bb)
  }
  borderSpread /= Math.max(borderR.length, 1)
  const borderLum = 0.2126 * br + 0.7152 * bg + 0.0722 * bb
  const studioGround = borderSpread < 32 && (borderLum < 42 || borderLum > 210)

  const innerR: number[] = []
  const innerG: number[] = []
  const innerB: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inCenterEllipse(x, y, w, h)) continue
      const i = (y * w + x) * 4
      innerR.push(data[i]!)
      innerG.push(data[i + 1]!)
      innerB.push(data[i + 2]!)
    }
  }
  const ir = medianChannel(innerR)
  const ig = medianChannel(innerG)
  const ib = medianChannel(innerB)
  let interiorSpread = 0
  for (let i = 0; i < innerR.length; i++) {
    interiorSpread += colorDistance(innerR[i]!, innerG[i]!, innerB[i]!, ir, ig, ib)
  }
  interiorSpread /= Math.max(innerR.length, 1)
  const subjectContrast = colorDistance(br, bg, bb, ir, ig, ib)
  const studio = studioGround && subjectContrast > 40
  if (!studio && subjectContrast < 22 && interiorSpread < 18) return restore()

  const match = studio ? Math.max(threshold, 58) : threshold
  const seedMatch = studio ? match + 10 : Math.max(28, match)
  const stepMax = studio ? 36 : Math.max(14, Math.round(match * 0.55))
  const growLimit = studio ? match * 1.55 : match * 1.2
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBorder(x, y, w, h, band)) continue
      if (inCenterEllipse(x, y, w, h)) continue
      const i = y * w + x
      const idx = i * 4
      if (colorDistance(data[idx]!, data[idx + 1]!, data[idx + 2]!, br, bg, bb) > seedMatch) continue
      seen[i] = 1
      stack.push(i)
    }
  }
  if (stack.length < 8) return restore()

  while (stack.length) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i / w) | 0
    if (inCenterEllipse(x, y, w, h)) continue
    const idx = i * 4
    const pr = data[idx]!
    const pg = data[idx + 1]!
    const pb = data[idx + 2]!
    if (colorDistance(pr, pg, pb, br, bg, bb) >= match) continue
    data[idx + 3] = 0
    const next = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ]
    for (const ni of next) {
      if (ni < 0 || seen[ni]) continue
      const nx = ni % w
      const ny = (ni / w) | 0
      if (inCenterEllipse(nx, ny, w, h)) continue
      const nidx = ni * 4
      const nr = data[nidx]!
      const ng = data[nidx + 1]!
      const nb = data[nidx + 2]!
      if (colorDistance(nr, ng, nb, pr, pg, pb) > stepMax) continue
      if (colorDistance(nr, ng, nb, br, bg, bb) > growLimit) continue
      seen[ni] = 1
      stack.push(ni)
    }
  }

  const blobs = extractConnectedComponents(buffer, { minArea: 8, minAreaFraction: 0.001, minFill: 0 })
  const subject = blobs.filter((blob) => {
    const cx = (blob.minX + blob.maxX) / 2
    const cy = (blob.minY + blob.maxY) / 2
    return inCenterEllipse(cx, cy, w, h) || (blob.minX <= w / 2 && blob.maxX >= w / 2 && blob.minY <= h / 2 && blob.maxY >= h / 2)
  })
  const keepBlobs = subject.length > 0 ? subject : blobs
  if (keepBlobs.length === 0) return restore()
  const largest = keepBlobs.reduce((a, b) => (a.area >= b.area ? a : b))
  const minKeep = Math.max(16, Math.round(largest.area * 0.12))
  const keptSet = keepBlobs.filter((b) => b.area >= minKeep)
  const inside = (x: number, y: number) => {
    for (const blob of keptSet) {
      if (x >= blob.minX && x <= blob.maxX && y >= blob.minY && y <= blob.maxY) return true
    }
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (data[idx + 3]! < 12) continue
      if (inCenterEllipse(x, y, w, h)) continue
      if (!inside(x, y)) data[idx + 3] = 0
    }
  }

  const bounds = contentBoundsFromAlpha(buffer)
  const fraction = bounds.kept / (w * h)
  if (fraction < 0.04) return restore()
  return bounds
}

/**
 * 4-connected blobs of remaining foreground. Used to split gem contact sheets
 * into per-stone cutouts when the stones sit apart on a knocked-out ground.
 */
export function extractConnectedComponents(
  buffer: PixelBuffer,
  options: {
    minArea?: number
    minAreaFraction?: number
    alphaMin?: number
    minFill?: number
    maxAspect?: number
  } = {},
): ConnectedComponent[] {
  const { width: w, height: h, data } = buffer
  const alphaMin = options.alphaMin ?? 10
  const minArea = Math.max(
    options.minArea ?? 64,
    Math.floor(w * h * (options.minAreaFraction ?? 0.0015)),
  )
  const minFill = options.minFill ?? 0
  const maxAspect = options.maxAspect ?? 99
  const seen = new Uint8Array(w * h)
  const out: ConnectedComponent[] = []

  const opaque = (x: number, y: number) => data[(y * w + x) * 4 + 3] > alphaMin

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x
      if (seen[start] || !opaque(x, y)) continue
      let minX = x
      let minY = y
      let maxX = x
      let maxY = y
      let area = 0
      const stack = [start]
      seen[start] = 1
      while (stack.length) {
        const i = stack.pop() as number
        const cx = i % w
        const cy = (i / w) | 0
        area++
        if (cx < minX) minX = cx
        if (cy < minY) minY = cy
        if (cx > maxX) maxX = cx
        if (cy > maxY) maxY = cy
        const neighbors = [i - 1, i + 1, i - w, i + w]
        const valid = [cx > 0, cx < w - 1, cy > 0, cy < h - 1]
        for (let n = 0; n < 4; n++) {
          if (!valid[n]) continue
          const ni = neighbors[n]
          const nx = ni % w
          const ny = (ni / w) | 0
          if (seen[ni] || !opaque(nx, ny)) continue
          seen[ni] = 1
          stack.push(ni)
        }
      }
      if (area < minArea) continue
      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      const aspect = bw / Math.max(bh, 1)
      const fill = area / Math.max(bw * bh, 1)
      if (aspect > maxAspect || aspect < 1 / maxAspect || fill < minFill) continue
      out.push({ minX, minY, maxX, maxY, area })
    }
  }

  return out.sort((a, b) => a.minY - b.minY || a.minX - b.minX)
}

export async function removeBackground(
  file: File | Blob,
  options: RemoveBackgroundOptions = {},
): Promise<string> {
  const subject = options.subject ?? "orb"
  const threshold = options.threshold ?? (subject === "photo" ? 40 : 60)
  const outSize = options.size ?? (subject === "photo" ? 384 : 256)

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const maxEdge = subject === "photo" ? 560 : Math.max(srcW, srcH)
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH, 1))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch {
    return dataUrl
  }
  const buffer = { width: w, height: h, data: imageData.data }
  const bounds =
    subject === "photo"
      ? knockOutPhotoBackground(buffer, threshold)
      : knockOutUniformBackground(buffer, threshold)
  ctx.putImageData(imageData, 0, 0)

  const cropW = bounds.maxX - bounds.minX + 1
  const cropH = bounds.maxY - bounds.minY + 1
  const side = Math.max(cropW, cropH)

  const out = document.createElement("canvas")
  out.width = outSize
  out.height = outSize
  const octx = out.getContext("2d")
  if (!octx) return canvas.toDataURL("image/png")
  octx.imageSmoothingQuality = "high"
  const outScale = outSize / side
  const drawW = cropW * outScale
  const drawH = cropH * outScale
  const dx = (outSize - drawW) / 2
  const dy = (outSize - drawH) / 2
  octx.drawImage(canvas, bounds.minX, bounds.minY, cropW, cropH, dx, dy, drawW, drawH)

  return out.toDataURL("image/png")
}
