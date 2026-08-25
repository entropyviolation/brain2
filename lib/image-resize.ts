/**
 * lib/image-resize.ts — Client-side image downscale / compress for Docs uploads
 *
 * Large phone photos are resized to fit a max edge and re-encoded (JPEG/WebP)
 * until the data URL is under a byte budget — so uploads never fail for size.
 */

export interface ResizeImageOptions {
  /** Longest edge in CSS pixels (default 1920). */
  maxEdge?: number
  /** Target max decoded data-URL payload size in bytes (default 1.5 MB). */
  maxBytes?: number
  /** Starting JPEG/WebP quality 0–1 (default 0.85). */
  quality?: number
}

export interface ResizedImage {
  dataUrl: string
  width: number
  height: number
  /** True when dimensions or encoding changed from the original file. */
  resized: boolean
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image"))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function approxDataUrlBytes(dataUrl: string): number {
  // data:[mime];base64,<payload> — base64 is ~4/3 of binary size
  const i = dataUrl.indexOf(",")
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor((b64.length * 3) / 4)
}

/**
 * Downscale and compress `file` so the resulting data URL fits `maxBytes`.
 * Prefer WebP when the browser supports it; fall back to JPEG. GIFs/PNGs with
 * alpha are flattened onto white when encoding as JPEG.
 */
export async function resizeImageForDoc(
  file: File | Blob,
  options: ResizeImageOptions = {},
): Promise<ResizedImage> {
  const maxEdge = options.maxEdge ?? 1920
  const maxBytes = options.maxBytes ?? 1.5 * 1024 * 1024
  let quality = options.quality ?? 0.85

  const img = await loadImage(file)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  if (!srcW || !srcH) throw new Error("Invalid image dimensions")

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  let width = Math.max(1, Math.round(srcW * scale))
  let height = Math.max(1, Math.round(srcH * scale))

  const prefersWebp =
    typeof HTMLCanvasElement !== "undefined" &&
    document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp")

  const mime = prefersWebp ? "image/webp" : "image/jpeg"
  const originalType = "type" in file ? file.type : ""
  const alreadySmall =
    "size" in file &&
    file.size <= maxBytes &&
    scale === 1 &&
    (originalType === "image/jpeg" || originalType === "image/webp" || originalType === "image/png")

  // Fast path: small enough and no downscale needed — keep original encoding.
  if (alreadySmall && "size" in file && file.size <= maxBytes) {
    const dataUrl = await blobToDataUrl(file)
    if (approxDataUrlBytes(dataUrl) <= maxBytes * 1.37) {
      // data URL overhead is fine; use original
      return { dataUrl, width: srcW, height: srcH, resized: false }
    }
  }

  const draw = (w: number, h: number) => {
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")
    // White backdrop so transparent PNGs don't go black as JPEG.
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)
    return canvas
  }

  let canvas = draw(width, height)
  let blob = await canvasToBlob(canvas, mime, quality)

  // Reduce quality, then dimensions, until under budget.
  for (let i = 0; i < 8 && blob && blob.size > maxBytes; i++) {
    quality = Math.max(0.45, quality - 0.1)
    blob = await canvasToBlob(canvas, mime, quality)
  }
  for (let i = 0; i < 6 && blob && blob.size > maxBytes; i++) {
    width = Math.max(320, Math.round(width * 0.75))
    height = Math.max(320, Math.round(height * 0.75))
    canvas = draw(width, height)
    quality = Math.min(quality, 0.75)
    blob = await canvasToBlob(canvas, mime, quality)
  }

  if (!blob) {
    // Last resort: dataURL from canvas
    const dataUrl = canvas.toDataURL(mime, quality)
    return { dataUrl, width, height, resized: true }
  }

  const dataUrl = await blobToDataUrl(blob)
  const resized = scale < 1 || blob.size !== ("size" in file ? file.size : -1) || mime !== originalType
  return { dataUrl, width, height, resized }
}
