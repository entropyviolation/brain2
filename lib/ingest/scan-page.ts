/**
 * lib/ingest/scan-page.ts — Deskew / contrast for journal and receipt photos
 *
 * Canvas path (Electron renderer, browser Settings simulate). Node hub skips
 * geometry and lets Tesseract read the JPEG as-is.
 */
import { dataUrlToBytes, bytesToDataUrl } from "./bytes"

const MAX_EDGE = 1800

export interface ScanPage {
  dataUrl: string
  width: number
  height: number
  mime: string
}

function canvasAvailable(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function"
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode scan"))
    img.src = dataUrl
  })
}

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** High-contrast grayscale + small-angle deskew. Falls back to the original JPEG. */
export async function enhanceScan(dataUrl: string): Promise<ScanPage> {
  if (!dataUrl.startsWith("data:") || !canvasAvailable()) {
    return { dataUrl, width: 0, height: 0, mime: "image/jpeg" }
  }
  try {
    const img = await loadHtmlImage(dataUrl)
    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height
    if (!srcW || !srcH) return { dataUrl, width: srcW, height: srcH, mime: "image/jpeg" }

    const sized = fit(srcW, srcH, MAX_EDGE)
    const probe = fit(srcW, srcH, 720)
    const angle = estimateSkew(img, probe.width, probe.height)

    const canvas = document.createElement("canvas")
    canvas.width = sized.width
    canvas.height = sized.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return { dataUrl, width: srcW, height: srcH, mime: "image/jpeg" }

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, sized.width, sized.height)
    ctx.save()
    ctx.translate(sized.width / 2, sized.height / 2)
    ctx.rotate((-angle * Math.PI) / 180)
    ctx.drawImage(img, -sized.width / 2, -sized.height / 2, sized.width, sized.height)
    ctx.restore()

    stretchContrast(ctx, sized.width, sized.height)

    const next = canvas.toDataURL("image/jpeg", 0.84)
    return { dataUrl: next, width: sized.width, height: sized.height, mime: "image/jpeg" }
  } catch {
    return { dataUrl, width: 0, height: 0, mime: "image/jpeg" }
  }
}

function estimateSkew(img: HTMLImageElement, width: number, height: number): number {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return 0
  ctx.drawImage(img, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data
  const gray = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    gray[p] = (pixels[i]! * 0.299 + pixels[i + 1]! * 0.587 + pixels[i + 2]! * 0.114) | 0
  }

  let bestAngle = 0
  let bestScore = -1
  for (let angle = -8; angle <= 8; angle += 0.5) {
    const score = projectionVariance(gray, width, height, angle)
    if (score > bestScore) {
      bestScore = score
      bestAngle = angle
    }
  }
  return Math.abs(bestAngle) < 0.4 ? 0 : bestAngle
}

function projectionVariance(gray: Uint8Array, width: number, height: number, angle: number): number {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const bins = new Float64Array(height)
  const midX = width / 2
  const midY = height / 2
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 3) {
      const g = gray[y * width + x]!
      if (g > 210) continue
      const dx = x - midX
      const dy = y - midY
      const ry = Math.round(dx * sin + dy * cos + midY)
      if (ry >= 0 && ry < height) bins[ry] += 255 - g
    }
  }
  let mean = 0
  for (let i = 0; i < bins.length; i++) mean += bins[i]!
  mean /= bins.length || 1
  let varSum = 0
  for (let i = 0; i < bins.length; i++) {
    const d = bins[i]! - mean
    varSum += d * d
  }
  return varSum
}

function stretchContrast(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0
    if (g < min) min = g
    if (g > max) max = g
  }
  const span = Math.max(1, max - min)
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0
    const stretched = Math.max(0, Math.min(255, Math.round(((g - min) / span) * 255)))
    const ink = stretched > 188 ? 255 : Math.max(0, stretched - 12)
    data[i] = ink
    data[i + 1] = ink
    data[i + 2] = ink
  }
  ctx.putImageData(image, 0, 0)
}

/** JPEG-ify a data URL when canvas exists (PNG / WebP photos from Telegram documents). */
export async function asJpegDataUrl(dataUrl: string): Promise<string> {
  if (/^data:image\/jpeg/i.test(dataUrl)) return dataUrl
  if (!canvasAvailable()) return dataUrl
  try {
    const img = await loadHtmlImage(dataUrl)
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const sized = fit(w, h, MAX_EDGE)
    const canvas = document.createElement("canvas")
    canvas.width = sized.width
    canvas.height = sized.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return dataUrl
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, sized.width, sized.height)
    ctx.drawImage(img, 0, 0, sized.width, sized.height)
    return canvas.toDataURL("image/jpeg", 0.86)
  } catch {
    return dataUrl
  }
}

export function jpegBytesFromDataUrl(dataUrl: string): Uint8Array {
  return dataUrlToBytes(dataUrl)
}

export function jpegDataUrlFromBytes(bytes: Uint8Array): string {
  return bytesToDataUrl(bytes, "image/jpeg")
}
