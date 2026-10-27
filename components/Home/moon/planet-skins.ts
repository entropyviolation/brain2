/**
 * components/Home/planet-skins.ts — Photographic globes for the solar chart
 *
 * Cylindrical maps in `public/planets/` are projected onto a disk. The wide
 * chart keeps a 96px buffer. A close-up or facts zoom passes a pixel size
 * and is painted at 384px, sampled from the source photograph, so albedo
 * detail survives when the globe fills the glass. The photographs stay.
 * Shading rounds them: the Sun darkens toward the limb, a twilight band
 * softens each planet's terminator, Earth keeps a thin blue rim and a
 * darker night, the Moon stays harsh, and Saturn's rings shadow the lit
 * half. `spinTurns` (0–1) shifts texture longitude under that light and
 * defaults to 0.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { SATURN_RING } from "@/lib/solar-system"

export type GlobeLight = {
  x: number
  y: number
  z: number
  emissive?: boolean
  /** 0–1 texture longitude. 0 leaves the map unshifted. */
  spinTurns?: number
}

const MAPS: Record<string, string> = {
  sun: "/planets/sun.jpg",
  mercury: "/planets/mercury.jpg",
  venus: "/planets/venus.jpg",
  earth: "/planets/earth.jpg",
  moon: "/planets/moon.jpg",
  mars: "/planets/mars.jpg",
  jupiter: "/planets/jupiter.jpg",
  saturn: "/planets/saturn.jpg",
  uranus: "/planets/uranus.jpg",
  neptune: "/planets/neptune.jpg",
}

const GLOBE = 96
/** Texture edge for a close-up or facts zoom. The wide chart stays at `GLOBE`. */
export const CLOSE_GLOBE = 384
const images = new Map<string, Promise<ImageData>>()
const painted = new Map<string, string>()

function globePixels(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return GLOBE
  const px = Math.round(n)
  if (px < 2) return GLOBE
  return px
}

/** A number paints every body. A map overrides one id. Omitted ids stay at 96. */
function pixelsFor(id: string, hint: number | Record<string, number> | undefined): number {
  if (typeof hint === "number") return globePixels(hint)
  if (hint && typeof hint[id] === "number") return globePixels(hint[id])
  return GLOBE
}

function pixelSignature(hint: number | Record<string, number> | undefined): string {
  if (hint == null) return ""
  if (typeof hint === "number") return String(globePixels(hint))
  return Object.keys(hint)
    .sort()
    .map((id) => `${id}:${globePixels(hint[id])}`)
    .join("|")
}

function loadImageData(src: string): Promise<ImageData> {
  const cached = images.get(src)
  if (cached) return cached
  const pending = new Promise<ImageData>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("no canvas"))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }
    img.onerror = () => reject(new Error(src))
    img.src = src
  })
  images.set(src, pending)
  return pending
}

function sample(data: ImageData, u: number, v: number): [number, number, number, number] {
  const { width, height, data: px } = data
  const uu = ((u % 1) + 1) % 1
  const vv = Math.max(0, Math.min(0.9999, v))
  const x = uu * (width - 1)
  const y = vv * (height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0
  const at = (xx: number, yy: number) => {
    const i = (yy * width + xx) * 4
    return [px[i], px[i + 1], px[i + 2], px[i + 3]] as [number, number, number, number]
  }
  const a = at(x0, y0)
  const b = at(x1, y0)
  const c = at(x0, y1)
  const d = at(x1, y1)
  const mix = (i: number) =>
    (a[i] * (1 - tx) + b[i] * tx) * (1 - ty) + (c[i] * (1 - tx) + d[i] * tx) * ty
  return [mix(0), mix(1), mix(2), mix(3)]
}

/** Screen vector toward the Sun (y down) → globe light (y up). */
export function sunLight(screenX: number, screenY: number): GlobeLight {
  const len = Math.hypot(screenX, screenY) || 1
  const x = screenX / len
  const y = -screenY / len
  const z = 0.62
  const n = Math.hypot(x, y, z)
  return { x: x / n, y: y / n, z: z / n }
}

function wrap01(n: number): number {
  return ((n % 1) + 1) % 1
}

/** Same longitude for the cache key and the sample. 0 leaves the map unshifted. */
function bucketSpin(spin: number | undefined): number {
  const turns = wrap01(spin ?? 0)
  const q = Math.round(turns * 100) / 100
  return q >= 1 ? 0 : q
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function clampByte(n: number): number {
  if (n < 0) return 0
  if (n > 255) return 255
  return n
}

type BodyShade = "sun" | "earth" | "moon" | "rocky" | "hazy" | "saturn"

function bodyShade(id: string): BodyShade {
  if (id === "sun" || id === "earth" || id === "moon" || id === "saturn") return id
  if (id === "venus" || id === "jupiter" || id === "uranus" || id === "neptune") return "hazy"
  return "rocky"
}

/** Visible-light limb darkening. The limb is dimmer and a little warmer. */
function sunLimb(mu: number): [number, number, number] {
  const ld = Math.max(0.3, 1 - 0.46 * (1 - mu) - 0.18 * (1 - mu * mu))
  const warm = (1 - mu) * 0.055
  return [ld + warm, ld, Math.max(0.24, ld - warm)]
}

/**
 * Soft band where the rings cross the lit half. The rings stay in the
 * sprite's equatorial plane; the band shifts a little away from the Sun.
 */
function ringShadow(ny: number, nz: number, light: GlobeLight, day: number): number {
  const open = Math.min(1, Math.abs(light.y) / 0.22)
  if (open < 0.08) return 0
  const shift = Math.max(-0.1, Math.min(0.1, -light.y * 0.18))
  const band = 1 - smoothstep(0.012, 0.072, Math.abs(ny - shift))
  if (band <= 0) return 0
  const lit = smoothstep(0.08, 0.5, day)
  return band * open * (0.65 + 0.35 * nz) * lit
}

/** Night land is a warm gradient. The day map has no city-light plate. */
function earthNight(rgb: [number, number, number, number], v: number, night: number): [number, number, number] {
  if (night < 0.12) return [0, 0, 0]
  const r = rgb[0]
  const g = rgb[1]
  const b = rgb[2]
  if (r > 206 && g > 206 && b > 200) return [0, 0, 0]
  if (b > r + 12 && b > g - 2) return [0, 0, 0]
  const land = Math.max(0, Math.min(1, (r * 0.45 + g * 0.55 - b) / 150))
  if (land < 0.18) return [0, 0, 0]
  const lat = Math.abs(v - 0.5)
  const belt = Math.exp(-((lat - 0.15) ** 2) / 0.014)
  const uneven = 0.7 + 0.3 * Math.min(1, Math.abs(r - g) / 36)
  const glow = land * belt * night * night * uneven
  return [glow * 34, glow * 22, glow * 9]
}

function paintGlobe(id: string, map: ImageData, light: GlobeLight, pixels = GLOBE): string {
  const size = globePixels(pixels)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  const out = ctx.createImageData(size, size)
  const kind = bodyShade(id)
  const spin = bucketSpin(light.spinTurns)
  const sun = kind === "sun" || light.emissive === true
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1
      const ny = 1 - ((y + 0.5) / size) * 2
      const r2 = nx * nx + ny * ny
      const i = (y * size + x) * 4
      if (r2 > 1) continue
      const nz = Math.sqrt(1 - r2)
      const lon = Math.atan2(nx, nz)
      const lat = Math.asin(ny)
      const u = lon / (Math.PI * 2) + 0.5 + spin
      const v = 0.5 - lat / Math.PI
      const rgb = sample(map, u, v)
      if (sun) {
        const limb = sunLimb(nz)
        out.data[i] = clampByte(rgb[0] * limb[0])
        out.data[i + 1] = clampByte(rgb[1] * limb[1])
        out.data[i + 2] = clampByte(rgb[2] * limb[2])
        out.data[i + 3] = 255
        continue
      }
      const ndotl = nx * light.x + ny * light.y + nz * light.z
      const day = kind === "moon" ? smoothstep(-0.025, 0.055, ndotl) : smoothstep(-0.17, 0.2, ndotl)
      const ambient = kind === "moon" ? 0.022 : kind === "earth" ? 0.032 : 0.055
      let shade = ambient + (1 - ambient) * day
      if (kind === "moon") shade *= 0.93 + 0.07 * nz
      if (kind === "hazy" || kind === "saturn") {
        const edge = Math.pow(1 - nz, 2.2)
        const amount = id === "venus" ? 0.2 : 0.12
        shade *= 1 + edge * day * amount
      }
      if (kind === "saturn") shade *= 1 - 0.38 * ringShadow(ny, nz, light, day)
      let r = rgb[0] * shade
      let g = rgb[1] * shade
      let b = rgb[2] * shade
      if (kind === "earth") {
        const night = 1 - day
        const glow = earthNight(rgb, v, night)
        r += glow[0]
        g += glow[1]
        b += glow[2]
        const air = Math.pow(1 - nz, 5.4) * (0.05 + 0.95 * smoothstep(-0.2, 0.42, ndotl))
        r += air * 26
        g += air * 78
        b += air * 158
        const twilight = day * (1 - day) * 4
        r += twilight * 14
        g += twilight * 6
        b += twilight * 2
      }
      out.data[i] = clampByte(r)
      out.data[i + 1] = clampByte(g)
      out.data[i + 2] = clampByte(b)
      out.data[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas.toDataURL("image/png")
}

/** Saturn's rings in the equatorial plane of the sprite. `inner` and `outer` are fractions of the sprite width. */
function paintRing(color: ImageData, alpha: ImageData): string {
  const w = 360
  const h = 128
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  const out = ctx.createImageData(w, h)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const rx = w / 2 - 1
  const ry = h / 2 - 1
  const inner = SATURN_RING.inner / SATURN_RING.outer
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rad = Math.hypot((x - cx) / rx, (y - cy) / ry)
      if (rad > 1 || rad < inner) continue
      const u = (rad - inner) / (1 - inner)
      const rgb = sample(color, u, 0.5)
      const mask = sample(alpha, u, 0.5)
      const a = (mask[0] + mask[1] + mask[2]) / (255 * 3)
      const i = (y * w + x) * 4
      out.data[i] = rgb[0]
      out.data[i + 1] = rgb[1]
      out.data[i + 2] = rgb[2]
      out.data[i + 3] = Math.round(255 * Math.min(1, a * 1.15))
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas.toDataURL("image/png")
}

function cacheKey(id: string, light: GlobeLight, pixels = GLOBE): string {
  const spin = bucketSpin(light.spinTurns)
  const spinKey = spin === 0 ? "" : `:s${spin.toFixed(2)}`
  const sizeKey = pixels === GLOBE ? "" : `:p${pixels}`
  if (light.emissive) return `${id}:emit${spinKey}${sizeKey}`
  return `${id}:${light.x.toFixed(2)}:${light.y.toFixed(2)}:${light.z.toFixed(2)}${spinKey}${sizeKey}`
}

/**
 * Data-URL globes keyed by body id, plus `saturn-ring`. Missing until the maps load.
 * `pixels` is the texture edge. Omit it for the 96px chart buffer. A number
 * paints every body; a map paints only those ids large (close-up / facts).
 */
export function usePlanetSkins(
  lights: Record<string, GlobeLight>,
  pixels?: number | Record<string, number>,
): Record<string, string> {
  const [skins, setSkins] = useState<Record<string, string>>({})
  const lightsRef = useRef(lights)
  lightsRef.current = lights
  const pixelsRef = useRef(pixels)
  pixelsRef.current = pixels
  const signature = Object.entries(lights)
    .map(([id, light]) => cacheKey(id, light, pixelsFor(id, pixels)))
    .sort()
    .join("|")
  const sizes = pixelSignature(pixels)

  useEffect(() => {
    let cancel = false
    const next: Record<string, string> = {}
    const jobs = Object.entries(lightsRef.current).map(async ([id, light]) => {
      const src = MAPS[id]
      if (!src) return
      const px = pixelsFor(id, pixelsRef.current)
      const key = cacheKey(id, light, px)
      const hit = painted.get(key)
      if (hit) {
        next[id] = hit
        return
      }
      const map = await loadImageData(src)
      const url = paintGlobe(id, map, light, px)
      painted.set(key, url)
      next[id] = url
    })
    jobs.push(
      (async () => {
        const hit = painted.get("saturn-ring")
        if (hit) {
          next["saturn-ring"] = hit
          return
        }
        const [color, alpha] = await Promise.all([
          loadImageData("/planets/saturn-ring.jpg"),
          loadImageData("/planets/saturn-ring-alpha.gif"),
        ])
        const url = paintRing(color, alpha)
        painted.set("saturn-ring", url)
        next["saturn-ring"] = url
      })(),
    )
    void Promise.all(jobs)
      .then(() => {
        if (!cancel) setSkins({ ...next })
      })
      .catch(() => {
        if (!cancel) setSkins({ ...next })
      })
    return () => {
      cancel = true
    }
  }, [signature, sizes])

  return skins
}
