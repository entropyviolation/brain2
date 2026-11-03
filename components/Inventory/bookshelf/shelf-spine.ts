/**
 * components/Inventory/bookshelf/shelf-spine.ts — Binding color and texture
 *
 * The cover photograph belongs on the front board only. A spine is a
 * generated cloth, paper, or leather binding: grain, a dark hinge, a light
 * along the front joint, head and tail bands, and a faint title panel.
 * When a cover is already loaded, the cloth color is sampled from it.
 * Thickness is decided in `shelf-books`, not here.
 */

export type BookSurface = "front" | "spine" | "back" | "pages" | "board"

export type SpineKind = "cloth" | "paper" | "leather"

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface SpineTones {
  cloth: string
  shade: string
  band: string
  headband: string
  ink: string
}

/** The photograph is the front. Spine, back, pages, and board edges never take it. */
export function surfaceTakesCoverArt(surface: BookSurface): boolean {
  return surface === "front"
}

export function spineKind(seed: number): SpineKind {
  const kinds = ["cloth", "paper", "leather"] as const
  return kinds[Math.abs(seed) % 3]
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", ""), 16)
  if (!Number.isFinite(n)) return { r: 90, g: 62, b: 46 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex(rgb: Rgb): string {
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`
}

/**
 * A saturation-weighted color from RGBA pixels. White margins and black
 * bars weigh less, and the middle of the picture weighs more, so a jacket
 * illustration wins over its border. A cover that is truly white or black
 * still returns that color.
 */
export function sampleCoverColor(data: Uint8ClampedArray, width: number, height: number): Rgb | null {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return null
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 800)))
  let r = 0
  let g = 0
  let b = 0
  let wsum = 0
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < 128) continue
      const pr = data[i]
      const pg = data[i + 1]
      const pb = data[i + 2]
      const max = Math.max(pr, pg, pb)
      const min = Math.min(pr, pg, pb)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = (pr + pg + pb) / (3 * 255)
      const margin = lum > 0.92 || lum < 0.06 ? 0.15 : 1
      const dx = (x + 0.5) / width - 0.5
      const dy = (y + 0.5) / height - 0.5
      const center = Math.max(0, 1 - Math.hypot(dx, dy) * 1.15)
      const weight = (0.2 + sat * 0.8) * margin * (0.35 + 0.65 * center) * (a / 255)
      r += pr * weight
      g += pg * weight
      b += pb * weight
      wsum += weight
    }
  }
  if (wsum <= 0) return null
  return { r: Math.round(r / wsum), g: Math.round(g / wsum), b: Math.round(b / wsum) }
}

/** Draw the cover into a small bitmap and sample it. A tainted canvas returns null. */
export function readCoverColor(image: CanvasImageSource): Rgb | null {
  const canvas = document.createElement("canvas")
  const width = 32
  const height = 48
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext("2d", { willReadFrequently: true })
  if (!g) return null
  try {
    g.drawImage(image, 0, 0, width, height)
    return sampleCoverColor(g.getImageData(0, 0, width, height).data, width, height)
  } catch {
    return null
  }
}

export function spineTones(rgb: Rgb): SpineTones {
  const lum = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  const bandRgb = lum > 140 ? scaleRgb(rgb, 0.82) : mixRgb(rgb, { r: 255, g: 248, b: 236 }, 0.22)
  const bandLum = (bandRgb.r * 299 + bandRgb.g * 587 + bandRgb.b * 114) / 1000
  return {
    cloth: rgbToHex(rgb),
    shade: rgbToHex(scaleRgb(rgb, 0.52)),
    band: rgbToHex(bandRgb),
    headband: rgbToHex(lum > 150 ? mixRgb(rgb, { r: 88, g: 36, b: 40 }, 0.42) : mixRgb(rgb, { r: 232, g: 214, b: 186 }, 0.4)),
    ink: bandLum > 150 ? "#2a2118" : "#f4ecdf",
  }
}

export function spineCanvas(opts: { title: string; cloth: string; seed: number; showTitle: boolean }): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  const w = 128
  const h = 512
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext("2d")
  if (!g) return canvas
  const rgb = hexToRgb(opts.cloth)
  const tones = spineTones(rgb)
  const kind = spineKind(opts.seed)
  const rand = mulberry32(opts.seed)

  g.fillStyle = tones.cloth
  g.fillRect(0, 0, w, h)
  drawGrain(g, kind, rand, w, h)
  drawJointLight(g, w, h)
  drawHeadTail(g, w, h, tones)
  if (kind === "leather") drawCords(g, w)
  drawTitlePanel(g, w, h, tones)
  if (opts.showTitle) drawSpineTitle(g, opts.title, w, h, tones.ink)
  return canvas
}

function scaleRgb(rgb: Rgb, t: number): Rgb {
  return { r: rgb.r * t, g: rgb.g * t, b: rgb.b * t }
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const s = 1 - t
  return { r: a.r * s + b.r * t, g: a.g * s + b.g * t, b: a.b * s + b.b * t }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Canvas x runs from the back hinge to the front joint. Y runs head to tail. */
function drawGrain(g: CanvasRenderingContext2D, kind: SpineKind, rand: () => number, w: number, h: number) {
  if (kind === "leather") {
    for (let i = 0; i < 70; i++) {
      const x = rand() * w
      const y = rand() * h
      g.fillStyle = rand() > 0.5 ? "rgba(255, 248, 236, 0.05)" : "rgba(28, 14, 8, 0.08)"
      g.beginPath()
      g.ellipse(x, y, 2 + rand() * 7, 1 + rand() * 3, rand(), 0, Math.PI * 2)
      g.fill()
    }
    return
  }
  const stride = kind === "paper" ? 2 : 3
  for (let x = 0; x < w; x += stride) {
    const shade = rand() > 0.55
    g.strokeStyle = shade ? "rgba(28, 16, 10, 0.14)" : "rgba(255, 248, 236, 0.1)"
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x + 0.5, 0)
    g.lineTo(x + 0.5 + (rand() - 0.5) * 2, h)
    g.stroke()
  }
  if (kind === "paper") {
    g.strokeStyle = "rgba(90, 70, 48, 0.06)"
    for (let y = 6; y < h; y += 5) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y + (rand() - 0.5) * 2)
      g.stroke()
    }
  }
}

function drawJointLight(g: CanvasRenderingContext2D, w: number, h: number) {
  const across = g.createLinearGradient(0, 0, w, 0)
  across.addColorStop(0, "rgba(24, 12, 8, 0.5)")
  across.addColorStop(0.14, "rgba(24, 12, 8, 0.08)")
  across.addColorStop(0.62, "rgba(255, 248, 236, 0)")
  across.addColorStop(0.84, "rgba(255, 248, 236, 0.28)")
  across.addColorStop(0.94, "rgba(255, 248, 236, 0.04)")
  across.addColorStop(1, "rgba(24, 12, 8, 0.55)")
  g.fillStyle = across
  g.fillRect(0, 0, w, h)
  const along = g.createLinearGradient(0, 0, 0, h)
  along.addColorStop(0, "rgba(24, 12, 8, 0.22)")
  along.addColorStop(0.07, "rgba(24, 12, 8, 0)")
  along.addColorStop(0.93, "rgba(24, 12, 8, 0)")
  along.addColorStop(1, "rgba(24, 12, 8, 0.26)")
  g.fillStyle = along
  g.fillRect(0, 0, w, h)
}

function drawHeadTail(g: CanvasRenderingContext2D, w: number, h: number, tones: SpineTones) {
  const band = (y: number) => {
    g.fillStyle = tones.shade
    g.fillRect(10, y, w - 20, 14)
    g.fillStyle = tones.headband
    g.fillRect(12, y + 3, w - 24, 3)
    g.fillStyle = "rgba(255, 248, 236, 0.55)"
    g.fillRect(12, y + 6, w - 24, 1)
    g.fillStyle = tones.headband
    g.fillRect(12, y + 8, w - 24, 3)
  }
  band(22)
  band(h - 36)
}

function drawCords(g: CanvasRenderingContext2D, w: number) {
  for (const y of [108, 392]) {
    g.fillStyle = "rgba(255, 248, 236, 0.16)"
    g.fillRect(8, y, w - 16, 2)
    g.fillStyle = "rgba(24, 12, 8, 0.28)"
    g.fillRect(8, y + 2, w - 16, 2)
  }
}

function drawTitlePanel(g: CanvasRenderingContext2D, w: number, h: number, tones: SpineTones) {
  const x = 16
  const y = Math.round(h * 0.4)
  const pw = w - 32
  const ph = Math.round(h * 0.11)
  g.fillStyle = tones.band
  g.globalAlpha = 0.55
  g.fillRect(x, y, pw, ph)
  g.globalAlpha = 0.45
  g.strokeStyle = tones.shade
  g.lineWidth = 1
  g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1)
  g.globalAlpha = 1
}

function drawSpineTitle(g: CanvasRenderingContext2D, title: string, w: number, h: number, ink: string) {
  const text = title.trim()
  if (!text) return
  g.fillStyle = ink
  g.textAlign = "center"
  g.textBaseline = "middle"
  let size = 42
  const maxW = h * 0.72
  g.font = `600 ${size}px Palatino, Georgia, serif`
  while (size > 16 && g.measureText(text).width > maxW) {
    size -= 2
    g.font = `600 ${size}px Palatino, Georgia, serif`
  }
  g.save()
  g.translate(w / 2, h * 0.46)
  g.rotate(-Math.PI / 2)
  g.fillText(text, 0, 0)
  g.restore()
}
